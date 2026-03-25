import { eq, and, inArray } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { authUsers, authAccounts, companyMemberships } from "@paperclipai/db";
import { USER_ROLES, type UserRole } from "@paperclipai/shared";
import { badRequest, forbidden, notFound } from "../errors.js";

export function canAssignRole(actorRole: string, targetRole: string): boolean {
  if (actorRole === "superadmin") return true;
  if (actorRole === "admin") return ["user", "guest"].includes(targetRole);
  return false;
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

    if (existing) return;

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
