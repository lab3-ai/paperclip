import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { PluginJobContext } from "@paperclipai/plugin-sdk";
import { scanMemberPosts, filterNewPosts } from "./scanner.js";
import { createSupabaseClient, upsertPosts } from "./supabase.js";
import type { XScannerConfig } from "./types.js";

const PLUGIN_NAME = "x-scanner";

const plugin = definePlugin({
  async setup(ctx) {
    ctx.logger.info(`${PLUGIN_NAME} plugin setup complete`);

    ctx.jobs.register("scan-x-posts", async (job: PluginJobContext) => {
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

        const config = (await ctx.config.get()) as unknown as XScannerConfig;
        if (!config?.members?.length) {
          ctx.logger.warn("No members configured, skipping scan");
          return;
        }

        const rapidApiKey = config.rapidApiKey;
        const supabase = createSupabaseClient(
          config.supabaseUrl,
          config.supabaseServiceKey,
        );

        const lastScanAt = (await ctx.state.get({
          scopeKind: "instance",
          stateKey: "lastScanAt",
        })) as string | null;

        let totalInserted = 0;
        let latestPostTime = lastScanAt;
        const failedMembers: string[] = [];

        for (const member of config.members) {
          try {
            const posts = await scanMemberPosts(
              ctx.http.fetch.bind(ctx.http),
              member,
              rapidApiKey,
              config.maxPostsPerMember ?? 20,
            );
            const newPosts = filterNewPosts(posts, lastScanAt);
            if (newPosts.length === 0) continue;

            const result = await upsertPosts(supabase, newPosts);
            if (result.error) {
              ctx.logger.error(`Supabase upsert failed for ${member}`, {
                error: result.error,
              });
              failedMembers.push(member);
              continue;
            }
            totalInserted += result.inserted;

            for (const p of newPosts) {
              if (!latestPostTime || p.posted_at > latestPostTime) {
                latestPostTime = p.posted_at;
              }
            }
          } catch (err) {
            ctx.logger.error(`Failed to scan member ${member}`, {
              error: String(err),
            });
            failedMembers.push(member);
          }
        }

        if (latestPostTime && latestPostTime !== lastScanAt) {
          await ctx.state.set(
            { scopeKind: "instance", stateKey: "lastScanAt" },
            latestPostTime,
          );
        }

        await ctx.activity.log({
          companyId: config.companyId,
          message: `Scanned X posts: ${totalInserted} new from ${config.members.length} members${failedMembers.length ? ` (${failedMembers.length} failed)` : ""}`,
          metadata: {
            plugin: PLUGIN_NAME,
            inserted: totalInserted,
            failedMembers,
          },
        });
      } finally {
        await ctx.state.set(
          { scopeKind: "instance", stateKey: "scanRunning" },
          false,
        );
      }
    });

    ctx.data.register(
      "scanner-status",
      async (params: Record<string, unknown>) => {
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
    return { status: "ok", message: "X Scanner plugin ready" };
  },

  async onValidateConfig(config: Record<string, unknown>) {
    const errors: string[] = [];
    if (!config.rapidApiKey) errors.push("rapidApiKey is required");
    if (!config.supabaseUrl) errors.push("supabaseUrl is required");
    if (!config.supabaseServiceKey)
      errors.push("supabaseServiceKey is required");
    if (!config.companyId) errors.push("companyId is required");
    if (
      !config.members ||
      !Array.isArray(config.members) ||
      config.members.length === 0
    )
      errors.push("members must be a non-empty array");
    return { ok: errors.length === 0, errors };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
