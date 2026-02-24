/**
 * Reflection API Routes
 *
 * Endpoints for triggering and monitoring reflection pipeline jobs.
 */

import { Request, Response } from "express";
import { z } from "zod";
import { Db } from "mongodb";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { VoyageEmbedder } from "../embedding.js";
import { DaemonConfig } from "../config.js";
import { createJob, getJob, listJobs } from "../reflection/jobQueue.js";
import { runPipeline, createWeek4Pipeline } from "../reflection/pipeline.js";
import { PipelineContext } from "../reflection/types.js";
import { getResolvedSettings } from "../services/settingsService.js";

/**
 * POST /reflect
 *
 * Trigger a reflection pipeline run manually
 */
const TriggerReflectSchema = z.object({
  agentId: z.string().min(1),
  sessionId: z.string().optional(),
  sessionTranscript: z.string().optional(),
});

export const triggerReflectRoute = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const data = TriggerReflectSchema.parse(req.body);

    const db: Db = req.app.locals.db;
    const embedder: VoyageEmbedder = req.app.locals.embedder;

    // Create job
    const jobId = await createJob(db, data.agentId, data.sessionId, {
      triggeredBy: "manual",
      triggeredAt: new Date().toISOString(),
    });

    // Resolve semantic/LLM settings for this agent
    const daemonConfig: DaemonConfig = req.app.locals.config;
    const resolvedSettings = await getResolvedSettings(db, data.agentId, daemonConfig);

    // Build pipeline context (include usageTracker for cost attribution)
    const context: PipelineContext = {
      agentId: data.agentId,
      sessionId: data.sessionId,
      jobId,
      sessionTranscript: data.sessionTranscript,
      resolvedSettings,
      usageTracker: req.app.locals.usageTracker,
      stats: {},
    };

    // Run pipeline asynchronously (don't block response)
    // Use full pipeline (all 9 stages)
    const { createFullPipeline } = await import("../reflection/pipeline.js");
    const stages = await createFullPipeline(db, embedder);

    runPipeline(db, jobId, context, stages).catch((error) => {
      console.error(`[Reflect] Pipeline ${jobId} failed:`, error);
    });

    res.json({
      success: true,
      message: "Reflection pipeline started",
      jobId,
    });
  },
);

/**
 * GET /reflect/status
 *
 * Get reflection pipeline status
 */
export const getReflectStatusRoute = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const jobId = req.query.jobId as string | undefined;

    if (!jobId) {
      res.status(400).json({ error: "jobId query parameter required" });
      return;
    }

    const db: Db = req.app.locals.db;
    const job = await getJob(db, jobId);

    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }

    res.json({
      success: true,
      job: {
        id: job._id!.toString(),
        agentId: job.agentId,
        sessionId: job.sessionId,
        status: job.status,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        stages: job.stages,
        error: job.error,
      },
    });
  },
);

/**
 * GET /reflect/jobs
 *
 * List recent reflection jobs for an agent
 */
export const listReflectJobsRoute = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const agentId = req.query.agentId as string;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

    if (!agentId) {
      res.status(400).json({ error: "agentId query parameter required" });
      return;
    }

    const db: Db = req.app.locals.db;
    const jobs = await listJobs(db, agentId, limit);

    res.json({
      success: true,
      count: jobs.length,
      jobs: jobs.map((j) => ({
        id: j._id!.toString(),
        agentId: j.agentId,
        sessionId: j.sessionId,
        status: j.status,
        createdAt: j.createdAt,
        startedAt: j.startedAt,
        completedAt: j.completedAt,
        stageCount: j.stages.length,
        completedStages: j.stages.filter((s) => s.status === "complete").length,
        error: j.error,
      })),
    });
  },
);
