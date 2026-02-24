/**
 * Usage & Cost Observability Types
 *
 * Every Voyage API call produces a UsageEvent that captures
 * token consumption, cost, and attribution (operation, agent, pipeline stage).
 */

export interface UsageEvent {
  _id?: import("mongodb").ObjectId;
  timestamp: Date;

  // What operation triggered this embedding call
  operation: UsageOperation;

  // Who
  agentId?: string;

  // Model & provider
  model: string;
  provider: "voyage" | "ollama" | "mock";

  // Token counts
  totalTokens: number;
  inputTexts: number; // how many texts were embedded in this call
  inputType?: "document" | "query";

  // Cost (estimated, in USD)
  estimatedCostUsd: number;

  // Attribution for reflection pipeline
  pipelineJobId?: string;
  pipelineStage?: string;
  memoryId?: string;

  // Was this a mock call? (no real tokens consumed)
  isMock: boolean;
}

export type UsageOperation =
  | "remember"
  | "recall"
  | "contradiction-check"
  | "reflect:deduplicate"
  | "reflect:conflict-check"
  | "reflect:classify"
  | "reflect:entity-update"
  | "reflect:graph-link"
  | "reembed"
  | "status-health-check"
  | "unknown";

/**
 * Voyage pricing per million tokens (USD).
 * Updated 2026-02-24 from https://docs.voyageai.com/pricing/
 */
export const VOYAGE_PRICING: Record<string, number> = {
  "voyage-4-lite": 0.02,
  "voyage-4": 0.1,
  "voyage-4-large": 0.12,
  "voyage-3": 0.06,
  "voyage-3-lite": 0.02,
  "voyage-2": 0.1,
  "voyage-code-3": 0.1,
  "voyage-finance-2": 0.1,
  "voyage-law-2": 0.1,
};

/**
 * Estimate the cost in USD for a given number of tokens on a given model.
 */
export function estimateCost(model: string, totalTokens: number): number {
  const pricePerMillion = VOYAGE_PRICING[model] || 0.1; // default to voyage-4 pricing
  return (totalTokens / 1_000_000) * pricePerMillion;
}

/**
 * Context pushed before an embedding call so UsageTracker knows what triggered it.
 */
export interface UsageContext {
  operation: UsageOperation;
  agentId?: string;
  pipelineJobId?: string;
  pipelineStage?: string;
  memoryId?: string;
}

/**
 * In-memory running totals (reset on daemon restart, DB has full history).
 */
export interface RunningTotals {
  totalTokens: number;
  totalCostUsd: number;
  totalCalls: number;
  byOperation: Record<string, { tokens: number; cost: number; calls: number }>;
  startedAt: Date;
}

/**
 * Internal event emitted by VoyageEmbedder after each API call.
 */
export interface EmbedderUsageEvent {
  totalTokens: number;
  model: string;
  inputTexts: number;
  inputType?: "document" | "query";
  isMock: boolean;
}
