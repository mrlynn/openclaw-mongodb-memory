/**
 * Stage 10: Graph-Apply
 *
 * Auto-applies pending edges created by GraphLink (Stage 8) and
 * EntityUpdate (Stage 9) to actual memory documents.
 *
 * Without this stage, edges sit in `pending_edges` forever and the
 * graph visualization shows zero connections.
 *
 * Only applies edges above a minimum probability threshold (default 0.5).
 * Lower-probability edges remain pending for manual review.
 */

import { Db, ObjectId } from "mongodb";
import { PipelineStage, PipelineContext } from "../types.js";
import { COLLECTION_MEMORIES } from "../../constants.js";
import { GraphEdge } from "../../types/index.js";

const COLLECTION_PENDING_EDGES = "pending_edges";

/**
 * Minimum probability for auto-approval.
 * Edges below this threshold stay pending for manual review.
 */
const AUTO_APPROVE_MIN_PROBABILITY = 0.5;

interface PendingEdge {
  _id: any;
  sourceId: string;
  targetId: string;
  edgeType: string;
  weight: number;
  probability: number;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

export class GraphApplyStage implements PipelineStage {
  name = "graph-apply";

  constructor(private db: Db) {}

  async execute(context: PipelineContext): Promise<PipelineContext> {
    const pendingCollection = this.db.collection<PendingEdge>(COLLECTION_PENDING_EDGES);
    const memoriesCollection = this.db.collection(COLLECTION_MEMORIES);

    // Find all pending edges above the auto-approve threshold
    const pendingEdges = await pendingCollection
      .find({ probability: { $gte: AUTO_APPROVE_MIN_PROBABILITY } })
      .sort({ probability: -1 })
      .toArray();

    if (pendingEdges.length === 0) {
      console.log(`[GraphApply] No pending edges to apply`);
      context.stats["graph-apply_processed"] = 0;
      context.stats["graph-apply_applied"] = 0;
      context.stats["graph-apply_skipped"] = 0;
      return context;
    }

    let applied = 0;
    let skipped = 0;

    for (const pending of pendingEdges) {
      try {
        // Verify source memory exists
        const sourceExists = await memoriesCollection.findOne(
          { _id: new ObjectId(pending.sourceId) as any },
          { projection: { _id: 1 } },
        );

        if (!sourceExists) {
          // Source deleted — remove orphaned pending edge
          await pendingCollection.deleteOne({ _id: pending._id });
          skipped++;
          continue;
        }

        // Build edge object
        const edge: GraphEdge = {
          type: pending.edgeType as GraphEdge["type"],
          targetId: pending.targetId,
          weight: pending.weight,
          createdAt: new Date(),
          metadata: pending.metadata,
        };

        // Apply to source memory
        await memoriesCollection.updateOne(
          { _id: new ObjectId(pending.sourceId) as any },
          {
            $push: { edges: edge as any },
            $set: { updatedAt: new Date() },
          },
        );

        // Bidirectional edges: CO_OCCURS, CONTRADICTS get a reverse edge too
        if (pending.edgeType === "CO_OCCURS" || pending.edgeType === "CONTRADICTS") {
          const targetExists = await memoriesCollection.findOne(
            { _id: new ObjectId(pending.targetId) as any },
            { projection: { _id: 1 } },
          );

          if (targetExists) {
            const reverseEdge: GraphEdge = {
              type: pending.edgeType as GraphEdge["type"],
              targetId: pending.sourceId,
              weight: pending.weight,
              createdAt: new Date(),
              metadata: pending.metadata,
            };

            await memoriesCollection.updateOne(
              { _id: new ObjectId(pending.targetId) as any },
              {
                $push: { edges: reverseEdge as any },
                $set: { updatedAt: new Date() },
              },
            );
          }
        }

        // Remove applied pending edge
        await pendingCollection.deleteOne({ _id: pending._id });
        applied++;
      } catch (err) {
        console.error(`[GraphApply] Failed to apply edge ${pending._id}:`, err);
        skipped++;
      }
    }

    console.log(
      `[GraphApply] Applied ${applied} edges, skipped ${skipped} (${pendingEdges.length} total)`,
    );

    context.stats["graph-apply_processed"] = pendingEdges.length;
    context.stats["graph-apply_applied"] = applied;
    context.stats["graph-apply_skipped"] = skipped;

    return context;
  }
}
