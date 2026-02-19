import { Db } from "mongodb";
import { COLLECTION_MEMORIES, COLLECTION_SESSIONS } from "../constants";

export async function initializeSchema(db: Db): Promise<void> {
  const memoriesCollection = db.collection(COLLECTION_MEMORIES);

  // Standard indexes
  await memoriesCollection.createIndex({ agentId: 1, createdAt: -1 });
  await memoriesCollection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await memoriesCollection.createIndex({ agentId: 1, projectId: 1, createdAt: -1 });
  await memoriesCollection.createIndex({ agentId: 1, tags: 1 });
  await memoriesCollection.createIndex({ text: "text", tags: "text" });

  console.log("✓ Memories collection schema initialized");

  // Sessions collection (future use)
  const sessionsCollection = db.collection(COLLECTION_SESSIONS);
  await sessionsCollection.createIndex({ agentId: 1, startedAt: -1 });
  await sessionsCollection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

  console.log("✓ Sessions collection schema initialized");
}

/**
 * Atlas Vector Search index setup:
 *
 * Create index named "memory_vector_index" on the memories collection.
 * JSON definition for Atlas UI or CLI:
 *
 * {
 *   "fields": [
 *     { "type": "vector", "path": "embedding", "numDimensions": 1024, "similarity": "cosine" },
 *     { "type": "filter", "path": "agentId" },
 *     { "type": "filter", "path": "projectId" },
 *     { "type": "filter", "path": "tags" }
 *   ]
 * }
 *
 * Without this index the daemon falls back to in-memory cosine similarity
 * (capped at 10K docs per recall).
 */
