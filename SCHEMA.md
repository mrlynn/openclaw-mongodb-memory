# MongoDB Schema Design

## Database: `openclaw_memory`

### Collections

#### `memories`

Core collection storing agent memories with vector embeddings.

**Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_id` | ObjectId | ✓ | Auto-generated document ID |
| `agentId` | string | ✓ | Agent identifier (groups memories by agent) |
| `projectId` | string\|null | | Project/context grouping (optional) |
| `text` | string | ✓ | Original memory text |
| `embedding` | number[] | ✓ | Voyage embedding (1024 dimensions) |
| `tags` | string[] | ✓ | Categorical labels (default: []) |
| `metadata` | object | ✓ | Custom fields (default: {}) |
| `createdAt` | Date | ✓ | Creation timestamp |
| `updatedAt` | Date | ✓ | Last update timestamp |
| `expiresAt` | Date | | TTL deletion time (optional) |

**Example document:**

```json
{
  "_id": ObjectId("..."),
  "agentId": "claude-session-123",
  "projectId": "vai-dashboard",
  "text": "User prefers Material UI over Tailwind for design",
  "embedding": [0.123, -0.456, 0.789, ...],
  "tags": ["user-preference", "design", "material-ui"],
  "metadata": {
    "source": "conversation",
    "confidence": 0.95
  },
  "createdAt": ISODate("2026-02-19T08:36:00Z"),
  "updatedAt": ISODate("2026-02-19T08:36:00Z"),
  "expiresAt": ISODate("2026-02-20T08:36:00Z")
}
```

**Indexes:**

1. **Composite (agentId, createdAt)** — Fast agent lookups + sorting
   ```javascript
   { agentId: 1, createdAt: -1 }
   ```

2. **TTL (expiresAt)** — Automatic deletion of expired memories
   ```javascript
   { expiresAt: 1 }, { expireAfterSeconds: 0 }
   ```

3. **Composite (agentId, projectId, createdAt)** — Scoped project queries
   ```javascript
   { agentId: 1, projectId: 1, createdAt: -1 }
   ```

4. **Composite (agentId, tags)** — Tag-based filtering
   ```javascript
   { agentId: 1, tags: 1 }
   ```

5. **Text Index** — Full-text search (optional)
   ```javascript
   { text: "text", tags: "text" }
   ```

#### `sessions` (Reserved for future use)

Stores agent session contexts and state.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_id` | ObjectId | ✓ | Auto-generated |
| `agentId` | string | ✓ | Agent identifier |
| `sessionId` | string | ✓ | Unique session ID |
| `startedAt` | Date | ✓ | Session start time |
| `expiresAt` | Date | | TTL deletion time |
| `context` | object | | Current session context |

---

## Size Estimates

**Per-document overhead:**
- `_id`: 12 bytes
- Metadata fields: ~200 bytes
- Embedding (1024 floats @ 4 bytes): ~4KB
- Text (average): ~500B-2KB
- Total: **~5-6KB per document**

**At scale:**
- 1,000 memories: ~5-6MB
- 10,000 memories: ~50-60MB
- 100,000 memories: ~500-600MB
- 1,000,000 memories: ~5-6GB

---

## Retrieval Strategy

### Current: In-Memory Cosine Similarity

For up to ~100K memories per agent:

1. Fetch all documents matching filter (agentId, projectId, tags)
2. Compute cosine similarity in-memory
3. Sort by score, return top-k

**Pros:**
- Simple, cost-effective
- No additional indexes needed
- Works with free tier MongoDB

**Cons:**
- O(n) for each recall operation
- Slow for >100K memories per query

### Future: Atlas Vector Search

For production with 1M+ memories:

1. Use MongoDB Atlas Vector Search (paid feature)
2. Create vector index on `embedding` field
3. Perform semantic search in MongoDB query

```javascript
// Example Vector Search pipeline (future)
[
  {
    $search: {
      cosmosSearch: {
        vector: queryEmbedding,
        k: 10
      },
      returnStoredSource: true
    }
  }
]
```

---

## TTL (Time-To-Live)

Memories with an `expiresAt` field are automatically deleted by MongoDB.

**Example:**
```typescript
// Remember with 24-hour TTL
await memory.remember(text, { ttl: 86400 });
// Sets expiresAt = now + 24 hours
// MongoDB deletes after that time
```

---

## Scalability Notes

1. **Shard key** (if needed): `agentId` — distributes by agent across nodes
2. **Connection pooling**: Recommended for high concurrency
3. **Batch operations**: Group multiple `/remember` calls in a single request
4. **Archive strategy**: Move old memories to a separate `memories_archive` collection

---

## Migration Path

As the system grows:

1. **Phase 1** (current): Single collection, in-memory similarity
2. **Phase 2**: Atlas Vector Search indexes for 100K+ scale
3. **Phase 3**: Collection sharding by agent
4. **Phase 4**: Archival & time-series optimization
