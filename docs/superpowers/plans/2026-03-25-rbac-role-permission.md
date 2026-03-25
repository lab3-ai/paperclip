# RBAC Role-Based Permission System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fixed role-based access control system with 4 roles (superadmin, admin, user, guest) and user management CRUD.

**Architecture:** Add `role` column to `authUsers` table. Define permission map as a const in shared package. Add `requirePermission()` middleware that checks role against permission map. Build user management API endpoints and UI pages.

**Tech Stack:** Drizzle ORM (migration), Express 5 (routes), React 19 + Radix UI + React Query (UI), Vitest (tests)

**Spec:** `docs/superpowers/specs/2026-03-25-rbac-role-permission-design.md`

---

### Task 1: Add role types and permission map to shared package

**Files:**
- Modify: `packages/shared/src/constants.ts` (after line 352)

- [ ] **Step 1: Write the failing test**

Create test file:

```typescript
// packages/shared/src/__tests__/role-permissions.test.ts
import { describe, it, expect } from "vitest";
import { USER_ROLES, ROLE_PERMISSIONS, type UserRole } from "../constants.js";

describe("USER_ROLES", () => {
  it("contains exactly 4 roles", () => {
    expect(USER_ROLES).toEqual(["superadmin", "admin", "user", "guest"]);
  });
});

describe("ROLE_PERMISSIONS", () => {
  it("has permissions defined for every role", () => {
    for (const role of USER_ROLES) {
      expect(ROLE_PERMISSIONS[role]).toBeDefined();
      expect(Array.isArray(ROLE_PERMISSIONS[role])).toBe(true);
      expect(ROLE_PERMISSIONS[role].length).toBeGreaterThan(0);
    }
  });

  it("superadmin has all permissions including company:create", () => {
    expect(ROLE_PERMISSIONS.superadmin).toContain("company:create");
    expect(ROLE_PERMISSIONS.superadmin).toContain("company:delete");
    expect(ROLE_PERMISSIONS.superadmin).toContain("users:assign_role");
    expect(ROLE_PERMISSIONS.superadmin).toContain("instance:update");
  });

  it("admin cannot create or delete companies", () => {
    expect(ROLE_PERMISSIONS.admin).not.toContain("company:create");
    expect(ROLE_PERMISSIONS.admin).not.toContain("company:delete");
    expect(ROLE_PERMISSIONS.admin).not.toContain("instance:update");
  });

  it("admin can manage users and agents", () => {
    expect(ROLE_PERMISSIONS.admin).toContain("users:create");
    expect(ROLE_PERMISSIONS.admin).toContain("agents:create");
    expect(ROLE_PERMISSIONS.admin).toContain("plugins:install");
  });

  it("user has limited permissions — no user management", () => {
    expect(ROLE_PERMISSIONS.user).not.toContain("users:create");
    expect(ROLE_PERMISSIONS.user).not.toContain("users:delete");
    expect(ROLE_PERMISSIONS.user).toContain("agents:create");
    expect(ROLE_PERMISSIONS.user).toContain("issues:create");
  });

  it("guest has read-only permissions", () => {
    const guestPerms = ROLE_PERMISSIONS.guest;
    for (const perm of guestPerms) {
      expect(perm).toMatch(/:read$/);
    }
  });

  it("each role's permissions are a subset of superadmin", () => {
    const superPerms = new Set(ROLE_PERMISSIONS.superadmin);
    for (const role of ["admin", "user", "guest"] as const) {
      for (const perm of ROLE_PERMISSIONS[role]) {
        expect(superPerms.has(perm)).toBe(true);
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/shared/src/__tests__/role-permissions.test.ts`
Expected: FAIL — `USER_ROLES` and `ROLE_PERMISSIONS` not exported

- [ ] **Step 3: Add role types and permission map**

In `packages/shared/src/constants.ts`, add after the existing `PERMISSION_KEYS` block (after line 352):

```typescript
// ---------------------------------------------------------------------------
// RBAC — Role-based access control
// ---------------------------------------------------------------------------

export const USER_ROLES = ["superadmin", "admin", "user", "guest"] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Fixed permission map — each role's allowed actions. */
export const ROLE_PERMISSIONS: Record<UserRole, readonly string[]> = {
  superadmin: [
    "company:create", "company:read", "company:update", "company:delete",
    "users:create", "users:read", "users:update", "users:delete",
    "users:assign_role",
    "agents:create", "agents:read", "agents:update", "agents:delete",
    "plugins:install", "plugins:remove",
    "issues:create", "issues:read", "issues:update", "issues:delete",
    "skills:create", "skills:read", "skills:update", "skills:delete",
    "tasks:assign",
    "approvals:read", "approvals:create", "approvals:approve", "approvals:reject",
    "goals:create", "goals:read", "goals:update", "goals:delete",
    "projects:create", "projects:read", "projects:update", "projects:delete",
    "routines:create", "routines:read", "routines:update", "routines:delete",
    "secrets:create", "secrets:read", "secrets:update", "secrets:delete",
    "budgets:read", "budgets:update",
    "instance:read", "instance:update",
    "activity:read",
  ],
  admin: [
    "company:read", "company:update",
    "users:create", "users:read", "users:update", "users:delete",
    "agents:create", "agents:read", "agents:update", "agents:delete",
    "plugins:install", "plugins:remove",
    "issues:create", "issues:read", "issues:update", "issues:delete",
    "skills:create", "skills:read", "skills:update", "skills:delete",
    "tasks:assign",
    "approvals:read", "approvals:create", "approvals:approve", "approvals:reject",
    "goals:create", "goals:read", "goals:update", "goals:delete",
    "projects:create", "projects:read", "projects:update", "projects:delete",
    "routines:create", "routines:read", "routines:update", "routines:delete",
    "secrets:create", "secrets:read", "secrets:update", "secrets:delete",
    "budgets:read", "budgets:update",
    "activity:read",
  ],
  user: [
    "company:read",
    "users:read",
    "agents:create", "agents:read", "agents:update", "agents:delete",
    "plugins:install", "plugins:remove",
    "issues:create", "issues:read", "issues:update", "issues:delete",
    "skills:create", "skills:read", "skills:update", "skills:delete",
    "tasks:assign",
    "approvals:read", "approvals:create",
    "goals:read",
    "projects:read",
    "routines:read",
    "budgets:read",
    "activity:read",
  ],
  guest: [
    "company:read",
    "users:read",
    "agents:read",
    "issues:read",
    "skills:read",
    "approvals:read",
    "goals:read",
    "projects:read",
    "routines:read",
    "activity:read",
  ],
} as const;

/** Check if a role has a specific permission. */
export function hasRolePermission(role: UserRole, permission: string): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/shared/src/__tests__/role-permissions.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/constants.ts packages/shared/src/__tests__/role-permissions.test.ts
git commit -m "feat(shared): add USER_ROLES, ROLE_PERMISSIONS, and hasRolePermission"
```

---

### Task 2: Add `role` column to `authUsers` schema + generate migration

**Files:**
- Modify: `packages/db/src/schema/auth.ts`

- [ ] **Step 1: Add role column to authUsers schema**

In `packages/db/src/schema/auth.ts`, add the `role` field to the `authUsers` table:

```typescript
// After the existing fields (image, createdAt, updatedAt), add:
  role: text("role").notNull().default("guest"),
```

The full table should look like:
```typescript
export const authUsers = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  role: text("role").notNull().default("guest"),
});
```

- [ ] **Step 2: Generate migration**

Run: `pnpm db:generate`
Expected: New migration file created in `packages/db/src/migrations/`

- [ ] **Step 3: Verify migration SQL**

Read the generated migration file. It should contain:
```sql
ALTER TABLE "user" ADD COLUMN "role" text DEFAULT 'guest' NOT NULL;
```

- [ ] **Step 4: Add data migration for existing instance admins**

Append to the generated migration SQL file (before the last statement-breakpoint or at the end):

```sql
--> statement-breakpoint
UPDATE "user" SET "role" = 'superadmin' WHERE "id" IN (SELECT "user_id" FROM "instance_user_roles" WHERE "role" = 'instance_admin');
```

This ensures existing instance admins are not locked out.

- [ ] **Step 5: Run migration locally**

Run: `pnpm db:migrate`
Expected: Migration applied successfully

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/schema/auth.ts packages/db/src/migrations/
git commit -m "feat(db): add role column to authUsers with data migration for instance admins"
```

---

### Task 3: Enrich actor with role in auth middleware

**Files:**
- Modify: `server/src/types/express.d.ts`
- Modify: `server/src/middleware/auth.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// server/src/__tests__/auth-middleware-role.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { actorMiddleware } from "../middleware/auth.js";

describe("actorMiddleware role enrichment", () => {
  it("sets role to superadmin for local_implicit actor", async () => {
    const app = express();
    const mockDb = {} as any;
    app.use(actorMiddleware(mockDb, { deploymentMode: "local_trusted" }));
    app.get("/test", (req, res) => {
      res.json({ role: req.actor.role, type: req.actor.type });
    });

    const res = await request(app).get("/test");
    expect(res.body.role).toBe("superadmin");
    expect(res.body.type).toBe("board");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/src/__tests__/auth-middleware-role.test.ts`
Expected: FAIL — `role` property does not exist on actor type

- [ ] **Step 3: Add `role` to actor type definition**

In `server/src/types/express.d.ts`, add `role?` to the actor interface:

```typescript
export {};

declare global {
  namespace Express {
    interface Request {
      actor: {
        type: "board" | "agent" | "none";
        userId?: string;
        agentId?: string;
        companyId?: string;
        companyIds?: string[];
        isInstanceAdmin?: boolean;
        keyId?: string;
        runId?: string;
        role?: string;
        source?: "local_implicit" | "session" | "board_key" | "agent_key" | "agent_jwt" | "none";
      };
    }
  }
}
```

- [ ] **Step 4: Add role to local_trusted actor in auth middleware**

In `server/src/middleware/auth.ts`, update the `local_trusted` branch (line 25-26):

Change:
```typescript
{ type: "board", userId: "local-board", isInstanceAdmin: true, source: "local_implicit" }
```
To:
```typescript
{ type: "board", userId: "local-board", isInstanceAdmin: true, source: "local_implicit", role: "superadmin" }
```

- [ ] **Step 5: Load role from DB for session-based board actors**

In `server/src/middleware/auth.ts`, in the session resolution block (around line 44-69), add `authUsers` import and load the role:

Add to imports at top:
```typescript
import { agentApiKeys, agents, companyMemberships, instanceUserRoles, authUsers } from "@paperclipai/db";
```

In the session block, after `const userId = session.user.id;`, update the parallel query to also fetch the user's role:

```typescript
const [roleRow, memberships, userRow] = await Promise.all([
  db
    .select({ id: instanceUserRoles.id })
    .from(instanceUserRoles)
    .where(and(eq(instanceUserRoles.userId, userId), eq(instanceUserRoles.role, "instance_admin")))
    .then((rows) => rows[0] ?? null),
  db
    .select({ companyId: companyMemberships.companyId })
    .from(companyMemberships)
    .where(
      and(
        eq(companyMemberships.principalType, "user"),
        eq(companyMemberships.principalId, userId),
        eq(companyMemberships.status, "active"),
      ),
    ),
  db
    .select({ role: authUsers.role })
    .from(authUsers)
    .where(eq(authUsers.id, userId))
    .then((rows) => rows[0] ?? null),
]);
req.actor = {
  type: "board",
  userId,
  companyIds: memberships.map((row) => row.companyId),
  isInstanceAdmin: Boolean(roleRow),
  role: userRow?.role ?? "guest",
  runId: runIdHeader ?? undefined,
  source: "session",
};
```

- [ ] **Step 6: Load role for board API key actors**

In the board key block (around line 86-101), after `req.actor = { ... }`, add role loading:

```typescript
const boardKeyUserRow = await db
  .select({ role: authUsers.role })
  .from(authUsers)
  .where(eq(authUsers.id, boardKey.userId))
  .then((rows) => rows[0] ?? null);

req.actor = {
  type: "board",
  userId: boardKey.userId,
  companyIds: access.companyIds,
  isInstanceAdmin: access.isInstanceAdmin,
  role: boardKeyUserRow?.role ?? "guest",
  keyId: boardKey.id,
  runId: runIdHeader || undefined,
  source: "board_key",
};
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx vitest run server/src/__tests__/auth-middleware-role.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add server/src/types/express.d.ts server/src/middleware/auth.ts server/src/__tests__/auth-middleware-role.test.ts
git commit -m "feat(server): enrich actor with role from authUsers in auth middleware"
```

---

### Task 4: Add `requirePermission()` middleware

**Files:**
- Modify: `server/src/routes/authz.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// server/src/__tests__/authz-require-permission.test.ts
import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { requirePermission } from "../routes/authz.js";

function makeApp(actor: any) {
  const app = express();
  app.use((req, _res, next) => {
    req.actor = actor;
    next();
  });
  app.get("/test", (req, res) => {
    try {
      requirePermission(req, "agents:create");
      res.json({ ok: true });
    } catch (err: any) {
      res.status(err.status ?? 500).json({ error: err.message });
    }
  });
  return app;
}

describe("requirePermission", () => {
  it("allows superadmin for any permission", async () => {
    const app = makeApp({ type: "board", role: "superadmin", source: "session" });
    const res = await request(app).get("/test");
    expect(res.status).toBe(200);
  });

  it("allows admin for agents:create", async () => {
    const app = makeApp({ type: "board", role: "admin", source: "session" });
    const res = await request(app).get("/test");
    expect(res.status).toBe(200);
  });

  it("allows user for agents:create", async () => {
    const app = makeApp({ type: "board", role: "user", source: "session" });
    const res = await request(app).get("/test");
    expect(res.status).toBe(200);
  });

  it("denies guest for agents:create", async () => {
    const app = makeApp({ type: "board", role: "guest", source: "session" });
    const res = await request(app).get("/test");
    expect(res.status).toBe(403);
  });

  it("bypasses RBAC for local_implicit source", async () => {
    const app = makeApp({ type: "board", role: undefined, source: "local_implicit" });
    const res = await request(app).get("/test");
    expect(res.status).toBe(200);
  });

  it("bypasses RBAC for agent actors", async () => {
    const app = makeApp({ type: "agent", agentId: "a1", companyId: "c1", source: "agent_key" });
    const res = await request(app).get("/test");
    expect(res.status).toBe(200);
  });

  it("denies non-board, non-agent actors", async () => {
    const app = makeApp({ type: "none", source: "none" });
    const res = await request(app).get("/test");
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/src/__tests__/authz-require-permission.test.ts`
Expected: FAIL — `requirePermission` not exported

- [ ] **Step 3: Implement requirePermission**

In `server/src/routes/authz.ts`, add:

```typescript
import { hasRolePermission, type UserRole } from "@paperclipai/shared";

export function requirePermission(req: Request, permission: string) {
  // local_trusted mode bypasses RBAC
  if (req.actor.source === "local_implicit") return;

  // Agent actors use assertCompanyAccess, not RBAC
  if (req.actor.type === "agent") return;

  // Must be a board actor
  if (req.actor.type !== "board") {
    throw forbidden("Board access required");
  }

  if (!hasRolePermission(req.actor.role as UserRole, permission)) {
    throw forbidden("Insufficient permissions");
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/src/__tests__/authz-require-permission.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/authz.ts server/src/__tests__/authz-require-permission.test.ts
git commit -m "feat(server): add requirePermission middleware with RBAC checks"
```

---

### Task 5: Update bootstrap to set superadmin role

**Files:**
- Modify: `server/src/services/bootstrap.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// server/src/__tests__/bootstrap-role.test.ts
import { describe, it, expect, vi } from "vitest";

describe("bootstrap sets superadmin role", () => {
  it("sets role=superadmin on first user during createDefaultSetup", async () => {
    // This test verifies that bootstrap updates authUsers.role
    // We'll check that db.update is called with role: "superadmin"
    const updateCalls: any[] = [];

    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
            then: vi.fn().mockResolvedValue(null),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "company-1", name: "My Company" }]),
        }),
      }),
      update: vi.fn().mockImplementation((table: any) => ({
        set: vi.fn().mockImplementation((data: any) => {
          updateCalls.push({ table: table?._.name, data });
          return {
            where: vi.fn().mockResolvedValue(undefined),
          };
        }),
      })),
    } as any;

    // Import after mock setup
    const { bootstrapService } = await import("../services/bootstrap.js");
    const service = bootstrapService(mockDb);

    await service.maybeBootstrapUser("user-1", "Test User");

    // Verify that authUsers.role was set to superadmin
    const roleUpdate = updateCalls.find((c) => c.table === "user" && c.data.role === "superadmin");
    expect(roleUpdate).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/src/__tests__/bootstrap-role.test.ts`
Expected: FAIL — no update call with `role: "superadmin"`

- [ ] **Step 3: Update bootstrap to set role**

In `server/src/services/bootstrap.ts`:

Add import for `authUsers`:
```typescript
import {
  companies,
  agents,
  companyMemberships,
  instanceUserRoles,
  authUsers,
} from "@paperclipai/db";
```

In the `createDefaultSetup` function, after the `instanceUserRoles` insert block (after line 149), add:

```typescript
    // Set role on authUsers table
    await db
      .update(authUsers)
      .set({ role: "superadmin" })
      .where(eq(authUsers.id, userId));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/src/__tests__/bootstrap-role.test.ts`
Expected: PASS

- [ ] **Step 5: Run full test suite to check for regressions**

Run: `pnpm test:run`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add server/src/services/bootstrap.ts server/src/__tests__/bootstrap-role.test.ts
git commit -m "feat(server): set superadmin role in bootstrap for first user"
```

---

### Task 6: Create user management service

**Files:**
- Create: `server/src/services/user-management.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// server/src/__tests__/user-management-service.test.ts
import { describe, it, expect, vi } from "vitest";

// Test the service contract — these tests validate business logic rules
describe("user-management service rules", () => {
  it("superadmin can assign any role", () => {
    // Role assignment validation logic
    const canAssignRole = (actorRole: string, targetRole: string): boolean => {
      if (actorRole === "superadmin") return true;
      if (actorRole === "admin") return ["user", "guest"].includes(targetRole);
      return false;
    };

    expect(canAssignRole("superadmin", "superadmin")).toBe(true);
    expect(canAssignRole("superadmin", "admin")).toBe(true);
    expect(canAssignRole("superadmin", "user")).toBe(true);
    expect(canAssignRole("superadmin", "guest")).toBe(true);
  });

  it("admin can only assign user or guest", () => {
    const canAssignRole = (actorRole: string, targetRole: string): boolean => {
      if (actorRole === "superadmin") return true;
      if (actorRole === "admin") return ["user", "guest"].includes(targetRole);
      return false;
    };

    expect(canAssignRole("admin", "user")).toBe(true);
    expect(canAssignRole("admin", "guest")).toBe(true);
    expect(canAssignRole("admin", "admin")).toBe(false);
    expect(canAssignRole("admin", "superadmin")).toBe(false);
  });

  it("user/guest cannot assign any role", () => {
    const canAssignRole = (actorRole: string, _targetRole: string): boolean => {
      if (actorRole === "superadmin") return true;
      if (actorRole === "admin") return ["user", "guest"].includes(_targetRole);
      return false;
    };

    expect(canAssignRole("user", "guest")).toBe(false);
    expect(canAssignRole("guest", "guest")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it passes (pure logic test)**

Run: `npx vitest run server/src/__tests__/user-management-service.test.ts`
Expected: PASS (these test pure logic, no imports yet)

- [ ] **Step 3: Create the user management service**

```typescript
// server/src/services/user-management.ts
import { eq, and, inArray, ilike } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { authUsers, authAccounts, companyMemberships } from "@paperclipai/db";
import { USER_ROLES, type UserRole } from "@paperclipai/shared";
import { badRequest, forbidden, notFound } from "../errors.js";

export function canAssignRole(actorRole: string, targetRole: string): boolean {
  if (actorRole === "superadmin") return true;
  if (actorRole === "admin") return ["user", "guest"].includes(targetRole);
  return false;
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
  companyIds?: string[];
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
}

export function userManagementService(db: Db) {
  async function listUsers(filterCompanyId?: string) {
    if (filterCompanyId) {
      const memberRows = await db
        .select({ principalId: companyMemberships.principalId })
        .from(companyMemberships)
        .where(
          and(
            eq(companyMemberships.companyId, filterCompanyId),
            eq(companyMemberships.principalType, "user"),
            eq(companyMemberships.status, "active"),
          ),
        );
      const userIds = memberRows.map((r) => r.principalId);
      if (userIds.length === 0) return [];
      return db
        .select({
          id: authUsers.id,
          name: authUsers.name,
          email: authUsers.email,
          role: authUsers.role,
          createdAt: authUsers.createdAt,
        })
        .from(authUsers)
        .where(inArray(authUsers.id, userIds));
    }
    return db
      .select({
        id: authUsers.id,
        name: authUsers.name,
        email: authUsers.email,
        role: authUsers.role,
        createdAt: authUsers.createdAt,
      })
      .from(authUsers);
  }

  async function getUser(userId: string) {
    const [user] = await db
      .select({
        id: authUsers.id,
        name: authUsers.name,
        email: authUsers.email,
        role: authUsers.role,
        createdAt: authUsers.createdAt,
      })
      .from(authUsers)
      .where(eq(authUsers.id, userId));

    if (!user) throw notFound("User not found");

    const memberships = await db
      .select({
        companyId: companyMemberships.companyId,
        status: companyMemberships.status,
        membershipRole: companyMemberships.membershipRole,
      })
      .from(companyMemberships)
      .where(
        and(
          eq(companyMemberships.principalType, "user"),
          eq(companyMemberships.principalId, userId),
        ),
      );

    return { ...user, companies: memberships };
  }

  async function updateUser(userId: string, input: UpdateUserInput) {
    const [user] = await db
      .select({ id: authUsers.id })
      .from(authUsers)
      .where(eq(authUsers.id, userId));
    if (!user) throw notFound("User not found");

    const updates: Record<string, unknown> = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.email !== undefined) updates.email = input.email;
    updates.updatedAt = new Date();

    await db.update(authUsers).set(updates).where(eq(authUsers.id, userId));
    return getUser(userId);
  }

  async function deleteUser(userId: string) {
    const [user] = await db
      .select({ id: authUsers.id, role: authUsers.role })
      .from(authUsers)
      .where(eq(authUsers.id, userId));
    if (!user) throw notFound("User not found");
    if (user.role === "superadmin") {
      throw badRequest("Cannot delete a superadmin user");
    }

    // Cascade delete handles sessions and accounts
    await db.delete(authUsers).where(eq(authUsers.id, userId));
  }

  async function changeRole(userId: string, newRole: UserRole, actorRole: string) {
    if (!USER_ROLES.includes(newRole)) {
      throw badRequest(`Invalid role: ${newRole}`);
    }
    if (!canAssignRole(actorRole, newRole)) {
      throw forbidden(`Cannot assign role: ${newRole}`);
    }

    const [user] = await db
      .select({ id: authUsers.id })
      .from(authUsers)
      .where(eq(authUsers.id, userId));
    if (!user) throw notFound("User not found");

    await db
      .update(authUsers)
      .set({ role: newRole, updatedAt: new Date() })
      .where(eq(authUsers.id, userId));

    return getUser(userId);
  }

  async function addToCompany(userId: string, companyId: string) {
    const [user] = await db
      .select({ id: authUsers.id })
      .from(authUsers)
      .where(eq(authUsers.id, userId));
    if (!user) throw notFound("User not found");

    const existing = await db
      .select({ id: companyMemberships.id })
      .from(companyMemberships)
      .where(
        and(
          eq(companyMemberships.companyId, companyId),
          eq(companyMemberships.principalType, "user"),
          eq(companyMemberships.principalId, userId),
        ),
      )
      .then((rows) => rows[0] ?? null);

    if (existing) return; // already a member

    await db.insert(companyMemberships).values({
      companyId,
      principalType: "user",
      principalId: userId,
      status: "active",
      membershipRole: "member",
    });
  }

  async function removeFromCompany(userId: string, companyId: string) {
    await db
      .delete(companyMemberships)
      .where(
        and(
          eq(companyMemberships.companyId, companyId),
          eq(companyMemberships.principalType, "user"),
          eq(companyMemberships.principalId, userId),
        ),
      );
  }

  return {
    listUsers,
    getUser,
    updateUser,
    deleteUser,
    changeRole,
    addToCompany,
    removeFromCompany,
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run server/src/__tests__/user-management-service.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/services/user-management.ts server/src/__tests__/user-management-service.test.ts
git commit -m "feat(server): add user management service with CRUD and role assignment"
```

---

### Task 7: Create user management API routes

**Files:**
- Create: `server/src/routes/users.ts`
- Modify: `server/src/app.ts` (mount the routes)

- [ ] **Step 1: Write the failing test**

```typescript
// server/src/__tests__/user-routes.test.ts
import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";

describe("user routes", () => {
  it("GET /api/users/me returns current user info", async () => {
    // This validates the route exists and returns actor info
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.actor = {
        type: "board",
        userId: "user-1",
        role: "admin",
        source: "session",
        companyIds: ["c1"],
      };
      next();
    });

    // We'll import and mount routes after they're created
    const { userRoutes } = await import("../routes/users.js");
    app.use("/api", userRoutes({} as any));

    const res = await request(app).get("/api/users/me");
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/src/__tests__/user-routes.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create user routes**

```typescript
// server/src/routes/users.ts
import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { authUsers, authAccounts } from "@paperclipai/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { requirePermission, getActorInfo } from "./authz.js";
import { userManagementService, canAssignRole } from "../services/user-management.js";
import { badRequest, forbidden, unauthorized, conflict } from "../errors.js";
import { USER_ROLES, type UserRole } from "@paperclipai/shared";

export interface UserRoutesOptions {
  /** better-auth instance for password hashing via its internal API */
  hashPassword: (password: string) => Promise<string>;
}

export function userRoutes(db: Db, opts: UserRoutesOptions) {
  const router = Router();
  const userService = userManagementService(db);

  // GET /users/me — current user profile (must be before /users/:id)
  router.get("/users/me", async (req, res) => {
    if (req.actor.type !== "board" || !req.actor.userId) {
      throw unauthorized();
    }
    const user = await userService.getUser(req.actor.userId);
    res.json(user);
  });

  // PATCH /users/me — update own profile
  router.patch("/users/me", async (req, res) => {
    if (req.actor.type !== "board" || !req.actor.userId) {
      throw unauthorized();
    }
    const { name } = req.body;
    const user = await userService.updateUser(req.actor.userId, { name });
    res.json(user);
  });

  // GET /users — list all users
  router.get("/users", async (req, res) => {
    requirePermission(req, "users:read");
    const actorRole = req.actor.role as string;
    let users;
    if (actorRole === "admin" && req.actor.companyIds?.length) {
      // Admin: list users from all their companies, deduplicated
      const allUsers = new Map<string, any>();
      for (const cid of req.actor.companyIds) {
        const companyUsers = await userService.listUsers(cid);
        for (const u of companyUsers) allUsers.set(u.id, u);
      }
      users = Array.from(allUsers.values());
    } else {
      users = await userService.listUsers();
    }
    res.json(users);
  });

  // POST /users — create new user
  router.post("/users", async (req, res) => {
    requirePermission(req, "users:create");
    const { name, email, password, role, companyIds } = req.body;

    if (!name || !email || !password) {
      throw badRequest("name, email, and password are required");
    }

    // Check for duplicate email
    const [existing] = await db
      .select({ id: authUsers.id })
      .from(authUsers)
      .where(eq(authUsers.email, email));
    if (existing) {
      throw conflict("Email already in use");
    }

    const targetRole = (role as UserRole) || "guest";
    if (!USER_ROLES.includes(targetRole)) {
      throw badRequest(`Invalid role: ${targetRole}`);
    }

    const actorRole = req.actor.role as string;
    if (!canAssignRole(actorRole, targetRole)) {
      throw forbidden(`Cannot assign role: ${targetRole}`);
    }

    const userId = randomUUID();

    // Hash password using better-auth's password context (scrypt)
    const hashedPassword = await opts.hashPassword(password);

    await db.insert(authUsers).values({
      id: userId,
      name,
      email,
      role: targetRole,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create account entry for email/password auth (compatible with better-auth)
    await db.insert(authAccounts).values({
      id: randomUUID(),
      accountId: userId,
      providerId: "credential",
      userId,
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Assign to companies
    if (companyIds && Array.isArray(companyIds)) {
      for (const companyId of companyIds) {
        await userService.addToCompany(userId, companyId);
      }
    }

    const user = await userService.getUser(userId);
    res.status(201).json(user);
  });

  // GET /users/:id — get user details
  router.get("/users/:id", async (req, res) => {
    requirePermission(req, "users:read");
    const user = await userService.getUser(req.params.id);
    res.json(user);
  });

  // PATCH /users/:id — update user
  router.patch("/users/:id", async (req, res) => {
    requirePermission(req, "users:update");
    const { name, email } = req.body;
    const user = await userService.updateUser(req.params.id, { name, email });
    res.json(user);
  });

  // DELETE /users/:id — delete user
  router.delete("/users/:id", async (req, res) => {
    requirePermission(req, "users:delete");
    await userService.deleteUser(req.params.id);
    res.status(204).end();
  });

  // PATCH /users/:id/role — change user role
  router.patch("/users/:id/role", async (req, res) => {
    requirePermission(req, "users:assign_role");
    const { role } = req.body;
    if (!role) throw badRequest("role is required");

    const actorRole = req.actor.role as string;
    const user = await userService.changeRole(req.params.id, role as UserRole, actorRole);
    res.json(user);
  });

  // POST /users/:id/companies — add user to company
  router.post("/users/:id/companies", async (req, res) => {
    requirePermission(req, "users:update");
    const { companyId } = req.body;
    if (!companyId) throw badRequest("companyId is required");
    await userService.addToCompany(req.params.id, companyId);
    const user = await userService.getUser(req.params.id);
    res.json(user);
  });

  // DELETE /users/:id/companies/:companyId — remove user from company
  router.delete("/users/:id/companies/:companyId", async (req, res) => {
    requirePermission(req, "users:update");
    await userService.removeFromCompany(req.params.id, req.params.companyId);
    res.status(204).end();
  });

  return router;
}
```

- [ ] **Step 4: Mount routes in app.ts**

In `server/src/app.ts`:

Add import:
```typescript
import { userRoutes } from "./routes/users.js";
```

Add mount after other `api.use(...)` calls (around line 157, after `instanceSettingsRoutes`).
The `hashPassword` function should use better-auth's password context. Check `better-auth` package for `hashPassword` or `ctx.password.hash`. Alternatively, use the `scryptAsync` from `better-auth/crypto`:
```typescript
  import { hashPassword } from "better-auth/crypto";
  // ...
  api.use(userRoutes(db, { hashPassword }));
```
Note: Verify the exact import path during implementation — better-auth may expose this differently. If `better-auth/crypto` is not available, use the `auth` instance's internal `ctx.password.hash` method.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run server/src/__tests__/user-routes.test.ts`
Expected: PASS

- [ ] **Step 6: Run typecheck**

Run: `pnpm typecheck`
Expected: No type errors

- [ ] **Step 7: Commit**

```bash
git add server/src/routes/users.ts server/src/app.ts server/src/__tests__/user-routes.test.ts
git commit -m "feat(server): add user management API routes with RBAC enforcement"
```

---

### Task 8: Create frontend API client and query keys for users

**Files:**
- Create: `ui/src/api/users.ts`
- Modify: `ui/src/lib/queryKeys.ts`

- [ ] **Step 1: Add query keys**

In `ui/src/lib/queryKeys.ts`, add to the `queryKeys` object:

```typescript
  users: {
    all: ["users"] as const,
    detail: (id: string) => ["users", "detail", id] as const,
    me: ["users", "me"] as const,
  },
```

- [ ] **Step 2: Create users API client**

```typescript
// ui/src/api/users.ts
import { api } from "./client";

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  companies?: {
    companyId: string;
    status: string;
    membershipRole: string | null;
  }[];
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role?: string;
  companyIds?: string[];
}

export const usersApi = {
  me: () => api.get<User>("/users/me"),

  updateMe: (data: { name?: string }) =>
    api.patch<User>("/users/me", data),

  list: () => api.get<User[]>("/users"),

  get: (id: string) => api.get<User>(`/users/${id}`),

  create: (data: CreateUserInput) =>
    api.post<User>("/users", data),

  update: (id: string, data: { name?: string; email?: string }) =>
    api.patch<User>(`/users/${id}`, data),

  delete: (id: string) => api.delete(`/users/${id}`),

  changeRole: (id: string, role: string) =>
    api.patch<User>(`/users/${id}/role`, { role }),

  addToCompany: (id: string, companyId: string) =>
    api.post<User>(`/users/${id}/companies`, { companyId }),

  removeFromCompany: (id: string, companyId: string) =>
    api.delete(`/users/${id}/companies/${companyId}`),
};
```

- [ ] **Step 3: Commit**

```bash
git add ui/src/api/users.ts ui/src/lib/queryKeys.ts
git commit -m "feat(ui): add users API client and query keys"
```

---

### Task 9: Create `useCurrentUser` hook and permission helper

**Files:**
- Create: `ui/src/hooks/useCurrentUser.ts`
- Create: `ui/src/hooks/usePermission.ts`

- [ ] **Step 1: Create useCurrentUser hook**

```typescript
// ui/src/hooks/useCurrentUser.ts
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { usersApi, type User } from "@/api/users";

export function useCurrentUser() {
  return useQuery({
    queryKey: queryKeys.users.me,
    queryFn: () => usersApi.me(),
    retry: false,
    staleTime: 5 * 60 * 1000, // cache for 5 minutes
  });
}
```

- [ ] **Step 2: Create usePermission hook**

```typescript
// ui/src/hooks/usePermission.ts
import { useCurrentUser } from "./useCurrentUser";
import { ROLE_PERMISSIONS, type UserRole } from "@paperclipai/shared";

export function usePermission(permission: string): boolean {
  const { data: user } = useCurrentUser();
  if (!user?.role) return false;
  const role = user.role as UserRole;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function useRole(): string | null {
  const { data: user } = useCurrentUser();
  return user?.role ?? null;
}
```

- [ ] **Step 3: Commit**

```bash
git add ui/src/hooks/useCurrentUser.ts ui/src/hooks/usePermission.ts
git commit -m "feat(ui): add useCurrentUser and usePermission hooks"
```

---

### Task 10: Create User Management page

**Files:**
- Create: `ui/src/pages/UserManagement.tsx`

- [ ] **Step 1: Create the page component**

```typescript
// ui/src/pages/UserManagement.tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { usersApi, type User, type CreateUserInput } from "@/api/users";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { usePermission } from "@/hooks/usePermission";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { useToast } from "@/context/ToastContext";
import { useCompany } from "@/context/CompanyContext";
import { useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2, Pencil, Shield, Plus } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  superadmin: "Super Admin",
  admin: "Admin",
  user: "User",
  guest: "Guest",
};

const ROLE_COLORS: Record<string, string> = {
  superadmin: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  admin: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  user: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  guest: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
};

export default function UserManagement() {
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToast();
  const { selectedCompany } = useCompany();
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const canCreate = usePermission("users:create");
  const canDelete = usePermission("users:delete");
  const canAssignRole = usePermission("users:assign_role");

  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [roleUser, setRoleUser] = useState<User | null>(null);

  // Form state for create
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("guest");

  useEffect(() => {
    setBreadcrumbs([
      { label: selectedCompany?.name ?? "Company", href: "/dashboard" },
      { label: "Settings", href: "/company/settings" },
      { label: "Users" },
    ]);
  }, [setBreadcrumbs, selectedCompany?.name]);

  const usersQuery = useQuery({
    queryKey: queryKeys.users.all,
    queryFn: () => usersApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateUserInput) => usersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      setCreateOpen(false);
      setNewName("");
      setNewEmail("");
      setNewPassword("");
      setNewRole("guest");
      pushToast({ title: "User created", tone: "success" });
    },
    onError: (err: Error) => {
      pushToast({ title: "Failed to create user", body: err.message, tone: "error" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      pushToast({ title: "User deleted", tone: "success" });
    },
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      usersApi.changeRole(id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      setRoleUser(null);
      pushToast({ title: "Role updated", tone: "success" });
    },
  });

  const allowedRoles =
    currentUser?.role === "superadmin"
      ? ["superadmin", "admin", "user", "guest"]
      : ["user", "guest"];

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">User Management</h1>
        {canCreate && (
          <Button onClick={() => setCreateOpen(true)} size="sm">
            <Plus className="mr-1.5 h-4 w-4" />
            Create User
          </Button>
        )}
      </div>

      {/* User list */}
      <div className="rounded-md border border-border">
        <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-4 border-b border-border px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          <span>Name</span>
          <span>Email</span>
          <span>Role</span>
          <span>Actions</span>
        </div>
        {usersQuery.data?.map((user) => (
          <div
            key={user.id}
            className="grid grid-cols-[1fr_1fr_auto_auto] gap-4 items-center border-b border-border px-4 py-3 last:border-b-0 text-sm"
          >
            <span className="truncate">{user.name}</span>
            <span className="truncate text-muted-foreground">{user.email}</span>
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[user.role] ?? ""}`}
            >
              {ROLE_LABELS[user.role] ?? user.role}
            </span>
            <div className="flex items-center gap-1">
              {canAssignRole && user.id !== currentUser?.id && (
                <button
                  onClick={() => setRoleUser(user)}
                  className="rounded p-1 hover:bg-muted"
                  title="Change role"
                >
                  <Shield className="h-4 w-4" />
                </button>
              )}
              {canDelete && user.id !== currentUser?.id && user.role !== "superadmin" && (
                <button
                  onClick={() => {
                    if (confirm(`Delete user "${user.name}"?`)) {
                      deleteMutation.mutate(user.id);
                    }
                  }}
                  className="rounded p-1 hover:bg-muted text-destructive"
                  title="Delete user"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        ))}
        {usersQuery.data?.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No users found
          </div>
        )}
      </div>

      {/* Create User Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground">Name</label>
              <input
                className="mt-1 w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Email</label>
              <input
                className="mt-1 w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Password</label>
              <input
                className="mt-1 w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Role</label>
              <select
                className="mt-1 w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
              >
                {allowedRoles.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() =>
                createMutation.mutate({
                  name: newName,
                  email: newEmail,
                  password: newPassword,
                  role: newRole,
                  companyIds: selectedCompany ? [selectedCompany.id] : [],
                })
              }
              disabled={createMutation.isPending || !newName || !newEmail || !newPassword}
            >
              {createMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Role Dialog */}
      <ChangeRoleDialog
        user={roleUser}
        allowedRoles={allowedRoles}
        isPending={roleMutation.isPending}
        onSave={(id, role) => roleMutation.mutate({ id, role })}
        onClose={() => setRoleUser(null)}
      />
    </div>
  );
}

function ChangeRoleDialog({
  user,
  allowedRoles,
  isPending,
  onSave,
  onClose,
}: {
  user: User | null;
  allowedRoles: string[];
  isPending: boolean;
  onSave: (id: string, role: string) => void;
  onClose: () => void;
}) {
  const [selectedRole, setSelectedRole] = useState(user?.role ?? "guest");

  useEffect(() => {
    if (user) setSelectedRole(user.role);
  }, [user]);

  return (
    <Dialog open={!!user} onOpenChange={() => onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change Role — {user?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {allowedRoles.map((r) => (
            <label key={r} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="role"
                value={r}
                checked={selectedRole === r}
                onChange={() => setSelectedRole(r)}
                className="accent-primary"
              />
              <span className="text-sm">{ROLE_LABELS[r]}</span>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button
            onClick={() => {
              if (user) onSave(user.id, selectedRole);
            }}
            disabled={isPending}
          >
            {isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/pages/UserManagement.tsx
git commit -m "feat(ui): add User Management page with CRUD and role assignment"
```

---

### Task 11: Create User Profile page

**Files:**
- Create: `ui/src/pages/UserProfile.tsx`

- [ ] **Step 1: Create profile page**

```typescript
// ui/src/pages/UserProfile.tsx
import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { usersApi } from "@/api/users";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { useToast } from "@/context/ToastContext";
import { Button } from "@/components/ui/button";

const ROLE_LABELS: Record<string, string> = {
  superadmin: "Super Admin",
  admin: "Admin",
  user: "User",
  guest: "Guest",
};

export default function UserProfile() {
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useCurrentUser();

  const [name, setName] = useState("");

  useEffect(() => {
    setBreadcrumbs([{ label: "Profile" }]);
  }, [setBreadcrumbs]);

  useEffect(() => {
    if (user) setName(user.name);
  }, [user]);

  const updateMutation = useMutation({
    mutationFn: (data: { name: string }) => usersApi.updateMe(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.me });
      pushToast({ title: "Profile updated", tone: "success" });
    },
    onError: (err: Error) => {
      pushToast({ title: "Failed to update profile", body: err.message, tone: "error" });
    },
  });

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading...</div>;
  if (!user) return null;

  const isDirty = name !== user.name;

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-lg font-semibold">Profile</h1>

      <div className="space-y-4 rounded-md border border-border px-4 py-4">
        <div>
          <label className="text-xs text-muted-foreground">Name</label>
          <input
            className="mt-1 w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Email</label>
          <div className="mt-1 text-sm text-muted-foreground">{user.email}</div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Role</label>
          <div className="mt-1 text-sm">{ROLE_LABELS[user.role] ?? user.role}</div>
        </div>
        {user.companies && user.companies.length > 0 && (
          <div>
            <label className="text-xs text-muted-foreground">Companies</label>
            <div className="mt-1 space-y-1">
              {user.companies.map((c) => (
                <div key={c.companyId} className="text-sm">
                  {c.companyId} ({c.membershipRole ?? "member"})
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {isDirty && (
        <div className="flex items-center gap-2">
          <Button
            onClick={() => updateMutation.mutate({ name })}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? "Saving..." : "Save changes"}
          </Button>
          <Button variant="ghost" onClick={() => setName(user.name)}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/pages/UserProfile.tsx
git commit -m "feat(ui): add User Profile page"
```

---

### Task 12: Create PermissionDenied component

**Files:**
- Create: `ui/src/components/PermissionDenied.tsx`

- [ ] **Step 1: Create component**

```typescript
// ui/src/components/PermissionDenied.tsx
import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/router";

export function PermissionDenied() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <ShieldX className="h-12 w-12 text-muted-foreground" />
      <h2 className="text-lg font-semibold">Access Denied</h2>
      <p className="text-sm text-muted-foreground">
        You don't have permission to access this feature.
      </p>
      <Link to="/dashboard">
        <Button variant="outline">Back to Dashboard</Button>
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/components/PermissionDenied.tsx
git commit -m "feat(ui): add PermissionDenied component"
```

---

### Task 13: Register routes and add permission gating to UI

**Files:**
- Modify: `ui/src/App.tsx` (add routes for UserManagement and UserProfile)

- [ ] **Step 1: Add routes to App.tsx**

Add imports:
```typescript
import UserManagement from "@/pages/UserManagement";
import UserProfile from "@/pages/UserProfile";
```

Inside the company-scoped `<Route path=":companyPrefix">` block, add:
```typescript
<Route path="settings/users" element={<UserManagement />} />
<Route path="profile" element={<UserProfile />} />
```

- [ ] **Step 2: Add navigation link to sidebar/settings**

Find the settings navigation or sidebar component and add a "Users" link visible only to superadmin/admin. This depends on the existing sidebar structure — find it and add:

```typescript
{(role === "superadmin" || role === "admin") && (
  <Link to="/settings/users">Users</Link>
)}
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: No type errors

- [ ] **Step 4: Run full test suite**

Run: `pnpm test:run`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add ui/src/App.tsx
git commit -m "feat(ui): register UserManagement and UserProfile routes"
```

---

### Task 14: End-to-end verification

- [ ] **Step 1: Build all packages**

Run: `pnpm build`
Expected: Build succeeds

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: No type errors

- [ ] **Step 3: Run all tests**

Run: `pnpm test:run`
Expected: All tests pass

- [ ] **Step 4: Manual verification**

Start dev: `pnpm dev`

Verify:
1. Login page works
2. Local-trusted mode still works (superadmin role auto-assigned)
3. `/api/users/me` returns current user with role
4. User Management page loads at `/settings/users`
5. Can create a new user with role assignment
6. Role badges display correctly
7. Permission gating hides buttons for unauthorized users

- [ ] **Step 5: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: address issues found during e2e verification"
```
