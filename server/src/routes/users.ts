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
  hashPassword: (password: string) => Promise<string>;
}

export function userRoutes(db: Db, opts: UserRoutesOptions) {
  const router = Router();
  const userService = userManagementService(db);

  // GET /users/me — must be before /users/:id
  router.get("/users/me", async (req, res) => {
    if (req.actor.type !== "board" || !req.actor.userId) {
      throw unauthorized();
    }
    const user = await userService.getUser(req.actor.userId);
    res.json(user);
  });

  // PATCH /users/me
  router.patch("/users/me", async (req, res) => {
    if (req.actor.type !== "board" || !req.actor.userId) {
      throw unauthorized();
    }
    const { name } = req.body;
    const user = await userService.updateUser(req.actor.userId, { name });
    res.json(user);
  });

  // GET /users
  router.get("/users", async (req, res) => {
    requirePermission(req, "users:read");
    const actorRole = req.actor.role as string;
    let users;
    if (actorRole === "admin" && req.actor.companyIds?.length) {
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

  // POST /users
  router.post("/users", async (req, res) => {
    requirePermission(req, "users:create");
    const { name, email, password, role, companyIds } = req.body;

    if (!name || !email || !password) {
      throw badRequest("name, email, and password are required");
    }

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
    const hashedPassword = await opts.hashPassword(password);

    await db.insert(authUsers).values({
      id: userId,
      name,
      email,
      role: targetRole,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(authAccounts).values({
      id: randomUUID(),
      accountId: userId,
      providerId: "credential",
      userId,
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    if (companyIds && Array.isArray(companyIds)) {
      for (const companyId of companyIds) {
        await userService.addToCompany(userId, companyId);
      }
    }

    const user = await userService.getUser(userId);
    res.status(201).json(user);
  });

  // GET /users/:id
  router.get("/users/:id", async (req, res) => {
    requirePermission(req, "users:read");
    const user = await userService.getUser(req.params.id);
    res.json(user);
  });

  // PATCH /users/:id
  router.patch("/users/:id", async (req, res) => {
    requirePermission(req, "users:update");
    const { name, email } = req.body;
    const user = await userService.updateUser(req.params.id, { name, email });
    res.json(user);
  });

  // DELETE /users/:id
  router.delete("/users/:id", async (req, res) => {
    requirePermission(req, "users:delete");
    await userService.deleteUser(req.params.id);
    res.status(204).end();
  });

  // PATCH /users/:id/role
  router.patch("/users/:id/role", async (req, res) => {
    requirePermission(req, "users:assign_role");
    const { role } = req.body;
    if (!role) throw badRequest("role is required");

    const actorRole = req.actor.role as string;
    const user = await userService.changeRole(req.params.id, role as UserRole, actorRole);
    res.json(user);
  });

  // POST /users/:id/companies
  router.post("/users/:id/companies", async (req, res) => {
    requirePermission(req, "users:update");
    const { companyId } = req.body;
    if (!companyId) throw badRequest("companyId is required");
    await userService.addToCompany(req.params.id, companyId);
    const user = await userService.getUser(req.params.id);
    res.json(user);
  });

  // DELETE /users/:id/companies/:companyId
  router.delete("/users/:id/companies/:companyId", async (req, res) => {
    requirePermission(req, "users:update");
    await userService.removeFromCompany(req.params.id, req.params.companyId);
    res.status(204).end();
  });

  return router;
}
