# MongoDB Schema Design

## Database: `openclaw_memory`

### Collections

#### `memories`

Core collection storing agent memories with vector embeddings.

**Fields:**

| Field       | Type         | Required | Description                                 |
| ----------- | ------------ | -------- | ------------------------------------------- |
| `_id`       | ObjectId     | yes      | Auto-generated document ID                  |
| `agentId`   | string       | yes      | Agent identifier (groups memories by agent) |
| `projectId` | string\|null |          | Project/context grouping (optional)         |
| `text`      | string       | yes      | Original memory text (max 50KB)             |
| `embedding` | number[]     | yes      | Voyage embedding (1024 dimensions)          |
| `tags`      | string[]     | yes      | Categorical labels (default: [], max 50)    |
| `metadata`  | object       | yes      | Custom fields (default: {})                 |
| `createdAt` | Date         | yes      | Creation timestamp                          |
| `updatedAt` | Date         | yes      | Last update timestamp                       |
| `expiresAt` | Date         |          | TTL deletion time (optional)                |

**Standard Indexes:**

1. `{ agentId: 1, createdAt: -1 }` — fast agent lookups
2. `{ expiresAt: 1 }` with `expireAfterSeconds: 0` — TTL auto-deletion
3. `{ agentId: 1, projectId: 1, createdAt: -1 }` — scoped queries
4. `{ agentId: 1, tags: 1 }` — tag filtering
5. `{ text: "text", tags: "text" }` — full-text search

These are created automatically on daemon startup.

---

## Atlas Vector Search Index

The daemon uses `$vectorSearch` for recall when available. Create a search index named **`memory_vector_index`** on the `memories` collection in Atlas:

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 1024,
      "similarity": "cosine"
    },
    {
      "type": "filter",
      "path": "agentId"
    },
    {
      "type": "filter",
      "path": "projectId"
    },
    {
      "type": "filter",
      "path": "tags"
    }
  ]
}
```

### Creating the index

**Via Atlas UI:**

1. Go to your cluster > Search > Create Search Index
2. Choose "JSON Editor" for the index definition
3. Select database `openclaw_memory`, collection `memories`
4. Name: `memory_vector_index`
5. Paste the JSON above

**Via `mongosh`:**

```javascript
db.memories.createSearchIndex({
  name: "memory_vector_index",
  type: "vectorSearch",
  definition: {
    fields: [
      { type: "vector", path: "embedding", numDimensions: 1024, similarity: "cosine" },
      { type: "filter", path: "agentId" },
      { type: "filter", path: "projectId" },
      { type: "filter", path: "tags" },
    ],
  },
});
```

Without this index, the daemon falls back to **in-memory cosine similarity** (capped at 10,000 docs per recall).

---

## `sessions` (Reserved)

| Field       | Type     | Required | Description             |
| ----------- | -------- | -------- | ----------------------- |
| `_id`       | ObjectId | yes      | Auto-generated          |
| `agentId`   | string   | yes      | Agent identifier        |
| `sessionId` | string   | yes      | Unique session ID       |
| `startedAt` | Date     | yes      | Session start time      |
| `expiresAt` | Date     |          | TTL deletion time       |
| `context`   | object   |          | Current session context |

---

## Size Estimates

| Scale              | Storage     |
| ------------------ | ----------- |
| 1,000 memories     | ~5-6 MB     |
| 10,000 memories    | ~50-60 MB   |
| 100,000 memories   | ~500-600 MB |
| 1,000,000 memories | ~5-6 GB     |

Per document: ~5-6 KB (4KB embedding + text + metadata).

---

## TTL

Memories with `expiresAt` are automatically deleted by MongoDB:

```typescript
await memory.remember("temporary context", { ttl: 86400 }); // 24 hours
```

---

## Scaling Path

1. **Phase 1** (current): Single collection, Atlas Vector Search with in-memory fallback
2. **Phase 2**: Collection sharding by `agentId`
3. **Phase 3**: Archival policy — move old memories to `memories_archive`
