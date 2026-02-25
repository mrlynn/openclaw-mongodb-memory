import { Request, Response } from "express";
import { z } from "zod";
import { Db, ObjectId } from "mongodb";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { COLLECTION_MEMORIES } from "../constants.js";

const DeduplicateSchema = z.object({
  agentId: z.string().optional(),
  dryRun: z.boolean().optional().default(false),
});

export const deduplicateRoute = asyncHandler(async (req: Request, res: Response) => {
  const data = DeduplicateSchema.parse(req.body);
  const db: Db = req.app.locals.db;
  const collection = db.collection(COLLECTION_MEMORIES);

  const filter = data.agentId ? { agentId: data.agentId } : {};

  // Find all memories grouped by (agentId, text)
  const duplicates = await collection
    .aggregate([
      { $match: filter },
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
    res.json({
      success: true,
      message: "No duplicates found",
      duplicatesFound: 0,
      memoriesRemoved: 0,
    });
    return;
  }

  const removedIds: string[] = [];
  const mergedInfo: Array<{
    text: string;
    kept: string;
    removed: string[];
    mergedTags: string[];
  }> = [];

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

    if (!data.dryRun) {
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

      removedIds.push(...idsToRemove.map((id) => id.toString()));
    }

    mergedInfo.push({
      text: (group._id as any).text,
      kept: keepMemory.id.toString(),
      removed: removeMemories.map((m) => m.id.toString()),
      mergedTags: Array.from(allTags),
    });
  }

  res.json({
    success: true,
    message: data.dryRun
      ? `Found ${duplicates.length} duplicate groups (dry run - no changes made)`
      : `Deduplicated ${duplicates.length} groups, removed ${removedIds.length} duplicate memories`,
    duplicatesFound: duplicates.length,
    memoriesRemoved: removedIds.length,
    dryRun: data.dryRun,
    details: mergedInfo,
  });
});
