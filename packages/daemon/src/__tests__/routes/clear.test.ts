/**
 * Tests for DELETE /clear endpoint
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { Express } from "express";
import { clearRoute } from "../../routes/clear";
import { rememberRoute } from "../../routes/remember";
import { createTestApp, addErrorHandler, cleanupTestData } from "../helpers";

const AGENT = "test-clear-agent";
let app: Express;

describe("DELETE /clear", () => {
  beforeAll(async () => {
    app = await createTestApp();
    app.post("/remember", rememberRoute);
    app.delete("/clear", clearRoute);
    await addErrorHandler(app);
  });

  afterAll(async () => {
    await cleanupTestData(AGENT);
  });

  it("should clear all memories for an agent", async () => {
    await cleanupTestData(AGENT);

    // Seed memories
    await request(app).post("/remember").send({ agentId: AGENT, text: "Memory to clear 1" });
    await request(app).post("/remember").send({ agentId: AGENT, text: "Memory to clear 2" });

    const res = await request(app).delete("/clear").query({ agentId: AGENT });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.agentId).toBe(AGENT);
    expect(res.body.deleted).toBeGreaterThanOrEqual(2);
  });

  it("should return deleted 0 for unknown agent", async () => {
    const res = await request(app).delete("/clear").query({ agentId: "nonexistent-agent-xyz" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.deleted).toBe(0);
  });

  it("should reject request without agentId", async () => {
    const res = await request(app).delete("/clear");
    expect(res.status).toBe(400);
  });
});
