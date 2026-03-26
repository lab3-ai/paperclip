import fs from "node:fs/promises";
import path from "node:path";
import { and, count, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  companies,
  agents,
  companyMemberships,
  instanceUserRoles,
  authUsers,
} from "@paperclipai/db";
import { logger } from "../middleware/logger.js";
import { resolveProjectRoot, resolveAgentInstructionsDir } from "../home-paths.js";
import { loadDefaultAgentInstructionsBundle } from "./default-agent-instructions.js";

export interface BootstrapResult {
  action: "created_company" | "assigned_to_company" | "noop";
  companyId?: string;
}

async function materializeInstructions(role: string): Promise<string | null> {
  const projectRoot = resolveProjectRoot();
  if (!projectRoot) return null;

  let instructionsDir: string;
  try {
    instructionsDir = resolveAgentInstructionsDir(role);
  } catch {
    return null;
  }

  // Idempotent: skip if already exists
  try {
    await fs.access(instructionsDir);
    return instructionsDir;
  } catch {
    // Directory doesn't exist, create it
  }

  const bundleRole = role === "ceo" ? "ceo" : "default";
  const bundle = await loadDefaultAgentInstructionsBundle(bundleRole as "ceo" | "default");

  await fs.mkdir(instructionsDir, { recursive: true });
  for (const [fileName, content] of Object.entries(bundle)) {
    await fs.writeFile(path.join(instructionsDir, fileName), content, "utf8");
  }

  logger.info(
    { role, instructionsDir, files: Object.keys(bundle) },
    "Materialized default agent instructions to project",
  );

  return instructionsDir;
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
      process.env.PAPERCLIP_DEFAULT_AGENT_NAME || "CEO Agent";

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

    // Set role on authUsers table
    await db
      .update(authUsers)
      .set({ role: "superadmin" })
      .where(eq(authUsers.id, userId));

    // Assign user as owner
    await db.insert(companyMemberships).values({
      companyId: company.id,
      principalType: "user",
      principalId: userId,
      status: "active",
      membershipRole: "owner",
    });

    // Materialize CEO instructions to project-local agents/ceo/
    const instructionsDir = await materializeInstructions("ceo");
    const projectRoot = resolveProjectRoot();
    const ceoCommand = process.env.PAPERCLIP_CEO_COMMAND || "claude";

    // Build adapterConfig for claude-local
    const adapterConfig: Record<string, unknown> = {};
    adapterConfig.command = ceoCommand;
    if (projectRoot) {
      adapterConfig.cwd = projectRoot;
    }
    if (instructionsDir) {
      adapterConfig.instructionsBundleMode = "external";
      adapterConfig.instructionsRootPath = instructionsDir;
      adapterConfig.instructionsEntryFile = "AGENTS.md";
    }

    // Create default CEO agent
    await db.insert(agents).values({
      companyId: company.id,
      name: agentName,
      role: "ceo",
      title: "Chief Executive Officer",
      adapterType: "claude-local",
      adapterConfig,
    });

    logger.info(
      { userId, companyId: company.id, companyName, agentName },
      "Auto-bootstrap: created default company and agent for first user",
    );

    return { action: "created_company", companyId: company.id };
  }

  /**
   * Seed the superadmin user on server startup.
   * Idempotent: skips if user with the given email already exists.
   */
  async function seedSuperadmin(
    email: string,
    password: string,
    hashPassword: (pw: string) => Promise<string>,
  ): Promise<void> {
    // Check if user already exists
    const [existing] = await db
      .select({ id: authUsers.id })
      .from(authUsers)
      .where(eq(authUsers.email, email));

    if (existing) {
      logger.info({ email }, "Superadmin already exists, skipping seed");
      return;
    }

    const { randomUUID } = await import("node:crypto");
    const userId = randomUUID();
    const hashedPassword = await hashPassword(password);

    // Create the user
    await db.insert(authUsers).values({
      id: userId,
      name: "Super Admin",
      email,
      role: "superadmin",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create account entry for email/password auth
    const { authAccounts } = await import("@paperclipai/db");
    await db.insert(authAccounts).values({
      id: randomUUID(),
      accountId: userId,
      providerId: "credential",
      userId,
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Run the standard bootstrap (company + CEO agent + instance_admin)
    await createDefaultSetup(userId, "Super Admin");

    logger.info({ email, userId }, "Seeded superadmin user on startup");
  }

  return { maybeBootstrapUser, seedSuperadmin };
}
