import { Request, Response } from "express";
import { z } from "zod";
import { Db, ObjectId } from "mongodb";
import { asyncHandler } from "../middleware/asyncHandler";
import { COLLECTION_MEMORIES } from "../constants";

const MemoriesSchema = z.object({
  agentId: z.string().min(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  cursor: z.string().optional(),
  cursorId: z.string().optional(),
  sort: z.enum(["desc", "asc"]).default("desc"),
  tags: z.string().optional(),
});

export const memoriesRoute = asyncHandler(async (req: Request, res: Response) => {
  const data = MemoriesSchema.parse(req.query);

  const db: Db = req.app.locals.db;
  const collection = db.collection(COLLECTION_MEMORIES);

  const filter: Record<string, unknown> = { agentId: data.agentId };

  if (data.tags) {
    filter.tags = { $in: data.tags.split(",").map((t) => t.trim()) };
  }

  // Cursor-based pagination using createdAt + _id as composite cursor
  if (data.cursor && data.cursorId) {
    const cursorDate = new Date(data.cursor);
    const cursorOid = new ObjectId(data.cursorId);
    if (data.sort === "desc") {
      filter.$or = [
        { createdAt: { $lt: cursorDate } },
        { createdAt: cursorDate, _id: { $lt: cursorOid } },
      ];
    } else {
      filter.$or = [
        { createdAt: { $gt: cursorDate } },
        { createdAt: cursorDate, _id: { $gt: cursorOid } },
      ];
    }
  }

  const sortDir = data.sort === "desc" ? -1 : 1;
  const memories = await collection
    .find(filter, { projection: { embedding: 0 } })
    .sort({ createdAt: sortDir, _id: sortDir })
    .limit(data.limit + 1)
    .toArray();

  const hasMore = memories.length > data.limit;
  if (hasMore) memories.pop();

  const lastItem = memories[memories.length - 1];
  const nextCursor =
    hasMore && lastItem
      ? {
          cursor: (lastItem.createdAt as Date).toISOString(),
          cursorId: lastItem._id.toString(),
        }
      : null;

  res.json({
    success: true,
    agentId: data.agentId,
    count: memories.length,
    hasMore,
    nextCursor,
    memories: memories.map((doc) => ({
      id: doc._id.toString(),
      text: doc.text,
      tags: doc.tags || [],
      metadata: doc.metadata || {},
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      expiresAt: doc.expiresAt || null,
    })),
  });
});
