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
