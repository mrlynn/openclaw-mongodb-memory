/**
 * Integration Test: Full Reflection Pipeline via API
 * 
 * Tests the complete reflection workflow through HTTP endpoints
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { Express } from "express";
import { createTestApp, addErrorHandler, cleanupTestData } from "../helpers";
import { triggerReflectRoute, getReflectStatusRoute, listReflectJobsRoute } from "../../routes/reflect";
import { rememberRoute } from "../../routes/remember";
import { getDatabase } from "../../db";

describe("Reflection Pipeline API Integration", () => {
  let app: Express;
  const agentId = "test-reflection-api";

  beforeAll(async () => {
    app = await createTestApp();
    app.post("/remember", rememberRoute);
    app.post("/reflect", triggerReflectRoute);
    app.get("/reflect/status", getReflectStatusRoute);
    app.get("/reflect/jobs", listReflectJobsRoute);
    await addErrorHandler(app);

    await cleanupTestData(agentId);
  });

  afterAll(async () => {
    await cleanupTestData(agentId);
  });

  it("should trigger reflection pipeline and complete successfully", async () => {
    const db = getDatabase();

    // 1. Create test memories in a session
    const sessionId = `test-session-${Date.now()}`;
    const memories = [
      {
        agentId,
        sessionId,
        text: "TypeScript provides static type checking for JavaScript",
        tags: ["typescript", "benefits"],
      },
      {
        agentId,
        sessionId,
        text: "Type systems catch errors at compile time",
        tags: ["typescript", "quality"],
      },
      {
        agentId,
        sessionId,
        text: "MongoDB is a document database",
        tags: ["mongodb", "database"],
      },
      {
        agentId,
        sessionId,
        text: "TypeScript allows dynamic typing when needed",
        tags: ["typescript", "flexibility"],
      },
    ];

    for (const memory of memories) {
      const res = await request(app).post("/remember").send(memory);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    }

    // 2. Trigger reflection pipeline with detailed session transcript
    const sessionTranscript = `
User: What are the benefits of TypeScript?
Assistant: TypeScript provides static type checking for JavaScript. This helps catch errors at compile time rather than runtime. Type systems improve code quality and maintainability.

User: How does it compare to plain JavaScript?
Assistant: While TypeScript provides structure, it still allows dynamic typing when needed. MongoDB is a document database that works well with both TypeScript and JavaScript.

User: What about tooling?
Assistant: TypeScript enables better IDE support with autocomplete and refactoring tools. This makes development faster and more reliable.
    `.trim();

    const triggerRes = await request(app)
      .post("/reflect")
      .send({
        agentId,
        sessionId,
        sessionTranscript,
      });

    expect(triggerRes.status).toBe(200);
    expect(triggerRes.body.success).toBe(true);
    expect(triggerRes.body.jobId).toBeDefined();

    const jobId = triggerRes.body.jobId;

    // 3. Poll for completion (max 30 seconds)
    let completed = false;
    let attempts = 0;
    const maxAttempts = 30;

    while (!completed && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const statusRes = await request(app)
        .get("/reflect/status")
        .query({ jobId });

      expect(statusRes.status).toBe(200);
      expect(statusRes.body.success).toBe(true);

      const job = statusRes.body.job;
      expect(job.id).toBe(jobId);
      expect(job.agentId).toBe(agentId);

      if (job.status === "completed" || job.status === "failed") {
        completed = true;

        // Verify all 9 stages exist
        expect(job.stages).toBeDefined();
        expect(Array.isArray(job.stages)).toBe(true);
        expect(job.stages.length).toBeGreaterThanOrEqual(9);

        // Verify stage names
        const stageNames = job.stages.map((s: any) => s.stage);
        expect(stageNames).toContain("extract");
        expect(stageNames).toContain("deduplicate");
        expect(stageNames).toContain("conflict-check");
        expect(stageNames).toContain("classify");
        expect(stageNames).toContain("confidence-update");
        expect(stageNames).toContain("decay-pass");
        expect(stageNames).toContain("layer-promote");
        expect(stageNames).toContain("graph-link");
        expect(stageNames).toContain("entity-update");

        // Job should complete successfully
        expect(job.status).toBe("completed");
        expect(job.completedAt).toBeDefined();

        // All stages should complete
        for (const stage of job.stages) {
          expect(stage.status).toBe("completed");
          expect(stage.error).toBeUndefined();
        }
      }

      attempts++;
    }

    expect(completed).toBe(true);

    // 4. Verify outputs (pipeline may extract atoms or not depending on heuristics)
    // The important thing is that all stages ran successfully
    
    // Check memories still exist
    const allMemories = await db.collection("memories").find({ agentId, sessionId }).toArray();
    expect(allMemories.length).toBe(4);

    // Episode creation happens in extract stage - may or may not create one
    const episodes = await db.collection("episodes").find({ agentId, sessionId }).toArray();
    console.log(`\n   Episodes created: ${episodes.length}`);

    // Entity extraction happens if atoms were extracted - may be 0
    const entities = await db.collection("entities").find({ agentId }).toArray();
    console.log(`   Entities extracted: ${entities.length}`);
    
    // Pending edges created if atoms were linked - may be 0
    const pendingEdges = await db.collection("pending_edges").find({ agentId }).toArray();
    console.log(`   Pending edges: ${pendingEdges.length}`);

    // The key success criteria: pipeline completed all 9 stages without errors
    // (actual extraction counts depend on heuristics and may be 0 for simple test data)

  }, 60000); // 60 second timeout

  it("should list all reflection jobs for an agent", async () => {
    const res = await request(app)
      .get("/reflect/jobs")
      .query({ agentId });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.jobs).toBeDefined();
    expect(Array.isArray(res.body.jobs)).toBe(true);
    expect(res.body.jobs.length).toBeGreaterThan(0);

    // Verify job structure
    const job = res.body.jobs[0];
    expect(job).toHaveProperty("id");
    expect(job).toHaveProperty("agentId");
    expect(job).toHaveProperty("status");
    expect(job).toHaveProperty("createdAt");
  });

  it("should handle missing jobId in status query", async () => {
    const res = await request(app).get("/reflect/status");

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it("should handle invalid jobId", async () => {
    const res = await request(app)
      .get("/reflect/status")
      .query({ jobId: "invalid-job-id" });

    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });
});
