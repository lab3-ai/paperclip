import { describe, it, expect } from "vitest";
import { canAssignRole } from "../services/user-management.js";

describe("canAssignRole", () => {
  it("superadmin can assign any role", () => {
    expect(canAssignRole("superadmin", "superadmin")).toBe(true);
    expect(canAssignRole("superadmin", "admin")).toBe(true);
    expect(canAssignRole("superadmin", "user")).toBe(true);
    expect(canAssignRole("superadmin", "guest")).toBe(true);
  });

  it("admin can only assign user or guest", () => {
    expect(canAssignRole("admin", "user")).toBe(true);
    expect(canAssignRole("admin", "guest")).toBe(true);
    expect(canAssignRole("admin", "admin")).toBe(false);
    expect(canAssignRole("admin", "superadmin")).toBe(false);
  });

  it("user/guest cannot assign any role", () => {
    expect(canAssignRole("user", "guest")).toBe(false);
    expect(canAssignRole("guest", "guest")).toBe(false);
  });
});
