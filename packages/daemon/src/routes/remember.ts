import { Request, Response } from "express";
import { z } from "zod";
import { Db } from "mongodb";
import { VoyageEmbedder } from "../embedding";
import { asyncHandler } from "../middleware/asyncHandler";
import { COLLECTION_MEMORIES } from "../constants";

const RememberSchema = z.object({
  agentId: z.string().min(1),
  projectId: z.string().optional(),
  text: z.string().min(1).max(50000),
  tags: z.array(z.string().max(100)).max(50).optional().default([]),
  metadata: z.record(z.unknown()).optional().default({}),
  ttl: z.number().positive().optional(),
});

export const rememberRoute = asyncHandler(async (req: Request, res: Response) => {
  const data = RememberSchema.parse(req.body);

  const db: Db = req.app.locals.db;
  const embedder: VoyageEmbedder = req.app.locals.embedder;
  const collection = db.collection(COLLECTION_MEMORIES);

  const embedding = await embedder.embedOne(data.text);

  const doc = {
    agentId: data.agentId,
    projectId: data.projectId || null,
    text: data.text,
    embedding,
    tags: data.tags,
    metadata: data.metadata,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...(data.ttl && {
      expiresAt: new Date(Date.now() + data.ttl * 1000),
    }),
  };

  const result = await collection.insertOne(doc);

  res.json({
    success: true,
    id: result.insertedId.toString(),
    text: data.text,
    tags: data.tags,
    ttl: data.ttl,
  });
});
