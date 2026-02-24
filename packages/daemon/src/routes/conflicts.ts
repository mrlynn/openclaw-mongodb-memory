/**
 * Conflicts API Route
 * 
 * Provides endpoints for viewing and resolving memory contradictions.
 */

import { Request, Response } from "express";
import { z } from "zod";
import { Db, ObjectId } from "mongodb";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { COLLECTION_MEMORIES } from "../constants.js";
import { Memory, ContradictionResolution } from "../types/index.js";

/**
 * GET /conflicts
 * 
 * List all unresolved contradictions for an agent
 */
export const getConflictsRoute = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const agentId = req.query.agentId as string;

  if (!agentId) {
    res.status(400).json({ error: "agentId query parameter required" });
    return;
  }

  const db: Db = req.app.locals.db;
  const collection = db.collection<Memory>(COLLECTION_MEMORIES);

  // Find all memories with unresolved contradictions
  const memoriesWithConflicts = await collection
    .find({
      agentId,
      "contradictions.resolution": "unresolved",
    })
    .toArray();

  // Build conflict pairs (A ↔ B)
  const conflicts = [];

  for (const memory of memoriesWithConflicts) {
    if (!memory.contradictions || memory.contradictions.length === 0) continue;

    for (const contradiction of memory.contradictions) {
      if (contradiction.resolution !== "unresolved") continue;

      // Fetch the conflicting memory
      const targetMemory = await collection.findOne<Memory>({
        _id: new ObjectId(contradiction.memoryId) as any,
      });

      if (!targetMemory) continue;

      conflicts.push({
        id: `${memory._id}_${contradiction.memoryId}`,
        memoryA: {
          id: memory._id!.toString(),
          text: memory.text,
          confidence: memory.confidence,
          createdAt: memory.createdAt,
          tags: memory.tags,
        },
        memoryB: {
          id: targetMemory._id!.toString(),
          text: targetMemory.text,
          confidence: targetMemory.confidence,
          createdAt: targetMemory.createdAt,
          tags: targetMemory.tags,
        },
        detectedAt: contradiction.detectedAt,
        resolution: contradiction.resolution,
      });
    }
  }

  res.json({
    success: true,
    count: conflicts.length,
    conflicts,
  });
});

/**
 * PATCH /conflicts/:id/resolve
 * 
 * Resolve a contradiction
 */
const ResolveConflictSchema = z.object({
  resolution: z.enum(["superseded", "context-dependent", "temporal"]),
  resolutionNote: z.string().optional(),
  supersededMemoryId: z.string().optional(), // Which memory is superseded
});

export const resolveConflictRoute = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const conflictId = req.params.id;
  const data = ResolveConflictSchema.parse(req.body);

  // Parse conflict ID (format: memoryA_memoryB)
  const [memoryAId, memoryBId] = conflictId.split("_");

  if (!memoryAId || !memoryBId) {
    res.status(400).json({ error: "Invalid conflict ID format" });
    return;
  }

  const db: Db = req.app.locals.db;
  const collection = db.collection<Memory>(COLLECTION_MEMORIES);

  const now = new Date();

  // Update both memories with the resolution
  await collection.updateOne(
    {
      _id: new ObjectId(memoryAId) as any,
      "contradictions.targetId": memoryBId,
    },
    {
      $set: {
        "contradictions.$.resolution": data.resolution as any,
        "contradictions.$.resolvedAt": now,
        "contradictions.$.resolutionNote": data.resolutionNote,
        updatedAt: now,
      },
    }
  );

  await collection.updateOne(
    {
      _id: new ObjectId(memoryBId) as any,
      "contradictions.targetId": memoryAId,
    },
    {
      $set: {
        "contradictions.$.resolution": data.resolution as any,
        "contradictions.$.resolvedAt": now,
        "contradictions.$.resolutionNote": data.resolutionNote,
        updatedAt: now,
      },
    }
  );

  // If resolution is "superseded", reduce confidence of the superseded memory
  if (data.resolution === "superseded" && data.supersededMemoryId) {
    const supersededMemory = await collection.findOne<Memory>({
      _id: new ObjectId(data.supersededMemoryId) as any,
    });

    if (supersededMemory && supersededMemory.confidence) {
      const newConfidence = Math.max(0.02, supersededMemory.confidence * 0.6); // 40% reduction

      await collection.updateOne(
        { _id: new ObjectId(data.supersededMemoryId) as any },
        {
          $set: {
            confidence: newConfidence,
            updatedAt: now,
          },
        }
      );
    }
  }

  res.json({
    success: true,
    message: "Contradiction resolved",
    resolution: data.resolution,
  });
});
