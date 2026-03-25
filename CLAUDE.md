# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Paperclip

Paperclip is an open-source control plane for AI-agent companies. It orchestrates teams of AI agents with org charts, budgets, governance, and task coordination. The current implementation target is V1 (see `doc/SPEC-implementation.md`).

## Common Commands

```sh
pnpm install              # Install dependencies
pnpm dev                  # Start dev (API + UI at localhost:3100, watch mode)
pnpm dev:once             # Start dev without file watching
pnpm typecheck            # TypeScript check across all packages (pnpm -r typecheck)
pnpm test:run             # Run all vitest tests
pnpm build                # Build all packages
pnpm test:e2e             # Playwright E2E tests (headless)
```

### Database commands

```sh
pnpm db:generate          # Generate migration after editing schema files
pnpm db:migrate           # Apply pending migrations
```

### Running a single test

```sh
npx vitest run path/to/test.ts                    # Run a specific test file
npx vitest run -t "test name pattern"             # Run tests matching a name
npx vitest run --project server path/to/test.ts   # Run within a specific project
```

Vitest projects: `packages/db`, `packages/adapters/opencode-local`, `server`, `ui`, `cli`.

### E2E tests

```sh
pnpm test:e2e                # Playwright headless
pnpm test:e2e:headed         # Playwright with browser visible
```

E2E config is at `tests/e2e/playwright.config.ts`. There is also a separate release-smoke suite at `tests/release-smoke/`.

### Reset local dev DB

```sh
rm -rf data/pglite && pnpm dev
```

### Pre-commit verification

```sh
pnpm -r typecheck && pnpm test:run && pnpm build
```

## Architecture

**Monorepo** using pnpm workspaces (`pnpm@9.15.4`, Node 20+).

### Workspace layout

| Package | Purpose |
|---------|---------|
| `server/` | Express 5 REST API + orchestration services (port 3100) |
| `ui/` | React 19 + Vite + Tailwind CSS 4 board UI |
| `cli/` | CLI tool (`pnpm paperclipai <command>`) |
| `packages/db/` | Drizzle ORM schema, migrations, DB clients |
| `packages/shared/` | Shared types, constants, validators, API path constants |
| `packages/adapter-utils/` | Base utilities for agent adapters |
| `packages/adapters/*` | Agent runtime adapters (claude-local, codex-local, cursor-local, gemini-local, openclaw-gateway, etc.) |
| `packages/plugins/sdk/` | Plugin SDK for extension authors |
| `packages/plugins/create-paperclip-plugin/` | Plugin scaffolding CLI |
| `packages/plugins/examples/` | Example plugins (hello-world, kitchen-sink, etc.) |
| `tests/e2e/` | Playwright end-to-end tests |
| `skills/` | Claude Code skills for Paperclip workflows |

### Data flow

All API routes are under `/api`. Everything is **company-scoped** — domain entities belong to a company and routes enforce company boundaries. The server uses Express middleware for auth, validation, and activity logging. The UI talks to the API via React Query (`@tanstack/react-query`).

### Database

- **ORM**: Drizzle ORM with PostgreSQL
- **Dev**: Leave `DATABASE_URL` unset — embedded PGlite auto-starts (data at `data/pglite`)
- **Schema**: `packages/db/src/schema/*.ts` — new tables must be exported from `packages/db/src/schema/index.ts`
- **Migration flow**: Edit schema → `pnpm db:generate` → `pnpm db:migrate` (note: `drizzle.config.ts` reads compiled schema from `dist/schema/*.js`, so `db:generate` compiles first)

### Auth model

- Board access = full operator control
- Agent access via bearer API keys (hashed at rest in `agent_api_keys` table)
- User auth via `better-auth`
- Agent keys must not cross company boundaries

### Plugin system

The server hosts a full plugin runtime. Plugins are loaded via `server/src/services/plugin-*.ts` services (loader, registry, lifecycle, sandbox, worker manager, etc.). Plugin authors use `packages/plugins/sdk/` and can scaffold new plugins with `packages/plugins/create-paperclip-plugin/`. See example plugins in `packages/plugins/examples/`.

### Server structure (`server/src/`)

- `routes/` — API endpoint handlers (company-scoped, with access checks)
- `services/` — Business logic layer
- `middleware/` — Auth, logging, error handling, validation
- `adapters/` — Agent adapter integration
- `realtime/` — WebSocket live events

### UI structure (`ui/src/`)

- `pages/` — React page components
- `components/` — Reusable UI components (Radix UI + Lucide icons)
- `api/` — API client layer
- `context/` — React context providers (auth, company selection)
- `hooks/` — Custom React hooks

## Key Engineering Rules

1. **Company-scoped**: Every domain entity is scoped to a company. Enforce company boundaries in routes/services.

2. **Keep contracts synchronized**: When changing schema/API behavior, update all impacted layers — `packages/db` schema → `packages/shared` types → `server` routes/services → `ui` API clients and pages.

3. **Control-plane invariants**: Single-assignee task model, atomic issue checkout, approval gates for governed actions, budget hard-stop auto-pause, activity logging for mutations.

4. **When adding endpoints**: Apply company access checks, enforce actor permissions (board vs agent), write activity log entries for mutations, return consistent HTTP errors (400/401/403/404/409/422/500).

5. **Lockfile policy**: Do not commit `pnpm-lock.yaml` in PRs — GitHub Actions manages it.

6. **Do not replace strategic docs wholesale** — prefer additive updates. Keep `doc/SPEC.md` and `doc/SPEC-implementation.md` aligned. New plan docs go in `doc/plans/` with `YYYY-MM-DD-slug.md` filenames.

## Key Documentation

Read before making changes:
1. `doc/GOAL.md` — Vision and purpose
2. `doc/PRODUCT.md` — Product definition, company model
3. `doc/SPEC-implementation.md` — V1 build contract
4. `doc/DEVELOPING.md` — Development setup details
5. `doc/DATABASE.md` — Database setup options
6. `AGENTS.md` — Contributor guidance and engineering rules
