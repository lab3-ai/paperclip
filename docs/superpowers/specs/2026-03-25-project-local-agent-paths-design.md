# Project-Local Agent Paths

**Date:** 2026-03-25
**Status:** Draft

## Goal

Make agent workspaces and instructions resolve project-locally instead of `~/.paperclip/`. After this change, a developer clones the repo, runs docker-compose + pnpm dev, signs up, and the CEO agent is fully functional with instructions materialized into the project directory.

## Context

- Bootstrap service (from prior work) creates a CEO agent on first signup
- The CEO agent fails with "Process adapter missing command" because `adapterType: "claude-local"` has no `adapterConfig` set (no `command`, no `cwd`)
- Agent workspaces resolve to `~/.paperclip/instances/default/workspaces/{agentId}/` via `home-paths.ts`
- Managed instructions resolve to `~/.paperclip/instances/default/companies/{companyId}/agents/{agentId}/instructions/`
- Both paths are external to the project, breaking the "self-contained local dev" goal

## Scope

### In scope

1. Project-local workspace resolution via new `resolveWorkspaceBaseDir()` in `home-paths.ts`
2. Bootstrap materializes CEO instructions from `onboarding-assets/ceo/` into `agents/ceo/`
3. Bootstrap sets correct `adapterConfig` for `claude-local` adapter (command, cwd, external instructions)
4. `.gitignore` update for `/agents/`

### Out of scope

- Changes to `agent-instructions.ts` (external bundle mode already supported)
- Changes to adapter code (`claude-local` already supports `command`/`cwd` config)
- Production/cloud deployment paths (they use `PAPERCLIP_HOME` env var, unchanged)
- UI changes

## Design

### 1. Path resolution (`server/src/home-paths.ts`)

**Key decision:** Do NOT modify `resolvePaperclipInstanceRoot()`. That function controls paths for secrets, logs, DB, backups — redirecting it would put sensitive data in the project tree. Instead, add targeted functions for workspace and project root resolution only.

**New exported functions:**

- `resolveProjectRoot(): string | null` — walks `process.cwd()` upward looking for `.paperclip/config.json`. Result is cached at first call (cwd doesn't change during server lifetime). Uses `fs.existsSync` for synchronous resolution.
- `resolveAgentInstructionsDir(role: string): string` — returns `{projectRoot}/agents/{role}/`. Throws if no project root found.

**Modified function:**

- `resolveDefaultAgentWorkspaceDir(agentId)` — when `resolveProjectRoot()` finds a project, resolve to `{projectRoot}/.paperclip/workspaces/{agentId}/` instead of `{instanceRoot}/workspaces/{agentId}/`. When `PAPERCLIP_HOME` is set, use existing behavior (production).

### 2. Bootstrap materialize instructions (`server/src/services/bootstrap.ts`)

When `createDefaultSetup()` creates the CEO agent:

1. Resolve `{projectRoot}/agents/ceo/` directory via `resolveAgentInstructionsDir("ceo")`
2. If directory doesn't exist:
   - Create it
   - Copy 4 files from `onboarding-assets/ceo/` using `loadDefaultAgentInstructionsBundle("ceo")`: `AGENTS.md`, `HEARTBEAT.md`, `SOUL.md`, `TOOLS.md`
3. If directory already exists: skip (idempotent)
4. Insert agent with correct config:
   - `adapterType: "claude-local"` (keeps skill sync, session management, quota tracking)
   - `adapterConfig.command`: from `PAPERCLIP_CEO_COMMAND` env var, default `"claude"`
   - `adapterConfig.cwd`: project root path
   - `adapterConfig.instructionsBundleMode`: `"external"`
   - `adapterConfig.instructionsRootPath`: `{projectRoot}/agents/ceo`
   - `adapterConfig.instructionsEntryFile`: `"AGENTS.md"`

**Note on portability:** `adapterConfig.cwd` and `adapterConfig.instructionsRootPath` store absolute paths in the DB. If the project directory moves, the agent config becomes stale. This is acceptable for local dev — re-running bootstrap or manually updating the agent config resolves it.

### 3. `.gitignore`

Add `/agents/` to `.gitignore` (leading slash scopes to project root only). Instructions are materialized per-developer and may be customized locally.

### 4. Directory structure (after bootstrap)

```
paperclip/
├── agents/                          # gitignored, materialized by bootstrap
│   └── ceo/
│       ├── AGENTS.md
│       ├── HEARTBEAT.md
│       ├── SOUL.md
│       └── TOOLS.md
├── .paperclip/
│   ├── config.json                  # committed, project config
│   └── workspaces/                  # gitignored, agent working dirs
│       └── {agentId}/
```

### 5. Files changed summary

| File | Action |
|------|--------|
| `server/src/home-paths.ts` | Add `resolveProjectRoot()`, `resolveAgentInstructionsDir()`, modify `resolveDefaultAgentWorkspaceDir()` |
| `server/src/services/bootstrap.ts` | Materialize instructions to `agents/ceo/`, set correct adapterConfig |
| `.gitignore` | Add `/agents/` |

### 6. What stays unchanged

- `resolvePaperclipInstanceRoot()` — untouched, secrets/logs/db paths remain at `~/.paperclip/`
- `server/src/services/agent-instructions.ts` — external bundle mode already handles `instructionsRootPath` from adapterConfig
- Adapter code — `claude-local` already supports `command`/`cwd` in config
- Production deployments — `PAPERCLIP_HOME` env var takes priority

### 7. Env vars

| Env var | Default | Purpose |
|---------|---------|---------|
| `PAPERCLIP_CEO_COMMAND` | `"claude"` | CLI command for CEO agent adapter |
| `PAPERCLIP_HOME` | (unset) | When set, disables project-local workspace resolution (production) |

### 8. Rollback

- Revert `home-paths.ts` changes → workspaces fall back to `~/.paperclip/`
- Delete `agents/` directory → instructions gone but can be re-materialized
- Set `PAPERCLIP_HOME=~/.paperclip` → forces old workspace behavior

## Testing

1. Fresh DB + `pnpm dev` + signup → verify CEO agent created with correct adapterConfig
2. Verify `agents/ceo/` directory created with 4 instruction files
3. Verify agent workspace resolves to `.paperclip/workspaces/{agentId}/` (not `~/.paperclip/...`)
4. Assign task to CEO → verify adapter runs with correct command/cwd (no "missing command" error)
5. Set `PAPERCLIP_HOME=~/.paperclip` → verify falls back to old paths (production compat)
6. Restart server + re-login → verify no duplicate materialization (idempotent)
