import { Request, Response } from "express";
import { z } from "zod";
import { Db } from "mongodb";
import { VoyageEmbedder } from "../embedding.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { COLLECTION_MEMORIES } from "../constants.js";
import { MemoryType, MemoryLayer } from "../types/index.js";
import { getInitialConfidence, DEFAULT_STRENGTH } from "../types/confidence.js";
import { detectContradictions, markMemoryAsContradicting } from "../services/contradictionDetector.js";
import type { UsageTracker } from "../services/usageTracker.js";

const RememberSchema = z.object({
  agentId: z.string().min(1),
  projectId: z.string().optional(),
  text: z.string().min(1).max(50000),
  tags: z.array(z.string().max(100)).max(50).optional().default([]),
  metadata: z.record(z.unknown()).optional().default({}),
  ttl: z.number().positive().optional(),
  
  // Phase 1: Optional explicit fields
  memoryType: z.enum(["fact", "preference", "decision", "observation", "episode", "opinion"]).optional(),
  layer: z.enum(["working", "episodic", "semantic", "archival"]).optional(),
  confidence: z.number().min(0).max(1).optional(),
  sourceSessionId: z.string().optional(),
  sourceEpisodeId: z.string().optional(),
});

export const rememberRoute = asyncHandler(async (req: Request, res: Response) => {
  const data = RememberSchema.parse(req.body);

  const db: Db = req.app.locals.db;
  const embedder: VoyageEmbedder = req.app.locals.embedder;
  const usageTracker: UsageTracker | undefined = req.app.locals.usageTracker;
  const collection = db.collection(COLLECTION_MEMORIES);

  // Track token usage for the embedding call
  usageTracker?.pushContext({ operation: "remember", agentId: data.agentId });
  let embedding: number[];
  try {
    embedding = await embedder.embedOne(data.text, "document");
  } finally {
    usageTracker?.popContext();
  }

  const now = new Date();

  // Phase 1: Determine confidence based on memoryType or explicit override
  const memoryType = data.memoryType as MemoryType | undefined;
  const confidence = data.confidence ?? getInitialConfidence(memoryType);
  const layer = data.layer as MemoryLayer | undefined ?? "episodic";

  // Phase 1: Detect contradictions with existing memories
  usageTracker?.pushContext({ operation: "contradiction-check", agentId: data.agentId });
  const contradictions = await detectContradictions(
    {
      agentId: data.agentId,
      text: data.text,
      tags: data.tags,
    },
    embedding,
    db,
    embedder
  );
  usageTracker?.popContext();

  const doc = {
    agentId: data.agentId,
    projectId: data.projectId || null,
    text: data.text,
    embedding,
    tags: data.tags,
    metadata: data.metadata,
    createdAt: now,
    updatedAt: now,
    ...(data.ttl && {
      expiresAt: new Date(Date.now() + data.ttl * 1000),
    }),
    
    // Phase 1: Reliability metadata
    confidence,
    strength: DEFAULT_STRENGTH,  // Start at max strength
    reinforcementCount: 0,
    lastReinforcedAt: now,
    
    // Phase 1: Memory classification
    layer,
    memoryType: memoryType || "fact",
    ...(data.sourceSessionId && { sourceSessionId: data.sourceSessionId }),
    ...(data.sourceEpisodeId && { sourceEpisodeId: data.sourceEpisodeId }),
    
    // Phase 1: Contradictions detected during storage
    contradictions,
    
    // Phase 3: Graph edges (empty for now)
    edges: [],
  };

  const result = await collection.insertOne(doc);
  const newMemoryId = result.insertedId.toString();

  // Phase 1: Mark existing memories as contradicting this new memory (bidirectional)
  for (const contradiction of contradictions) {
    await markMemoryAsContradicting(contradiction.memoryId.toString(), newMemoryId, db);
  }

  res.json({
    success: true,
    id: newMemoryId,
    text: data.text,
    tags: data.tags,
    ttl: data.ttl,
    confidence,
    strength: DEFAULT_STRENGTH,
    layer,
    memoryType: memoryType || "fact",
    contradictions: contradictions.length > 0 ? contradictions : undefined,
  });
});
