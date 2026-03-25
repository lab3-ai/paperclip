import { describe, it, expect } from "vitest";
import { createTestHarness } from "@paperclipai/plugin-sdk";
import manifest from "../src/manifest.js";
import plugin from "../src/worker.js";

describe("Polymarket Scanner worker", () => {
  it("sets up without error", async () => {
    const harness = createTestHarness({
      manifest,
      capabilities: manifest.capabilities,
    });
    await plugin.definition.setup(harness.ctx);
    const health = await plugin.definition.onHealth!();
    expect(health.status).toBe("ok");
  });

  it("registers scan-polymarket job handler", async () => {
    const harness = createTestHarness({
      manifest,
      capabilities: manifest.capabilities,
    });
    await plugin.definition.setup(harness.ctx);
    expect(harness.logs.some((l) => l.message.includes("setup"))).toBe(true);
  });

  it("registers settings data handler", async () => {
    const harness = createTestHarness({
      manifest,
      capabilities: manifest.capabilities,
    });
    await plugin.definition.setup(harness.ctx);
    const data = await harness.getData("scanner-status", {});
    expect(data).toHaveProperty("lastScanAt");
    expect(data).toHaveProperty("scanRunning");
  });

  it("validates config with missing fields", async () => {
    const result = await plugin.definition.onValidateConfig!({});
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("supabaseUrl is required");
    expect(result.errors).toContain("supabaseServiceKey is required");
    expect(result.errors).toContain("keywords must be a non-empty array");
    expect(result.errors).toContain("agentSlug is required");
    expect(result.errors).toContain("companyId is required");
  });

  it("validates config with all fields present", async () => {
    const result = await plugin.definition.onValidateConfig!({
      supabaseUrl: "https://example.supabase.co",
      supabaseServiceKey: "svc-key",
      keywords: ["crypto"],
      agentSlug: "analyzer",
      companyId: "comp-1",
    });
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
