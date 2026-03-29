# CoinGecko Scanner Plugin + Market Analysis Skill — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a CoinGecko crypto market scanner plugin and a market-analysis skill that teaches agents to analyze price data.

**Architecture:** Plugin follows the existing polymarket-scanner pattern — `definePlugin` + `runWorker`, single cron job, plugin state for persistence, events for inter-plugin communication. Skill is a standalone SKILL.md markdown file in `skills/`.

**Tech Stack:** TypeScript, @paperclipai/plugin-sdk, CoinGecko Free API (v3), React 19 (settings page)

**Spec:** `docs/superpowers/specs/2026-03-27-coingecko-scanner-market-analysis-design.md`

---

## File Structure

### Plugin: `packages/plugins/examples/plugin-coingecko-scanner/`

| File | Responsibility |
|------|---------------|
| `package.json` | Package metadata, dependencies, build scripts |
| `tsconfig.json` | TypeScript config (extends root) |
| `src/index.ts` | Re-exports manifest |
| `src/manifest.ts` | Plugin manifest: capabilities, job, config schema, UI slot |
| `src/worker.ts` | Main logic: job handler, scan, compare, emit events, create issues |
| `src/types.ts` | TypeScript interfaces for config, coin data, events |
| `src/coingecko.ts` | CoinGecko API client (fetch top, trending, watchlist) |
| `src/ui/index.tsx` | Settings page: scan status display |

### Skill: `skills/market-analysis/`

| File | Responsibility |
|------|---------------|
| `SKILL.md` | Agent-readable analysis guide with price action framework |

### Server registration

| File | Change |
|------|--------|
| `server/src/routes/plugins.ts` | Add entry to `BUNDLED_PLUGIN_EXAMPLES` array |

---

## Task 1: Scaffold plugin package

**Files:**
- Create: `packages/plugins/examples/plugin-coingecko-scanner/package.json`
- Create: `packages/plugins/examples/plugin-coingecko-scanner/tsconfig.json`
- Create: `packages/plugins/examples/plugin-coingecko-scanner/src/index.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@lab3-ai/plugin-coingecko-scanner",
  "version": "0.1.0",
  "description": "Scans crypto market data from CoinGecko — prices, trends, volume alerts",
  "type": "module",
  "private": false,
  "license": "MIT",
  "files": ["dist/"],
  "exports": {
    ".": "./src/index.ts"
  },
  "paperclipPlugin": {
    "manifest": "./dist/manifest.js",
    "worker": "./dist/worker.js",
    "ui": "./dist/ui/"
  },
  "scripts": {
    "prebuild": "node ../../../../scripts/ensure-plugin-build-deps.mjs",
    "build": "tsc",
    "clean": "rm -rf dist",
    "typecheck": "pnpm --filter @paperclipai/plugin-sdk build && tsc --noEmit"
  },
  "dependencies": {
    "@paperclipai/plugin-sdk": "^2026.325.0"
  },
  "devDependencies": {
    "@types/node": "^24.6.0",
    "@types/react": "^19.0.8",
    "@types/react-dom": "^19.0.3",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "typescript": "^5.7.3"
  },
  "peerDependencies": {
    "react": ">=18"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "../../../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "lib": ["ES2023", "DOM"],
    "jsx": "react-jsx"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create src/index.ts**

```typescript
export { default as manifest } from "./manifest.js";
```

- [ ] **Step 4: Run pnpm install to register workspace package**

Run: `pnpm install --no-frozen-lockfile`
Expected: Package registered in workspace, no errors

- [ ] **Step 5: Commit**

```bash
git add packages/plugins/examples/plugin-coingecko-scanner/
git commit -m "feat: scaffold plugin-coingecko-scanner package"
```

---

## Task 2: Define types

**Files:**
- Create: `packages/plugins/examples/plugin-coingecko-scanner/src/types.ts`

- [ ] **Step 1: Create types.ts**

```typescript
/** Operator-provided instance configuration */
export interface CoingeckoConfig {
  companyId: string;
  scanMode: "top" | "trending" | "watchlist" | "all";
  watchlistCoinIds: string;
  topCoinsLimit: number;
  priceChangeThreshold: number;
  volumeChangeThreshold: number;
  currency: string;
}

/** Single coin data from CoinGecko or normalized */
export interface CoinData {
  id: string;
  symbol: string;
  name: string;
  currentPrice: number;
  priceChange24hPercent: number;
  volume24h: number;
  marketCap: number;
  source: "top" | "trending" | "watchlist";
}

/** Stored scan result in plugin state */
export interface ScanResult {
  scannedAt: string;
  scanMode: string;
  coins: CoinData[];
  alertsTriggered: number;
}

/** Coin with diff compared to previous scan */
export interface CoinDiff {
  coin: CoinData;
  prevPrice: number | null;
  volumeChangePercent: number | null;
}

/** Event payload: scan complete */
export interface ScanCompletePayload {
  scannedAt: string;
  coinCount: number;
  coins: CoinData[];
}

/** Event payload: price alert */
export interface PriceAlertPayload {
  coin: CoinData;
  priceChangePercent: number;
  volumeChangePercent: number | null;
  reason: string;
}

/** CoinGecko /coins/markets response item */
export interface CoinGeckoMarketItem {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number;
  total_volume: number;
  market_cap: number;
}

/** CoinGecko /search/trending response */
export interface CoinGeckoTrendingResponse {
  coins: Array<{
    item: {
      id: string;
      symbol: string;
      name: string;
      data?: {
        price?: number;
        price_change_percentage_24h?: Record<string, number>;
        total_volume?: string;
        market_cap?: string;
      };
    };
  }>;
}

/** CoinGecko /simple/price response */
export interface CoinGeckoSimplePriceResponse {
  [coinId: string]: {
    [currency: string]: number;
    usd_24h_change?: number;
    usd_24h_vol?: number;
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/plugins/examples/plugin-coingecko-scanner/src/types.ts
git commit -m "feat: add CoinGecko scanner type definitions"
```

---

## Task 3: Create CoinGecko API client

**Files:**
- Create: `packages/plugins/examples/plugin-coingecko-scanner/src/coingecko.ts`

- [ ] **Step 1: Create coingecko.ts**

```typescript
import type {
  CoinData,
  CoinGeckoMarketItem,
  CoinGeckoTrendingResponse,
  CoinGeckoSimplePriceResponse,
} from "./types.js";

const BASE_URL = "https://api.coingecko.com/api/v3";

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * Fetch top coins by market cap.
 */
export async function fetchTopCoins(
  fetchFn: FetchFn,
  currency: string,
  limit: number,
): Promise<CoinData[]> {
  const url = `${BASE_URL}/coins/markets?vs_currency=${currency}&order=market_cap_desc&per_page=${limit}&page=1&sparkline=false&price_change_percentage=24h`;
  const resp = await fetchFn(url);
  if (!resp.ok) {
    throw new Error(`CoinGecko /coins/markets failed: ${resp.status}`);
  }
  const items: CoinGeckoMarketItem[] = await resp.json();
  return items.map((item) => ({
    id: item.id,
    symbol: item.symbol,
    name: item.name,
    currentPrice: item.current_price ?? 0,
    priceChange24hPercent: item.price_change_percentage_24h ?? 0,
    volume24h: item.total_volume ?? 0,
    marketCap: item.market_cap ?? 0,
    source: "top" as const,
  }));
}

/**
 * Fetch trending coins.
 */
export async function fetchTrendingCoins(
  fetchFn: FetchFn,
): Promise<CoinData[]> {
  const url = `${BASE_URL}/search/trending`;
  const resp = await fetchFn(url);
  if (!resp.ok) {
    throw new Error(`CoinGecko /search/trending failed: ${resp.status}`);
  }
  const data: CoinGeckoTrendingResponse = await resp.json();
  return data.coins.map((entry) => ({
    id: entry.item.id,
    symbol: entry.item.symbol,
    name: entry.item.name,
    currentPrice: entry.item.data?.price ?? 0,
    priceChange24hPercent:
      entry.item.data?.price_change_percentage_24h?.usd ?? 0,
    volume24h: parseFloat(entry.item.data?.total_volume ?? "0"),
    marketCap: parseFloat(entry.item.data?.market_cap ?? "0"),
    source: "trending" as const,
  }));
}

/**
 * Fetch specific coins by IDs (watchlist).
 */
export async function fetchWatchlistCoins(
  fetchFn: FetchFn,
  coinIds: string[],
  currency: string,
): Promise<CoinData[]> {
  if (coinIds.length === 0) return [];
  const ids = coinIds.join(",");
  const url = `${BASE_URL}/simple/price?ids=${ids}&vs_currencies=${currency}&include_24hr_change=true&include_24hr_vol=true`;
  const resp = await fetchFn(url);
  if (!resp.ok) {
    throw new Error(`CoinGecko /simple/price failed: ${resp.status}`);
  }
  const data: CoinGeckoSimplePriceResponse = await resp.json();
  return Object.entries(data).map(([id, values]) => ({
    id,
    symbol: id,
    name: id,
    currentPrice: values[currency] ?? 0,
    priceChange24hPercent: values[`${currency}_24h_change`] ?? values.usd_24h_change ?? 0,
    volume24h: values[`${currency}_24h_vol`] ?? values.usd_24h_vol ?? 0,
    marketCap: 0,
    source: "watchlist" as const,
  }));
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/plugins/examples/plugin-coingecko-scanner/src/coingecko.ts
git commit -m "feat: add CoinGecko API client functions"
```

---

## Task 4: Create manifest

**Files:**
- Create: `packages/plugins/examples/plugin-coingecko-scanner/src/manifest.ts`

- [ ] **Step 1: Create manifest.ts**

```typescript
import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "lab3-ai.plugin-coingecko-scanner",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "CoinGecko Scanner",
  description:
    "Scans crypto market data from CoinGecko — prices, trends, volume alerts",
  author: "lab3-ai",
  categories: ["connector", "automation"],
  capabilities: [
    "http.outbound",
    "jobs.schedule",
    "plugin.state.read",
    "plugin.state.write",
    "events.emit",
    "issues.create",
    "activity.log.write",
    "instance.settings.register",
  ],
  instanceConfigSchema: {
    type: "object",
    required: ["companyId"],
    properties: {
      companyId: { type: "string", title: "Company ID" },
      scanMode: {
        type: "string",
        title: "Scan Mode",
        enum: ["top", "trending", "watchlist", "all"],
        default: "top",
      },
      watchlistCoinIds: {
        type: "string",
        title: "Watchlist Coin IDs (comma-separated)",
        default: "bitcoin,ethereum,solana",
      },
      topCoinsLimit: {
        type: "number",
        title: "Top Coins Limit",
        default: 20,
      },
      priceChangeThreshold: {
        type: "number",
        title: "Price Change Alert Threshold (%)",
        default: 10,
      },
      volumeChangeThreshold: {
        type: "number",
        title: "Volume Change Alert Threshold (%)",
        default: 50,
      },
      currency: { type: "string", title: "Currency", default: "usd" },
    },
  },
  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui",
  },
  jobs: [
    {
      jobKey: "scan-coingecko",
      displayName: "Scan CoinGecko Markets",
      description:
        "Fetch crypto market data and detect price/volume anomalies",
      schedule: "*/5 * * * *",
    },
  ],
  ui: {
    slots: [
      {
        type: "settingsPage",
        id: "coingecko-scanner-settings",
        displayName: "CoinGecko Scanner Settings",
        exportName: "CoingeckoScannerSettings",
      },
    ],
  },
};

export default manifest;
```

- [ ] **Step 2: Verify typecheck**

Run: `cd packages/plugins/examples/plugin-coingecko-scanner && pnpm typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/plugins/examples/plugin-coingecko-scanner/src/manifest.ts
git commit -m "feat: add CoinGecko scanner manifest"
```

---

## Task 5: Create worker

**Files:**
- Create: `packages/plugins/examples/plugin-coingecko-scanner/src/worker.ts`

- [ ] **Step 1: Create worker.ts**

```typescript
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

          // 4. Save state FIRST (crash-safe: even if alerts fail, data is persisted)
          const scanResult: ScanResult = {
            scannedAt: new Date().toISOString(),
            scanMode,
            coins,
            alertsTriggered: 0, // updated below
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
```

- [ ] **Step 2: Verify typecheck**

Run: `cd packages/plugins/examples/plugin-coingecko-scanner && pnpm typecheck`
Expected: No errors (may need `pnpm --filter @paperclipai/plugin-sdk build` first)

- [ ] **Step 3: Commit**

```bash
git add packages/plugins/examples/plugin-coingecko-scanner/src/worker.ts
git commit -m "feat: add CoinGecko scanner worker with job, events, issues"
```

---

## Task 6: Create settings page UI

**Files:**
- Create: `packages/plugins/examples/plugin-coingecko-scanner/src/ui/index.tsx`

- [ ] **Step 1: Create ui/index.tsx**

```tsx
import type { PluginSettingsPageProps } from "@paperclipai/plugin-sdk/ui";
import { usePluginData } from "@paperclipai/plugin-sdk/ui";

interface ScannerStatus {
  lastScanAt: string | null;
  scanRunning: boolean;
  coinCount: number;
  alertsTriggered: number;
}

export function CoingeckoScannerSettings({
  context,
}: PluginSettingsPageProps) {
  const { data: status, loading, refresh } = usePluginData<ScannerStatus>(
    "scanner-status",
    {},
  );

  return (
    <div style={{ padding: "1rem", maxWidth: 600 }}>
      <h2>CoinGecko Scanner</h2>

      <section style={{ marginTop: "1rem" }}>
        <h3>Scan Status</h3>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <div>
            <p>
              <strong>Last scan:</strong>{" "}
              {status?.lastScanAt
                ? new Date(status.lastScanAt).toLocaleString()
                : "Never"}
            </p>
            <p>
              <strong>Scan running:</strong>{" "}
              {status?.scanRunning ? "Yes" : "No"}
            </p>
            <p>
              <strong>Coins tracked:</strong> {status?.coinCount ?? 0}
            </p>
            <p>
              <strong>Alerts (last scan):</strong>{" "}
              {status?.alertsTriggered ?? 0}
            </p>
            <button onClick={refresh} style={{ marginTop: "0.5rem" }}>
              Refresh
            </button>
          </div>
        )}
      </section>

      <section style={{ marginTop: "1rem" }}>
        <h3>Configuration</h3>
        <p>
          Configure scan mode, coin watchlist, alert thresholds, and Company ID
          in the plugin configuration panel above.
        </p>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/plugins/examples/plugin-coingecko-scanner/src/ui/
git commit -m "feat: add CoinGecko scanner settings page UI"
```

---

## Task 7: Register as bundled example plugin

**Files:**
- Modify: `server/src/routes/plugins.ts:117-166` (BUNDLED_PLUGIN_EXAMPLES array)

- [ ] **Step 1: Add entry to BUNDLED_PLUGIN_EXAMPLES**

Add after the last entry in the `BUNDLED_PLUGIN_EXAMPLES` array (after the telegram-notifier entry, before the closing `];`):

```typescript
  {
    packageName: "@lab3-ai/plugin-coingecko-scanner",
    pluginKey: "lab3-ai.plugin-coingecko-scanner",
    displayName: "CoinGecko Scanner",
    description: "Scans crypto market data from CoinGecko — prices, trends, volume alerts",
    localPath: "packages/plugins/examples/plugin-coingecko-scanner",
    tag: "example",
  },
```

- [ ] **Step 2: Build plugin and verify**

Run: `cd packages/plugins/examples/plugin-coingecko-scanner && pnpm build`
Expected: Compiles to `dist/` without errors

- [ ] **Step 3: Build full project and typecheck**

Run: `pnpm build && pnpm -r typecheck`
Expected: All packages build and typecheck pass

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/plugins.ts
git commit -m "feat: register coingecko-scanner as bundled example plugin"
```

---

## Task 8: Create market-analysis skill

**Files:**
- Create: `skills/market-analysis/SKILL.md`

- [ ] **Step 1: Create SKILL.md**

```markdown
---
name: market-analysis
description: >
  Hướng dẫn agent phân tích thị trường crypto bằng price action — so sánh %
  thay đổi giá, volume, trend. Dùng khi checkout task liên quan phân tích
  market hoặc đọc data từ coingecko-scanner, polymarket-scanner.
---

# Market Analysis Skill

Dùng skill này khi bạn được giao task phân tích thị trường crypto hoặc cần đọc data từ các scanner plugins.

## Quy trình phân tích

### Bước 1: Thu thập data

- Đọc task comments/documents chứa scan results (từ coingecko-scanner hoặc polymarket-scanner)
- Nếu có para-memory skill: đọc data tuần trước để so sánh trend

### Bước 2: So sánh % thay đổi

Cho mỗi coin/market đáng chú ý:
- **Giá 24h**: tăng/giảm bao nhiêu %?
- **Volume 24h**: spike hay giảm so với trung bình?
- **So với tuần trước**: trend đi lên hay xuống?

### Bước 3: Xác định tín hiệu

| Signal | Điều kiện | Hành động |
|--------|----------|-----------|
| 🟢 Bullish mạnh | Giá >+10%, volume >+30% | Tạo subtask viết bài |
| 🟢 Bullish nhẹ | Giá +5% đến +10% | Ghi nhận, theo dõi |
| 🟡 Neutral | Biến động <5% | Ghi nhận |
| 🔴 Bearish nhẹ | Giá -5% đến -10% | Ghi nhận, theo dõi |
| 🔴 Bearish mạnh | Giá <-10%, volume >+30% | Tạo subtask viết bài cảnh báo |

### Bước 4: Tổng hợp

- Xếp hạng coins theo mức độ đáng chú ý (signal mạnh nhất trước)
- Highlight top 3 movers
- Xác định trend chung: Bullish / Bearish / Sideways

### Bước 5: Output

Comment lên task theo template bên dưới. Nếu có signal 🟢 hoặc 🔴 mạnh → tạo subtask cho Content Writer. Nếu có para-memory → lưu kết quả để tuần sau so sánh.

## Template Output

Luôn comment theo format này:

```
## Market Analysis - [Ngày tháng]

### Top Movers (24h)
| Coin | Giá | 24h % | Volume | Signal |
|------|-----|-------|--------|--------|
| BTC  | $XX,XXX | +X.X% | $XXB | 🟢/🔴/🟡 |
| ETH  | $X,XXX  | -X.X% | $XXB | 🟢/🔴/🟡 |
| ...  | ...     | ...   | ...  | ...    |

### Tín hiệu đáng chú ý
- **[COIN]**: [Lý do cụ thể] — [Hành động đề xuất]

### So với tuần trước
- Trend chung: [Bullish/Bearish/Sideways]
- Điểm khác biệt chính: [...]

### Đề xuất
- [ ] Viết bài về [topic] (nếu signal mạnh)
```

## Lưu ý quan trọng

- Chỉ dùng data có sẵn trong task comments hoặc plugin state — không tự bịa số liệu
- Khi không chắc chắn, ghi rõ "data không đủ để kết luận"
- Luôn ghi nguồn data (CoinGecko, Polymarket, X scanner)
```

- [ ] **Step 2: Commit**

```bash
git add skills/market-analysis/
git commit -m "feat: add market-analysis skill for crypto market agents"
```

---

## Task 9: End-to-end verification

- [ ] **Step 1: Full build**

Run: `pnpm build`
Expected: All packages build successfully including plugin-coingecko-scanner

- [ ] **Step 2: Typecheck**

Run: `pnpm -r typecheck`
Expected: No type errors across entire monorepo

- [ ] **Step 3: Run existing tests to ensure no regressions**

Run: `pnpm test:run`
Expected: All existing tests pass

- [ ] **Step 4: Start dev server and verify plugin appears**

Run: `pnpm dev`
Then open `http://localhost:3100` → Plugin Manager → verify "CoinGecko Scanner" appears in bundled examples list.

- [ ] **Step 5: Verify skill file is readable**

Run: `cat skills/market-analysis/SKILL.md | head -5`
Expected: Shows frontmatter with `name: market-analysis`

- [ ] **Step 6: Final commit (if any remaining changes)**

```bash
git add -A
git commit -m "feat: complete coingecko-scanner plugin + market-analysis skill"
```
