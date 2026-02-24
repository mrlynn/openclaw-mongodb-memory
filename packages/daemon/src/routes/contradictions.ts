/**
 * Contradiction Management API Routes
 * 
 * Enhanced contradiction explanations using LLM analysis
 */

import { Request, Response } from "express";
import { z } from "zod";
import { Db } from "mongodb";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { enhanceContradictionExplanations } from "../services/contradictionExplainer.js";

/**
 * POST /contradictions/enhance
 * 
 * Enhance existing contradiction explanations with LLM analysis
 */
const EnhanceSchema = z.object({
  agentId: z.string().min(1),
  limit: z.number().int().positive().optional().default(10),
});

export const enhanceContradictionsRoute = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const data = EnhanceSchema.parse(req.body);
  const db: Db = req.app.locals.db;

  const enhanced = await enhanceContradictionExplanations(db, data.agentId, data.limit);

  res.json({
    success: true,
    message: `Enhanced ${enhanced} contradiction${enhanced === 1 ? "" : "s"} with LLM explanations`,
    enhanced,
  });
});

/**
 * GET /contradictions/:memoryId
 * 
 * Get detailed contradiction analysis for a specific memory
 */
export const getContradictionDetailsRoute = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { memoryId } = req.params;
  const db: Db = req.app.locals.db;

  const memory = await db.collection("memories").findOne({ _id: memoryId as any });

  if (!memory) {
    res.status(404).json({ error: "Memory not found" });
    return;
  }

  if (!memory.contradictions || memory.contradictions.length === 0) {
    res.json({
      success: true,
      memory: {
        id: memory._id.toString(),
        text: memory.text,
        contradictions: [],
      },
    });
    return;
  }

  // Fetch details of all contradicting memories
  const contradictionDetails = [];

  for (const contradiction of memory.contradictions) {
    const otherMemory = await db.collection("memories").findOne({ _id: contradiction.memoryId as any });

    if (otherMemory) {
      contradictionDetails.push({
        id: contradiction.memoryId.toString(),
        text: otherMemory.text,
        type: otherMemory.memoryType,
        createdAt: otherMemory.createdAt,
        tags: otherMemory.tags,
        contradiction: {
          type: contradiction.type,
          explanation: contradiction.explanation,
          severity: contradiction.severity,
          resolutionSuggestion: contradiction.resolutionSuggestion,
          probability: contradiction.probability,
          detectedAt: contradiction.detectedAt,
          resolution: contradiction.resolution,
          resolvedAt: contradiction.resolvedAt,
          resolutionNote: contradiction.resolutionNote,
        },
      });
    }
  }

  res.json({
    success: true,
    memory: {
      id: memory._id.toString(),
      text: memory.text,
      type: memory.memoryType,
      createdAt: memory.createdAt,
      tags: memory.tags,
      contradictions: contradictionDetails,
    },
  });
});
