/**
 * Tests for /embeddings endpoint
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { Express } from "express";
import { embeddingsRoute } from "../../routes/embeddings";
import { rememberRoute } from "../../routes/remember";
import { createTestApp, addErrorHandler, cleanupTestData } from "../helpers";

const AGENT = "test-embeddings-agent";
let app: Express;

describe("GET /embeddings", () => {
  beforeAll(async () => {
    app = await createTestApp();
    app.post("/remember", rememberRoute);
    app.get("/embeddings", embeddingsRoute);
    await addErrorHandler(app);

    await cleanupTestData(AGENT);
    // Seed at least 3 memories so PCA has something to work with
    const texts = [
      "First memory about coding in TypeScript",
      "Second memory about database design patterns",
      "Third memory about vector search algorithms",
    ];
    for (const text of texts) {
      await request(app).post("/remember").send({ agentId: AGENT, text });
    }
  });

  afterAll(async () => {
    await cleanupTestData(AGENT);
  });

  it("should return 2D projected points", async () => {
    const res = await request(app).get("/embeddings").query({ agentId: AGENT });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.agentId).toBe(AGENT);
    expect(res.body.count).toBeGreaterThanOrEqual(3);
    expect(Array.isArray(res.body.points)).toBe(true);

    if (res.body.points.length > 0) {
      const point = res.body.points[0];
      expect(point).toHaveProperty("x");
      expect(point).toHaveProperty("y");
      expect(point).toHaveProperty("text");
      expect(point).toHaveProperty("tags");
      expect(typeof point.x).toBe("number");
      expect(typeof point.y).toBe("number");
    }
  });

  it("should respect limit parameter", async () => {
    const res = await request(app).get("/embeddings").query({ agentId: AGENT, limit: 2 });

    expect(res.status).toBe(200);
    expect(res.body.points.length).toBeLessThanOrEqual(2);
  });

  it("should return empty points for unknown agent", async () => {
    const res = await request(app).get("/embeddings").query({ agentId: "nonexistent-agent-xyz" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.points).toEqual([]);
  });

  it("should reject request without agentId", async () => {
    const res = await request(app).get("/embeddings");
    expect(res.status).toBe(400);
  });
});
