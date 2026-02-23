/**
 * Integration test — full lifecycle flow:
 *   remember → recall → wordcloud → timeline → agents → export → forget → clear
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { Express } from "express";
import { rememberRoute } from "../../routes/remember";
import { recallRoute } from "../../routes/recall";
import { forgetRoute } from "../../routes/forget";
import { wordcloudRoute } from "../../routes/wordcloud";
import { timelineRoute } from "../../routes/timeline";
import { handleAgents } from "../../routes/agents";
import { exportRoute } from "../../routes/export";
import { clearRoute } from "../../routes/clear";
import { createTestApp, addErrorHandler, cleanupTestData } from "../helpers";

const AGENT = "test-integration-agent";
let app: Express;
let storedId: string;

describe("Full lifecycle integration", () => {
  beforeAll(async () => {
    app = await createTestApp();
    app.post("/remember", rememberRoute);
    app.get("/recall", recallRoute);
    app.delete("/forget/:id", forgetRoute);
    app.get("/wordcloud", wordcloudRoute);
    app.get("/timeline", timelineRoute);
    app.get("/agents", handleAgents);
    app.get("/export", exportRoute);
    app.delete("/clear", clearRoute);
    await addErrorHandler(app);

    await cleanupTestData(AGENT);
  });

  afterAll(async () => {
    await cleanupTestData(AGENT);
  });

  it("1. remember — should store a memory", async () => {
    const res = await request(app)
      .post("/remember")
      .send({
        agentId: AGENT,
        text: "TypeScript is great for building scalable applications",
        tags: ["typescript", "scalable"],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.id).toBeDefined();
    storedId = res.body.id;
  });

  it("2. remember — should store a second memory", async () => {
    const res = await request(app)
      .post("/remember")
      .send({
        agentId: AGENT,
        text: "MongoDB excels at flexible document storage",
        tags: ["mongodb", "database"],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("3. recall — should find stored memories", async () => {
    const res = await request(app)
      .get("/recall")
      .query({ agentId: AGENT, text: "TypeScript scalable" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.memories.length).toBeGreaterThanOrEqual(1);
  });

  it("4. wordcloud — should return words from memories", async () => {
    const res = await request(app).get("/wordcloud").query({ agentId: AGENT, minCount: 1 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.totalMemories).toBeGreaterThanOrEqual(2);
  });

  it("5. timeline — should show today as active", async () => {
    const res = await request(app).get("/timeline").query({ agentId: AGENT });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.total).toBeGreaterThanOrEqual(2);
    expect(res.body.days.length).toBeGreaterThanOrEqual(1);
  });

  it("6. agents — should list our test agent", async () => {
    const res = await request(app).get("/agents");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const agent = res.body.agents.find((a: { agentId: string }) => a.agentId === AGENT);
    expect(agent).toBeDefined();
    expect(agent.count).toBeGreaterThanOrEqual(2);
  });

  it("7. export — should export all memories without embeddings", async () => {
    const res = await request(app).get("/export").query({ agentId: AGENT });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBeGreaterThanOrEqual(2);
    // Should not expose embeddings
    for (const mem of res.body.memories) {
      expect(mem).not.toHaveProperty("embedding");
    }
  });

  it("8. forget — should delete one specific memory", async () => {
    const res = await request(app).delete(`/forget/${storedId}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("9. clear — should delete remaining memories", async () => {
    const res = await request(app).delete("/clear").query({ agentId: AGENT });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.deleted).toBeGreaterThanOrEqual(1);
  });

  it("10. verify — agent should have no memories left", async () => {
    const res = await request(app).get("/export").query({ agentId: AGENT });

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(0);
    expect(res.body.memories).toEqual([]);
  });
});
