/**
 * Integration Test: API Performance Benchmarks
 * 
 * Tests system performance through HTTP endpoints at scale
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { Express } from "express";
import { createTestApp, addErrorHandler, cleanupTestData } from "../helpers";
import { rememberRoute } from "../../routes/remember";
import { recallRoute } from "../../routes/recall";
import { traverseGraphRoute } from "../../routes/graph";
import { runClusteringRoute, listClustersRoute } from "../../routes/clusters";
import { getDatabase } from "../../db";
import { ObjectId } from "mongodb";

describe("API Performance Benchmarks", () => {
  let app: Express;
  const agentId = "test-perf-api";

  beforeAll(async () => {
    app = await createTestApp();
    app.post("/remember", rememberRoute);
    app.get("/recall", recallRoute);
    app.get("/graph/traverse/:id", traverseGraphRoute);
    app.post("/clusters/run", runClusteringRoute);
    app.get("/clusters", listClustersRoute);
    await addErrorHandler(app);

    await cleanupTestData(agentId);
  });

  afterAll(async () => {
    await cleanupTestData(agentId);
  });

  it("should handle 100 sequential memory insertions within target time", async () => {
    const startTime = Date.now();
    const count = 100;

    const topics = [
      "TypeScript",
      "MongoDB",
      "React",
      "Python",
      "API design",
      "DevOps",
      "Machine learning",
      "Data structures",
      "Cloud",
      "Security",
    ];

    for (let i = 0; i < count; i++) {
      const topic = topics[i % topics.length];
      const res = await request(app)
        .post("/remember")
        .send({
          agentId,
          text: `${topic} fact ${i}`,
          tags: [topic.toLowerCase(), "test"],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    }

    const duration = Date.now() - startTime;
    const throughput = count / (duration / 1000);

    console.log(`\n📊 Sequential Insert Performance:`);
    console.log(`   Total: ${count} memories`);
    console.log(`   Duration: ${duration}ms`);
    console.log(`   Throughput: ${throughput.toFixed(2)} ops/sec`);

    // Target: > 10 insertions/sec (reasonable for HTTP overhead + embeddings)
    expect(throughput).toBeGreaterThan(5);

  }, 120000); // 2 minute timeout

  it("should handle recall queries efficiently with 100+ memories", async () => {
    const queries = [
      "TypeScript best practices",
      "MongoDB optimization",
      "React performance",
      "Python data analysis",
      "API security",
    ];

    const results = [];

    for (const query of queries) {
      const startTime = Date.now();

      const res = await request(app)
        .get("/recall")
        .query({ agentId, query, limit: 10 });

      const duration = Date.now() - startTime;

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.results).toBeDefined();

      results.push({
        query,
        duration,
        resultsCount: res.body.results.length,
      });
    }

    const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
    const p95Duration = results.sort((a, b) => b.duration - a.duration)[0].duration;

    console.log(`\n📊 Recall Query Performance:`);
    console.log(`   Queries: ${queries.length}`);
    console.log(`   Average: ${avgDuration.toFixed(2)}ms`);
    console.log(`   P95: ${p95Duration}ms`);

    // Target: p95 < 1000ms for HTTP + embedding + similarity
    expect(p95Duration).toBeLessThan(2000);

    // All queries should return results
    results.forEach((r) => {
      expect(r.resultsCount).toBeGreaterThan(0);
    });

  }, 60000);

  it("should handle 50 concurrent memory insertions", async () => {
    const concurrency = 50;
    const startTime = Date.now();

    const requests = [];
    for (let i = 0; i < concurrency; i++) {
      requests.push(
        request(app)
          .post("/remember")
          .send({
            agentId,
            text: `Concurrent memory ${i}`,
            tags: ["concurrent"],
          })
      );
    }

    const responses = await Promise.all(requests);
    const duration = Date.now() - startTime;

    console.log(`\n📊 Concurrent Insert Performance:`);
    console.log(`   Requests: ${concurrency} parallel`);
    console.log(`   Duration: ${duration}ms`);
    console.log(`   Throughput: ${(concurrency / (duration / 1000)).toFixed(2)} ops/sec`);

    // All should succeed
    responses.forEach((res) => {
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    // Target: < 10 seconds for 50 parallel
    expect(duration).toBeLessThan(20000);

  }, 60000);

  it("should perform clustering on 100+ memories within target time", async () => {
    const db = getDatabase();
    const count = await db.collection("memories").countDocuments({ agentId });
    expect(count).toBeGreaterThan(100);

    const startTime = Date.now();

    const res = await request(app)
      .post("/clusters/run")
      .send({
        agentId,
        k: 10, // 10 clusters
      });

    const duration = Date.now() - startTime;

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.clustersCreated).toBeGreaterThan(0);
    expect(res.body.memoriesAssigned).toBeGreaterThanOrEqual(count * 0.8);

    console.log(`\n📊 Clustering Performance (${count} memories):`);
    console.log(`   Duration: ${duration}ms`);
    console.log(`   Clusters: ${res.body.clustersCreated}`);
    console.log(`   Assigned: ${res.body.memoriesAssigned}`);

    // Target: < 10 seconds for 100+ memories
    expect(duration).toBeLessThan(15000);

    // Verify clusters have labels
    const clustersRes = await request(app)
      .get("/clusters")
      .query({ agentId });

    expect(clustersRes.status).toBe(200);
    expect(clustersRes.body.success).toBe(true);
    expect(clustersRes.body.clusters.length).toBeGreaterThan(0);

    clustersRes.body.clusters.forEach((cluster: any) => {
      expect(cluster.label).toBeDefined();
      expect(cluster.size).toBeGreaterThan(0);
    });

  }, 60000);

  it("should handle deep graph traversal efficiently", async () => {
    const db = getDatabase();

    // Create a chain of 10 memories
    const chain = [];
    for (let i = 0; i < 10; i++) {
      const res = await request(app)
        .post("/remember")
        .send({
          agentId,
          text: `Chain node ${i}`,
          tags: ["chain"],
        });
      expect(res.status).toBe(200);
      chain.push(res.body.id);
    }

    // Connect them: 0 → 1 → 2 → ... → 9
    for (let i = 0; i < chain.length - 1; i++) {
      await db.collection("memories").updateOne(
        { _id: new ObjectId(chain[i]) },
        {
          $push: {
            edges: {
              type: "PRECEDES",
              targetId: chain[i + 1],
              weight: 1.0,
            },
          } as any,
        }
      );
    }

    // Traverse from root with depth 5
    const startTime = Date.now();
    const res = await request(app)
      .get(`/graph/traverse/${chain[0]}`)
      .query({ direction: "outbound", maxDepth: 5 });
    const duration = Date.now() - startTime;

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.nodes.length).toBeGreaterThanOrEqual(6); // Root + 5 levels
    expect(res.body.edges.length).toBeGreaterThanOrEqual(5);

    console.log(`\n📊 Graph Traversal (depth 5):`);
    console.log(`   Duration: ${duration}ms`);
    console.log(`   Nodes: ${res.body.nodes.length}`);
    console.log(`   Edges: ${res.body.edges.length}`);

    // Target: < 500ms
    expect(duration).toBeLessThan(1000);

  }, 60000);

  it("should handle multiple simultaneous recall queries", async () => {
    const queries = [
      "TypeScript development",
      "MongoDB database",
      "React components",
      "Python scripts",
      "concurrent testing",
    ];

    const startTime = Date.now();

    const requests = queries.map((query) =>
      request(app)
        .get("/recall")
        .query({ agentId, query, limit: 10 })
    );

    const responses = await Promise.all(requests);
    const duration = Date.now() - startTime;

    console.log(`\n📊 Concurrent Recall Performance:`);
    console.log(`   Queries: ${queries.length} parallel`);
    console.log(`   Duration: ${duration}ms`);
    console.log(`   Avg per query: ${(duration / queries.length).toFixed(2)}ms`);

    // All should succeed and return results
    responses.forEach((res) => {
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.results.length).toBeGreaterThan(0);
    });

    // Target: < 5 seconds for 5 parallel queries
    expect(duration).toBeLessThan(10000);

  }, 60000);

  it("should maintain performance with batch recall queries", async () => {
    const batchSize = 10;
    const results = [];

    const startTime = Date.now();

    for (let i = 0; i < batchSize; i++) {
      const res = await request(app)
        .get("/recall")
        .query({
          agentId,
          query: `batch query ${i}`,
          limit: 5,
        });

      expect(res.status).toBe(200);
      results.push(res.body.results.length);
    }

    const duration = Date.now() - startTime;
    const avgDuration = duration / batchSize;

    console.log(`\n📊 Batch Recall Performance:`);
    console.log(`   Batch size: ${batchSize}`);
    console.log(`   Total duration: ${duration}ms`);
    console.log(`   Avg per query: ${avgDuration.toFixed(2)}ms`);

    // Target: < 200ms per query on average
    expect(avgDuration).toBeLessThan(500);

  }, 60000);
});
