/**
 * Stage 2: Deduplicate
 * 
 * Vector search for near-duplicate existing memories.
 * Merges or reinforces instead of creating duplicates.
 */

import { Db } from "mongodb";
import { PipelineStage, PipelineContext, CandidateMemory } from "../types.js";
import { VoyageEmbedder } from "../../embedding.js";
import { COLLECTION_MEMORIES } from "../../constants.js";
import { Memory } from "../../types/index.js";

/**
 * Similarity threshold for considering two memories as duplicates
 * Higher than contradiction threshold (0.75) to catch very similar content
 */
const DUPLICATE_THRESHOLD = 0.92;

/**
 * Similarity threshold for "likely duplicate" (human review queue)
 */
const REVIEW_THRESHOLD = 0.85;

/**
 * Deduplicate stage — prevents duplicate memories
 */
export class DeduplicateStage implements PipelineStage {
  name = "deduplicate";

  constructor(
    private db: Db,
    private embedder: VoyageEmbedder
  ) {}

  async execute(context: PipelineContext): Promise<PipelineContext> {
    const { extractedAtoms, agentId } = context;

    if (!extractedAtoms || extractedAtoms.length === 0) {
      console.log(`[Deduplicate] No atoms to deduplicate`);
      context.deduplicatedAtoms = [];
      context.stats.deduplicate_processed = 0;
      return context;
    }

    const collection = this.db.collection<Memory>(COLLECTION_MEMORIES);
    const deduplicatedAtoms: CandidateMemory[] = [];

    let mergedCount = 0;
    let reinforcedCount = 0;

    for (const atom of extractedAtoms) {
      // Embed the candidate (with usage tracking)
      context.usageTracker?.pushContext({
        operation: "reflect:deduplicate",
        agentId,
        pipelineJobId: context.jobId,
        pipelineStage: "deduplicate",
      });
      let embedding: number[];
      try {
        embedding = await this.embedder.embedOne(atom.text, "document");
      } finally {
        context.usageTracker?.popContext();
      }

      // Search for similar existing memories
      const similar = await this.findSimilarMemories(agentId, embedding, collection);

      if (similar.length > 0 && similar[0].score >= DUPLICATE_THRESHOLD) {
        // Very similar — merge/reinforce existing
        const existing = similar[0];

        await this.reinforceMemory(existing._id!.toString(), collection);
        reinforcedCount++;

        console.log(
          `[Deduplicate] Reinforced existing memory (score: ${similar[0].score.toFixed(3)})`
        );
      } else if (similar.length > 0 && similar[0].score >= REVIEW_THRESHOLD) {
        // Likely duplicate — for now, keep the new one but flag for review
        // In production, this would go to a review queue
        deduplicatedAtoms.push({
          ...atom,
          metadata: {
            ...atom.metadata,
            likelyDuplicateOf: similar[0]._id!.toString(),
            similarityScore: similar[0].score,
          },
        });

        console.log(
          `[Deduplicate] Likely duplicate detected (score: ${similar[0].score.toFixed(3)}), flagged`
        );
      } else {
        // No duplicate — keep as new
        deduplicatedAtoms.push(atom);
      }
    }

    context.deduplicatedAtoms = deduplicatedAtoms;
    context.stats.deduplicate_processed = extractedAtoms.length;
    context.stats.deduplicate_merged = mergedCount;
    context.stats.deduplicate_reinforced = reinforcedCount;
    context.stats.deduplicate_kept = deduplicatedAtoms.length;

    console.log(
      `[Deduplicate] Processed ${extractedAtoms.length} atoms: ` +
        `${reinforcedCount} reinforced, ${deduplicatedAtoms.length} kept`
    );

    return context;
  }

  /**
   * Find similar memories using in-memory cosine similarity
   * (In production with Atlas Vector Search, this would use $vectorSearch)
   */
  private async findSimilarMemories(
    agentId: string,
    embedding: number[],
    collection: any
  ): Promise<Array<Memory & { score: number }>> {
    const allMemories = await collection.find({ agentId }).limit(1000).toArray();

    const results: Array<Memory & { score: number }> = [];

    for (const memory of allMemories) {
      if (!memory.embedding) continue;

      const score = this.cosineSimilarity(embedding, memory.embedding);

      if (score >= REVIEW_THRESHOLD) {
        results.push({ ...memory, score });
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, 5);
  }

  /**
   * Reinforce an existing memory (increment count, update timestamp)
   */
  private async reinforceMemory(memoryId: string, collection: any): Promise<void> {
    const { ObjectId } = await import("mongodb");

    await collection.updateOne(
      { _id: new ObjectId(memoryId) as any },
      {
        $inc: { reinforcementCount: 1 },
        $set: {
          lastReinforcedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );
  }

  /**
   * Cosine similarity between two vectors
   */
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) return 0;

    return dotProduct / (normA * normB);
  }
}
