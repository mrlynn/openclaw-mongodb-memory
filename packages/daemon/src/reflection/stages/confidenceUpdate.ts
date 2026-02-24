/**
 * Stage 5: Confidence-Update
 * 
 * Applies reinforcement/contradiction deltas to existing memories based on
 * deduplication and conflict-check results.
 */

import { Db } from "mongodb";
import { PipelineStage, PipelineContext } from "../types.js";
import { COLLECTION_MEMORIES } from "../../constants.js";
import { Memory } from "../../types/index.js";
import {
  updateConfidenceOnReinforcement,
  updateConfidenceOnStrongContradiction,
  updateConfidenceOnWeakContradiction,
} from "../../types/confidence.js";

/**
 * Confidence-Update stage — updates confidence based on evidence
 */
export class ConfidenceUpdateStage implements PipelineStage {
  name = "confidence-update";

  constructor(private db: Db) {}

  async execute(context: PipelineContext): Promise<PipelineContext> {
    const { classifiedAtoms } = context;

    if (!classifiedAtoms || classifiedAtoms.length === 0) {
      console.log(`[ConfidenceUpdate] No atoms to process`);
      context.stats.confidence_update_processed = 0;
      return context;
    }

    const collection = this.db.collection<Memory>(COLLECTION_MEMORIES);

    let reinforced = 0;
    let contradicted = 0;

    for (const atom of classifiedAtoms) {
      // Check if atom has contradictions (from conflict-check stage)
      if (atom.contradictions && atom.contradictions.length > 0) {
        // Apply contradiction penalty to conflicting memories
        for (const contradiction of atom.contradictions) {
          const targetMemory = await collection.findOne({
            _id: new (await import("mongodb")).ObjectId(contradiction.memoryId) as any,
          });

          if (targetMemory && targetMemory.confidence) {
            // Determine if strong or weak contradiction based on new atom's confidence
            const isStrong = atom.confidence && atom.confidence > 0.75;

            const newConfidence = isStrong
              ? updateConfidenceOnStrongContradiction(targetMemory.confidence)
              : updateConfidenceOnWeakContradiction(targetMemory.confidence);

            await collection.updateOne(
              { _id: targetMemory._id as any },
              {
                $set: {
                  confidence: newConfidence,
                  updatedAt: new Date(),
                },
              }
            );

            contradicted++;
          }
        }
      }

      // Check if atom reinforces existing memories (from dedup metadata)
      if (atom.metadata?.likelyDuplicateOf) {
        const targetId = atom.metadata.likelyDuplicateOf as string;
        const targetMemory = await collection.findOne({
          _id: new (await import("mongodb")).ObjectId(targetId) as any,
        });

        if (targetMemory && targetMemory.confidence) {
          const newConfidence = updateConfidenceOnReinforcement(targetMemory.confidence);

          await collection.updateOne(
            { _id: targetMemory._id as any },
            {
              $set: {
                confidence: newConfidence,
                updatedAt: new Date(),
              },
              $inc: { reinforcementCount: 1 },
            }
          );

          reinforced++;
        }
      }
    }

    context.stats.confidence_update_processed = classifiedAtoms.length;
    context.stats.confidence_update_reinforced = reinforced;
    context.stats.confidence_update_contradicted = contradicted;

    console.log(
      `[ConfidenceUpdate] Updated confidence: ` +
        `${reinforced} reinforced, ${contradicted} contradicted`
    );

    return context;
  }
}
