#!/usr/bin/env tsx
/**
 * Print database statistics.
 *
 * Usage:
 *   pnpm --filter @openclaw-memory/daemon db:status
 */

import dotenv from "dotenv";
import path from "path";
import { MongoClient } from "mongodb";
import { DB_NAME, COLLECTION_MEMORIES, COLLECTION_SESSIONS } from "../constants";

dotenv.config({ path: path.resolve(__dirname, "../../../../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

async function main() {
  const MONGO_URI = process.env.MONGODB_URI;
  if (!MONGO_URI) {
    console.error("  MONGODB_URI not set. Run: pnpm setup");
    process.exit(1);
  }

  console.log("\n  OpenClaw Memory — Database Status\n");

  const client = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 5000 });

  try {
    await client.connect();
    const db = client.db(DB_NAME);

    // Database stats
    const dbStats = await db.stats();
    console.log(`  Database:     ${DB_NAME}`);
    console.log(`  Storage:      ${(dbStats.dataSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  Collections:  ${dbStats.collections}`);

    // Memories collection
    const memories = db.collection(COLLECTION_MEMORIES);
    const totalMemories = await memories.countDocuments();
    console.log(`\n  Memories:     ${totalMemories}`);

    if (totalMemories > 0) {
      // Per-agent breakdown
      const agents = await memories
        .aggregate([
          { $group: { _id: "$agentId", count: { $sum: 1 }, latest: { $max: "$createdAt" } } },
          { $sort: { count: -1 } },
        ])
        .toArray();

      console.log(`  Agents:       ${agents.length}`);
      for (const agent of agents) {
        const latest = agent.latest ? new Date(agent.latest).toISOString().slice(0, 10) : "unknown";
        console.log(`    - ${agent._id}: ${agent.count} memories (latest: ${latest})`);
      }

      // Tag distribution
      const tagCounts = await memories
        .aggregate([
          { $unwind: "$tags" },
          { $group: { _id: "$tags", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ])
        .toArray();

      if (tagCounts.length > 0) {
        console.log(`\n  Top tags:`);
        for (const tag of tagCounts) {
          console.log(`    - ${tag._id}: ${tag.count}`);
        }
      }

      // Embedding stats
      const withEmbeddings = await memories.countDocuments({
        embedding: { $exists: true, $ne: [] },
      });
      const pct = totalMemories > 0 ? ((withEmbeddings / totalMemories) * 100).toFixed(0) : "0";
      console.log(`\n  Embeddings:   ${withEmbeddings}/${totalMemories} (${pct}%)`);
    }

    // Indexes
    const indexes = await memories.listIndexes().toArray();
    console.log(`\n  Indexes:      ${indexes.length}`);
    for (const idx of indexes) {
      console.log(`    - ${idx.name}`);
    }

    // Vector search index
    let vectorStatus = "not available (local MongoDB)";
    try {
      const searchIndexes = await memories.listSearchIndexes().toArray();
      const vectorIdx = searchIndexes.find((idx) => idx.name === "memory_vector_index");
      if (vectorIdx) {
        vectorStatus = "active";
      } else {
        vectorStatus = "not created (run db:setup for instructions)";
      }
    } catch {
      // Not Atlas — that's fine
    }
    console.log(`  Vector index: ${vectorStatus}`);

    // Sessions
    const sessions = db.collection(COLLECTION_SESSIONS);
    const sessionCount = await sessions.countDocuments();
    console.log(`\n  Sessions:     ${sessionCount}`);

    console.log("\n  Done.\n");
  } catch (err) {
    console.error("\n  Status check failed:", err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
