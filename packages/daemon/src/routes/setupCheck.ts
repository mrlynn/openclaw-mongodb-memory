import { Request, Response } from "express";
import { Db } from "mongodb";
import { COLLECTION_MEMORIES } from "../constants";
import { getTier } from "../utils/tier";
import { DaemonConfig } from "../config";

export interface SetupCheckItem {
  id: string;
  label: string;
  status: "ok" | "warning" | "error";
  detail: string;
  fix?: string;
}

export const setupCheckRoute = async (req: Request, res: Response) => {
  const checks: SetupCheckItem[] = [];
  const config: DaemonConfig | undefined = req.app.locals.config;

  // 1. MongoDB connection
  try {
    const db: Db = req.app.locals.db;
    await db.admin().ping();
    checks.push({
      id: "mongodb",
      label: "MongoDB connected",
      status: "ok",
      detail: "Database is reachable and responding",
    });
  } catch {
    checks.push({
      id: "mongodb",
      label: "MongoDB connection",
      status: "error",
      detail: "Cannot reach MongoDB",
      fix: "Check MONGODB_URI in .env.local or run: pnpm setup",
    });
  }

  // 2. Embedding mode — use validated config, not raw env vars
  const isMock = config?.voyageMock ?? process.env.VOYAGE_MOCK === "true";
  if (isMock) {
    checks.push({
      id: "embeddings",
      label: "Mock embeddings active",
      status: "warning",
      detail: "Using deterministic mock embeddings (development mode)",
      fix: "Set VOYAGE_API_KEY and VOYAGE_MOCK=false in .env.local for production-quality search",
    });
  } else {
    checks.push({
      id: "embeddings",
      label: "Voyage AI embeddings configured",
      status: "ok",
      detail: "Real semantic embeddings active",
    });
  }

  // 3. Vector search index
  try {
    const db: Db = req.app.locals.db;
    const memories = db.collection(COLLECTION_MEMORIES);
    const searchIndexes = await memories.listSearchIndexes().toArray();
    const hasVector = searchIndexes.some((idx) => idx.name === "memory_vector_index");
    if (hasVector) {
      checks.push({
        id: "vector_index",
        label: "Atlas Vector Search index",
        status: "ok",
        detail: "memory_vector_index is active",
      });
    } else {
      checks.push({
        id: "vector_index",
        label: "Vector search index missing",
        status: "warning",
        detail: "Falling back to in-memory cosine similarity",
        fix: "Run: pnpm --filter @openclaw-memory/daemon db:setup",
      });
    }
  } catch {
    // Not Atlas — just note it
    checks.push({
      id: "vector_index",
      label: "Vector search not available",
      status: "warning",
      detail: "Atlas Vector Search requires MongoDB Atlas (not local MongoDB)",
      fix: "Optional: migrate to MongoDB Atlas for scalable vector search",
    });
  }

  // 4. Memory count
  try {
    const db: Db = req.app.locals.db;
    const count = await db.collection(COLLECTION_MEMORIES).countDocuments();
    if (count === 0) {
      checks.push({
        id: "data",
        label: "No memories stored",
        status: "warning",
        detail: "Database is empty",
        fix: "Run: pnpm --filter @openclaw-memory/daemon db:seed",
      });
    } else {
      checks.push({
        id: "data",
        label: `${count} memories stored`,
        status: "ok",
        detail: `Database contains ${count} memories`,
      });
    }
  } catch {
    // Skip if DB not available
  }

  const allOk = checks.every((c) => c.status === "ok");
  const hasVectorIndex = checks.some((c) => c.id === "vector_index" && c.status === "ok");
  const tierInfo = getTier(isMock, hasVectorIndex);

  res.json({
    success: true,
    complete: allOk,
    tier: tierInfo,
    checks,
  });
};
