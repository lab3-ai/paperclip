import { describe, it, expect } from "vitest";
import { createTestHarness } from "@paperclipai/plugin-sdk";
import manifest from "../src/manifest.js";
import plugin from "../src/worker.js";

describe("Telegram Notifier worker", () => {
  it("sets up without error", async () => {
    const harness = createTestHarness({
      manifest,
      capabilities: manifest.capabilities,
    });
    await plugin.definition.setup(harness.ctx);
    const health = await plugin.definition.onHealth!();
    expect(health.status).toBe("ok");
  });

  it("logs setup message", async () => {
    const harness = createTestHarness({
      manifest,
      capabilities: manifest.capabilities,
    });
    await plugin.definition.setup(harness.ctx);
    expect(harness.logs.some((l) => l.message.includes("setup"))).toBe(true);
  });

  it("registers notifier-status data handler", async () => {
    const harness = createTestHarness({
      manifest,
      capabilities: manifest.capabilities,
    });
    await plugin.definition.setup(harness.ctx);
    const data = await harness.getData<{ lastSentAt: string | null }>(
      "notifier-status",
      {},
    );
    expect(data).toHaveProperty("lastSentAt");
    expect(data.lastSentAt).toBeNull();
  });

  it("validates config with missing fields", async () => {
    const result = await plugin.definition.onValidateConfig!({});
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("botToken is required");
    expect(result.errors).toContain("chatId is required");
    expect(result.errors).toContain("supabaseUrl is required");
    expect(result.errors).toContain("supabaseServiceKey is required");
  });

  it("validates config with all fields present", async () => {
    const result = await plugin.definition.onValidateConfig!({
      botToken: "bot-token",
      chatId: "chat-id",
      supabaseUrl: "https://example.supabase.co",
      supabaseServiceKey: "svc-key",
    });
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
