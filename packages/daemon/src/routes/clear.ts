import { Request, Response } from "express";
import { z } from "zod";
import { Db } from "mongodb";
import { asyncHandler } from "../middleware/asyncHandler";
import { COLLECTION_MEMORIES } from "../constants";

const ClearSchema = z.object({
  agentId: z.string().min(1),
});

export const clearRoute = asyncHandler(async (req: Request, res: Response) => {
  const data = ClearSchema.parse(req.query);

  const db: Db = req.app.locals.db;
  const collection = db.collection(COLLECTION_MEMORIES);

  const result = await collection.deleteMany({ agentId: data.agentId });

  res.json({
    success: true,
    agentId: data.agentId,
    deleted: result.deletedCount,
  });
});
