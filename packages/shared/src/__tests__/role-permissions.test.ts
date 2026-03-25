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
