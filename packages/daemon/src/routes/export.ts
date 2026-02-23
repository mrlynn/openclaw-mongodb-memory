import { Request, Response } from "express";
import { z } from "zod";
import { Db } from "mongodb";
import { asyncHandler } from "../middleware/asyncHandler";
import { COLLECTION_MEMORIES } from "../constants";

const ExportSchema = z.object({
  agentId: z.string().min(1),
  projectId: z.string().optional(),
});

export const exportRoute = asyncHandler(async (req: Request, res: Response) => {
  const data = ExportSchema.parse(req.query);

  const db: Db = req.app.locals.db;
  const collection = db.collection(COLLECTION_MEMORIES);

  const filter: Record<string, unknown> = { agentId: data.agentId };
  if (data.projectId) filter.projectId = data.projectId;

  const memories = await collection
    .find(filter, { projection: { embedding: 0 } })
    .sort({ createdAt: -1 })
    .toArray();

  res.json({
    success: true,
    agentId: data.agentId,
    projectId: data.projectId || null,
    count: memories.length,
    exportedAt: new Date().toISOString(),
    memories: memories.map((doc) => ({
      id: doc._id.toString(),
      text: doc.text,
      tags: doc.tags,
      metadata: doc.metadata,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      expiresAt: doc.expiresAt || null,
    })),
  });
});
