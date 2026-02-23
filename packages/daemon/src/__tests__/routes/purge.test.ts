/**
 * Tests for /purge endpoint
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { Express } from "express";
import { purgeRoute } from "../../routes/purge";
import { rememberRoute } from "../../routes/remember";
import { createTestApp, addErrorHandler, cleanupTestData } from "../helpers";

const AGENT = "test-purge-agent";
let app: Express;

describe("POST /purge", () => {
  beforeAll(async () => {
    app = await createTestApp();
    app.post("/remember", rememberRoute);
    app.post("/purge", purgeRoute);
    await addErrorHandler(app);
  });

  afterAll(async () => {
    await cleanupTestData(AGENT);
  });

  it("should purge memories older than a given date", async () => {
    await cleanupTestData(AGENT);

    // Seed memories
    await request(app).post("/remember").send({ agentId: AGENT, text: "Old memory" });
    await request(app).post("/remember").send({ agentId: AGENT, text: "New memory" });

    // Purge everything older than far in the future
    const future = new Date(Date.now() + 86400_000).toISOString();
    const res = await request(app).post("/purge").send({ agentId: AGENT, olderThan: future });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.agentId).toBe(AGENT);
    expect(res.body.deleted).toBeGreaterThanOrEqual(2);
  });

  it("should return deleted 0 when no matching memories", async () => {
    await cleanupTestData(AGENT);

    const past = new Date("2000-01-01T00:00:00Z").toISOString();
    const res = await request(app).post("/purge").send({ agentId: AGENT, olderThan: past });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.deleted).toBe(0);
  });

  it("should reject request without agentId", async () => {
    const res = await request(app).post("/purge").send({ olderThan: new Date().toISOString() });

    expect(res.status).toBe(400);
  });

  it("should reject request with invalid olderThan format", async () => {
    const res = await request(app).post("/purge").send({ agentId: AGENT, olderThan: "not-a-date" });

    expect(res.status).toBe(400);
  });

  it("should reject request without olderThan", async () => {
    const res = await request(app).post("/purge").send({ agentId: AGENT });

    expect(res.status).toBe(400);
  });
});
