import { Request, Response } from "express";
import { Db } from "mongodb";
import { VoyageEmbedder } from "../embedding";
import { asyncHandler } from "../middleware/asyncHandler";
import { COLLECTION_MEMORIES } from "../constants";
import { getTier } from "../utils/tier";
import { DaemonConfig } from "../config";

export const statusRoute = asyncHandler(async (req: Request, res: Response) => {
  const db: Db = req.app.locals.db;
  const embedder: VoyageEmbedder = req.app.locals.embedder;
  const config: DaemonConfig | undefined = req.app.locals.config;
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

  // Determine tier — use validated config, not raw env vars
  const isMock = config?.voyageMock ?? process.env.VOYAGE_MOCK === "true";
  let hasVectorIndex = false;
  try {
    const searchIndexes = await collection.listSearchIndexes().toArray();
    hasVectorIndex = searchIndexes.some((idx) => idx.name === "memory_vector_index");
  } catch {
    // Not Atlas — that's fine
  }
  const tierInfo = getTier(isMock, hasVectorIndex);

  res.json({
    success: true,
    daemon: "ready",
    mongodb: mongoStatus,
    voyage: voyageStatus,
    tier: tierInfo,
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
