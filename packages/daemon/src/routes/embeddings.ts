import { Request, Response } from "express";
import { z } from "zod";
import { Db } from "mongodb";
import { asyncHandler } from "../middleware/asyncHandler";
import { COLLECTION_MEMORIES } from "../constants";
import { projectTo2D } from "../pca";

const EmbeddingsSchema = z.object({
  agentId: z.string().min(1),
  limit: z.coerce.number().int().positive().max(500).default(200),
});

/**
 * GET /embeddings?agentId=X&limit=200
 *
 * Returns memories projected to 2D via PCA for scatter-plot visualization.
 * The raw 1024-dim embeddings are never sent to the client — only the
 * 2D projected [x, y] coordinates are returned, keeping the payload small.
 */
export const embeddingsRoute = asyncHandler(
  async (req: Request, res: Response) => {
    const data = EmbeddingsSchema.parse(req.query);

    const db: Db = req.app.locals.db;
    const collection = db.collection(COLLECTION_MEMORIES);

    // Fetch memories WITH embeddings (needed for PCA), plus metadata for tooltips
    const docs = await collection
      .find(
        { agentId: data.agentId },
        {
          projection: {
            _id: 1,
            text: 1,
            tags: 1,
            embedding: 1,
            createdAt: 1,
          },
          sort: { createdAt: -1 },
          limit: data.limit,
        },
      )
      .toArray();

    if (docs.length === 0) {
      res.json({
        success: true,
        agentId: data.agentId,
        count: 0,
        points: [],
      });
      return;
    }

    // Extract embedding vectors (skip any docs missing embeddings)
    const validDocs = docs.filter(
      (d) => Array.isArray(d.embedding) && d.embedding.length > 0,
    );

    if (validDocs.length === 0) {
      res.json({
        success: true,
        agentId: data.agentId,
        count: 0,
        points: [],
      });
      return;
    }

    const vectors = validDocs.map((d) => d.embedding as number[]);
    const { points: projected } = projectTo2D(vectors);

    // Build response with 2D points and truncated text previews
    const points = validDocs.map((doc, i) => ({
      id: doc._id.toString(),
      x: Math.round(projected[i][0] * 10000) / 10000,
      y: Math.round(projected[i][1] * 10000) / 10000,
      text:
        typeof doc.text === "string"
          ? doc.text.length > 200
            ? doc.text.slice(0, 200) + "..."
            : doc.text
          : "",
      tags: Array.isArray(doc.tags) ? doc.tags : [],
      createdAt: doc.createdAt
        ? new Date(doc.createdAt).toISOString()
        : new Date().toISOString(),
    }));

    res.json({
      success: true,
      agentId: data.agentId,
      count: points.length,
      points,
    });
  },
);
