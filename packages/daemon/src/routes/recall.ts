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
    console.log("[Recall] Parsing query params...");
    const data = RecallSchema.parse(req.query);
    console.log(`[Recall] Query: "${data.query}", Agent: ${data.agentId}, Limit: ${data.limit}`);

    const mongoClient: MongoClient = req.app.locals.mongoClient;
    const voyageApiKey: string = req.app.locals.voyageApiKey;
    const voyageBaseUrl: string | undefined = req.app.locals.voyageBaseUrl;
    const voyageModel: string | undefined = req.app.locals.voyageModel;

    const embedder = new VoyageEmbedder(voyageApiKey, voyageBaseUrl, voyageModel);

    // Embed the query
    console.log("[Recall] Embedding query...");
    const queryEmbedding = await embedder.embedOne(data.query);
    console.log(`[Recall] Query embedding created (${queryEmbedding.length} dims)`);

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
    console.log(`[Recall] Querying MongoDB with filter: ${JSON.stringify(filter)}`);
    const memories = await collection.find(filter).toArray();
    console.log(`[Recall] Found ${memories.length} matching memories`);

    // Score by cosine similarity
    console.log("[Recall] Computing similarity scores...");
    const scored = memories
      .map((doc) => {
        const score = VoyageEmbedder.cosineSimilarity(
          queryEmbedding,
          doc.embedding as number[]
        );
        return {
          id: doc._id.toString(),
          text: doc.text,
          tags: doc.tags,
          metadata: doc.metadata,
          createdAt: doc.createdAt,
          score,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, data.limit);

    console.log(`[Recall] Returning ${scored.length} results`);
    res.json({
      success: true,
      query: data.query,
      results: scored,
      count: scored.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("[Recall] Validation error:", error);
      res.status(400).json({ error: "Validation failed", details: error.errors });
    } else {
      console.error("[Recall] Error:", error);
      res.status(500).json({ error: String(error) });
    }
  }
};
