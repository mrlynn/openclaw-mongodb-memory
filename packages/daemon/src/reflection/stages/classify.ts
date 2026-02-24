/**
 * Stage 4: Classify
 *
 * Assigns memory layer, type, and initial confidence to atoms.
 * Converts candidate memories into full Memory objects ready for storage.
 *
 * Two modes:
 *   - Heuristic (default): Uses candidate's self-reported type and rule-based confidence.
 *   - LLM-enhanced: LLM determines optimal memoryType, layer, confidence, and suggests tags.
 */

import { Db } from "mongodb";
import { PipelineStage, PipelineContext, CandidateMemory } from "../types.js";
import { VoyageEmbedder } from "../../embedding.js";
import { Memory, MemoryType, MemoryLayer } from "../../types/index.js";
import { getInitialConfidence, DEFAULT_STRENGTH } from "../../types/confidence.js";
import { COLLECTION_MEMORIES } from "../../constants.js";
import { callLlmJson, getLlmConfig } from "../../services/llmClient.js";

/** Shape returned by the LLM classification prompt. */
interface LlmClassification {
  memoryType: MemoryType;
  layer: MemoryLayer;
  confidence: number;
  suggestedTags?: string[];
}

/**
 * Classify stage — converts candidates to full Memory documents
 */
export class ClassifyStage implements PipelineStage {
  name = "classify";

  constructor(
    private db: Db,
    private embedder: VoyageEmbedder,
  ) {}

  async execute(context: PipelineContext): Promise<PipelineContext> {
    const { deduplicatedAtoms, agentId, sessionId } = context;

    if (!deduplicatedAtoms || deduplicatedAtoms.length === 0) {
      console.log(`[Classify] No atoms to classify`);
      context.classifiedAtoms = [];
      context.stats.classify_processed = 0;
      return context;
    }

    const useLlm = context.resolvedSettings?.stages?.classify?.useLlm ?? false;

    // If LLM is enabled, get classifications for all atoms in batch
    let llmClassifications: Map<number, LlmClassification> | null = null;
    if (useLlm) {
      try {
        llmClassifications = await this.classifyWithLlm(context, deduplicatedAtoms);
        context.stats.classify_llm_used = 1;
        console.log(`[Classify] LLM classified ${llmClassifications.size} atoms`);
      } catch (error) {
        console.warn(`[Classify] LLM classification failed, using heuristics:`, error);
        context.stats.classify_llm_used = 0;
      }
    }

    const collection = this.db.collection<Memory>(COLLECTION_MEMORIES);
    const classifiedMemories: Memory[] = [];

    for (let i = 0; i < deduplicatedAtoms.length; i++) {
      const atom = deduplicatedAtoms[i];
      const llmResult = llmClassifications?.get(i);

      // Embed the text (with usage tracking)
      context.usageTracker?.pushContext({
        operation: "reflect:classify",
        agentId,
        pipelineJobId: context.jobId,
        pipelineStage: "classify",
      });
      let embedding: number[];
      try {
        embedding = await this.embedder.embedOne(atom.text, "document");
      } finally {
        context.usageTracker?.popContext();
      }

      const now = new Date();

      // Use LLM results if available, otherwise heuristic defaults
      const layer: MemoryLayer =
        llmResult?.layer || (atom.metadata?.layer as MemoryLayer) || "episodic";
      const memoryType: MemoryType =
        llmResult?.memoryType || (atom.memoryType as MemoryType) || "fact";
      const confidence =
        llmResult?.confidence ?? atom.confidence ?? getInitialConfidence(memoryType);
      const tags = llmResult?.suggestedTags
        ? [...new Set([...atom.tags, ...llmResult.suggestedTags])]
        : atom.tags;

      // Build Memory document
      const memory: Omit<Memory, "_id"> = {
        agentId,
        text: atom.text,
        embedding,
        tags,
        metadata: atom.metadata || {},
        createdAt: now,
        updatedAt: now,

        // Phase 1 fields
        confidence,
        strength: DEFAULT_STRENGTH,
        reinforcementCount: 0,
        lastReinforcedAt: now,
        layer,
        memoryType,
        ...(sessionId && { sourceSessionId: sessionId }),

        // Contradictions from conflict-check stage
        contradictions: (atom.metadata?.contradictions as any) || [],

        // Phase 3/4 (reserved)
        edges: [],
      };

      classifiedMemories.push(memory as Memory);
    }

    // Store all classified memories
    if (classifiedMemories.length > 0) {
      const result = await collection.insertMany(classifiedMemories as any);
      context.stats.classify_created = result.insertedCount;

      console.log(`[Classify] Created ${result.insertedCount} new memories`);
    }

    context.classifiedAtoms = classifiedMemories;
    context.stats.classify_processed = deduplicatedAtoms.length;

    return context;
  }

  /**
   * LLM-enhanced classification — batches atoms for efficiency.
   */
  private async classifyWithLlm(
    context: PipelineContext,
    atoms: CandidateMemory[],
  ): Promise<Map<number, LlmClassification>> {
    const config = getLlmConfig(context.resolvedSettings);
    const results = new Map<number, LlmClassification>();

    // Batch atoms (up to 10 per LLM call)
    const batchSize = 10;
    for (let start = 0; start < atoms.length; start += batchSize) {
      const batch = atoms.slice(start, start + batchSize);

      const atomList = batch
        .map((a, i) => `[${start + i}] "${a.text}" (current type: ${a.memoryType || "unknown"})`)
        .join("\n");

      const prompt = `You are a memory classification system. For each memory atom below, determine:
- memoryType: one of "fact", "preference", "decision", "observation", "episode", "opinion"
- layer: one of "episodic" (temporary/session-specific), "semantic" (stable knowledge), "archival" (rarely needed but worth keeping)
- confidence: 0.0-1.0 (how clearly and definitively this is stated)
- suggestedTags: 1-4 descriptive tags

Return ONLY a JSON object mapping index numbers to classifications. No explanation.

Example: {"0": {"memoryType": "preference", "layer": "semantic", "confidence": 0.9, "suggestedTags": ["typescript", "language"]}}

Atoms:
${atomList}`;

      try {
        const { data } = await callLlmJson<Record<string, LlmClassification>>(prompt, config);

        for (const [indexStr, classification] of Object.entries(data)) {
          const index = parseInt(indexStr, 10);
          if (!isNaN(index) && classification?.memoryType) {
            results.set(index, {
              memoryType: classification.memoryType,
              layer: classification.layer || "episodic",
              confidence:
                typeof classification.confidence === "number"
                  ? Math.max(0, Math.min(1, classification.confidence))
                  : 0.7,
              suggestedTags: Array.isArray(classification.suggestedTags)
                ? classification.suggestedTags
                : undefined,
            });
          }
        }
      } catch (error) {
        console.warn(`[Classify] LLM batch ${start}-${start + batch.length} failed:`, error);
        // Continue with other batches
      }
    }

    return results;
  }
}
