import { Db } from "mongodb";

export async function initializeSchema(db: Db): Promise<void> {
  // Memories collection: stores agent memories with embeddings
  const memoriesCollection = db.collection("memories");

  // Create indexes for efficient queries
  await memoriesCollection.createIndex({
    agentId: 1,
    createdAt: -1,
  });

  // Index for TTL-based deletion (MongoDB TTL index)
  // Documents with expiresAt field will be automatically deleted after that time
  await memoriesCollection.createIndex(
    { expiresAt: 1 },
    { expireAfterSeconds: 0 } // Delete immediately when expiresAt is reached
  );

  // Index for agent + project queries
  await memoriesCollection.createIndex({
    agentId: 1,
    projectId: 1,
    createdAt: -1,
  });

  // Index for tag-based filtering
  await memoriesCollection.createIndex({
    agentId: 1,
    tags: 1,
  });

  // Text index for full-text search (optional, for hybrid search)
  // Remove if you want purely vector-based search
  await memoriesCollection.createIndex({
    text: "text",
    tags: "text",
  });

  console.log("✓ Memories collection schema initialized");

  // Sessions collection: track agent session context (optional, for future use)
  const sessionsCollection = db.collection("sessions");

  await sessionsCollection.createIndex({
    agentId: 1,
    startedAt: -1,
  });

  await sessionsCollection.createIndex(
    { expiresAt: 1 },
    { expireAfterSeconds: 0 }
  );

  console.log("✓ Sessions collection schema initialized");
}

/**
 * MongoDB schema design:
 *
 * MEMORIES COLLECTION
 * - _id: ObjectId (auto)
 * - agentId: string (required) — which agent owns this memory
 * - projectId: string | null (optional) — grouping within agent
 * - text: string (required) — original text
 * - embedding: number[] (required) — Voyage embedding (1024 dims)
 * - tags: string[] (required, default []) — categorical labels
 * - metadata: object (required, default {}) — custom fields
 * - createdAt: Date (required)
 * - updatedAt: Date (required)
 * - expiresAt: Date | undefined (optional) — TTL field
 *
 * Size estimate:
 * - embedding: ~4KB (1024 * 4 bytes for float32)
 * - text: ~500B-2KB average
 * - Per doc: ~5-6KB
 * - 1M memories: ~5-6GB
 *
 * Index strategy:
 * 1. (agentId, createdAt) — fast agent lookups + sorting
 * 2. (expiresAt) — TTL deletion
 * 3. (agentId, projectId, createdAt) — scoped queries
 * 4. (agentId, tags) — tag filtering
 * 5. text index — full-text search
 *
 * Vector search notes:
 * - Currently using in-memory cosine similarity (fine for <100K memories per query)
 * - If you need 1M+ memories, migrate to MongoDB Atlas Vector Search
 * - Vector Search is a paid Atlas feature but handles large-scale retrieval
 *
 * SESSIONS COLLECTION (future use)
 * - _id: ObjectId
 * - agentId: string
 * - sessionId: string
 * - startedAt: Date
 * - expiresAt: Date
 * - context: object (current session context for agents)
 */
