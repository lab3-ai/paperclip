import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { PluginJobContext } from "@paperclipai/plugin-sdk";
import { fetchMarkets, filterByVolume } from "./scanner.js";
import { buildAnalysisPrompt, parseAnalysisResponse } from "./analyzer.js";
import { createSupabaseClient, upsertMarkets, updateNotifiedAt } from "./supabase.js";
import type { PolymarketConfig, AnalyzedMarket, MarketEventPayload } from "./types.js";

const PLUGIN_NAME = "polymarket-scanner";

const plugin = definePlugin({
  async setup(ctx) {
    ctx.logger.info(`${PLUGIN_NAME} plugin setup complete`);

    ctx.jobs.register("scan-polymarket", async (_job: PluginJobContext) => {
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

        const config = (await ctx.config.get()) as unknown as PolymarketConfig;
        if (!config?.keywords?.length) {
          ctx.logger.warn("No keywords configured, skipping scan");
          return;
        }
        if (!config.supabaseUrl || !config.supabaseServiceKey) {
          ctx.logger.warn("Supabase not configured, skipping scan");
          return;
        }
        if (!config.agentSlug) {
          ctx.logger.warn("Agent slug not configured, skipping scan");
          return;
        }
        if (!config.companyId) {
          ctx.logger.warn("Company ID not configured, skipping scan");
          return;
        }

        const supabase = createSupabaseClient(
          config.supabaseUrl,
          config.supabaseServiceKey,
        );

        // 1. Fetch markets from Gamma API
        const rawMarkets = await fetchMarkets(
          ctx.http.fetch.bind(ctx.http),
          config.keywords,
        );
        ctx.logger.info(`Fetched ${rawMarkets.length} markets from Gamma API`);

        // 2. Filter by volume
        const minVolume = config.minVolume ?? 0;
        const filteredMarkets = filterByVolume(rawMarkets, minVolume);
        ctx.logger.info(
          `${filteredMarkets.length} markets pass volume threshold (${minVolume})`,
        );

        if (filteredMarkets.length === 0) {
          await ctx.state.set(
            { scopeKind: "instance", stateKey: "lastScanAt" },
            new Date().toISOString(),
          );
          return;
        }

        // 3. AI analyze via agent sessions
        const prompt = buildAnalysisPrompt(filteredMarkets, config.keywords);

        // Find agent by slug
        const agents = await ctx.agents.list({
          companyId: config.companyId,
        });
        const agent = agents.find((a) => a.urlKey === config.agentSlug);
        if (!agent) {
          ctx.logger.error(
            `Agent with slug "${config.agentSlug}" not found`,
          );
          return;
        }

        const session = await ctx.agents.sessions.create(
          agent.id,
          config.companyId,
          { reason: "Polymarket market analysis" },
        );

        let aiResponseText = "";
        await ctx.agents.sessions.sendMessage(
          session.sessionId,
          config.companyId,
          {
            prompt,
            reason: "Analyze markets for relevance",
            onEvent: (event) => {
              if (event.eventType === "chunk" && event.message) {
                aiResponseText += event.message;
              }
            },
          },
        );

        const analysisResults = parseAnalysisResponse(aiResponseText);
        ctx.logger.info(
          `AI analysis returned ${analysisResults.length} results`,
        );

        // 4. Build analyzed markets
        const analysisMap = new Map(
          analysisResults.map((r) => [r.market_id, r]),
        );

        const analyzedMarkets: AnalyzedMarket[] = filteredMarkets.map((m) => {
          const analysis = analysisMap.get(m.market_id);
          return {
            ...m,
            matched_keywords: config.keywords.filter(
              (kw) =>
                m.question.toLowerCase().includes(kw.toLowerCase()) ||
                (m.description ?? "").toLowerCase().includes(kw.toLowerCase()),
            ),
            ai_relevance_score: analysis?.relevance_score ?? null,
            ai_analysis: analysis?.analysis ?? null,
          };
        });

        // 5. Upsert ALL markets to Supabase
        const upsertResult = await upsertMarkets(supabase, analyzedMarkets);
        if (upsertResult.error) {
          ctx.logger.error(`Supabase upsert failed: ${upsertResult.error}`);
        }

        // 6. Query Supabase for already-notified markets
        const { data: notifiedRows } = await supabase
          .from("polymarket_markets")
          .select("market_id")
          .not("notified_at", "is", null)
          .in(
            "market_id",
            analyzedMarkets.map((m) => m.market_id),
          );
        const alreadyNotified = new Set(
          (notifiedRows ?? []).map(
            (r: { market_id: string }) => r.market_id,
          ),
        );

        // 7. Emit event for new markets (skip AI score filter for now)
        // TODO: uncomment AI score filter when ready:
        // const minScore = config.minAiRelevanceScore ?? 0.5;
        // const newRelevantMarkets = analyzedMarkets.filter(
        //   (m) => (m.ai_relevance_score ?? 0) >= minScore && !alreadyNotified.has(m.market_id),
        // );
        const newRelevantMarkets = analyzedMarkets.filter(
          (m) => !alreadyNotified.has(m.market_id),
        );

        if (newRelevantMarkets.length > 0) {
          const payload: MarketEventPayload = {
            markets: newRelevantMarkets.map((m) => ({
              market_id: m.market_id,
              question: m.question,
              outcome_prices: m.outcome_prices,
              ai_relevance_score: m.ai_relevance_score ?? 0,
              ai_analysis: m.ai_analysis ?? "",
              url: m.url ?? "",
            })),
          };
          await ctx.events.emit(
            "new_markets",
            config.companyId,
            payload,
          );
          ctx.logger.info(
            `Emitted new_markets event for ${newRelevantMarkets.length} markets`,
          );

          // 8. Update notified_at for emitted markets
          await updateNotifiedAt(
            supabase,
            newRelevantMarkets.map((m) => m.market_id),
          );
        }

        await ctx.state.set(
          { scopeKind: "instance", stateKey: "lastScanAt" },
          new Date().toISOString(),
        );

        // 9. Log activity
        await ctx.activity.log({
          companyId: config.companyId,
          message: `Scanned Polymarket: ${analyzedMarkets.length} markets analyzed, ${newRelevantMarkets.length} new relevant markets`,
          metadata: {
            plugin: PLUGIN_NAME,
            totalMarkets: rawMarkets.length,
            filtered: filteredMarkets.length,
            analyzed: analyzedMarkets.length,
            newRelevant: newRelevantMarkets.length,
          },
        });
      } finally {
        await ctx.state.set(
          { scopeKind: "instance", stateKey: "scanRunning" },
          false,
        );
      }
    });

    // Action: test-pipeline — emit a fake event to test full flow
    ctx.actions.register("test-pipeline", async (_params: Record<string, unknown>) => {
      const config = (await ctx.config.get()) as unknown as PolymarketConfig;
      if (!config?.companyId) throw new Error("companyId not configured");

      const fakeMarkets: MarketEventPayload = {
        markets: [
          {
            market_id: `fake-test-${Date.now()}`,
            question: "Will Bitcoin reach $200k by December 2026?",
            outcome_prices: { Yes: 0.35, No: 0.65 },
            ai_relevance_score: 0.92,
            ai_analysis: "Highly relevant to Bitcoin/Crypto topics. Test alert from Paperclip.",
            url: "https://polymarket.com/event/btc-200k-2026",
          },
          {
            market_id: `fake-test-${Date.now() + 1}`,
            question: "Will Trump win the 2028 presidential election?",
            outcome_prices: { Yes: 0.45, No: 0.55 },
            ai_relevance_score: 0.88,
            ai_analysis: "Relevant to Trump topic. High volume prediction market.",
            url: "https://polymarket.com/event/trump-2028",
          },
        ],
      };

      await ctx.events.emit("new_markets", config.companyId, fakeMarkets);
      ctx.logger.info("test-pipeline: emitted fake new_markets event");
      return { ok: true, marketsEmitted: fakeMarkets.markets.length };
    });

    ctx.data.register(
      "scanner-status",
      async (_params: Record<string, unknown>) => {
        const lastScanAt = await ctx.state.get({
          scopeKind: "instance",
          stateKey: "lastScanAt",
        });
        const scanRunning = await ctx.state.get({
          scopeKind: "instance",
          stateKey: "scanRunning",
        });
        return { lastScanAt: lastScanAt ?? null, scanRunning: !!scanRunning };
      },
    );
  },

  async onHealth() {
    return { status: "ok", message: "Polymarket Scanner plugin ready" };
  },

  async onValidateConfig(config: Record<string, unknown>) {
    const errors: string[] = [];
    if (!config.supabaseUrl) errors.push("supabaseUrl is required");
    if (!config.supabaseServiceKey)
      errors.push("supabaseServiceKey is required");
    if (
      !config.keywords ||
      !Array.isArray(config.keywords) ||
      config.keywords.length === 0
    )
      errors.push("keywords must be a non-empty array");
    if (!config.agentSlug) errors.push("agentSlug is required");
    if (!config.companyId) errors.push("companyId is required");
    return { ok: errors.length === 0, errors };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
