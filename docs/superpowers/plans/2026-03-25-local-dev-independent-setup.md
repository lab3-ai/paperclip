# Local Dev Independent Setup + Auto-Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Paperclip fully self-contained for local dev — no `~/.paperclip` dependency. Docker-compose PostgreSQL + authenticated mode + auto-bootstrap company/agent on first signup.

**Architecture:** Project-local `.paperclip/config.json` overrides the home-directory config via existing ancestor-search logic. A new `bootstrap.ts` service auto-creates company + agent post-login when DB is empty. Integration via auth middleware in `index.ts`.

**Tech Stack:** Express 5, Drizzle ORM, PostgreSQL 17, better-auth, Vitest

---

### Task 1: Create project-local `.paperclip/config.json`

**Files:**
- Create: `paperclip/.paperclip/config.json`

- [ ] **Step 1: Create the config file**

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

- [ ] **Step 2: Verify `.gitignore` handles this correctly**

Check that `.paperclip/config.json` is NOT in `.gitignore` (it should be committed).
Check that `.paperclip/.env` IS in `.gitignore` (already is — line 10).

- [ ] **Step 3: Commit**

```bash
git add .paperclip/config.json
git commit -m "feat: add project-local .paperclip/config.json for self-contained dev"
```

---

### Task 2: Update `.env` for authenticated mode

**Files:**
- Modify: `.env`

- [ ] **Step 1: Update `.env`**

Uncomment `DATABASE_URL` and set `PAPERCLIP_DEPLOYMENT_MODE`:

```env
DATABASE_URL=postgres://paperclip:paperclip@localhost:5432/paperclip
# PORT=3100
# SERVE_UI=false
PAPERCLIP_DEPLOYMENT_MODE=authenticated
# PAPERCLIP_DEPLOYMENT_EXPOSURE=private
# PAPERCLIP_AUTH_BASE_URL_MODE=auto
# PAPERCLIP_AUTH_PUBLIC_BASE_URL=https://paperclip.example.com
# PAPERCLIP_AGENT_JWT_SECRET=paperclip-dev-secret
# PAPERCLIP_SECRETS_PROVIDER=local
# PAPERCLIP_SECRETS_STRICT_MODE=false
# PAPERCLIP_SECRETS_MASTER_KEY_FILE=./secrets/master.key
BETTER_AUTH_SECRET="lol"
```

Note: `.env` is gitignored, so this is a local-only change. The `.paperclip/config.json` (committed) provides the same defaults for teammates.

- [ ] **Step 2: Verify config loads correctly**

Run: `cd paperclip && node -e "console.log(require('dotenv').config().parsed)"`
Expected: Shows `DATABASE_URL` and `PAPERCLIP_DEPLOYMENT_MODE=authenticated`

---

### Task 3: Create bootstrap service

**Files:**
- Create: `server/src/services/bootstrap.ts`
- Modify: `server/src/services/index.ts`

- [ ] **Step 1: Write the bootstrap service**

Create `server/src/services/bootstrap.ts`:

```typescript
import { and, count, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  companies,
  agents,
  companyMemberships,
  instanceUserRoles,
} from "@paperclipai/db";
import { logger } from "../middleware/logger.js";

export interface BootstrapResult {
  action: "created_company" | "assigned_to_company" | "noop";
  companyId?: string;
}

export function bootstrapService(db: Db) {
  const isEnabled = process.env.PAPERCLIP_AUTO_BOOTSTRAP !== "false";

  async function maybeBootstrapUser(
    userId: string,
    userName?: string | null,
  ): Promise<BootstrapResult> {
    if (!isEnabled) return { action: "noop" };

    // Check if user already has any company memberships
    const existingMemberships = await db
      .select({ id: companyMemberships.id })
      .from(companyMemberships)
      .where(
        and(
          eq(companyMemberships.principalType, "user"),
          eq(companyMemberships.principalId, userId),
          eq(companyMemberships.status, "active"),
        ),
      )
      .limit(1);

    if (existingMemberships.length > 0) {
      return { action: "noop" };
    }

    // Check if any companies exist
    const [companyCount] = await db
      .select({ count: count() })
      .from(companies);

    if (companyCount.count === 0) {
      // First user: create default company + agent, promote to admin
      return createDefaultSetup(userId, userName);
    }

    // Companies exist but user has no membership: assign to first company
    const [firstCompany] = await db
      .select({ id: companies.id })
      .from(companies)
      .limit(1);

    if (firstCompany) {
      await db.insert(companyMemberships).values({
        companyId: firstCompany.id,
        principalType: "user",
        principalId: userId,
        status: "active",
        membershipRole: "member",
      });

      logger.info(
        { userId, companyId: firstCompany.id },
        "Auto-assigned user to existing company",
      );

      return { action: "assigned_to_company", companyId: firstCompany.id };
    }

    return { action: "noop" };
  }

  async function createDefaultSetup(
    userId: string,
    userName?: string | null,
  ): Promise<BootstrapResult> {
    const companyName =
      process.env.PAPERCLIP_DEFAULT_COMPANY_NAME || "My Company";
    const agentName =
      process.env.PAPERCLIP_DEFAULT_AGENT_NAME || "Assistant";

    // Create company
    const [company] = await db
      .insert(companies)
      .values({ name: companyName })
      .returning();

    // Promote user to instance_admin
    const existingRole = await db
      .select({ id: instanceUserRoles.id })
      .from(instanceUserRoles)
      .where(
        and(
          eq(instanceUserRoles.userId, userId),
          eq(instanceUserRoles.role, "instance_admin"),
        ),
      )
      .then((rows) => rows[0] ?? null);

    if (!existingRole) {
      await db.insert(instanceUserRoles).values({
        userId,
        role: "instance_admin",
      });
    }

    // Assign user as owner
    await db.insert(companyMemberships).values({
      companyId: company.id,
      principalType: "user",
      principalId: userId,
      status: "active",
      membershipRole: "owner",
    });

    // Create default agent
    await db.insert(agents).values({
      companyId: company.id,
      name: agentName,
      role: "general",
      adapterType: "claude-local",
    });

    logger.info(
      { userId, companyId: company.id, companyName, agentName },
      "Auto-bootstrap: created default company and agent for first user",
    );

    return { action: "created_company", companyId: company.id };
  }

  return { maybeBootstrapUser };
}
```

- [ ] **Step 2: Export from services index**

Add to `server/src/services/index.ts`:

```typescript
export { bootstrapService } from "./bootstrap.js";
```

- [ ] **Step 3: Commit**

```bash
git add server/src/services/bootstrap.ts server/src/services/index.ts
git commit -m "feat: add bootstrap service for auto-creating company and agent"
```

---

### Task 4: Integrate bootstrap into auth flow

**Files:**
- Modify: `server/src/index.ts` (around line 437-476, the `authenticated` mode block)

- [ ] **Step 1: Import and initialize bootstrap service**

Add import at top of `server/src/index.ts` (after existing imports, around line 32):

```typescript
import { bootstrapService } from "./services/bootstrap.js";
```

- [ ] **Step 2: Create bootstrap instance and wrap resolveSession**

After the better-auth setup block (after line 475 `authReady = true;`), add bootstrap wrapping logic. The key insight: we wrap `resolveSession` to call `maybeBootstrapUser` after successful session resolution.

Find this block in `server/src/index.ts` (around line 437-476):

```typescript
  if (config.deploymentMode === "authenticated") {
    // ... existing better-auth setup ...
    authReady = true;
  }
```

After `authReady = true;` (line 475) and before the closing `}` of the if-block, add:

```typescript
    // Auto-bootstrap: wrap resolveSession to bootstrap user on first login
    const bootstrap = bootstrapService(db as any);
    const originalResolveSession = resolveSession!;
    resolveSession = async (req) => {
      const session = await originalResolveSession(req);
      if (session?.user?.id) {
        try {
          await bootstrap.maybeBootstrapUser(
            session.user.id,
            session.user.name,
          );
        } catch (err) {
          logger.warn({ err, userId: session.user.id }, "Bootstrap check failed (non-fatal)");
        }
      }
      return session;
    };
```

This is non-intrusive: bootstrap runs after session resolution, is idempotent, and failures don't block auth.

- [ ] **Step 3: Commit**

```bash
git add server/src/index.ts
git commit -m "feat: integrate auto-bootstrap into authenticated mode login flow"
```

---

### Task 5: Write tests for bootstrap service

**Files:**
- Create: `server/src/__tests__/bootstrap-service.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { bootstrapService } from "../services/bootstrap.js";

// Mock logger to avoid noise in tests
vi.mock("../middleware/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

/**
 * These tests use a mock Db that tracks insert/select calls.
 * The bootstrap service uses raw Drizzle queries, so we mock
 * the db methods to return controlled results.
 */

function createMockDb(state: {
  memberships?: Array<{ id: string }>;
  companyCount?: number;
  companies?: Array<{ id: string }>;
}) {
  const insertedValues: Array<{ table: string; values: unknown }> = [];

  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockImplementation(() => {
      // Return based on what was last selected
      return Promise.resolve(state.memberships ?? []);
    }),
    then: vi.fn(),
    insert: vi.fn().mockImplementation(() => ({
      values: vi.fn().mockImplementation((vals: unknown) => {
        insertedValues.push({ table: "unknown", values: vals });
        return {
          returning: vi.fn().mockReturnValue(
            Promise.resolve([{ id: "generated-id", ...vals as object }]),
          ),
        };
      }),
    })),
    _insertedValues: insertedValues,
  };

  return mockDb;
}

describe("bootstrapService", () => {
  beforeEach(() => {
    delete process.env.PAPERCLIP_AUTO_BOOTSTRAP;
    delete process.env.PAPERCLIP_DEFAULT_COMPANY_NAME;
    delete process.env.PAPERCLIP_DEFAULT_AGENT_NAME;
  });

  it("returns noop when PAPERCLIP_AUTO_BOOTSTRAP is false", async () => {
    process.env.PAPERCLIP_AUTO_BOOTSTRAP = "false";
    const db = createMockDb({});
    const bootstrap = bootstrapService(db as any);
    const result = await bootstrap.maybeBootstrapUser("user-1");
    expect(result.action).toBe("noop");
  });

  it("returns noop when user already has memberships", async () => {
    const db = createMockDb({ memberships: [{ id: "membership-1" }] });
    const bootstrap = bootstrapService(db as any);
    const result = await bootstrap.maybeBootstrapUser("user-1");
    expect(result.action).toBe("noop");
  });
});
```

Note: Full integration tests would require a real DB connection (like other tests in this project use). The unit tests above validate the basic control flow. A manual E2E test via the dev workflow is the primary validation method per the spec's Testing section.

- [ ] **Step 2: Run the tests**

Run: `npx vitest run server/src/__tests__/bootstrap-service.test.ts --project server`
Expected: Tests pass

- [ ] **Step 3: Commit**

```bash
git add server/src/__tests__/bootstrap-service.test.ts
git commit -m "test: add bootstrap service unit tests"
```

---

### Task 6: Verify end-to-end local dev workflow

This is a manual verification task following the spec's Testing section.

- [ ] **Step 1: Start PostgreSQL**

```bash
cd paperclip
docker compose up db -d
```

Expected: PostgreSQL container starts, healthcheck passes.

- [ ] **Step 2: Verify PostgreSQL is healthy**

```bash
docker compose ps
```

Expected: `db` service shows "healthy" status.

- [ ] **Step 3: Apply migrations**

```bash
pnpm db:migrate
```

Expected: Migrations apply successfully against the docker PostgreSQL (not embedded). Output shows pending migrations being applied.

- [ ] **Step 4: Start dev server**

```bash
pnpm dev
```

Expected: Startup banner shows:
- `Deploy: authenticated (private)` (NOT `local_trusted`)
- `Database: postgres://paperclip:...@localhost:5432/paperclip` (NOT embedded-postgres)
- `Mode: external-postgres` (NOT embedded-postgres)

- [ ] **Step 5: Sign up first user**

Open `http://localhost:3100` in browser.
Expected: Login/signup screen (authenticated mode).
Sign up with email and password.
Expected: After signup, company "My Company" and agent "Assistant" are auto-created.

- [ ] **Step 6: Verify auto-bootstrap worked**

Check the UI: should show "My Company" in the company selector and "Assistant" agent in the agents list.

- [ ] **Step 7: Sign up second user**

Sign up with a different email.
Expected: Second user is auto-assigned to "My Company" as member (no duplicate company).

- [ ] **Step 8: Restart server and verify idempotency**

Stop and restart `pnpm dev`.
Login again with first user.
Expected: No duplicate company or agent created. Everything works as before.

---

### Task 7: Typecheck and existing tests

- [ ] **Step 1: Run typecheck**

```bash
pnpm -r typecheck
```

Expected: No TypeScript errors.

- [ ] **Step 2: Run existing tests**

```bash
pnpm test:run
```

Expected: All existing tests still pass. No regressions.

- [ ] **Step 3: Final commit if any fixes needed**

If typecheck or tests revealed issues, fix and commit.
