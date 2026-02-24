/**
 * Temporal Decay System
 * 
 * Strength represents how "alive" a memory is — how recently it has been
 * reinforced or accessed. Unlike TTL-based expiration (hard delete),
 * strength decay is gradual and reversible through reinforcement.
 */

import { MemoryLayer } from "./index.js";

/**
 * Decay rates per memory layer (applied daily)
 * Higher rate = faster decay
 */
export const DECAY_RATE: Record<MemoryLayer, number> = {
  working: 0.05,    // fast decay — working memory is session-scoped
  episodic: 0.015,  // moderate decay — episode fades over weeks
  semantic: 0.003,  // slow decay — stable knowledge persists months
  archival: 0.001,  // very slow — archival memory is nearly permanent
};

/**
 * Strength thresholds and their meanings
 */
export const STRENGTH_THRESHOLDS = {
  VIVID: 0.80,           // Active / vivid — eligible for bootstrap injection
  FADING: 0.50,          // Fading — included in recall only if score met
  DIM: 0.25,             // Dim — excluded from bootstrap; explicit search only
  ARCHIVAL_CANDIDATE: 0.10,  // Propose promotion to archival layer
  EXPIRATION_CANDIDATE: 0.10, // Flag for deletion; user review required
} as const;

/**
 * Apply exponential decay to strength based on time since last reinforcement
 * 
 * @param currentStrength - Current strength value (0.0 - 1.0)
 * @param lastReinforcedAt - When memory was last reinforced
 * @param layer - Memory layer (determines decay rate)
 * @returns Updated strength value
 */
export function applyDecay(
  currentStrength: number,
  lastReinforcedAt: Date,
  layer: MemoryLayer = "episodic"
): number {
  const now = Date.now();
  const daysSinceLast = (now - lastReinforcedAt.getTime()) / 86400000;
  
  const rate = DECAY_RATE[layer];
  const newStrength = currentStrength * Math.exp(-rate * daysSinceLast);
  
  // Clamp to [0, 1]
  return Math.max(0, Math.min(1, newStrength));
}

/**
 * Determine memory status based on current strength
 */
export function getMemoryStatus(strength: number): string {
  if (strength >= STRENGTH_THRESHOLDS.VIVID) return "vivid";
  if (strength >= STRENGTH_THRESHOLDS.FADING) return "fading";
  if (strength >= STRENGTH_THRESHOLDS.DIM) return "dim";
  if (strength >= STRENGTH_THRESHOLDS.ARCHIVAL_CANDIDATE) return "archival_candidate";
  return "expiration_candidate";
}

/**
 * Check if memory should be included in bootstrap (proactive injection)
 */
export function shouldIncludeInBootstrap(strength: number): boolean {
  return strength >= STRENGTH_THRESHOLDS.VIVID;
}

/**
 * Check if memory is a candidate for archival promotion
 */
export function isArchivalCandidate(strength: number): boolean {
  return strength < STRENGTH_THRESHOLDS.ARCHIVAL_CANDIDATE && strength >= STRENGTH_THRESHOLDS.EXPIRATION_CANDIDATE;
}

/**
 * Check if memory is a candidate for expiration
 */
export function isExpirationCandidate(strength: number): boolean {
  return strength < STRENGTH_THRESHOLDS.EXPIRATION_CANDIDATE;
}
