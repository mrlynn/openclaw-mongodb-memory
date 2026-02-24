/**
 * Decay API Routes
 * 
 * Endpoints for triggering decay manually and viewing candidates.
 */

import { Request, Response } from "express";
import { Db } from "mongodb";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { runDecayPass, getArchivalCandidates, getExpirationCandidates, promoteToArchival } from "../services/decayService.js";

/**
 * POST /decay
 * 
 * Trigger a manual decay pass (for testing/debugging)
 */
export const triggerDecayRoute = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const agentId = req.query.agentId as string | undefined;
  const db: Db = req.app.locals.db;

  const stats = await runDecayPass(db, agentId);

  res.json({
    success: true,
    message: "Decay pass complete",
    stats,
  });
});

/**
 * GET /decay/archival-candidates
 * 
 * List memories that are candidates for archival promotion
 */
export const getArchivalCandidatesRoute = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const agentId = req.query.agentId as string;

  if (!agentId) {
    res.status(400).json({ error: "agentId query parameter required" });
    return;
  }

  const db: Db = req.app.locals.db;
  const candidates = await getArchivalCandidates(db, agentId);

  res.json({
    success: true,
    count: candidates.length,
    candidates: candidates.map((m) => ({
      id: m._id!.toString(),
      text: m.text,
      strength: m.strength,
      layer: m.layer,
      confidence: m.confidence,
      createdAt: m.createdAt,
      lastReinforcedAt: m.lastReinforcedAt,
    })),
  });
});

/**
 * GET /decay/expiration-candidates
 * 
 * List memories that are candidates for expiration
 */
export const getExpirationCandidatesRoute = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const agentId = req.query.agentId as string;

  if (!agentId) {
    res.status(400).json({ error: "agentId query parameter required" });
    return;
  }

  const db: Db = req.app.locals.db;
  const candidates = await getExpirationCandidates(db, agentId);

  res.json({
    success: true,
    count: candidates.length,
    candidates: candidates.map((m) => ({
      id: m._id!.toString(),
      text: m.text,
      strength: m.strength,
      layer: m.layer,
      confidence: m.confidence,
      createdAt: m.createdAt,
      lastReinforcedAt: m.lastReinforcedAt,
    })),
  });
});

/**
 * POST /decay/promote-archival/:id
 * 
 * Promote a memory to archival layer
 */
export const promoteToArchivalRoute = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const memoryId = req.params.id;
  const db: Db = req.app.locals.db;

  await promoteToArchival(db, memoryId);

  res.json({
    success: true,
    message: "Memory promoted to archival layer",
    memoryId,
  });
});
