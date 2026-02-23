/**
 * Tests for /timeline endpoint
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { Express } from "express";
import { timelineRoute } from "../../routes/timeline";
import { rememberRoute } from "../../routes/remember";
import { createTestApp, addErrorHandler, cleanupTestData } from "../helpers";

const AGENT = "test-timeline-agent";
let app: Express;

describe("GET /timeline", () => {
  beforeAll(async () => {
    app = await createTestApp();
    app.post("/remember", rememberRoute);
    app.get("/timeline", timelineRoute);
    await addErrorHandler(app);

    await cleanupTestData(AGENT);
    // Seed a few memories (all created today)
    for (let i = 0; i < 3; i++) {
      await request(app)
        .post("/remember")
        .send({ agentId: AGENT, text: `Timeline memory ${i}` });
    }
  });

  afterAll(async () => {
    await cleanupTestData(AGENT);
  });

  it("should return timeline data with day buckets", async () => {
    const res = await request(app).get("/timeline").query({ agentId: AGENT });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.agentId).toBe(AGENT);
    expect(Array.isArray(res.body.days)).toBe(true);
    expect(res.body.total).toBeGreaterThanOrEqual(3);
    expect(res.body.dateRange).toHaveProperty("from");
    expect(res.body.dateRange).toHaveProperty("to");

    // Today should have at least 3 entries
    if (res.body.days.length > 0) {
      const day = res.body.days[0];
      expect(day).toHaveProperty("date");
      expect(day).toHaveProperty("count");
      expect(typeof day.count).toBe("number");
    }
  });

  it("should respect days parameter", async () => {
    const res = await request(app).get("/timeline").query({ agentId: AGENT, days: 1 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("should return empty days for unknown agent", async () => {
    const res = await request(app).get("/timeline").query({ agentId: "nonexistent-agent-xyz" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.days).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  it("should reject request without agentId", async () => {
    const res = await request(app).get("/timeline");
    expect(res.status).toBe(400);
  });
});
