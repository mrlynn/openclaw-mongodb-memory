/**
 * Episodes API Routes
 * 
 * Endpoints for managing episodic memory (session narratives).
 */

import { Request, Response } from "express";
import { z } from "zod";
import { Db, ObjectId } from "mongodb";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { VoyageEmbedder } from "../embedding.js";
import { Episode } from "../types/index.js";

const COLLECTION_EPISODES = "episodes";

/**
 * POST /episodes
 * 
 * Create a new episode (session narrative)
 */
const CreateEpisodeSchema = z.object({
  agentId: z.string().min(1),
  sessionId: z.string().min(1),
  title: z.string().min(1).max(200),
  narrative: z.string().min(10).max(10000),
  participants: z.array(z.string()).optional().default([]),
  dominantTopics: z.array(z.string()).optional().default([]),
  factIds: z.array(z.string()).optional().default([]),
});

export const createEpisodeRoute = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const data = CreateEpisodeSchema.parse(req.body);

  const db: Db = req.app.locals.db;
  const embedder: VoyageEmbedder = req.app.locals.embedder;
  const collection = db.collection<Episode>(COLLECTION_EPISODES);

  // Embed the narrative
  const embedding = await embedder.embedOne(data.narrative, "document");

  const now = new Date();

  const episode: Omit<Episode, "_id"> = {
    agentId: data.agentId,
    sessionId: data.sessionId,
    startedAt: now, // Could be passed in if available
    endedAt: now,
    title: data.title,
    narrative: data.narrative,
    participants: data.participants,
    dominantTopics: data.dominantTopics,
    factIds: data.factIds,
    embedding,
    strength: 1.0, // Start at max strength
    layer: "episodic",
  };

  const result = await collection.insertOne(episode as any);

  res.json({
    success: true,
    id: result.insertedId.toString(),
    title: data.title,
  });
});

/**
 * GET /episodes
 * 
 * List episodes for an agent
 */
export const listEpisodesRoute = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const agentId = req.query.agentId as string;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const skip = parseInt(req.query.skip as string) || 0;

  if (!agentId) {
    res.status(400).json({ error: "agentId query parameter required" });
    return;
  }

  const db: Db = req.app.locals.db;
  const collection = db.collection<Episode>(COLLECTION_EPISODES);

  const episodes = await collection
    .find({ agentId })
    .sort({ endedAt: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();

  const total = await collection.countDocuments({ agentId });

  res.json({
    success: true,
    count: episodes.length,
    total,
    episodes: episodes.map((e) => ({
      id: e._id!.toString(),
      sessionId: e.sessionId,
      title: e.title,
      narrative: e.narrative,
      participants: e.participants,
      dominantTopics: e.dominantTopics,
      factIds: e.factIds,
      strength: e.strength,
      startedAt: e.startedAt,
      endedAt: e.endedAt,
    })),
  });
});

/**
 * GET /episodes/:id
 * 
 * Get a single episode with linked memories
 */
export const getEpisodeRoute = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const episodeId = req.params.id;
  const db: Db = req.app.locals.db;
  const episodesCollection = db.collection<Episode>(COLLECTION_EPISODES);

  const episode = await episodesCollection.findOne<Episode>({
    _id: new ObjectId(episodeId) as any,
  });

  if (!episode) {
    res.status(404).json({ error: "Episode not found" });
    return;
  }

  // Fetch linked memories (atoms)
  const memoriesCollection = db.collection(COLLECTION_MEMORIES);
  const linkedMemories = await memoriesCollection
    .find({
      _id: { $in: episode.factIds.map((id) => new ObjectId(id)) } as any,
    })
    .toArray();

  res.json({
    success: true,
    episode: {
      id: episode._id!.toString(),
      sessionId: episode.sessionId,
      title: episode.title,
      narrative: episode.narrative,
      participants: episode.participants,
      dominantTopics: episode.dominantTopics,
      strength: episode.strength,
      startedAt: episode.startedAt,
      endedAt: episode.endedAt,
      linkedMemories: linkedMemories.map((m) => ({
        id: m._id!.toString(),
        text: m.text,
        confidence: m.confidence,
        memoryType: m.memoryType,
        tags: m.tags,
      })),
    },
  });
});

/**
 * GET /episodes/by-session/:sessionId
 * 
 * Get episode by session ID
 */
export const getEpisodeBySessionRoute = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const sessionId = req.params.sessionId;
  const agentId = req.query.agentId as string;

  if (!agentId) {
    res.status(400).json({ error: "agentId query parameter required" });
    return;
  }

  const db: Db = req.app.locals.db;
  const collection = db.collection<Episode>(COLLECTION_EPISODES);

  const episode = await collection.findOne({
    agentId,
    sessionId,
  });

  if (!episode) {
    res.status(404).json({ error: "Episode not found for session" });
    return;
  }

  res.json({
    success: true,
    episode: {
      id: episode._id!.toString(),
      sessionId: episode.sessionId,
      title: episode.title,
      narrative: episode.narrative,
      participants: episode.participants,
      dominantTopics: episode.dominantTopics,
      factIds: episode.factIds,
      strength: episode.strength,
      startedAt: episode.startedAt,
      endedAt: episode.endedAt,
    },
  });
});

const COLLECTION_MEMORIES = "memories";
