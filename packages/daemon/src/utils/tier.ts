/**
 * Determine the degradation tier based on current configuration.
 *
 * - Minimal:    Mock embeddings, no vector search
 * - Standard:   Real Voyage AI embeddings, in-memory cosine
 * - Production: Real embeddings + Atlas Vector Search
 */

export type DegradationTier = "minimal" | "standard" | "production";

export interface TierInfo {
  tier: DegradationTier;
  label: string;
  description: string;
}

export function getTier(isMock: boolean, hasVectorIndex: boolean): TierInfo {
  if (isMock) {
    return {
      tier: "minimal",
      label: "Minimal",
      description: "Mock embeddings — development/testing mode",
    };
  }
  if (hasVectorIndex) {
    return {
      tier: "production",
      label: "Production",
      description: "Real embeddings + Atlas Vector Search",
    };
  }
  return {
    tier: "standard",
    label: "Standard",
    description: "Real embeddings, in-memory cosine similarity",
  };
}
