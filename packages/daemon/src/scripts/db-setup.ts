#!/usr/bin/env tsx
/**
 * Database setup — creates collections, indexes, and checks vector search.
 *
 * Usage:
 *   pnpm --filter @openclaw-memory/daemon db:setup
 */

import dotenv from "dotenv";
import path from "path";
import { MongoClient } from "mongodb";
import {
  DB_NAME,
  COLLECTION_MEMORIES,
  COLLECTION_SESSIONS,
  EMBEDDING_DIMENSIONS,
} from "../constants";

dotenv.config({ path: path.resolve(__dirname, "../../../../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

const VECTOR_INDEX_NAME = "memory_vector_index";

async function main() {
  const MONGO_URI = process.env.MONGODB_URI;
  if (!MONGO_URI) {
    console.error("  MONGODB_URI not set. Run: pnpm setup");
    process.exit(1);
  }

  console.log("\n  OpenClaw Memory — Database Setup\n");
  console.log(`  MongoDB URI: ${MONGO_URI.replace(/\/\/[^:]+:[^@]+@/, "//***:***@")}`);
  console.log(`  Database:    ${DB_NAME}\n`);

  const client = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 5000 });

  try {
    // 1. Connect
    await client.connect();
    console.log("  1/5  Connected to MongoDB");

    const db = client.db(DB_NAME);

    // 2. Ensure collections exist
    const existing = await db.listCollections().toArray();
    const collNames = existing.map((c) => c.name);

    for (const name of [COLLECTION_MEMORIES, COLLECTION_SESSIONS]) {
      if (collNames.includes(name)) {
        console.log(`  2/5  Collection "${name}" exists`);
      } else {
        await db.createCollection(name);
        console.log(`  2/5  Created collection "${name}"`);
      }
    }

    // 3. Create standard indexes
    const memories = db.collection(COLLECTION_MEMORIES);
    const sessions = db.collection(COLLECTION_SESSIONS);

    await memories.createIndex({ agentId: 1, createdAt: -1 });
    await memories.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    await memories.createIndex({ agentId: 1, projectId: 1, createdAt: -1 });
    await memories.createIndex({ agentId: 1, tags: 1 });
    await memories.createIndex({ text: "text", tags: "text" });
    await sessions.createIndex({ agentId: 1, startedAt: -1 });
    await sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

    console.log("  3/5  Standard indexes ensured");

    // 4. List all indexes for verification
    const indexList = await memories.listIndexes().toArray();
    console.log(`       ${indexList.length} indexes on "${COLLECTION_MEMORIES}":`);
    for (const idx of indexList) {
      const keys = Object.keys(idx.key).join(", ");
      console.log(`         - ${idx.name} (${keys})`);
    }

    // 5. Check vector search index
    let hasVectorIndex = false;
    try {
      // listSearchIndexes is only available on Atlas
      const searchIndexes = await memories.listSearchIndexes().toArray();
      hasVectorIndex = searchIndexes.some((idx) => idx.name === VECTOR_INDEX_NAME);
    } catch {
      // Not Atlas or search indexes not supported — that's fine
    }

    if (hasVectorIndex) {
      console.log(`  4/5  Vector search index "${VECTOR_INDEX_NAME}" found`);
    } else {
      console.log(`  4/5  Vector search index not found — attempting to create...`);
      try {
        await memories.createSearchIndex({
          name: VECTOR_INDEX_NAME,
          type: "vectorSearch",
          definition: {
            fields: [
              {
                type: "vector",
                path: "embedding",
                numDimensions: EMBEDDING_DIMENSIONS,
                similarity: "cosine",
              },
              { type: "filter", path: "agentId" },
              { type: "filter", path: "projectId" },
              { type: "filter", path: "tags" },
            ],
          },
        });
        console.log(`       Created "${VECTOR_INDEX_NAME}" — it may take a few minutes to build.`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("already exists")) {
          console.log(`       Index "${VECTOR_INDEX_NAME}" already exists (may be building).`);
        } else {
          console.log("       Could not create vector search index automatically.");
          console.log(`       Reason: ${msg}`);
          console.log(
            "       This is optional — the daemon falls back to in-memory cosine similarity.",
          );
          console.log(
            `       To create manually in Atlas UI, use index name "${VECTOR_INDEX_NAME}":`,
          );
          console.log("       {");
          console.log('         "fields": [');
          console.log(
            `           { "type": "vector", "path": "embedding", "numDimensions": ${EMBEDDING_DIMENSIONS}, "similarity": "cosine" },`,
          );
          console.log('           { "type": "filter", "path": "agentId" },');
          console.log('           { "type": "filter", "path": "projectId" },');
          console.log('           { "type": "filter", "path": "tags" }');
          console.log("         ]");
          console.log("       }");
        }
      }
    }

    // 5. Summary
    const memCount = await memories.countDocuments();
    console.log(`\n  5/5  Database ready — ${memCount} memories stored`);

    console.log("\n  Done.\n");
  } catch (err) {
    console.error("\n  Database setup failed:", err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
