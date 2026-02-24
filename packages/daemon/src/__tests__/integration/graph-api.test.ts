/**
 * Integration Test: Graph API
 * 
 * Tests graph traversal and edge management through HTTP endpoints
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { Express } from "express";
import { ObjectId } from "mongodb";
import { createTestApp, addErrorHandler, cleanupTestData } from "../helpers";
import { getDatabase } from "../../db";
import {
  getPendingEdgesRoute,
  approvePendingEdgeRoute,
  rejectPendingEdgeRoute,
  traverseGraphRoute,
  getNodeRoute,
} from "../../routes/graph";

describe("Graph API Integration", () => {
  let app: Express;
  const agentId = "test-graph-api";
  let memoryIds: string[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    app.get("/graph/pending-edges", getPendingEdgesRoute);
    app.post("/graph/pending-edges/:id/approve", approvePendingEdgeRoute);
    app.post("/graph/pending-edges/:id/reject", rejectPendingEdgeRoute);
    app.get("/graph/traverse/:id", traverseGraphRoute);
    app.get("/graph/node/:id", getNodeRoute);
    await addErrorHandler(app);

    await cleanupTestData(agentId);

    // Create test graph:
    // A (root) → B (child 1) → C (grandchild)
    //         → D (child 2)
    const db = getDatabase();
    const memories = await db.collection("memories").insertMany([
      {
        agentId,
        text: "Root memory A",
        tags: ["test"],
        confidence: 0.9,
        strength: 2.0,
        layer: "semantic",
        memoryType: "fact",
        embedding: Array(1024).fill(0).map(() => Math.random()),
        edges: [], // Will add later
        createdAt: new Date(),
      },
      {
        agentId,
        text: "Child memory B",
        tags: ["test"],
        confidence: 0.85,
        strength: 1.8,
        layer: "semantic",
        memoryType: "fact",
        embedding: Array(1024).fill(0).map(() => Math.random()),
        edges: [],
        createdAt: new Date(),
      },
      {
        agentId,
        text: "Grandchild memory C",
        tags: ["test"],
        confidence: 0.8,
        strength: 1.5,
        layer: "episodic",
        memoryType: "fact",
        embedding: Array(1024).fill(0).map(() => Math.random()),
        edges: [],
        createdAt: new Date(),
      },
      {
        agentId,
        text: "Child memory D",
        tags: ["test"],
        confidence: 0.82,
        strength: 1.6,
        layer: "episodic",
        memoryType: "fact",
        embedding: Array(1024).fill(0).map(() => Math.random()),
        edges: [],
        createdAt: new Date(),
      },
    ]);

    memoryIds = Object.values(memories.insertedIds).map((id) => id.toString());

    // Add edges: A → B, A → D, B → C
    await db.collection("memories").updateOne(
      { _id: new ObjectId(memoryIds[0]) },
      {
        $set: {
          edges: [
            { type: "SUPPORTS", targetId: memoryIds[1], weight: 0.9 },
            { type: "SUPPORTS", targetId: memoryIds[3], weight: 0.85 },
          ],
        },
      }
    );

    await db.collection("memories").updateOne(
      { _id: new ObjectId(memoryIds[1]) },
      {
        $set: {
          edges: [
            { type: "CAUSES", targetId: memoryIds[2], weight: 0.8 },
          ],
        },
      }
    );
  });

  afterAll(async () => {
    await cleanupTestData(agentId);
  });

  it("should traverse graph from root node (depth 1)", async () => {
    const res = await request(app)
      .get(`/graph/traverse/${memoryIds[0]}`)
      .query({ direction: "outbound", maxDepth: 1 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.root).toBeDefined();
    expect(res.body.root.id).toBe(memoryIds[0]);
    expect(res.body.nodes).toBeDefined();
    expect(res.body.edges).toBeDefined();

    // Should find: A (root) + B + D (depth 1)
    expect(res.body.nodes.length).toBeGreaterThanOrEqual(3);

    // Should have 2 edges (A→B, A→D)
    expect(res.body.edges.length).toBeGreaterThanOrEqual(2);

    // Verify edge structure
    const edge = res.body.edges[0];
    expect(edge).toHaveProperty("source");
    expect(edge).toHaveProperty("target");
    expect(edge).toHaveProperty("type");
    expect(edge).toHaveProperty("weight");
  });

  it("should traverse graph deeper (depth 2)", async () => {
    const res = await request(app)
      .get(`/graph/traverse/${memoryIds[0]}`)
      .query({ direction: "outbound", maxDepth: 2 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Should find: A + B + C + D
    expect(res.body.nodes.length).toBe(4);

    // Should have 3 edges (A→B, A→D, B→C)
    expect(res.body.edges.length).toBe(3);
  });

  it("should traverse graph inbound", async () => {
    const res = await request(app)
      .get(`/graph/traverse/${memoryIds[2]}`) // Start from C (grandchild)
      .query({ direction: "inbound", maxDepth: 2 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Should find nodes pointing TO C: B and A
    const nodeIds = res.body.nodes.map((n: any) => n.id);
    expect(nodeIds).toContain(memoryIds[1]); // B
    expect(nodeIds).toContain(memoryIds[0]); // A
  });

  it("should traverse graph bidirectionally", async () => {
    const res = await request(app)
      .get(`/graph/traverse/${memoryIds[1]}`) // Start from B (middle)
      .query({ direction: "both", maxDepth: 1 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Should find: B (root) + A (inbound) + C (outbound)
    expect(res.body.nodes.length).toBeGreaterThanOrEqual(3);
  });

  it("should get individual graph node", async () => {
    const res = await request(app).get(`/graph/node/${memoryIds[0]}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.node).toBeDefined();
    expect(res.body.node.id).toBe(memoryIds[0]);
    expect(res.body.node.text).toBe("Root memory A");
    expect(res.body.node.edges).toBeDefined();
    expect(res.body.node.edges.length).toBe(2);
  });

  it("should list pending edges", async () => {
    const db = getDatabase();

    // Create a pending edge
    await db.collection("pending_edges").insertOne({
      agentId,
      sourceId: memoryIds[2],
      targetId: memoryIds[3],
      type: "CO_OCCURS",
      weight: 0.7,
      reason: "Both memories from same context",
      status: "pending",
      createdAt: new Date(),
    });

    const res = await request(app)
      .get("/graph/pending-edges")
      .query({ agentId });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.edges).toBeDefined();
    expect(Array.isArray(res.body.edges)).toBe(true);
    expect(res.body.edges.length).toBeGreaterThan(0);

    // Verify edge structure
    const edge = res.body.edges[0];
    expect(edge).toHaveProperty("id");
    expect(edge).toHaveProperty("sourceId");
    expect(edge).toHaveProperty("targetId");
    expect(edge).toHaveProperty("type");
    expect(edge).toHaveProperty("weight");
    expect(edge).toHaveProperty("status");
    expect(edge.status).toBe("pending");
  });

  it("should approve pending edge", async () => {
    const db = getDatabase();

    // Get pending edge
    const pendingEdge = await db.collection("pending_edges").findOne({
      agentId,
      status: "pending",
    });

    expect(pendingEdge).toBeDefined();

    const edgeId = pendingEdge!._id.toString();

    const res = await request(app)
      .post(`/graph/pending-edges/${edgeId}/approve`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify edge was approved
    const updated = await db.collection("pending_edges").findOne({ _id: pendingEdge!._id });
    expect(updated?.status).toBe("approved");

    // Verify edge was applied to source memory
    const sourceMemory = await db.collection("memories").findOne({
      _id: new ObjectId(pendingEdge!.sourceId),
    });
    const hasEdge = sourceMemory?.edges.some(
      (e: any) => e.targetId === pendingEdge!.targetId && e.type === pendingEdge!.type
    );
    expect(hasEdge).toBe(true);
  });

  it("should reject pending edge", async () => {
    const db = getDatabase();

    // Create another pending edge
    const result = await db.collection("pending_edges").insertOne({
      agentId,
      sourceId: memoryIds[0],
      targetId: memoryIds[2],
      type: "DERIVES_FROM",
      weight: 0.6,
      reason: "Test rejection",
      status: "pending",
      createdAt: new Date(),
    });

    const edgeId = result.insertedId.toString();

    const res = await request(app)
      .post(`/graph/pending-edges/${edgeId}/reject`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify edge was rejected
    const updated = await db.collection("pending_edges").findOne({ _id: result.insertedId });
    expect(updated?.status).toBe("rejected");

    // Verify edge was NOT applied to source memory
    const sourceMemory = await db.collection("memories").findOne({
      _id: new ObjectId(memoryIds[0]),
    });
    const hasEdge = sourceMemory?.edges.some(
      (e: any) => e.targetId === memoryIds[2] && e.type === "DERIVES_FROM"
    );
    expect(hasEdge).toBe(false);
  });

  it("should handle non-existent node", async () => {
    const fakeId = new ObjectId().toString();
    const res = await request(app)
      .get(`/graph/traverse/${fakeId}`)
      .query({ direction: "outbound", maxDepth: 2 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    expect(res.body.nodes.length).toBe(0);
    expect(res.body.edges.length).toBe(0);
  });

  it("should handle isolated node (no edges)", async () => {
    const db = getDatabase();
    const isolated = await db.collection("memories").insertOne({
      agentId,
      text: "Isolated memory",
      tags: ["isolated"],
      confidence: 0.8,
      strength: 1.0,
      layer: "episodic",
      memoryType: "fact",
      embedding: Array(1024).fill(0).map(() => Math.random()),
      edges: [],
      createdAt: new Date(),
    });

    const res = await request(app)
      .get(`/graph/traverse/${isolated.insertedId.toString()}`)
      .query({ direction: "outbound", maxDepth: 2 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.nodes.length).toBe(1); // Only root
    expect(res.body.edges.length).toBe(0);
  });
});
