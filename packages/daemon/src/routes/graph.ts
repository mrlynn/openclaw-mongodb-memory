/**
 * Graph API Routes
 * 
 * Endpoints for graph traversal, edge management, and visualization.
 */

import { Request, Response } from "express";
import { z } from "zod";
import { Db, ObjectId } from "mongodb";
import { asyncHandler } from "../middleware/asyncHandler.js";
import {
  listPendingEdges,
  applyPendingEdge,
  rejectPendingEdge,
  approvePendingEdges,
  traverseGraph,
} from "../services/graphService.js";
import { GraphEdge, GraphEdgeType } from "../types/index.js";
import { COLLECTION_MEMORIES } from "../constants.js";

/**
 * GET /graph/pending-edges
 * 
 * List pending graph edges awaiting approval
 */
export const getPendingEdgesRoute = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const edgeType = req.query.edgeType as GraphEdgeType | undefined;
  const minProbability = req.query.minProbability
    ? parseFloat(req.query.minProbability as string)
    : undefined;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);

  const db: Db = req.app.locals.db;

  const edges = await listPendingEdges(db, {
    edgeType,
    minProbability,
    limit,
  });

  res.json({
    success: true,
    count: edges.length,
    edges: edges.map((e) => ({
      id: e._id!.toString(),
      sourceId: e.sourceId,
      targetId: e.targetId,
      edgeType: e.edgeType,
      weight: e.weight,
      probability: e.probability,
      createdAt: e.createdAt,
      metadata: e.metadata,
    })),
  });
});

/**
 * POST /graph/pending-edges/:id/approve
 * 
 * Approve and apply a pending edge
 */
export const approvePendingEdgeRoute = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const edgeId = req.params.id;
  const db: Db = req.app.locals.db;

  const result = await applyPendingEdge(db, edgeId);

  if (result.success) {
    res.json({
      success: true,
      message: "Pending edge approved and applied",
    });
  } else {
    res.status(400).json({
      success: false,
      error: result.error,
    });
  }
});

/**
 * POST /graph/pending-edges/:id/reject
 * 
 * Reject a pending edge
 */
export const rejectPendingEdgeRoute = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const edgeId = req.params.id;
  const db: Db = req.app.locals.db;

  const success = await rejectPendingEdge(db, edgeId);

  if (success) {
    res.json({
      success: true,
      message: "Pending edge rejected",
    });
  } else {
    res.status(404).json({
      success: false,
      error: "Pending edge not found",
    });
  }
});

/**
 * POST /graph/pending-edges/approve-batch
 * 
 * Approve multiple pending edges
 */
const ApproveBatchSchema = z.object({
  edgeIds: z.array(z.string()).min(1).max(100),
});

export const approveBatchRoute = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const data = ApproveBatchSchema.parse(req.body);
  const db: Db = req.app.locals.db;

  const result = await approvePendingEdges(db, data.edgeIds);

  res.json({
    success: true,
    message: `${result.applied} edges approved, ${result.failed} failed`,
    applied: result.applied,
    failed: result.failed,
  });
});

/**
 * GET /graph/traverse/:id
 * 
 * Traverse graph from a starting memory
 */
export const traverseGraphRoute = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const startId = req.params.id;
  const edgeTypes = req.query.edgeTypes
    ? (req.query.edgeTypes as string).split(",")
    : undefined;
  const direction = (req.query.direction as "outbound" | "inbound" | "both") || "outbound";
  const maxDepth = Math.min(parseInt(req.query.maxDepth as string) || 2, 5);

  const db: Db = req.app.locals.db;

  const result = await traverseGraph(db, startId, {
    edgeTypes: edgeTypes as GraphEdgeType[] | undefined,
    direction,
    maxDepth,
  });

  res.json({
    success: true,
    centerNode: {
      id: result.centerNode._id!.toString(),
      text: result.centerNode.text,
      confidence: result.centerNode.confidence,
      layer: result.centerNode.layer,
      memoryType: result.centerNode.memoryType,
      tags: result.centerNode.tags,
      createdAt: result.centerNode.createdAt,
    },
    connectedMemories: result.connectedMemories.map((c) => ({
      id: c.memory._id!.toString(),
      text: c.memory.text,
      confidence: c.memory.confidence,
      relationship: c.relationship,
      depth: c.depth,
      path: c.path,
    })),
    count: result.connectedMemories.length,
  });
});

/**
 * GET /graph/node/:id
 * 
 * Get a single node with all its edges
 */
export const getNodeRoute = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const nodeId = req.params.id;
  const db: Db = req.app.locals.db;
  const { ObjectId } = await import("mongodb");

  const collection = db.collection("memories");
  const memory = await collection.findOne({ _id: new ObjectId(nodeId) as any });

  if (!memory) {
    res.status(404).json({ error: "Memory not found" });
    return;
  }

  res.json({
    success: true,
    node: {
      id: memory._id!.toString(),
      text: memory.text,
      confidence: memory.confidence,
      strength: memory.strength,
      layer: memory.layer,
      memoryType: memory.memoryType,
      tags: memory.tags,
      createdAt: memory.createdAt,
      edges: memory.edges || [],
      contradictions: memory.contradictions || [],
    },
  });
});

/**
 * POST /graph/edges
 *
 * Directly create a graph edge between two memories.
 * Useful for seeding demo data and manual graph construction.
 * Bidirectional types (CO_OCCURS, CONTRADICTS) automatically get reverse edges.
 */
const CreateEdgeSchema = z.object({
  sourceId: z.string().min(1),
  targetId: z.string().min(1),
  edgeType: z.enum([
    "PRECEDES", "CAUSES", "SUPPORTS", "CONTRADICTS",
    "DERIVES_FROM", "SUPERSEDES", "MENTIONS_ENTITY", "CO_OCCURS", "CONTEXT_OF",
  ]),
  weight: z.number().min(0).max(1).default(0.8),
  metadata: z.record(z.unknown()).optional(),
});

export const createEdgeRoute = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const data = CreateEdgeSchema.parse(req.body);
  const db: Db = req.app.locals.db;
  const collection = db.collection(COLLECTION_MEMORIES);

  // Verify both memories exist
  const source = await collection.findOne({ _id: new ObjectId(data.sourceId) as any }, { projection: { _id: 1 } });
  const target = await collection.findOne({ _id: new ObjectId(data.targetId) as any }, { projection: { _id: 1 } });

  if (!source) {
    res.status(404).json({ success: false, error: `Source memory ${data.sourceId} not found` });
    return;
  }
  if (!target) {
    res.status(404).json({ success: false, error: `Target memory ${data.targetId} not found` });
    return;
  }

  const edge: GraphEdge = {
    type: data.edgeType as GraphEdgeType,
    targetId: data.targetId,
    weight: data.weight,
    createdAt: new Date(),
    metadata: data.metadata,
  };

  // Add forward edge to source memory
  await collection.updateOne(
    { _id: new ObjectId(data.sourceId) as any },
    { $push: { edges: edge as any }, $set: { updatedAt: new Date() } },
  );

  let bidirectional = false;

  // Add reverse edge for bidirectional types
  if (data.edgeType === "CO_OCCURS" || data.edgeType === "CONTRADICTS") {
    const reverseEdge: GraphEdge = {
      type: data.edgeType as GraphEdgeType,
      targetId: data.sourceId,
      weight: data.weight,
      createdAt: new Date(),
      metadata: data.metadata,
    };

    await collection.updateOne(
      { _id: new ObjectId(data.targetId) as any },
      { $push: { edges: reverseEdge as any }, $set: { updatedAt: new Date() } },
    );
    bidirectional = true;
  }

  res.json({
    success: true,
    message: `Edge ${data.edgeType} created${bidirectional ? " (bidirectional)" : ""}`,
    edge: {
      sourceId: data.sourceId,
      targetId: data.targetId,
      edgeType: data.edgeType,
      weight: data.weight,
      bidirectional,
    },
  });
});
