# Project-Local Agent Paths Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make agent workspaces resolve to `.paperclip/workspaces/` and agent instructions materialize to `agents/ceo/` within the project directory, eliminating `~/.paperclip/` dependency for local dev.

**Architecture:** Add `resolveProjectRoot()` with cached ancestor search to `home-paths.ts`. Modify `resolveDefaultAgentWorkspaceDir()` to prefer project-local paths. Update `bootstrap.ts` to materialize CEO instructions and set correct `adapterConfig` for `claude-local`.

**Tech Stack:** Node.js, TypeScript, Vitest, Drizzle ORM

---

### Task 1: Add `resolveProjectRoot()` to `home-paths.ts`

**Files:**
- Modify: `server/src/home-paths.ts`
- Create: `server/src/__tests__/home-paths.test.ts`

- [ ] **Step 1: Write the test file**

Create `server/src/__tests__/home-paths.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Must import after mocking
let resolveProjectRoot: () => string | null;
let resetProjectRootCache: () => void;

describe("resolveProjectRoot", () => {
  const originalCwd = process.cwd;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    process.env = { ...originalEnv };
    delete process.env.PAPERCLIP_HOME;
    // Re-import to reset module-level cache
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
    // cwd is the monorepo root which has .paperclip/config.json
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
    // Simulate running from a subdirectory
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
    // Even if cwd changes, cache holds
    process.cwd = () => "/tmp";
    const second = resolveProjectRoot();
    expect(first).toBe(second);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/src/__tests__/home-paths.test.ts --project server`
Expected: FAIL — `resolveProjectRoot` and `resetProjectRootCache` are not exported.

- [ ] **Step 3: Implement `resolveProjectRoot()` and `resetProjectRootCache()`**

In `server/src/home-paths.ts`, add after the existing imports:

```typescript
import fs from "node:fs";
```

Then add before the `resolveDefaultAgentWorkspaceDir` function:

```typescript
let _cachedProjectRoot: string | null | undefined;

export function resolveProjectRoot(): string | null {
  if (_cachedProjectRoot !== undefined) return _cachedProjectRoot;

  let dir = process.cwd();
  const root = path.parse(dir).root;

  while (dir !== root) {
    const configPath = path.join(dir, ".paperclip", "config.json");
    if (fs.existsSync(configPath)) {
      _cachedProjectRoot = dir;
      return dir;
    }
    dir = path.dirname(dir);
  }

  _cachedProjectRoot = null;
  return null;
}

export function resetProjectRootCache(): void {
  _cachedProjectRoot = undefined;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/src/__tests__/home-paths.test.ts --project server`
Expected: PASS

---

### Task 2: Add `resolveAgentInstructionsDir()` to `home-paths.ts`

**Files:**
- Modify: `server/src/home-paths.ts`
- Modify: `server/src/__tests__/home-paths.test.ts`

- [ ] **Step 1: Add test**

Append to `server/src/__tests__/home-paths.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/src/__tests__/home-paths.test.ts --project server`
Expected: FAIL — `resolveAgentInstructionsDir` not exported.

- [ ] **Step 3: Implement `resolveAgentInstructionsDir()`**

Add to `server/src/home-paths.ts`:

```typescript
export function resolveAgentInstructionsDir(role: string): string {
  const projectRoot = resolveProjectRoot();
  if (!projectRoot) {
    throw new Error("No project root found (no .paperclip/config.json in ancestor directories)");
  }
  return path.resolve(projectRoot, "agents", role);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/src/__tests__/home-paths.test.ts --project server`
Expected: PASS

---

### Task 3: Modify `resolveDefaultAgentWorkspaceDir()` for project-local

**Files:**
- Modify: `server/src/home-paths.ts`
- Modify: `server/src/__tests__/home-paths.test.ts`

- [ ] **Step 1: Add test**

Append to the `server/src/__tests__/home-paths.test.ts` file:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/src/__tests__/home-paths.test.ts --project server`
Expected: FAIL — workspace still resolves to `~/.paperclip/instances/default/workspaces/`.

- [ ] **Step 3: Modify `resolveDefaultAgentWorkspaceDir()`**

Replace the existing function in `server/src/home-paths.ts`:

```typescript
export function resolveDefaultAgentWorkspaceDir(agentId: string): string {
  const trimmed = agentId.trim();
  if (!PATH_SEGMENT_RE.test(trimmed)) {
    throw new Error(`Invalid agent id for workspace path '${agentId}'.`);
  }

  // Prefer project-local workspace when not in production (no PAPERCLIP_HOME set)
  if (!process.env.PAPERCLIP_HOME?.trim()) {
    const projectRoot = resolveProjectRoot();
    if (projectRoot) {
      return path.resolve(projectRoot, ".paperclip", "workspaces", trimmed);
    }
  }

  return path.resolve(resolvePaperclipInstanceRoot(), "workspaces", trimmed);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/src/__tests__/home-paths.test.ts --project server`
Expected: PASS

- [ ] **Step 5: Run existing heartbeat workspace tests to verify no regression**

Run: `npx vitest run server/src/__tests__/heartbeat-workspace-session.test.ts --project server`
Expected: PASS — existing tests should still pass since they don't depend on specific absolute paths.

---

### Task 4: Update bootstrap to materialize instructions and set adapterConfig

**Files:**
- Modify: `server/src/services/bootstrap.ts`

- [ ] **Step 1: Add imports**

Add to the top of `server/src/services/bootstrap.ts`:

```typescript
import fs from "node:fs/promises";
import path from "node:path";
import { resolveProjectRoot, resolveAgentInstructionsDir } from "../home-paths.js";
import { loadDefaultAgentInstructionsBundle } from "./default-agent-instructions.js";
```

- [ ] **Step 2: Add materialize function**

Add as a module-level function (outside `bootstrapService()`, since it doesn't need `db`) in `server/src/services/bootstrap.ts`:

```typescript
  async function materializeInstructions(role: string): Promise<string | null> {
    const projectRoot = resolveProjectRoot();
    if (!projectRoot) return null;

    let instructionsDir: string;
    try {
      instructionsDir = resolveAgentInstructionsDir(role);
    } catch {
      return null;
    }

    // Idempotent: skip if already exists
    try {
      await fs.access(instructionsDir);
      return instructionsDir;
    } catch {
      // Directory doesn't exist, create it
    }

    const bundleRole = role === "ceo" ? "ceo" : "default";
    const bundle = await loadDefaultAgentInstructionsBundle(bundleRole as "ceo" | "default");

    await fs.mkdir(instructionsDir, { recursive: true });
    for (const [fileName, content] of Object.entries(bundle)) {
      await fs.writeFile(path.join(instructionsDir, fileName), content, "utf8");
    }

    logger.info(
      { role, instructionsDir, files: Object.keys(bundle) },
      "Materialized default agent instructions to project",
    );

    return instructionsDir;
  }
```

- [ ] **Step 3: Update `createDefaultSetup()` to use materialize and set adapterConfig**

Replace the agent insert block in `createDefaultSetup()`. Change from:

```typescript
    // Create default CEO agent
    await db.insert(agents).values({
      companyId: company.id,
      name: agentName,
      role: "ceo",
      title: "Chief Executive Officer",
      adapterType: "claude-local",
    });
```

To:

```typescript
    // Materialize CEO instructions to project-local agents/ceo/
    const instructionsDir = await materializeInstructions("ceo");
    const projectRoot = resolveProjectRoot();
    const ceoCommand = process.env.PAPERCLIP_CEO_COMMAND || "claude";

    // Build adapterConfig for claude-local
    const adapterConfig: Record<string, unknown> = {};
    adapterConfig.command = ceoCommand;
    if (projectRoot) {
      adapterConfig.cwd = projectRoot;
    }
    if (instructionsDir) {
      adapterConfig.instructionsBundleMode = "external";
      adapterConfig.instructionsRootPath = instructionsDir;
      adapterConfig.instructionsEntryFile = "AGENTS.md";
    }

    // Create default CEO agent
    await db.insert(agents).values({
      companyId: company.id,
      name: agentName,
      role: "ceo",
      title: "Chief Executive Officer",
      adapterType: "claude-local",
      adapterConfig,
    });
```

- [ ] **Step 4: Run typecheck**

Run: `pnpm -r typecheck`
Expected: No TypeScript errors.

---

### Task 5: Update `.gitignore`

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Add `/agents/` to `.gitignore`**

Add after the `/.agents/` line (line 41) in `.gitignore`:

```
/agents/
```

- [ ] **Step 2: Add `.paperclip/workspaces/` to `.gitignore`**

The `.paperclip/` directory has `config.json` committed but workspaces should be ignored. Add after the `.paperclip/.env` line (line 10):

```
/.paperclip/workspaces/
```

---

### Task 6: Run full test suite and typecheck

**Files:** None (verification only)

- [ ] **Step 1: Run typecheck**

Run: `pnpm -r typecheck`
Expected: No TypeScript errors.

- [ ] **Step 2: Run all tests**

Run: `pnpm test:run`
Expected: All tests pass, no regressions.

- [ ] **Step 3: Run the new home-paths tests specifically**

Run: `npx vitest run server/src/__tests__/home-paths.test.ts --project server`
Expected: All new tests pass.

---

### Task 7: Manual E2E verification

- [ ] **Step 1: Reset database**

Drop and recreate the paperclip database:
```bash
PGPASSWORD=paperclip psql -h localhost -U paperclip -d paperclip -c "DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
```

- [ ] **Step 2: Run migrations**

```bash
pnpm db:migrate
```
Expected: All migrations applied.

- [ ] **Step 3: Clean up any existing materialized files**

```bash
rm -rf agents/ .paperclip/workspaces/
```

- [ ] **Step 4: Start dev server**

```bash
pnpm dev
```
Expected: Server starts in authenticated mode.

- [ ] **Step 5: Sign up and verify bootstrap**

Open `http://localhost:3100`, sign up.

Verify:
- `agents/ceo/` directory created with 4 files: `AGENTS.md`, `HEARTBEAT.md`, `SOUL.md`, `TOOLS.md`
- CEO Agent visible in UI sidebar with title "Chief Executive Officer"
- Agent adapterConfig in DB has `command: "claude"`, `cwd` pointing to project root, `instructionsBundleMode: "external"`

- [ ] **Step 6: Assign task to CEO**

Create an issue and assign to CEO Agent. Verify:
- No "Process adapter missing command" error
- Agent workspace resolves to `.paperclip/workspaces/{agentId}/` (check server logs)
- If `claude` CLI is installed, agent should run successfully

- [ ] **Step 7: Verify idempotency**

Restart server, login again. Verify:
- No duplicate `agents/ceo/` materialization
- No duplicate company or agent created
