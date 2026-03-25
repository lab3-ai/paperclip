import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { TelegramConfig, MarketEventPayload } from "./types.js";
import { formatMarketMessage, sendTelegramMessage } from "./notifier.js";
import { createSupabaseClient, updateNotifiedAt } from "./supabase.js";

const PLUGIN_NAME = "telegram-notifier";

const plugin = definePlugin({
  async setup(ctx) {
    ctx.logger.info(`${PLUGIN_NAME} plugin setup complete`);

    // Subscribe to new markets event from polymarket-scanner
    ctx.events.on(
      "plugin.lab3-ai.plugin-polymarket-scanner.new_markets",
      async (event) => {
        const payload = event.payload as MarketEventPayload;
        if (!payload?.markets?.length) {
          ctx.logger.info("No markets in event payload, skipping");
          return;
        }

        const config = (await ctx.config.get()) as unknown as TelegramConfig;
        if (!config?.botToken || !config?.chatId) {
          ctx.logger.warn("Missing botToken or chatId in config, skipping notification");
          return;
        }

        const botToken = config.botToken;
        const chatId = config.chatId;

        const sentMarketIds: string[] = [];

        for (const market of payload.markets) {
          try {
            const message = formatMarketMessage(market);
            await sendTelegramMessage(
              ctx.http.fetch.bind(ctx.http),
              botToken,
              chatId,
              message,
            );
            sentMarketIds.push(market.market_id);

            // Rate limit: 3s between messages
            if (payload.markets.indexOf(market) < payload.markets.length - 1) {
              await new Promise((r) => setTimeout(r, 3000));
            }
          } catch (err) {
            ctx.logger.error(`Failed to send Telegram message for market ${market.market_id}`, {
              error: String(err),
            });
          }
        }

        // Update notified_at in Supabase for sent markets
        if (sentMarketIds.length > 0 && config.supabaseUrl && config.supabaseServiceKey) {
          try {
            const supabase = createSupabaseClient(
              config.supabaseUrl,
              config.supabaseServiceKey,
            );
            await updateNotifiedAt(supabase, sentMarketIds);
          } catch (err) {
            ctx.logger.error("Failed to update notified_at in Supabase", {
              error: String(err),
            });
          }
        }

        // Update state
        const now = new Date().toISOString();
        await ctx.state.set(
          { scopeKind: "instance", stateKey: "lastSentAt" },
          now,
        );

        await ctx.activity.log({
          companyId: event.companyId,
          message: `Sent ${sentMarketIds.length}/${payload.markets.length} Telegram notifications`,
          metadata: {
            plugin: PLUGIN_NAME,
            sentCount: sentMarketIds.length,
            totalCount: payload.markets.length,
          },
        });
      },
    );

    // Action: test-send — sends a test message to the configured chat
    ctx.actions.register("test-send", async (_params: Record<string, unknown>) => {
      const config = (await ctx.config.get()) as unknown as TelegramConfig;
      if (!config?.botToken || !config?.chatId) {
        throw new Error("Missing botToken or chatId in config");
      }
      const botToken = config.botToken;
      const text = "Paperclip Telegram Notifier: Test message sent successfully!";
      await sendTelegramMessage(ctx.http.fetch.bind(ctx.http), botToken, config.chatId, text);
      return { ok: true };
    });

    // Data: notifier-status — returns current status
    ctx.data.register(
      "notifier-status",
      async (_params: Record<string, unknown>) => {
        const lastSentAt = await ctx.state.get({
          scopeKind: "instance",
          stateKey: "lastSentAt",
        });
        return { lastSentAt: lastSentAt ?? null };
      },
    );
  },

  async onHealth() {
    return { status: "ok", message: "Telegram Notifier plugin ready" };
  },

  async onValidateConfig(config: Record<string, unknown>) {
    const errors: string[] = [];
    if (!config.botToken) errors.push("botToken is required");
    if (!config.chatId) errors.push("chatId is required");
    if (!config.supabaseUrl) errors.push("supabaseUrl is required");
    if (!config.supabaseServiceKey) errors.push("supabaseServiceKey is required");
    return { ok: errors.length === 0, errors };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
