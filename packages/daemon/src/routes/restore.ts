import { Request, Response } from "express";
import { z } from "zod";
import { Db } from "mongodb";
import { VoyageEmbedder } from "../embedding";
import { asyncHandler } from "../middleware/asyncHandler";
import { COLLECTION_MEMORIES } from "../constants";
import type { UsageTracker } from "../services/usageTracker";

const RestoreMemorySchema = z.object({
  text: z.string().min(1).max(50000),
  tags: z.array(z.string().max(100)).max(50).optional().default([]),
  metadata: z.record(z.unknown()).optional().default({}),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  expiresAt: z.string().nullable().optional(),
});

const RestoreSchema = z.object({
  agentId: z.string().min(1),
  projectId: z.string().optional(),
  memories: z.array(RestoreMemorySchema).min(1).max(10000),
});

const BATCH_SIZE = 10;

export const restoreRoute = asyncHandler(async (req: Request, res: Response) => {
  const data = RestoreSchema.parse(req.body);

  const db: Db = req.app.locals.db;
  const embedder: VoyageEmbedder = req.app.locals.embedder;
  const usageTracker: UsageTracker | undefined = req.app.locals.usageTracker;
  const collection = db.collection(COLLECTION_MEMORIES);

  let totalInserted = 0;
  const errors: { index: number; snippet: string; error: string }[] = [];

  for (let i = 0; i < data.memories.length; i += BATCH_SIZE) {
    const batch = data.memories.slice(i, i + BATCH_SIZE);
    const texts = batch.map((m) => m.text);

    try {
      usageTracker?.pushContext({ operation: "reembed", agentId: data.agentId });
      let embeddings: number[][];
      try {
        embeddings = await embedder.embed(texts, "document");
      } finally {
        usageTracker?.popContext();
      }

      const docs = batch.map((memory, j) => ({
        agentId: data.agentId,
        projectId: data.projectId || null,
        text: memory.text,
        embedding: embeddings[j],
        tags: memory.tags,
        metadata: memory.metadata,
        createdAt: memory.createdAt ? new Date(memory.createdAt) : new Date(),
        updatedAt: memory.updatedAt ? new Date(memory.updatedAt) : new Date(),
        ...(memory.expiresAt ? { expiresAt: new Date(memory.expiresAt) } : {}),
      }));

      const result = await collection.insertMany(docs);
      totalInserted += result.insertedCount;
    } catch (err) {
      // Record per-batch errors but continue with remaining batches
      batch.forEach((m, j) => {
        errors.push({
          index: i + j,
          snippet: m.text.slice(0, 80),
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }
  }

  res.json({
    success: errors.length === 0,
    totalReceived: data.memories.length,
    totalInserted,
    errors,
  });
});
