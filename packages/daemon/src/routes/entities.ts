/**
 * Entities API Routes
 * 
 * Endpoints for managing entity hub documents (people, projects, systems, concepts).
 */

import { Request, Response } from "express";
import { Db } from "mongodb";
import { asyncHandler } from "../middleware/asyncHandler.js";

const COLLECTION_ENTITIES = "entities";
const COLLECTION_MEMORIES = "memories";

/**
 * GET /entities
 * 
 * List all entities for an agent
 */
export const listEntitiesRoute = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const agentId = req.query.agentId as string;
  const type = req.query.type as string | undefined;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const sortBy = (req.query.sortBy as string) || "memoryCount"; // memoryCount | lastSeenAt | displayName

  if (!agentId) {
    res.status(400).json({ error: "agentId query parameter required" });
    return;
  }

  const db: Db = req.app.locals.db;
  const collection = db.collection(COLLECTION_ENTITIES);

  const filter: any = { agentId };
  if (type) {
    filter.type = type;
  }

  const sortField = sortBy === "displayName" ? "displayName" : sortBy;
  const sortDirection = sortBy === "displayName" ? 1 : -1;

  const entities = await collection
    .find(filter)
    .sort({ [sortField]: sortDirection })
    .limit(limit)
    .toArray();

  const total = await collection.countDocuments(filter);

  res.json({
    success: true,
    count: entities.length,
    total,
    entities: entities.map((e) => ({
      id: e._id!.toString(),
      slug: e.slug,
      type: e.type,
      displayName: e.displayName,
      aliases: e.aliases,
      summary: e.summary,
      memoryCount: e.memoryCount,
      lastSeenAt: e.lastSeenAt,
      createdAt: e.createdAt,
    })),
  });
});

/**
 * GET /entities/:slug
 * 
 * Get a single entity with linked memories
 */
export const getEntityRoute = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const slug = req.params.slug;
  const agentId = req.query.agentId as string;

  if (!agentId) {
    res.status(400).json({ error: "agentId query parameter required" });
    return;
  }

  const db: Db = req.app.locals.db;
  const entitiesCollection = db.collection(COLLECTION_ENTITIES);
  const memoriesCollection = db.collection(COLLECTION_MEMORIES);

  const entity = await entitiesCollection.findOne({ agentId, slug });

  if (!entity) {
    res.status(404).json({ error: "Entity not found" });
    return;
  }

  // Find memories that mention this entity
  const linkedMemories = await memoriesCollection
    .find({
      agentId,
      "edges.targetId": slug, // MENTIONS_ENTITY edges use slug as targetId
    })
    .sort({ createdAt: -1 })
    .limit(20)
    .toArray();

  res.json({
    success: true,
    entity: {
      id: entity._id!.toString(),
      slug: entity.slug,
      type: entity.type,
      displayName: entity.displayName,
      aliases: entity.aliases,
      summary: entity.summary,
      attributes: entity.attributes,
      memoryCount: entity.memoryCount,
      lastSeenAt: entity.lastSeenAt,
      createdAt: entity.createdAt,
      linkedMemories: linkedMemories.map((m) => ({
        id: m._id!.toString(),
        text: m.text,
        confidence: m.confidence,
        memoryType: m.memoryType,
        createdAt: m.createdAt,
        tags: m.tags,
      })),
    },
  });
});

/**
 * GET /entities/search
 * 
 * Search entities by name
 */
export const searchEntitiesRoute = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const agentId = req.query.agentId as string;
  const query = req.query.q as string;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

  if (!agentId) {
    res.status(400).json({ error: "agentId query parameter required" });
    return;
  }

  if (!query || query.trim().length === 0) {
    res.status(400).json({ error: "q query parameter required" });
    return;
  }

  const db: Db = req.app.locals.db;
  const collection = db.collection(COLLECTION_ENTITIES);

  // Simple text search on displayName and aliases
  const results = await collection
    .find({
      agentId,
      $or: [
        { displayName: { $regex: query, $options: "i" } },
        { aliases: { $elemMatch: { $regex: query, $options: "i" } } },
      ],
    })
    .sort({ memoryCount: -1 })
    .limit(limit)
    .toArray();

  res.json({
    success: true,
    count: results.length,
    entities: results.map((e) => ({
      id: e._id!.toString(),
      slug: e.slug,
      type: e.type,
      displayName: e.displayName,
      memoryCount: e.memoryCount,
    })),
  });
});
