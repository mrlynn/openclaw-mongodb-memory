import { Request, Response } from "express";
import { z } from "zod";
import { Collection, Db } from "mongodb";
import { VoyageEmbedder } from "../embedding";
import { asyncHandler } from "../middleware/asyncHandler";
import { COLLECTION_MEMORIES, MAX_RECALL_LIMIT } from "../constants";

const RecallSchema = z.object({
  agentId: z.string().min(1),
  projectId: z.string().optional(),
  query: z.string().min(1),
  limit: z.coerce.number().int().positive().max(MAX_RECALL_LIMIT).default(10),
  tags: z.string().optional(), // comma-separated
});

/**
 * Recall uses MongoDB Atlas Vector Search ($vectorSearch aggregation)
 * when the index exists, otherwise falls back to in-memory cosine similarity
 * with a hard cap to prevent OOM.
 */
export const recallRoute = asyncHandler(async (req: Request, res: Response) => {
  const data = RecallSchema.parse(req.query);

  const db: Db = req.app.locals.db;
  const embedder: VoyageEmbedder = req.app.locals.embedder;
  const collection = db.collection(COLLECTION_MEMORIES);

  const queryEmbedding = await embedder.embedOne(data.query);

  // Build pre-filter
  const filter: Record<string, unknown> = { agentId: data.agentId };
  if (data.projectId) filter.projectId = data.projectId;
  if (data.tags) {
    const tagArray = data.tags.split(",").map((t) => t.trim());
    filter.tags = { $in: tagArray };
  }

  // Try Atlas Vector Search first
  try {
    const results = await vectorSearchRecall(collection, queryEmbedding, filter, data.limit);
    res.json({
      success: true,
      query: data.query,
      results,
      count: results.length,
      method: "vector_search",
    });
    return;
  } catch {
    // Vector search index doesn't exist — fall back to in-memory
    console.log("[Recall] Atlas Vector Search unavailable, using in-memory fallback");
  }

  // Fallback: in-memory cosine similarity with streaming cursor + hard cap
  const IN_MEMORY_CAP = 10000;
  const cursor = collection.find(filter, {
    projection: { embedding: 1, text: 1, tags: 1, metadata: 1, createdAt: 1 },
    sort: { createdAt: -1 },
    limit: IN_MEMORY_CAP,
  });

  const scored: Array<{
    id: string;
    text: string;
    score: number;
    tags: string[];
    metadata: Record<string, unknown>;
    createdAt: Date;
  }> = [];

  for await (const doc of cursor) {
    const score = VoyageEmbedder.cosineSimilarity(
      queryEmbedding,
      doc.embedding as number[]
    );
    scored.push({
      id: doc._id.toString(),
      text: doc.text,
      tags: doc.tags,
      metadata: doc.metadata,
      createdAt: doc.createdAt,
      score,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  const results = scored.slice(0, data.limit);

  res.json({
    success: true,
    query: data.query,
    results,
    count: results.length,
    method: "in_memory",
  });
});

/**
 * Atlas Vector Search via $vectorSearch aggregation.
 * Requires index "memory_vector_index" on the embedding field.
 */
async function vectorSearchRecall(
  collection: Collection,
  queryEmbedding: number[],
  filter: Record<string, unknown>,
  limit: number,
) {
  const pipeline = [
    {
      $vectorSearch: {
        index: "memory_vector_index",
        path: "embedding",
        queryVector: queryEmbedding,
        numCandidates: Math.max(limit * 10, 100),
        limit,
        filter,
      },
    },
    {
      $project: {
        _id: 1,
        text: 1,
        tags: 1,
        metadata: 1,
        createdAt: 1,
        score: { $meta: "vectorSearchScore" },
      },
    },
  ];

  const docs = await collection.aggregate(pipeline).toArray();

  return docs.map((doc) => ({
    id: doc._id.toString(),
    text: doc.text,
    tags: doc.tags,
    metadata: doc.metadata,
    createdAt: doc.createdAt,
    score: doc.score as number,
  }));
}
