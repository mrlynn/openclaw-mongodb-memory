import { Request, Response } from "express";
import { z } from "zod";
import { MongoClient, ObjectId } from "mongodb";
import { VoyageEmbedder } from "../embedding";

const RememberSchema = z.object({
  agentId: z.string(),
  projectId: z.string().optional(),
  text: z.string().min(1),
  tags: z.array(z.string()).optional().default([]),
  metadata: z.record(z.unknown()).optional().default({}),
  ttl: z.number().positive().optional(),
});

export const rememberRoute = async (req: Request, res: Response) => {
  try {
    const data = RememberSchema.parse(req.body);

    const mongoClient: MongoClient = req.app.locals.mongoClient;
    const voyageApiKey: string = req.app.locals.voyageApiKey;

    const embedder = new VoyageEmbedder(voyageApiKey);

    // Embed the text
    const embedding = await embedder.embedOne(data.text);

    // Get database and collection
    const db = mongoClient.db("openclaw_memory");
    const collection = db.collection("memories");

    // Prepare document
    const doc = {
      agentId: data.agentId,
      projectId: data.projectId || null,
      text: data.text,
      embedding,
      tags: data.tags,
      metadata: data.metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...(data.ttl && {
        expiresAt: new Date(Date.now() + data.ttl * 1000),
      }),
    };

    // Insert
    const result = await collection.insertOne(doc);

    res.json({
      success: true,
      id: result.insertedId.toString(),
      text: data.text,
      tags: data.tags,
      ttl: data.ttl,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.errors });
    } else {
      console.error("Remember error:", error);
      res.status(500).json({ error: String(error) });
    }
  }
};
