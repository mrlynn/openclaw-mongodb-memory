import { Request, Response } from "express";
import { Db } from "mongodb";
import { VoyageEmbedder } from "../embedding";
import { asyncHandler } from "../middleware/asyncHandler";
import { COLLECTION_MEMORIES } from "../constants";

export const statusRoute = asyncHandler(async (req: Request, res: Response) => {
  const db: Db = req.app.locals.db;
  const embedder: VoyageEmbedder = req.app.locals.embedder;
  const collection = db.collection(COLLECTION_MEMORIES);

  let mongoStatus = "connected";
  let totalMemories = 0;
  try {
    totalMemories = await collection.countDocuments();
  } catch {
    mongoStatus = "error";
  }

  let voyageStatus = "unknown";
  try {
    await embedder.embedOne("health check");
    voyageStatus = "ready";
  } catch {
    voyageStatus = "error";
  }

  res.json({
    success: true,
    daemon: "ready",
    mongodb: mongoStatus,
    voyage: voyageStatus,
    uptime: process.uptime(),
    memory: {
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
    },
    stats: {
      totalMemories,
    },
  });
});
