import { Request, Response } from "express";
import { z } from "zod";
import { Db } from "mongodb";
import { asyncHandler } from "../middleware/asyncHandler";
import { COLLECTION_MEMORIES } from "../constants";

const PurgeSchema = z.object({
  agentId: z.string().min(1),
  olderThan: z.string().datetime(),
});

export const purgeRoute = asyncHandler(async (req: Request, res: Response) => {
  const data = PurgeSchema.parse(req.body);

  const db: Db = req.app.locals.db;
  const collection = db.collection(COLLECTION_MEMORIES);

  const result = await collection.deleteMany({
    agentId: data.agentId,
    createdAt: { $lt: new Date(data.olderThan) },
  });

  res.json({
    success: true,
    agentId: data.agentId,
    olderThan: data.olderThan,
    deleted: result.deletedCount,
  });
});
