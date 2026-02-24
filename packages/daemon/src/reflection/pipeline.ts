/**
 * Reflection Pipeline Orchestrator
 * 
 * Runs stages in sequence, updates job status, handles errors.
 */

import { Db } from "mongodb";
import { PipelineStage, PipelineContext, StageResult } from "./types.js";
import { updateJobStatus, updateStageResult } from "./jobQueue.js";

/**
 * Run the full reflection pipeline
 */
export async function runPipeline(
  db: Db,
  jobId: string,
  context: PipelineContext,
  stages: PipelineStage[]
): Promise<PipelineContext> {
  // Mark job as running
  await updateJobStatus(db, jobId, "running");

  let currentContext = context;

  for (const stage of stages) {
    const stageResult: StageResult = {
      stage: stage.name,
      status: "running",
      startedAt: new Date(),
    };

    try {
      // Update stage as running
      await updateStageResult(db, jobId, stageResult);

      // Execute stage
      const startTime = Date.now();
      currentContext = await stage.execute(currentContext);
      const duration = Date.now() - startTime;

      // Mark stage as complete
      stageResult.status = "complete";
      stageResult.completedAt = new Date();
      stageResult.duration = duration;
      stageResult.itemsProcessed = currentContext.stats[`${stage.name}_processed`] || 0;
      stageResult.itemsCreated = currentContext.stats[`${stage.name}_created`] || 0;
      stageResult.itemsUpdated = currentContext.stats[`${stage.name}_updated`] || 0;

      await updateStageResult(db, jobId, stageResult);

      console.log(`[Pipeline ${jobId}] Stage "${stage.name}" complete in ${duration}ms`);
    } catch (error) {
      // Mark stage as failed
      stageResult.status = "failed";
      stageResult.completedAt = new Date();
      stageResult.error = error instanceof Error ? error.message : String(error);

      await updateStageResult(db, jobId, stageResult);

      // Mark entire job as failed
      await updateJobStatus(db, jobId, "failed", stageResult.error);

      console.error(`[Pipeline ${jobId}] Stage "${stage.name}" failed:`, error);

      throw error; // Propagate error
    }
  }

  // All stages complete
  await updateJobStatus(db, jobId, "complete");

  console.log(`[Pipeline ${jobId}] Complete — ${stages.length} stages executed`);

  return currentContext;
}

/**
 * Create a pipeline with Phase 2 Week 4 stages (1-4)
 */
export async function createWeek4Pipeline(db: Db, embedder: any): Promise<PipelineStage[]> {
  const { ExtractStage } = await import("./stages/extract.js");
  const { DeduplicateStage } = await import("./stages/deduplicate.js");
  const { ConflictCheckStage } = await import("./stages/conflictCheck.js");
  const { ClassifyStage } = await import("./stages/classify.js");

  return [
    new ExtractStage(),
    new DeduplicateStage(db, embedder),
    new ConflictCheckStage(db, embedder),
    new ClassifyStage(db, embedder),
  ];
}

/**
 * Create a pipeline with Phase 2 Week 5 stages (1-8)
 */
export async function createWeek5Pipeline(db: Db, embedder: any): Promise<PipelineStage[]> {
  const { ExtractStage } = await import("./stages/extract.js");
  const { DeduplicateStage } = await import("./stages/deduplicate.js");
  const { ConflictCheckStage } = await import("./stages/conflictCheck.js");
  const { ClassifyStage } = await import("./stages/classify.js");
  const { ConfidenceUpdateStage } = await import("./stages/confidenceUpdate.js");
  const { DecayPassStage } = await import("./stages/decayPass.js");
  const { LayerPromoteStage } = await import("./stages/layerPromote.js");
  const { GraphLinkStage } = await import("./stages/graphLink.js");
  const { GraphApplyStage } = await import("./stages/graphApply.js");

  return [
    new ExtractStage(),
    new DeduplicateStage(db, embedder),
    new ConflictCheckStage(db, embedder),
    new ClassifyStage(db, embedder),
    new ConfidenceUpdateStage(db),
    new DecayPassStage(db),
    new LayerPromoteStage(db),
    new GraphLinkStage(db, embedder),
    new GraphApplyStage(db),
  ];
}

/**
 * Create a complete pipeline with all 9 stages (Phase 2 Week 6 — Production)
 */
export async function createFullPipeline(db: Db, embedder: any): Promise<PipelineStage[]> {
  const { ExtractStage } = await import("./stages/extract.js");
  const { DeduplicateStage } = await import("./stages/deduplicate.js");
  const { ConflictCheckStage } = await import("./stages/conflictCheck.js");
  const { ClassifyStage } = await import("./stages/classify.js");
  const { ConfidenceUpdateStage } = await import("./stages/confidenceUpdate.js");
  const { DecayPassStage } = await import("./stages/decayPass.js");
  const { LayerPromoteStage } = await import("./stages/layerPromote.js");
  const { GraphLinkStage } = await import("./stages/graphLink.js");
  const { EntityUpdateStage } = await import("./stages/entityUpdate.js");
  const { GraphApplyStage } = await import("./stages/graphApply.js");

  return [
    new ExtractStage(),
    new DeduplicateStage(db, embedder),
    new ConflictCheckStage(db, embedder),
    new ClassifyStage(db, embedder),
    new ConfidenceUpdateStage(db),
    new DecayPassStage(db),
    new LayerPromoteStage(db),
    new GraphLinkStage(db, embedder),
    new EntityUpdateStage(db, embedder),
    new GraphApplyStage(db),
  ];
}
