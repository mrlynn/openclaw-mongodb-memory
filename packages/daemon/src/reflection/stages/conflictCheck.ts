/**
 * Stage 3: Conflict-Check
 * 
 * Runs contradiction detection on surviving atoms.
 * Reuses Phase 1 contradiction detector.
 */

import { Db } from "mongodb";
import { PipelineStage, PipelineContext, CandidateMemory } from "../types.js";
import { VoyageEmbedder } from "../../embedding.js";
import { detectContradictions } from "../../services/contradictionDetector.js";

/**
 * Conflict-check stage — detects contradictions
 */
export class ConflictCheckStage implements PipelineStage {
  name = "conflict-check";

  constructor(
    private db: Db,
    private embedder: VoyageEmbedder
  ) {}

  async execute(context: PipelineContext): Promise<PipelineContext> {
    const { deduplicatedAtoms, agentId } = context;

    if (!deduplicatedAtoms || deduplicatedAtoms.length === 0) {
      console.log(`[ConflictCheck] No atoms to check`);
      context.stats.conflict_check_processed = 0;
      return context;
    }

    let conflictsDetected = 0;

    for (const atom of deduplicatedAtoms) {
      // Embed the atom (with usage tracking)
      context.usageTracker?.pushContext({
        operation: "reflect:conflict-check",
        agentId,
        pipelineJobId: context.jobId,
        pipelineStage: "conflict-check",
      });
      let embedding: number[];
      try {
        embedding = await this.embedder.embedOne(atom.text, "document");
      } finally {
        context.usageTracker?.popContext();
      }

      // Run contradiction detection (reuse Phase 1 service)
      const contradictions = await detectContradictions(
        {
          agentId,
          text: atom.text,
          tags: atom.tags,
        },
        embedding,
        this.db,
        this.embedder
      );

      // Store contradictions in atom metadata
      if (contradictions.length > 0) {
        atom.metadata = {
          ...atom.metadata,
          contradictions,
        };
        conflictsDetected++;

        console.log(`[ConflictCheck] Detected ${contradictions.length} conflict(s) for atom`);
      }
    }

    context.stats.conflict_check_processed = deduplicatedAtoms.length;
    context.stats.conflict_check_conflicts = conflictsDetected;

    console.log(
      `[ConflictCheck] Checked ${deduplicatedAtoms.length} atoms, ` +
        `found ${conflictsDetected} with conflicts`
    );

    return context;
  }
}
