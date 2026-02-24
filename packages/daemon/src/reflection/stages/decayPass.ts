/**
 * Stage 6: Decay Pass
 * 
 * Applies temporal decay to all memories not touched in this session.
 * Reuses Phase 1 decay service.
 */

import { Db } from "mongodb";
import { PipelineStage, PipelineContext } from "../types.js";
import { runDecayPass } from "../../services/decayService.js";

/**
 * Decay Pass stage — applies temporal decay
 */
export class DecayPassStage implements PipelineStage {
  name = "decay-pass";

  constructor(private db: Db) {}

  async execute(context: PipelineContext): Promise<PipelineContext> {
    const { agentId } = context;

    console.log(`[DecayPass] Running decay for agent ${agentId}`);

    // Run decay pass (reuse Phase 1 service)
    const stats = await runDecayPass(this.db, agentId);

    context.stats.decay_pass_processed = stats.totalMemories;
    context.stats.decay_pass_decayed = stats.decayed;
    context.stats.decay_pass_archival_candidates = stats.archivalCandidates;
    context.stats.decay_pass_expiration_candidates = stats.expirationCandidates;

    console.log(
      `[DecayPass] Decayed ${stats.decayed}/${stats.totalMemories} memories ` +
        `(${stats.expirationCandidates} expiration candidates)`
    );

    return context;
  }
}
