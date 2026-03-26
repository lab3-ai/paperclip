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
