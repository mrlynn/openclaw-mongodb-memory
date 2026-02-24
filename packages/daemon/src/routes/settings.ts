/**
 * Settings API Routes
 *
 * CRUD for per-agent semantic/LLM configuration.
 */

import { Request, Response } from "express";
import { z } from "zod";
import { Db } from "mongodb";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { DaemonConfig } from "../config.js";
import {
  getResolvedSettings,
  getSettingsDoc,
  upsertSettings,
  deleteSettings,
} from "../services/settingsService.js";
import { AgentSettingsInputSchema, GLOBAL_SETTINGS_ID } from "../types/settings.js";

/**
 * GET /settings/:agentId
 *
 * Returns fully resolved settings (agent merged over global merged over defaults).
 */
export const getSettingsRoute = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { agentId } = req.params;
  const db: Db = req.app.locals.db;
  const config: DaemonConfig = req.app.locals.config;

  const doc = await getSettingsDoc(db, agentId);
  const resolved = await getResolvedSettings(db, agentId, config);

  res.json({
    success: true,
    settings: doc,
    resolved,
    source: doc ? (agentId === GLOBAL_SETTINGS_ID ? "global" : "agent") : "defaults",
  });
});

/**
 * PUT /settings/:agentId
 *
 * Upsert full settings for an agent (or _global).
 */
export const upsertSettingsRoute = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { agentId } = req.params;
    const db: Db = req.app.locals.db;

    const input = AgentSettingsInputSchema.parse(req.body);
    const settings = await upsertSettings(db, agentId, input);

    res.json({ success: true, settings });
  },
);

/**
 * PATCH /settings/:agentId
 *
 * Partial merge — e.g., toggle a single stage without touching other fields.
 */
export const patchSettingsRoute = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { agentId } = req.params;
    const db: Db = req.app.locals.db;

    const input = AgentSettingsInputSchema.parse(req.body);
    const settings = await upsertSettings(db, agentId, input);

    res.json({ success: true, settings });
  },
);

/**
 * DELETE /settings/:agentId
 *
 * Remove agent-specific overrides (revert to global defaults).
 * Cannot delete _global.
 */
export const deleteSettingsRoute = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { agentId } = req.params;
    const db: Db = req.app.locals.db;

    if (agentId === GLOBAL_SETTINGS_ID) {
      res.status(400).json({ success: false, error: "Cannot delete global settings" });
      return;
    }

    const deleted = await deleteSettings(db, agentId);
    if (!deleted) {
      res.status(404).json({ success: false, error: "No settings found for this agent" });
      return;
    }

    res.json({ success: true, message: "Agent settings deleted, reverted to global defaults" });
  },
);

/**
 * POST /settings/:agentId/test-llm
 *
 * Test LLM connectivity with current resolved config.
 */
export const testLlmRoute = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { agentId } = req.params;
  const db: Db = req.app.locals.db;
  const config: DaemonConfig = req.app.locals.config;

  const resolved = await getResolvedSettings(db, agentId, config);
  const { endpoint, model, timeoutMs } = resolved.llmProvider;

  const startTime = Date.now();

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt: "Respond with exactly: OK",
        stream: false,
        options: { temperature: 0, num_predict: 10 },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`LLM returned ${response.status}: ${response.statusText}`);
    }

    const data = (await response.json()) as { response?: string };
    const responseTime = Date.now() - startTime;

    res.json({
      success: true,
      responseTime,
      model,
      endpoint,
      sampleOutput: data.response?.trim().slice(0, 100) || "(empty)",
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    res.json({
      success: false,
      responseTime,
      model,
      endpoint,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
