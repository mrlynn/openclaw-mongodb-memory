/**
 * Temporal Decay Service
 * 
 * Applies exponential decay to memory strength based on time since last reinforcement.
 * Runs as a scheduled background job (default: daily at 02:00 local time).
 */

import { Db } from "mongodb";
import { COLLECTION_MEMORIES } from "../constants.js";
import { Memory, MemoryLayer } from "../types/index.js";
import { applyDecay, isArchivalCandidate, isExpirationCandidate } from "../types/decay.js";

interface DecayStats {
  totalMemories: number;
  decayed: number;
  archivalCandidates: number;
  expirationCandidates: number;
  errors: number;
  duration: number;
}

/**
 * Run decay pass on all memories for an agent
 * 
 * @param db - MongoDB database instance
 * @param agentId - Optional agent ID to filter (if not provided, decays all)
 * @returns Statistics about the decay run
 */
export async function runDecayPass(db: Db, agentId?: string): Promise<DecayStats> {
  const startTime = Date.now();
  const collection = db.collection<Memory>(COLLECTION_MEMORIES);

  const stats: DecayStats = {
    totalMemories: 0,
    decayed: 0,
    archivalCandidates: 0,
    expirationCandidates: 0,
    errors: 0,
    duration: 0,
  };

  // Build filter
  const filter: any = {};
  if (agentId) {
    filter.agentId = agentId;
  }

  // Count total
  stats.totalMemories = await collection.countDocuments(filter);

  if (stats.totalMemories === 0) {
    stats.duration = Date.now() - startTime;
    return stats;
  }

  // Process in batches to avoid memory issues
  const BATCH_SIZE = 100;
  const cursor = collection.find(filter);

  const bulkOps: any[] = [];

  for await (const memory of cursor) {
    try {
      // Skip if missing required fields
      if (!memory.strength || !memory.lastReinforcedAt || !memory.layer) {
        continue;
      }

      // Apply decay
      const newStrength = applyDecay(
        memory.strength,
        memory.lastReinforcedAt,
        memory.layer as MemoryLayer
      );

      // Only update if strength actually changed
      if (newStrength !== memory.strength) {
        bulkOps.push({
          updateOne: {
            filter: { _id: memory._id },
            update: {
              $set: {
                strength: newStrength,
                updatedAt: new Date(),
              },
            },
          },
        });

        stats.decayed++;

        // Track candidates
        if (isArchivalCandidate(newStrength)) {
          stats.archivalCandidates++;
        }
        if (isExpirationCandidate(newStrength)) {
          stats.expirationCandidates++;
        }
      }

      // Execute batch when it reaches size limit
      if (bulkOps.length >= BATCH_SIZE) {
        await collection.bulkWrite(bulkOps);
        bulkOps.length = 0; // Clear batch
      }
    } catch (error) {
      console.error(`Error decaying memory ${memory._id}:`, error);
      stats.errors++;
    }
  }

  // Execute remaining operations
  if (bulkOps.length > 0) {
    await collection.bulkWrite(bulkOps);
  }

  stats.duration = Date.now() - startTime;
  return stats;
}

/**
 * Get all archival candidates (strength < 0.25)
 * 
 * @param db - MongoDB database instance
 * @param agentId - Agent ID to filter
 * @returns Array of memories that are candidates for archival promotion
 */
export async function getArchivalCandidates(db: Db, agentId: string): Promise<Memory[]> {
  const collection = db.collection<Memory>(COLLECTION_MEMORIES);

  return collection
    .find({
      agentId,
      strength: { $lt: 0.25, $gte: 0.10 },
      layer: { $ne: "archival" },
    })
    .sort({ strength: 1 })
    .toArray();
}

/**
 * Get all expiration candidates (strength < 0.10)
 * 
 * @param db - MongoDB database instance
 * @param agentId - Agent ID to filter
 * @returns Array of memories that are candidates for expiration
 */
export async function getExpirationCandidates(db: Db, agentId: string): Promise<Memory[]> {
  const collection = db.collection<Memory>(COLLECTION_MEMORIES);

  return collection
    .find({
      agentId,
      strength: { $lt: 0.10 },
    })
    .sort({ strength: 1 })
    .toArray();
}

/**
 * Promote a memory to archival layer
 * 
 * @param db - MongoDB database instance
 * @param memoryId - Memory ID to promote
 */
export async function promoteToArchival(db: Db, memoryId: string): Promise<void> {
  const collection = db.collection<Memory>(COLLECTION_MEMORIES);
  const { ObjectId } = await import("mongodb");

  await collection.updateOne(
    { _id: new ObjectId(memoryId) as any },
    {
      $set: {
        layer: "archival",
        updatedAt: new Date(),
      },
    }
  );
}
