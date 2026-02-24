/**
 * UsageTracker — Captures token usage from VoyageEmbedder, writes to MongoDB,
 * and maintains in-memory running totals for fast status queries.
 *
 * Architecture:
 *   VoyageEmbedder emits "usage" events → UsageTracker captures them
 *   Routes push/pop context to attribute usage to operations/agents/pipeline stages
 *   MongoDB writes are fire-and-forget (don't block embedding calls)
 */

import { Db } from "mongodb";
import { VoyageEmbedder } from "../embedding";
import { COLLECTION_USAGE_EVENTS } from "../constants";
import type {
  UsageEvent,
  UsageContext,
  UsageOperation,
  RunningTotals,
  EmbedderUsageEvent,
} from "../types/usage";
import { estimateCost } from "../types/usage";

export class UsageTracker {
  private db: Db;
  private embedder: VoyageEmbedder;
  private contextStack: UsageContext[] = [];
  private runningTotals: RunningTotals;

  constructor(db: Db, embedder: VoyageEmbedder) {
    this.db = db;
    this.embedder = embedder;
    this.runningTotals = {
      totalTokens: 0,
      totalCostUsd: 0,
      totalCalls: 0,
      byOperation: {},
      startedAt: new Date(),
    };
    this.subscribe();
    console.log("  [UsageTracker] Initialized — tracking embedding token usage");
  }

  /**
   * Push context before an embedding call so we know what triggered it.
   * Always wrap in try/finally to ensure popContext() is called.
   *
   * Example:
   *   tracker.pushContext({ operation: "remember", agentId: "openclaw" });
   *   try { await embedder.embedOne(text); } finally { tracker.popContext(); }
   */
  pushContext(ctx: UsageContext): void {
    this.contextStack.push(ctx);
  }

  /** Pop the most recent context after embedding completes. */
  popContext(): void {
    this.contextStack.pop();
  }

  /** Get current in-memory running totals (fast, no DB query). */
  getRunningTotals(): RunningTotals {
    return {
      totalTokens: this.runningTotals.totalTokens,
      totalCostUsd: this.runningTotals.totalCostUsd,
      totalCalls: this.runningTotals.totalCalls,
      byOperation: { ...this.runningTotals.byOperation },
      startedAt: this.runningTotals.startedAt,
    };
  }

  /** Subscribe to embedder usage events. */
  private subscribe(): void {
    this.embedder.usageEmitter.on("usage", (event: EmbedderUsageEvent) => {
      // Peek at the current context (set by the route handler)
      const ctx = this.contextStack[this.contextStack.length - 1] || {
        operation: "unknown" as UsageOperation,
      };

      const cost = estimateCost(event.model, event.totalTokens);

      // Build document without _id — let MongoDB auto-generate ObjectId
      const doc: Omit<UsageEvent, "_id"> = {
        timestamp: new Date(),
        operation: ctx.operation,
        agentId: ctx.agentId,
        model: event.model,
        provider: event.isMock ? "mock" : "voyage",
        totalTokens: event.totalTokens,
        inputTexts: event.inputTexts,
        inputType: event.inputType,
        estimatedCostUsd: cost,
        pipelineJobId: ctx.pipelineJobId,
        pipelineStage: ctx.pipelineStage,
        memoryId: ctx.memoryId,
        isMock: event.isMock,
      };

      // Update in-memory running totals
      this.runningTotals.totalTokens += event.totalTokens;
      this.runningTotals.totalCostUsd += cost;
      this.runningTotals.totalCalls++;

      const opKey = ctx.operation;
      if (!this.runningTotals.byOperation[opKey]) {
        this.runningTotals.byOperation[opKey] = { tokens: 0, cost: 0, calls: 0 };
      }
      this.runningTotals.byOperation[opKey].tokens += event.totalTokens;
      this.runningTotals.byOperation[opKey].cost += cost;
      this.runningTotals.byOperation[opKey].calls++;

      // Fire-and-forget write to MongoDB (don't block the embedding caller)
      this.db
        .collection(COLLECTION_USAGE_EVENTS)
        .insertOne(doc)
        .catch((err) => {
          console.error("[UsageTracker] Failed to write usage event:", err);
        });
    });
  }
}
