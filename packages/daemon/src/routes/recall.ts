import { Request, Response } from "express";
import { z } from "zod";
import { MongoClient } from "mongodb";
import { VoyageEmbedder } from "../embedding";

const RecallSchema = z.object({
  agentId: z.string(),
  projectId: z.string().optional(),
  query: z.string().min(1),
  limit: z.coerce.number().int().positive().default(10),
  tags: z.string().optional(), // comma-separated
});

export const recallRoute = async (req: Request, res: Response) => {
  try {
    const data = RecallSchema.parse(req.query);

    const mongoClient: MongoClient = req.app.locals.mongoClient;
    const voyageApiKey: string = req.app.locals.voyageApiKey;

    const embedder = new VoyageEmbedder(voyageApiKey);

    // Embed the query
    const queryEmbedding = await embedder.embedOne(data.query);

    // Get database and collection
    const db = mongoClient.db("openclaw_memory");
    const collection = db.collection("memories");

    // Build filter
    const filter: Record<string, unknown> = {
      agentId: data.agentId,
    };

    if (data.projectId) {
      filter.projectId = data.projectId;
    }

    if (data.tags) {
      const tagArray = data.tags.split(",").map((t) => t.trim());
      filter.tags = { $in: tagArray };
    }

    // Fetch all matching memories (we'll do in-memory similarity scoring)
    const memories = await collection.find(filter).toArray();

    // Score by cosine similarity
    const scored = memories
      .map((doc) => ({
        id: doc._id.toString(),
        text: doc.text,
        tags: doc.tags,
        metadata: doc.metadata,
        createdAt: doc.createdAt,
        score: VoyageEmbedder.cosineSimilarity(
          queryEmbedding,
          doc.embedding as number[]
        ),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, data.limit);

    res.json({
      success: true,
      query: data.query,
      results: scored,
      count: scored.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.errors });
    } else {
      console.error("Recall error:", error);
      res.status(500).json({ error: String(error) });
    }
  }
};
