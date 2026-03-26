import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import path from "node:path";

let resolveProjectRoot: () => string | null;
let resetProjectRootCache: () => void;

describe("resolveProjectRoot", () => {
  const originalCwd = process.cwd;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    process.env = { ...originalEnv };
    delete process.env.PAPERCLIP_HOME;
    vi.resetModules();
    const mod = await import("../home-paths.js");
    resolveProjectRoot = mod.resolveProjectRoot;
    resetProjectRootCache = mod.resetProjectRootCache;
  });

  afterEach(() => {
    process.cwd = originalCwd;
    process.env = originalEnv;
  });

  it("returns project root when .paperclip/config.json exists in cwd", () => {
    const projectRoot = path.resolve(".");
    process.cwd = () => projectRoot;
    resetProjectRootCache();
    const result = resolveProjectRoot();
    expect(result).toBe(projectRoot);
  });

  it("returns null when no .paperclip/config.json found", () => {
    process.cwd = () => "/tmp";
    resetProjectRootCache();
    const result = resolveProjectRoot();
    expect(result).toBeNull();
  });

  it("walks ancestor directories to find project root", () => {
    const projectRoot = path.resolve(".");
    process.cwd = () => path.join(projectRoot, "server", "src");
    resetProjectRootCache();
    const result = resolveProjectRoot();
    expect(result).toBe(projectRoot);
  });

  it("caches the result across calls", () => {
    const projectRoot = path.resolve(".");
    process.cwd = () => projectRoot;
    resetProjectRootCache();
    const first = resolveProjectRoot();
    process.cwd = () => "/tmp";
    const second = resolveProjectRoot();
    expect(first).toBe(second);
  });
});

describe("resolveAgentInstructionsDir", () => {
  const originalCwd = process.cwd;

  afterEach(() => {
    process.cwd = originalCwd;
  });

  it("returns {projectRoot}/agents/{role} when project root exists", async () => {
    const projectRoot = path.resolve(".");
    process.cwd = () => projectRoot;
    vi.resetModules();
    const mod = await import("../home-paths.js");
    mod.resetProjectRootCache();
    const result = mod.resolveAgentInstructionsDir("ceo");
    expect(result).toBe(path.join(projectRoot, "agents", "ceo"));
  });

  it("throws when no project root found", async () => {
    process.cwd = () => "/tmp";
    vi.resetModules();
    const mod = await import("../home-paths.js");
    mod.resetProjectRootCache();
    expect(() => mod.resolveAgentInstructionsDir("ceo")).toThrow("No project root found");
  });
});

describe("resolveDefaultAgentWorkspaceDir (project-local)", () => {
  const originalCwd = process.cwd;
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.cwd = originalCwd;
    process.env = originalEnv;
  });

  it("resolves to project-local .paperclip/workspaces/ when project root exists", async () => {
    const projectRoot = path.resolve(".");
    process.cwd = () => projectRoot;
    delete process.env.PAPERCLIP_HOME;
    vi.resetModules();
    const mod = await import("../home-paths.js");
    mod.resetProjectRootCache();
    const result = mod.resolveDefaultAgentWorkspaceDir("agent-123");
    expect(result).toBe(path.join(projectRoot, ".paperclip", "workspaces", "agent-123"));
  });

  it("falls back to instance root when PAPERCLIP_HOME is set", async () => {
    process.env.PAPERCLIP_HOME = "/custom/paperclip";
    vi.resetModules();
    const mod = await import("../home-paths.js");
    mod.resetProjectRootCache();
    const result = mod.resolveDefaultAgentWorkspaceDir("agent-123");
    expect(result).toContain("/custom/paperclip/");
    expect(result).toContain("workspaces/agent-123");
  });
});
