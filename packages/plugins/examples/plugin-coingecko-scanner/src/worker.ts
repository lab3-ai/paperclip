import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { PluginJobContext } from "@paperclipai/plugin-sdk";
import {
  fetchTopCoins,
  fetchTrendingCoins,
  fetchWatchlistCoins,
} from "./coingecko.js";
import type {
  CoingeckoConfig,
  CoinData,
  ScanResult,
  ScanCompletePayload,
  PriceAlertPayload,
} from "./types.js";

const PLUGIN_NAME = "coingecko-scanner";

const plugin = definePlugin({
  async setup(ctx) {
    ctx.logger.info(`${PLUGIN_NAME} plugin setup complete`);

    ctx.jobs.register(
      "scan-coingecko",
      async (_job: PluginJobContext) => {
        // Guard: prevent concurrent scans
        const scanRunning = await ctx.state.get({
          scopeKind: "instance",
          stateKey: "scanRunning",
        });
        if (scanRunning) {
          ctx.logger.info("Scan already running, skipping this cycle");
          return;
        }

        try {
          await ctx.state.set(
            { scopeKind: "instance", stateKey: "scanRunning" },
            true,
          );

          const config =
            (await ctx.config.get()) as unknown as CoingeckoConfig;
          const hasCompanyId = !!config?.companyId;
          if (!hasCompanyId) {
            ctx.logger.warn(
              "companyId not configured — will scan and save state but skip events/issues",
            );
          }

          const scanMode = config?.scanMode ?? "top";
          const currency = config.currency ?? "usd";
          const topLimit = config.topCoinsLimit ?? 20;
          const watchlistIds = (config.watchlistCoinIds ?? "bitcoin,ethereum,solana")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);

          // 1. Fetch coins based on scanMode
          let coins: CoinData[] = [];
          try {
            if (scanMode === "top" || scanMode === "all") {
              const topCoins = await fetchTopCoins(
                ctx.http.fetch.bind(ctx.http),
                currency,
                topLimit,
              );
              coins.push(...topCoins);
            }
            if (scanMode === "trending" || scanMode === "all") {
              const trendingCoins = await fetchTrendingCoins(
                ctx.http.fetch.bind(ctx.http),
              );
              coins.push(...trendingCoins);
            }
            if (scanMode === "watchlist" || scanMode === "all") {
              const watchlistCoins = await fetchWatchlistCoins(
                ctx.http.fetch.bind(ctx.http),
                watchlistIds,
                currency,
              );
              coins.push(...watchlistCoins);
            }
          } catch (err: unknown) {
            const message =
              err instanceof Error ? err.message : String(err);
            if (message.includes("429")) {
              ctx.logger.warn(
                `CoinGecko rate limited, skipping this cycle`,
              );
              return;
            }
            throw err;
          }

          // Deduplicate by coin id (keep first occurrence)
          const seen = new Set<string>();
          coins = coins.filter((c) => {
            if (seen.has(c.id)) return false;
            seen.add(c.id);
            return true;
          });

          ctx.logger.info(
            `Fetched ${coins.length} unique coins (mode: ${scanMode})`,
          );

          // 2. Load previous scan for comparison
          const prevScan = (await ctx.state.get({
            scopeKind: "instance",
            stateKey: "last-scan",
          })) as ScanResult | null;

          const prevMap = new Map<string, CoinData>();
          if (prevScan?.coins) {
            for (const c of prevScan.coins) {
              prevMap.set(c.id, c);
            }
          }

          // 3. Compare and detect alerts
          const priceThreshold = config?.priceChangeThreshold ?? 10;
          const volumeThreshold = config?.volumeChangeThreshold ?? 50;
          let alertsTriggered = 0;

          // 4. Prepare scan result
          const scanResult: ScanResult = {
            scannedAt: new Date().toISOString(),
            scanMode,
            coins,
            alertsTriggered: 0,
          };

          // 5. Process alerts (only if companyId set and not first scan)
          if (hasCompanyId && prevScan !== null) {
            for (const coin of coins) {
              const prev = prevMap.get(coin.id);
              const priceChange = Math.abs(coin.priceChange24hPercent);

              let volumeChange: number | null = null;
              if (prev && prev.volume24h > 0) {
                volumeChange =
                  ((coin.volume24h - prev.volume24h) / prev.volume24h) *
                  100;
              }

              const priceAlert = priceChange >= priceThreshold;
              const volumeAlert =
                volumeChange !== null &&
                Math.abs(volumeChange) >= volumeThreshold;

              if (priceAlert || volumeAlert) {
                alertsTriggered++;
                const reasons: string[] = [];
                if (priceAlert) {
                  reasons.push(
                    `price ${coin.priceChange24hPercent > 0 ? "+" : ""}${coin.priceChange24hPercent.toFixed(1)}% (24h)`,
                  );
                }
                if (volumeAlert) {
                  reasons.push(
                    `volume ${volumeChange! > 0 ? "+" : ""}${volumeChange!.toFixed(1)}%`,
                  );
                }
                const reason = reasons.join(", ");

                // Emit alert event
                const alertPayload: PriceAlertPayload = {
                  coin,
                  priceChangePercent: coin.priceChange24hPercent,
                  volumeChangePercent: volumeChange,
                  reason,
                };
                await ctx.events.emit(
                  "coingecko-price-alert",
                  config.companyId,
                  alertPayload,
                );

                // Create issue
                const priority =
                  priceChange >= 20 ? "high" : "medium";
                const sign =
                  coin.priceChange24hPercent >= 0 ? "+" : "";
                await ctx.issues.create({
                  companyId: config.companyId,
                  title: `🔔 ${coin.symbol.toUpperCase()} ${sign}${coin.priceChange24hPercent.toFixed(1)}% trong 24h`,
                  description: `**${coin.name}** (${coin.symbol.toUpperCase()})\n\n- Giá: $${coin.currentPrice.toLocaleString()}\n- Thay đổi 24h: ${sign}${coin.priceChange24hPercent.toFixed(1)}%\n- Volume 24h: $${coin.volume24h.toLocaleString()}\n${volumeChange !== null ? `- Volume change: ${volumeChange > 0 ? "+" : ""}${volumeChange.toFixed(1)}%\n` : ""}\n**Reason:** ${reason}`,
                  priority,
                });

                ctx.logger.info(
                  `Alert: ${coin.symbol} — ${reason}`,
                );
              }
            }
          }

          // 6. Save scan result with final alert count
          scanResult.alertsTriggered = alertsTriggered;
          await ctx.state.set(
            { scopeKind: "instance", stateKey: "last-scan" },
            scanResult,
          );

          // 7. Emit scan-complete event (only if companyId set)
          if (hasCompanyId) {
            const completePayload: ScanCompletePayload = {
              scannedAt: scanResult.scannedAt,
              coinCount: coins.length,
              coins,
            };
            await ctx.events.emit(
              "coingecko-scan-complete",
              config.companyId,
              completePayload,
            );

            // 8. Activity log
            await ctx.activity.log({
              companyId: config.companyId,
              message: `Scanned CoinGecko: ${coins.length} coins, ${alertsTriggered} alerts triggered`,
              metadata: {
                plugin: PLUGIN_NAME,
                scanMode,
                totalCoins: coins.length,
                alertsTriggered,
              },
            });
          }
        } finally {
          await ctx.state.set(
            { scopeKind: "instance", stateKey: "scanRunning" },
            false,
          );
        }
      },
    );

    // Data provider: scanner status for settings page
    ctx.data.register(
      "scanner-status",
      async (_params: Record<string, unknown>) => {
        const lastScan = (await ctx.state.get({
          scopeKind: "instance",
          stateKey: "last-scan",
        })) as ScanResult | null;
        const scanRunning = await ctx.state.get({
          scopeKind: "instance",
          stateKey: "scanRunning",
        });
        return {
          lastScanAt: lastScan?.scannedAt ?? null,
          scanRunning: !!scanRunning,
          coinCount: lastScan?.coins.length ?? 0,
          alertsTriggered: lastScan?.alertsTriggered ?? 0,
        };
      },
    );
  },

  async onHealth() {
    return { status: "ok", message: "CoinGecko Scanner plugin ready" };
  },

  async onValidateConfig(config: Record<string, unknown>) {
    const errors: string[] = [];
    if (!config.companyId) errors.push("companyId is required");
    return { ok: errors.length === 0, errors };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
