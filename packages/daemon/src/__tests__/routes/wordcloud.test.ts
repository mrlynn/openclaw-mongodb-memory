/**
 * Tests for /wordcloud endpoint
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { Express } from "express";
import { wordcloudRoute } from "../../routes/wordcloud";
import { rememberRoute } from "../../routes/remember";
import { createTestApp, addErrorHandler, cleanupTestData } from "../helpers";

const AGENT = "test-wordcloud-agent";
let app: Express;

describe("GET /wordcloud", () => {
  beforeAll(async () => {
    app = await createTestApp();
    app.post("/remember", rememberRoute);
    app.get("/wordcloud", wordcloudRoute);
    await addErrorHandler(app);

    // Seed some memories with repeated words
    await cleanupTestData(AGENT);
    const texts = [
      "MongoDB is a document database for modern applications",
      "MongoDB Atlas provides managed database services",
      "Vector search enables semantic similarity queries",
      "Semantic search uses embeddings for matching",
    ];
    for (const text of texts) {
      await request(app).post("/remember").send({ agentId: AGENT, text });
    }
  });

  afterAll(async () => {
    await cleanupTestData(AGENT);
  });

  it("should return word frequencies for an agent", async () => {
    const res = await request(app).get("/wordcloud").query({ agentId: AGENT });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.agentId).toBe(AGENT);
    expect(res.body.totalMemories).toBeGreaterThanOrEqual(4);
    expect(Array.isArray(res.body.words)).toBe(true);
    expect(res.body.words.length).toBeGreaterThan(0);

    // Each word entry should have text, count, frequency
    const word = res.body.words[0];
    expect(word).toHaveProperty("text");
    expect(word).toHaveProperty("count");
    expect(word).toHaveProperty("frequency");
    expect(word.frequency).toBeGreaterThan(0);
    expect(word.frequency).toBeLessThanOrEqual(1);
  });

  it("should respect limit parameter", async () => {
    const res = await request(app).get("/wordcloud").query({ agentId: AGENT, limit: 3 });

    expect(res.status).toBe(200);
    expect(res.body.words.length).toBeLessThanOrEqual(3);
  });

  it("should return empty words for unknown agent", async () => {
    const res = await request(app).get("/wordcloud").query({ agentId: "nonexistent-agent-xyz" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.words).toEqual([]);
  });

  it("should reject request without agentId", async () => {
    const res = await request(app).get("/wordcloud");
    expect(res.status).toBe(400);
  });
});
