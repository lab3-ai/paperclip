# RBAC Role-Based Permission System Design

**Date:** 2026-03-25
**Status:** Approved
**Approach:** Enum role on user + permission map in code (Approach 3)

## Summary

Add a fixed role-based access control (RBAC) system to Paperclip. Each user has exactly one global role (`superadmin`, `admin`, `user`, `guest`). Permissions for each role are defined as a const map in code — no DB storage needed for permissions. This system applies only to **board (human) actors**; agent actors continue using the existing `assertCompanyAccess` pattern.

## Requirements

1. **Roles**: superadmin (instance admin, full access), admin (manages assigned companies, creates user/guest accounts), user (manages agents/skills/plugins/issues), guest (read-only)
2. **1 role per user** — applies across all companies the user belongs to
3. **Account creation flow**: superadmin creates any account; admin creates user/guest in their company; both can coexist
4. **Multi-company**: 1 user can belong to multiple companies (existing `company_memberships` table)
5. **Fixed permissions**: no custom permission assignment; role determines all access

## Design

### 1. Data Model

#### Schema change: `authUsers` table

Add a `role` field to `packages/db/src/schema/auth.ts`:

```typescript
role: text("role").notNull().default("guest")
// Values: "superadmin" | "admin" | "user" | "guest"
```

- Bootstrap (first user) auto-assigned `superadmin`
- New users default to `guest` unless specified

#### Data migration

When the migration runs:
1. Add `role` column with default `"guest"` — all existing users get `guest` initially
2. **Update users who have `instance_admin` in `instance_user_roles` to `role = 'superadmin'`** — prevents admin lockout
3. The `instance_user_roles` table is **deprecated** but kept for backward compatibility. New code uses `authUsers.role` exclusively. Plan to drop `instance_user_roles` in a future release.

#### Relationship to existing permission systems

The existing `principal_permission_grants` table and `PERMISSION_KEYS` constant are **superseded** by this RBAC system for board (human) actors. The new `ROLE_PERMISSIONS` map replaces the need for per-user grant management. Existing `PERMISSION_KEYS` and `principal_permission_grants` remain in the codebase for backward compatibility but are no longer the primary authorization mechanism for board users.

#### Permission map in code

Defined in `packages/shared/src/constants.ts`:

```typescript
export const USER_ROLES = ["superadmin", "admin", "user", "guest"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ROLE_PERMISSIONS = {
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
```

### 2. Auth & Middleware

#### Permission checking helper

In `server/src/services/access.ts`:

```typescript
function hasRolePermission(userRole: string, permissionKey: string): boolean {
  return ROLE_PERMISSIONS[userRole]?.includes(permissionKey) ?? false;
}
```

#### Route-level enforcement

In `server/src/routes/authz.ts`, add:

```typescript
function requirePermission(req: Request, permission: string): void {
  // local_trusted mode bypasses RBAC (consistent with existing behavior)
  if (req.actor.source === "local_implicit") return;

  // Agent actors are not subject to RBAC — they use assertCompanyAccess instead
  if (req.actor.type === "agent") return;

  assertBoard(req);
  if (!hasRolePermission(req.actor.role, permission)) {
    throw new HttpError(403, "Insufficient permissions");
  }
}
```

#### Actor enrichment

In `server/src/middleware/auth.ts`, when resolving a board actor from session, load the `role` field from `authUsers` and attach to `req.actor`:

```typescript
req.actor = {
  ...existing,
  role: user.role // "superadmin" | "admin" | "user" | "guest"
}
```

For `local_trusted` mode, the synthetic `local-board` user gets `role: "superadmin"` by default.

#### Scope: board actors only

This RBAC system applies **only to board (human) actors**. Agent actors continue using the existing authorization model:
- `assertCompanyAccess(req, companyId)` — ensures agent belongs to the company
- Agent-specific permissions (e.g., `canCreateAgents` for CEO role) remain unchanged
- Routes that serve both board and agent actors call `requirePermission` for board actors and `assertCompanyAccess` for agent actors

### 3. API Endpoints

#### User Management

Routes are **not company-scoped** (unlike most other routes) because user management is inherently cross-company — a user can belong to multiple companies. This is intentional and consistent with other auth-related routes (invites, CLI auth).

**Important:** `/api/users/me` must be registered **before** `/api/users/:id` to avoid Express treating `"me"` as an ID parameter.

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| `GET` | `/api/users/me` | (authenticated) | View own profile |
| `PATCH` | `/api/users/me` | (authenticated) | Update own profile/password |
| `GET` | `/api/users` | `users:read` | List users (superadmin: all, admin: same company) |
| `POST` | `/api/users` | `users:create` | Create user (email, password, role, companyIds) |
| `GET` | `/api/users/:id` | `users:read` | User details |
| `PATCH` | `/api/users/:id` | `users:update` | Update user info |
| `DELETE` | `/api/users/:id` | `users:delete` | Delete user |
| `PATCH` | `/api/users/:id/role` | `users:assign_role` | Change role |
| `POST` | `/api/users/:id/companies` | `users:update` | Assign user to company |
| `DELETE` | `/api/users/:id/companies/:companyId` | `users:update` | Remove user from company |

#### Role assignment rules

- **superadmin** can assign any role
- **admin** can only assign `user` or `guest` (cannot promote to admin/superadmin)
- **user/guest** cannot assign roles

### 4. UI

#### New pages/components

**1. User Management Page** (`/settings/users`)
- Table: name, email, role, companies, status
- "Create User" button (visible to superadmin/admin)
- Row actions: edit, delete, change role
- Superadmin sees all users; admin sees only users in their companies

**2. Create/Edit User Dialog**
- Form fields: name, email, password, role (dropdown), company assignment (multi-select)
- Admin sees role options: user, guest only
- Superadmin sees all role options

**3. User Profile Page** (`/profile`)
- Accessible by all authenticated users
- Shows: name, email, role, company list
- Allows: change name, change password

**4. Permission Denied Component**
- Shown when user accesses a feature they don't have permission for
- Message + back-to-home button

#### UI permission gating

- Role data loaded once from `GET /api/users/me` and cached in auth context/hook
- `usePermission(permission: string): boolean` hook checks role against `ROLE_PERMISSIONS` client-side
- Hide/disable UI elements based on permissions (e.g., guest doesn't see "Create Issue" button, user doesn't see "User Management" menu)
- Unauthorized route access shows Permission Denied component (not a redirect)
- Existing auth state (from better-auth client) is extended with role info — identify current auth state location in `ui/src/` before implementation

### 5. Bootstrap Changes

In `server/src/services/bootstrap.ts`:

1. **First user** (`createDefaultSetup`): Set `authUsers.role = 'superadmin'` AND keep existing `instance_user_roles` insert for backward compatibility
2. **Subsequent auto-bootstrapped users**: Receive `role = 'guest'` (the column default). Admins can upgrade them via User Management UI.
3. **`local_trusted` mode**: Synthetic `local-board` actor gets `role: "superadmin"` hardcoded in middleware — no DB lookup needed, bypasses RBAC entirely via `local_implicit` source check.

## Files to modify

### Backend
- `packages/db/src/schema/auth.ts` — add `role` field
- `packages/shared/src/constants.ts` — add `USER_ROLES`, `UserRole`, `ROLE_PERMISSIONS`; deprecate `PERMISSION_KEYS`
- `server/src/middleware/auth.ts` — enrich actor with role; set `superadmin` for local_implicit
- `server/src/types/express.d.ts` — add `role` to actor type
- `server/src/services/access.ts` — add `hasRolePermission()` helper
- `server/src/routes/authz.ts` — add `requirePermission()` middleware with local_implicit + agent bypasses
- `server/src/routes/` — new user management route file (`users.ts`)
- `server/src/services/` — new user management service (`user-management.ts`)
- `server/src/services/bootstrap.ts` — assign `superadmin` role to first user

### Frontend
- `ui/src/pages/` — UserManagement page, Profile page
- `ui/src/components/` — CreateUserDialog, EditUserDialog, PermissionDenied component
- `ui/src/api/` — user management API client
- `ui/src/context/` or `ui/src/hooks/` — extend auth state with role, add `usePermission()` hook
- Existing pages/components — add permission checks to hide/disable restricted UI elements

### Database
- New migration: add `role` column to `authUsers` table
- Data migration: set `role = 'superadmin'` for users with `instance_admin` in `instance_user_roles`
