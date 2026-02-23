/**
 * Tests for /export endpoint
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { Express } from "express";
import { exportRoute } from "../../routes/export";
import { rememberRoute } from "../../routes/remember";
import { createTestApp, addErrorHandler, cleanupTestData } from "../helpers";

const AGENT = "test-export-agent";
let app: Express;

describe("GET /export", () => {
  beforeAll(async () => {
    app = await createTestApp();
    app.post("/remember", rememberRoute);
    app.get("/export", exportRoute);
    await addErrorHandler(app);

    await cleanupTestData(AGENT);
    await request(app)
      .post("/remember")
      .send({ agentId: AGENT, text: "Exportable memory 1", tags: ["test"] });
    await request(app)
      .post("/remember")
      .send({ agentId: AGENT, text: "Exportable memory 2", tags: ["test", "export"] });
  });

  afterAll(async () => {
    await cleanupTestData(AGENT);
  });

  it("should export all memories for an agent", async () => {
    const res = await request(app).get("/export").query({ agentId: AGENT });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.agentId).toBe(AGENT);
    expect(res.body.count).toBeGreaterThanOrEqual(2);
    expect(Array.isArray(res.body.memories)).toBe(true);
    expect(res.body).toHaveProperty("exportedAt");

    // Memories should have expected fields but NOT embeddings
    const mem = res.body.memories[0];
    expect(mem).toHaveProperty("id");
    expect(mem).toHaveProperty("text");
    expect(mem).toHaveProperty("tags");
    expect(mem).not.toHaveProperty("embedding");
  });

  it("should return empty memories for unknown agent", async () => {
    const res = await request(app).get("/export").query({ agentId: "nonexistent-agent-xyz" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.memories).toEqual([]);
    expect(res.body.count).toBe(0);
  });

  it("should reject request without agentId", async () => {
    const res = await request(app).get("/export");
    expect(res.status).toBe(400);
  });
});
