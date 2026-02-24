/**
 * Contradiction Detection System
 * 
 * Detects semantic conflicts between memories. When a new memory is stored,
 * the system checks whether it conflicts with existing memories on the same topic.
 * Conflicts are flagged, not silently overwritten.
 */

import { Db, ObjectId } from "mongodb";
import { VoyageEmbedder } from "../embedding.js";
import { COLLECTION_MEMORIES } from "../constants.js";
import { Contradiction, Memory } from "../types/index.js";

/**
 * Similarity threshold for considering two memories as potentially related
 */
const SIMILARITY_THRESHOLD = 0.75;

/**
 * Contradiction probability threshold for marking as conflicting
 */
const CONTRADICTION_THRESHOLD = 0.70;

/**
 * Maximum number of candidate memories to check for contradictions
 */
const MAX_CANDIDATES = 10;

/**
 * Simple negation patterns that indicate contradiction
 */
const NEGATION_PATTERNS = [
  /\b(not|no|never|don't|doesn't|didn't|won't|wouldn't|can't|cannot|isn't|aren't)\b/i,
  /\b(prefer|like|hate|dislike)\b.*\b(over|instead of|rather than)\b/i,
  /\b(always|usually|sometimes|rarely|never)\b/i,
];

/**
 * Contradiction classifier result
 */
interface ContradictionResult {
  contradicts: boolean;
  probability: number;
  type: "direct" | "context-dependent" | "temporal" | "none";
  explanation: string;
}

/**
 * Detect contradictions between a new memory and existing memories
 * 
 * @param newMemory - The memory being stored
 * @param embedding - Embedding vector for the new memory
 * @param db - MongoDB database instance
 * @param embedder - Voyage AI embedder
 * @returns Array of contradiction objects to add to the new memory
 */
export async function detectContradictions(
  newMemory: { agentId: string; text: string; tags: string[] },
  embedding: number[],
  db: Db,
  embedder: VoyageEmbedder
): Promise<Contradiction[]> {
  const collection = db.collection<Memory>(COLLECTION_MEMORIES);

  // Step 1: Vector search for similar memories (same agent, above threshold)
  const candidates = await findSimilarMemories(
    newMemory.agentId,
    embedding,
    newMemory.tags,
    collection
  );

  if (candidates.length === 0) {
    return []; // No similar memories to check
  }

  // Step 2: Run contradiction classifier on each candidate
  const contradictions: Contradiction[] = [];

  for (const candidate of candidates) {
    const result = classifyContradiction(newMemory.text, candidate.text);

    if (result.contradicts && result.probability >= CONTRADICTION_THRESHOLD) {
      // Mark as contradiction
      contradictions.push({
        memoryId: candidate._id!.toString(),
        detectedAt: new Date(),
        resolution: "unresolved",
      });

      // Also update the existing memory to mark it as conflicting with the new one
      // (This will be done in the remember route after the new memory is inserted)
    }
  }

  return contradictions;
}

/**
 * Find memories similar to the new memory using vector search
 */
async function findSimilarMemories(
  agentId: string,
  embedding: number[],
  tags: string[],
  collection: any
): Promise<Array<Memory & { score: number }>> {
  // Simple in-memory cosine similarity search
  // For production with Atlas Vector Search, this would use $vectorSearch
  
  const allMemories = await collection
    .find({ agentId })
    .limit(1000) // Reasonable limit for in-memory search
    .toArray();

  const results: Array<Memory & { score: number }> = [];

  for (const memory of allMemories) {
    if (!memory.embedding) continue;

    const score = cosineSimilarity(embedding, memory.embedding);
    
    if (score >= SIMILARITY_THRESHOLD) {
      results.push({ ...memory, score });
    }
  }

  // Sort by similarity descending and take top N
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CANDIDATES);
}

/**
 * Classify whether two memory texts contradict each other
 * 
 * Uses heuristic pattern matching for Phase 1 (simple, fast, no LLM cost).
 * Can be upgraded to LLM-based classification in Phase 2.
 */
function classifyContradiction(textA: string, textB: string): ContradictionResult {
  const lowerA = textA.toLowerCase();
  const lowerB = textB.toLowerCase();

  // Check 1: Direct negation patterns
  const hasNegationA = NEGATION_PATTERNS.some((pattern) => pattern.test(textA));
  const hasNegationB = NEGATION_PATTERNS.some((pattern) => pattern.test(textB));

  if (hasNegationA !== hasNegationB) {
    // One has negation, the other doesn't — potential contradiction
    return {
      contradicts: true,
      probability: 0.75,
      type: "direct",
      explanation: "One statement contains negation while the other doesn't",
    };
  }

  // Check 2: Opposite preference indicators
  const preferenceKeywords = ["prefer", "like", "favorite", "always use", "best"];
  const hasPreferenceA = preferenceKeywords.some((kw) => lowerA.includes(kw));
  const hasPreferenceB = preferenceKeywords.some((kw) => lowerB.includes(kw));

  if (hasPreferenceA && hasPreferenceB) {
    // Both express preferences — check if they mention different things
    const wordsA = new Set(lowerA.split(/\W+/));
    const wordsB = new Set(lowerB.split(/\W+/));
    
    const commonWords = Array.from(wordsA).filter((w) => wordsB.has(w));
    const overlapRatio = commonWords.length / Math.min(wordsA.size, wordsB.size);

    if (overlapRatio < 0.3) {
      // Different subjects in preference statements
      return {
        contradicts: true,
        probability: 0.70,
        type: "context-dependent",
        explanation: "Different preferences expressed about related topics",
      };
    }
  }

  // Check 3: Temporal indicators (then vs now)
  const temporalPast = /\b(used to|previously|before|was|were|had)\b/i;
  const temporalPresent = /\b(now|currently|is|are|have|use)\b/i;

  const isPastA = temporalPast.test(textA);
  const isPresentA = temporalPresent.test(textA);
  const isPastB = temporalPast.test(textB);
  const isPresentB = temporalPresent.test(textB);

  if ((isPastA && isPresentB) || (isPresentA && isPastB)) {
    return {
      contradicts: true,
      probability: 0.65,
      type: "temporal",
      explanation: "One describes past state, the other describes current state",
    };
  }

  // No contradiction detected
  return {
    contradicts: false,
    probability: 0.0,
    type: "none",
    explanation: "No contradiction patterns detected",
  };
}

/**
 * Update an existing memory to mark it as conflicting with another memory
 */
export async function markMemoryAsContradicting(
  memoryId: string,
  contradictingMemoryId: string,
  db: Db
): Promise<void> {
  const collection = db.collection<Memory>(COLLECTION_MEMORIES);

  const contradiction: Contradiction = {
    memoryId: contradictingMemoryId,
    detectedAt: new Date(),
  };

  await collection.updateOne(
    { _id: new ObjectId(memoryId) as any },
    {
      $push: { contradictions: contradiction as any },
      $set: { updatedAt: new Date() },
    }
  );
}

/**
 * Cosine similarity between two vectors
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error("Vectors must have the same length");
  }

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

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}
