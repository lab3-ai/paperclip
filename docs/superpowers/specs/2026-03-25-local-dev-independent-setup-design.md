# Local Dev Independent Setup + Auto-Bootstrap

**Date:** 2026-03-25
**Status:** Draft

## Goal

Make the Paperclip project fully self-contained for local development — no dependency on `~/.paperclip/`. Dev clones repo, runs docker-compose + pnpm dev, signs up, and gets a ready-to-use workspace with company and agent auto-created.

## Context

- Server currently resolves config from `~/.paperclip/instances/default/config.json` as fallback
- Config search walks ancestor directories for `.paperclip/config.json` — placing one in project root takes priority
- `authenticated` mode has no auto-bootstrap: after signup, user must manually create company and agent
- `local_trusted` mode creates a `local-board` principal but also doesn't auto-create company

## Scope

### In scope

1. Project-local `.paperclip/config.json` to decouple from `~/.paperclip`
2. Auto-bootstrap service: create default company + agent on first user signup
3. Update `.env` with correct values
4. Document the local dev workflow

### Out of scope

- CORS configuration (user handles)
- FE deployment to Cloudflare Pages (user handles)
- BE deployment to VM (devops handles)
- CI/CD pipeline (devops handles)
- Changes to existing UI flows

## Design

### 1. Project-local config

**New file: `.paperclip/config.json`**

```json
{
  "$meta": { "version": 1, "source": "configure" },
  "database": {
    "mode": "postgres",
    "connectionString": "postgres://paperclip:paperclip@localhost:5432/paperclip"
  },
  "server": {
    "deploymentMode": "authenticated",
    "serveUi": true,
    "port": 3100
  }
}
```

This file is committed to git (shared team config). Secrets stay in `.env` (already gitignored).

**Updated `.env`:**

```env
DATABASE_URL=postgres://paperclip:paperclip@localhost:5432/paperclip
PAPERCLIP_DEPLOYMENT_MODE=authenticated
BETTER_AUTH_SECRET=lol
```

Env vars override config.json, so production can set different values without needing a separate config file.

### 2. Auto-bootstrap service

**New file: `server/src/services/bootstrap.ts`**

A service that runs post-login and ensures the first user gets a working environment.

**Trigger:** Called after successful authentication, in auth middleware or as a post-login hook.

**Logic:**

```
function maybeBootstrapUser(userId, userEmail, userName):
  1. Check: are there any companies in DB?
  2. If NO companies exist:
     a. Create default company
        - name: env PAPERCLIP_DEFAULT_COMPANY_NAME || "My Company"
     b. Assign user as owner of company
     c. Promote user to instance_admin
     d. Create default agent
        - name: env PAPERCLIP_DEFAULT_AGENT_NAME || "Assistant"
        - role: "individual_contributor"
        - adapter: "claude-local" (or configurable)
     e. Log bootstrap activity
  3. If companies exist but user has NO memberships:
     a. Auto-assign user to the first company as "member"
  4. If user already has memberships:
     a. No-op
```

**Idempotency:** The function checks state before acting — safe to call on every login.

**Config via env vars:**

| Env var | Default | Purpose |
|---------|---------|---------|
| `PAPERCLIP_DEFAULT_COMPANY_NAME` | `"My Company"` | Name for auto-created company |
| `PAPERCLIP_DEFAULT_AGENT_NAME` | `"Assistant"` | Name for auto-created agent |
| `PAPERCLIP_AUTO_BOOTSTRAP` | `"true"` | Enable/disable auto-bootstrap |

### 3. Integration point

**Modified file: `server/src/index.ts` or auth middleware**

After better-auth successfully authenticates a user (login or signup), call `maybeBootstrapUser()`. This should be a lightweight check (single DB query for company count) that short-circuits quickly for subsequent logins.

### 4. Local dev workflow

```bash
# 1. Start PostgreSQL
docker compose up db -d

# 2. Apply migrations
pnpm db:migrate

# 3. Start app
pnpm dev

# 4. Open http://localhost:3100
#    → Sign up with email/password
#    → Company "My Company" + agent "Assistant" auto-created
#    → Ready to use
```

### 5. Files changed summary

| File | Action |
|------|--------|
| `.paperclip/config.json` | **New** — project-local config |
| `.env` | **Update** — uncomment DATABASE_URL, set authenticated mode |
| `server/src/services/bootstrap.ts` | **New** — auto-bootstrap service |
| `server/src/index.ts` or auth middleware | **Modify** — call bootstrap after login |

### 6. Rollback

- Delete `.paperclip/config.json` → falls back to `~/.paperclip`
- Comment out DATABASE_URL in `.env` → falls back to embedded PGLite
- Set `PAPERCLIP_AUTO_BOOTSTRAP=false` → disables auto-bootstrap

## Testing

1. Fresh DB: `docker compose up db -d && pnpm db:migrate && pnpm dev`
2. Sign up first user → verify company + agent auto-created
3. Sign up second user → verify auto-assigned to existing company (no duplicate company)
4. Restart server → verify no duplicate bootstrap on next login
5. Set `PAPERCLIP_AUTO_BOOTSTRAP=false` → verify no auto-creation
