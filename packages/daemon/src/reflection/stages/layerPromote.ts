/**
 * Stage 7: Layer-Promote
 *
 * Moves memories between layers based on age, strength, reinforcement, and confidence.
 *
 * Two modes:
 *   - Heuristic (default): Pure threshold-based rules.
 *   - LLM-enhanced: For borderline cases (within 10% of thresholds), the LLM
 *     assesses semantic importance to confirm or block the promotion.
 */

import { Db } from "mongodb";
import { PipelineStage, PipelineContext } from "../types.js";
import { COLLECTION_MEMORIES } from "../../constants.js";
import { Memory, MemoryLayer } from "../../types/index.js";
import { callLlmJson, getLlmConfig } from "../../services/llmClient.js";

const PROMOTION_RULES = {
  EPISODIC_TO_SEMANTIC: {
    minAge: 14 * 24 * 60 * 60 * 1000,
    minReinforcement: 3,
    minConfidence: 0.7,
  },
  SEMANTIC_TO_ARCHIVAL: {
    maxStrength: 0.25,
    minAge: 60 * 24 * 60 * 60 * 1000,
    maxReinforcement: 5,
  },
  FAST_TRACK_SEMANTIC: {
    minConfidence: 0.9,
    minReinforcement: 5,
  },
};

/** LLM response for borderline promotion check. */
interface LlmPromotionResult {
  shouldPromote: boolean;
  reason: string;
}

/**
 * Layer-Promote stage — moves memories between layers
 */
export class LayerPromoteStage implements PipelineStage {
  name = "layer-promote";

  constructor(private db: Db) {}

  async execute(context: PipelineContext): Promise<PipelineContext> {
    const { agentId } = context;

    console.log(`[LayerPromote] Evaluating layer promotions for agent ${agentId}`);

    const collection = this.db.collection<Memory>(COLLECTION_MEMORIES);
    const useLlm = context.resolvedSettings?.stages?.layerPromote?.useLlm ?? false;

    let promotions = 0;
    let demotions = 0;
    let llmChecks = 0;

    const memories = await collection.find({ agentId }).toArray();

    for (const memory of memories) {
      const evaluation = this.evaluateLayerPromotion(memory);

      if (!evaluation) continue;

      const finalLayer = evaluation.newLayer;

      // For borderline cases, consult LLM if enabled
      if (useLlm && evaluation.borderline) {
        try {
          const llmResult = await this.consultLlm(context, memory, evaluation);
          llmChecks++;

          if (!llmResult.shouldPromote) {
            console.log(
              `[LayerPromote] LLM blocked ${memory.layer} → ${evaluation.newLayer}: ${llmResult.reason}`,
            );
            continue; // Skip this promotion
          }
        } catch (error) {
          console.warn(`[LayerPromote] LLM check failed, proceeding with heuristic:`, error);
        }
      }

      if (finalLayer !== memory.layer) {
        await collection.updateOne(
          { _id: memory._id as any },
          { $set: { layer: finalLayer, updatedAt: new Date() } },
        );

        if (this.isPromotion(memory.layer!, finalLayer)) {
          promotions++;
        } else {
          demotions++;
        }

        console.log(`[LayerPromote] ${memory.layer} → ${finalLayer} (${memory._id})`);
      }
    }

    context.stats.layer_promote_processed = memories.length;
    context.stats.layer_promote_promotions = promotions;
    context.stats.layer_promote_demotions = demotions;
    if (useLlm) {
      context.stats.layer_promote_llm_checks = llmChecks;
    }

    console.log(`[LayerPromote] Completed: ${promotions} promotions, ${demotions} demotions`);

    return context;
  }

  /**
   * Evaluate if memory should change layers. Returns null if no change,
   * or the new layer + whether the case is borderline (for LLM review).
   */
  private evaluateLayerPromotion(
    memory: Memory,
  ): { newLayer: MemoryLayer; borderline: boolean } | null {
    const now = Date.now();
    const age = now - new Date(memory.createdAt).getTime();
    const reinforcement = memory.reinforcementCount || 0;
    const confidence = memory.confidence || 0;
    const strength = memory.strength || 1;

    // Fast-track to semantic
    if (
      memory.layer !== "semantic" &&
      memory.layer !== "archival" &&
      confidence >= PROMOTION_RULES.FAST_TRACK_SEMANTIC.minConfidence &&
      reinforcement >= PROMOTION_RULES.FAST_TRACK_SEMANTIC.minReinforcement
    ) {
      return { newLayer: "semantic", borderline: false };
    }

    // episodic → semantic
    if (memory.layer === "episodic") {
      const rules = PROMOTION_RULES.EPISODIC_TO_SEMANTIC;
      const meetsAge = age >= rules.minAge;
      const meetsReinforcement = reinforcement >= rules.minReinforcement;
      const meetsConfidence = confidence >= rules.minConfidence;

      if (meetsAge && meetsReinforcement && meetsConfidence) {
        // Borderline: confidence within 10% of threshold
        const borderline = confidence < rules.minConfidence * 1.1;
        return { newLayer: "semantic", borderline };
      }
    }

    // semantic → archival
    if (memory.layer === "semantic") {
      const rules = PROMOTION_RULES.SEMANTIC_TO_ARCHIVAL;
      const lowStrength = strength <= rules.maxStrength;
      const oldEnough = age >= rules.minAge;
      const lowReinforcement = reinforcement <= rules.maxReinforcement;

      if (lowStrength && oldEnough && lowReinforcement) {
        // Borderline: strength within 10% of threshold
        const borderline = strength > rules.maxStrength * 0.9;
        return { newLayer: "archival", borderline };
      }
    }

    // Demotion: semantic → episodic (contradicted + low confidence)
    if (
      memory.layer === "semantic" &&
      confidence < 0.5 &&
      memory.contradictions &&
      memory.contradictions.length > 0
    ) {
      return { newLayer: "episodic", borderline: false };
    }

    return null;
  }

  /**
   * Consult LLM for borderline promotion decisions.
   */
  private async consultLlm(
    context: PipelineContext,
    memory: Memory,
    evaluation: { newLayer: MemoryLayer; borderline: boolean },
  ): Promise<LlmPromotionResult> {
    const config = getLlmConfig(context.resolvedSettings);

    const prompt = `You are a memory management system. A memory is being evaluated for layer promotion.

Memory text: "${memory.text}"
Current layer: ${memory.layer}
Proposed new layer: ${evaluation.newLayer}
Memory type: ${memory.memoryType}
Age: ${Math.round((Date.now() - new Date(memory.createdAt).getTime()) / (1000 * 60 * 60 * 24))} days
Reinforcement count: ${memory.reinforcementCount || 0}
Confidence: ${memory.confidence}
Strength: ${memory.strength}

Layer definitions:
- episodic: Temporary, session-specific memories
- semantic: Stable, verified knowledge worth long-term retention
- archival: Rarely accessed but worth preserving

Should this memory be promoted from ${memory.layer} to ${evaluation.newLayer}?
Consider: Is this memory ephemeral (e.g., "meeting at 3pm") or durable knowledge?

Return ONLY JSON: {"shouldPromote": true/false, "reason": "brief explanation"}`;

    const { data } = await callLlmJson<LlmPromotionResult>(prompt, config);
    return {
      shouldPromote: data.shouldPromote === true,
      reason: data.reason || "No reason provided",
    };
  }

  private isPromotion(from: MemoryLayer, to: MemoryLayer): boolean {
    const order: MemoryLayer[] = ["working", "episodic", "semantic", "archival"];
    return order.indexOf(to) > order.indexOf(from);
  }
}
