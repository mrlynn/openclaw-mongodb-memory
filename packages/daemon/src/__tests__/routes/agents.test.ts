/**
 * Tests for /agents endpoint
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { Express } from "express";
import { handleAgents } from "../../routes/agents";
import { rememberRoute } from "../../routes/remember";
import { createTestApp, addErrorHandler, cleanupTestData } from "../helpers";

const AGENT_A = "test-agents-alpha";
const AGENT_B = "test-agents-beta";
let app: Express;

describe("GET /agents", () => {
  beforeAll(async () => {
    app = await createTestApp();
    app.post("/remember", rememberRoute);
    app.get("/agents", handleAgents);
    await addErrorHandler(app);

    await cleanupTestData(AGENT_A);
    await cleanupTestData(AGENT_B);

    // Seed memories for two agents
    await request(app).post("/remember").send({ agentId: AGENT_A, text: "Alpha memory 1" });
    await request(app).post("/remember").send({ agentId: AGENT_A, text: "Alpha memory 2" });
    await request(app).post("/remember").send({ agentId: AGENT_B, text: "Beta memory 1" });
  });

  afterAll(async () => {
    await cleanupTestData(AGENT_A);
    await cleanupTestData(AGENT_B);
  });

  it("should return a list of agents with counts", async () => {
    const res = await request(app).get("/agents");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.agents)).toBe(true);
    expect(res.body.count).toBeGreaterThanOrEqual(2);

    // Find our test agents in the results
    const alpha = res.body.agents.find((a: { agentId: string }) => a.agentId === AGENT_A);
    const beta = res.body.agents.find((a: { agentId: string }) => a.agentId === AGENT_B);

    expect(alpha).toBeDefined();
    expect(alpha.count).toBeGreaterThanOrEqual(2);
    expect(alpha).toHaveProperty("lastUpdated");

    expect(beta).toBeDefined();
    expect(beta.count).toBeGreaterThanOrEqual(1);
  });

  it("should include count and lastUpdated for each agent", async () => {
    const res = await request(app).get("/agents");

    expect(res.status).toBe(200);
    for (const agent of res.body.agents) {
      expect(agent).toHaveProperty("agentId");
      expect(agent).toHaveProperty("count");
      expect(agent).toHaveProperty("lastUpdated");
      expect(typeof agent.count).toBe("number");
    }
  });
});
