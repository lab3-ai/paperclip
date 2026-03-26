# Local Dev with PostgreSQL + Authenticated Mode

**Date:** 2026-03-24
**Status:** Draft

## Goal

Run Paperclip locally using PostgreSQL via docker-compose instead of embedded PGLite, with `authenticated` deployment mode — matching production configuration.

## Context

- Project already has `docker-compose.yml` with PostgreSQL 17 + server services
- Currently using embedded PGLite with `local_trusted` mode
- Need to switch to external PostgreSQL + `authenticated` mode for production parity
- See also: `doc/DATABASE.md` for full database configuration options

## Scope

Config-only change — no code modifications required.

### In scope

- Update `.env` to use `DATABASE_URL`, `authenticated` mode
- Document the local dev workflow with PostgreSQL

### Out of scope

- CORS configuration (user handles manually)
- FE deployment to Cloudflare Pages (user handles)
- BE deployment to VM (devops handles)
- CI/CD pipeline (devops handles)

## Design

### Changes

**File: `.env`** — Make these changes:

1. **Uncomment** `DATABASE_URL` and set the value:
   ```
   DATABASE_URL=postgres://paperclip:paperclip@localhost:5432/paperclip
   ```

2. **Uncomment** `PAPERCLIP_DEPLOYMENT_MODE` and change the value from `local_trusted` to `authenticated`:
   ```
   PAPERCLIP_DEPLOYMENT_MODE=authenticated
   ```

3. `BETTER_AUTH_SECRET="lol"` is already set — no change needed for local dev. **Must be changed to a strong secret for production.**

All other values remain as-is (commented out = defaults). `PAPERCLIP_DEPLOYMENT_EXPOSURE` defaults to `private` for authenticated mode — no change needed.

### Local Dev Workflow

```bash
# 1. Start PostgreSQL only (detached)
docker compose up db -d

# 2. Verify PostgreSQL is healthy
docker compose ps   # should show db as "healthy"

# 3. Apply database migrations
pnpm db:migrate

# 4. Start app with hot reload
pnpm dev
```

**Note:** The `server` service in docker-compose.yml is for containerized deployment. For local dev, we only start `db` and run the app via `pnpm dev` for hot reload.

### How it works

- `docker compose up db` starts only the `db` service (PostgreSQL 17 on port 5432)
- The app reads `DATABASE_URL` from `.env` and connects to PostgreSQL instead of starting embedded PGLite
- Data persists in Docker volume `pgdata`
- `authenticated` mode requires user login — first user creates account via UI
- Existing PGLite data will not be migrated — the PostgreSQL database starts empty

### Port conflict

If port 5432 is already in use (e.g., a local PostgreSQL installation), either stop the existing instance or remap the port in `docker-compose.yml`:
```yaml
ports:
  - "5433:5432"
```
And update `DATABASE_URL` accordingly: `postgres://paperclip:paperclip@localhost:5433/paperclip`

### Rollback

To revert to embedded PGLite:
```bash
# Comment out DATABASE_URL in .env
# Change PAPERCLIP_DEPLOYMENT_MODE back to local_trusted (or comment it out)
docker compose stop db
```

## Testing

1. `docker compose up db -d` — verify PostgreSQL starts
2. `docker compose ps` — verify db service shows "healthy"
3. `pnpm db:migrate` — verify migrations apply successfully
4. `pnpm dev` — verify app starts and connects to PostgreSQL
5. Open `http://localhost:3100` — verify login screen appears (authenticated mode)
6. Create account and login — verify full functionality
