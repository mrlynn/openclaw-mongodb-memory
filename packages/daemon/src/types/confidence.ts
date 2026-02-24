/**
 * Confidence Scoring System
 * 
 * Confidence represents how certain the system is that a memory is accurate.
 * It evolves as evidence accumulates or contradicts the memory.
 */

import { MemoryType } from "./index.js";

/**
 * Initial confidence assignment rules based on memory type and source
 */
export const INITIAL_CONFIDENCE: Record<MemoryType, number> = {
  preference: 0.80,      // Direct expression of preference
  decision: 0.90,        // Explicitly confirmed decision
  fact: 0.60,            // Default for general facts
  observation: 0.50,     // Single session observation, unverified
  opinion: 0.40,         // Casual mention / passing reference
  episode: 0.60,         // Extracted from historical episode
};

/**
 * Default confidence when memoryType is not provided
 */
export const DEFAULT_CONFIDENCE = 0.60;

/**
 * Default strength (how "alive" the memory is)
 */
export const DEFAULT_STRENGTH = 1.0;

/**
 * Confidence bounds
 */
export const MIN_CONFIDENCE = 0.02;
export const MAX_CONFIDENCE = 0.98;

/**
 * Get initial confidence for a new memory based on its type
 */
export function getInitialConfidence(memoryType?: MemoryType): number {
  if (!memoryType) {
    return DEFAULT_CONFIDENCE;
  }
  return INITIAL_CONFIDENCE[memoryType] ?? DEFAULT_CONFIDENCE;
}

/**
 * Update confidence on reinforcement (new evidence agrees with existing memory)
 * Uses bounded exponential model to prevent single large jumps
 */
export function updateConfidenceOnReinforcement(currentConfidence: number): number {
  const delta = (1 - currentConfidence) * 0.15;
  return Math.min(MAX_CONFIDENCE, currentConfidence + delta);
}

/**
 * Update confidence on strong contradiction (repeated, high-confidence source)
 */
export function updateConfidenceOnStrongContradiction(currentConfidence: number): number {
  const delta = currentConfidence * 0.25;
  return Math.max(MIN_CONFIDENCE, currentConfidence - delta);
}

/**
 * Update confidence on weak contradiction (single mention, low-confidence source)
 */
export function updateConfidenceOnWeakContradiction(currentConfidence: number): number {
  const delta = currentConfidence * 0.08;
  return Math.max(MIN_CONFIDENCE, currentConfidence - delta);
}
