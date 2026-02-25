/**
 * Global Deduplicate Stage
 *
 * Cleans up exact duplicate memories across the entire database.
 * Keeps the oldest copy, merges tags from duplicates, removes the rest.
 *
 * This is different from the regular DeduplicateStage which handles
 * near-duplicates during extraction. This stage removes exact text matches.
 */

import { Db, ObjectId } from "mongodb";
import { PipelineStage, PipelineContext } from "../types.js";
import { COLLECTION_MEMORIES } from "../../constants.js";

/**
 * Global deduplication stage — removes exact duplicates
 */
export class GlobalDeduplicateStage implements PipelineStage {
  name = "global-deduplicate";

  constructor(private db: Db) {}

  async execute(context: PipelineContext): Promise<PipelineContext> {
    const { agentId } = context;
    const collection = this.db.collection(COLLECTION_MEMORIES);

    console.log(`[GlobalDeduplicate] Starting database-wide deduplication for agent: ${agentId}`);

    // Find all memories grouped by (agentId, text)
    const duplicates = await collection
      .aggregate([
        { $match: { agentId } },
        {
          $group: {
            _id: { agentId: "$agentId", text: "$text" },
            memories: {
              $push: {
                id: "$_id",
                createdAt: "$createdAt",
                tags: "$tags",
                confidence: "$confidence",
                strength: "$strength",
              },
            },
            count: { $sum: 1 },
          },
        },
        { $match: { count: { $gt: 1 } } },
      ])
      .toArray();

    if (duplicates.length === 0) {
      console.log(`[GlobalDeduplicate] No duplicates found for agent: ${agentId}`);
      context.stats.global_deduplicate_processed = 0;
      context.stats.global_deduplicate_removed = 0;
      return context;
    }

    let removedCount = 0;
    let groupsProcessed = 0;

    for (const group of duplicates) {
      const memories = group.memories as Array<{
        id: ObjectId;
        createdAt: Date;
        tags: string[];
        confidence?: number;
        strength?: number;
      }>;

      // Sort by createdAt (oldest first) - keep the oldest
      memories.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      const keepMemory = memories[0];
      const removeMemories = memories.slice(1);

      // Merge all tags from duplicates
      const allTags = new Set<string>();
      memories.forEach((m) => (m.tags || []).forEach((tag) => allTags.add(tag)));

      // Update the kept memory with merged tags
      await collection.updateOne(
        { _id: keepMemory.id },
        {
          $set: {
            tags: Array.from(allTags),
            updatedAt: new Date(),
          },
        },
      );

      // Remove the duplicates
      const idsToRemove = removeMemories.map((m) => m.id);
      await collection.deleteMany({ _id: { $in: idsToRemove } });

      removedCount += idsToRemove.length;
      groupsProcessed++;

      console.log(
        `[GlobalDeduplicate] Merged ${memories.length} duplicates, kept oldest (${keepMemory.id})`,
      );
    }

    context.stats.global_deduplicate_processed = duplicates.length;
    context.stats.global_deduplicate_removed = removedCount;
    context.stats.global_deduplicate_groups = groupsProcessed;

    console.log(
      `[GlobalDeduplicate] Complete: ${groupsProcessed} duplicate groups, ` +
        `${removedCount} memories removed, ${groupsProcessed} kept`,
    );

    return context;
  }
}
