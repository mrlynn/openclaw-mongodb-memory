# Architecture

OpenClaw Memory is a monorepo with 4 packages that form a distributed memory system for AI agents.

## System Overview

```
┌─────────────┐     ┌──────────────────┐     ┌──────────┐
│  AI Agent   │────>│  Memory Daemon   │────>│ MongoDB  │
│  (client)   │<────│  (Express API)   │<────│          │
└─────────────┘     └──────────────────┘     └──────────┘
                           │
                    ┌──────┴──────┐
                    │  Voyage AI  │
                    │ (embeddings)│
                    └─────────────┘
```

1. **Agent** calls `/remember` to store facts, `/recall` to search by meaning
2. **Daemon** embeds text via Voyage AI (or mock), stores in MongoDB with vector
3. **Search** compares query embedding against stored vectors (cosine similarity)
4. Results ranked by semantic relevance, not keyword matching

## Package Architecture

### daemon (`packages/daemon`)

Express.js HTTP server. The core of the system.

**Key files:**

- `src/server.ts` — App setup, config loading, route registration
- `src/config.ts` — Zod-based environment validation
- `src/embedding.ts` — Voyage AI embedder (real + mock mode)
- `src/db/index.ts` — MongoDB connection management
- `src/db/schema.ts` — Collection setup and indexes
- `src/routes/` — 13 route handlers
- `src/pca.ts` — Principal Component Analysis for 2D visualization
- `src/utils/startupError.ts` — Rich boxed error messages

### web (`packages/web`)

Next.js 15 dashboard with MongoDB LeafyGreen UI components.

**Pages:**

- `/dashboard` — Word cloud, memory map, timeline, service health, stats
- `/browser` — Browse and search memories with filtering
- `/recall` — Semantic search interface
- `/remember` — Store new memories
- `/health` — Health monitoring dashboard
- `/settings` — Daemon URL configuration

### client (`packages/client`)

Lightweight TypeScript SDK for agents to interact with the daemon.

```typescript
class MemoryClient {
  remember(text: string, options?: RememberOptions): Promise<RememberResult>;
  recall(query: string, options?: RecallOptions): Promise<RecallResult[]>;
  forget(id: string): Promise<void>;
}
```

### cli (`packages/cli`)

Command-line tool (`ocmem`) for operations and debugging.

```
ocmem status    # Check daemon health
ocmem export    # Export memories
ocmem purge     # Delete old memories
ocmem clear     # Clear all memories for an agent
```

## Data Flow

### Remember (Store)

```
POST /remember { agentId, text, tags }
  → Validate request (Zod)
  → Embed text via Voyage AI → 1024-dim vector
  → Insert into MongoDB: { agentId, text, tags, embedding, createdAt, ... }
  → If TTL set: compute expiresAt, MongoDB TTL index auto-deletes
  → Return { success, id }
```

### Recall (Search)

```
GET /recall?agentId=x&query=y
  → Validate params
  → Embed query via Voyage AI → 1024-dim vector
  → Search strategy:
    A) Atlas Vector Search (if index exists) → $vectorSearch aggregation
    B) In-memory cosine similarity → fetch all vectors, compute scores, sort
  → Return top-K results with similarity scores
```

## MongoDB Schema

### memories collection

```typescript
{
  _id: ObjectId,
  agentId: string,          // Agent identifier
  projectId?: string,       // Optional project scope
  text: string,             // Memory content
  tags: string[],           // Categorization
  metadata: object,         // Arbitrary data
  embedding: number[],      // 1024-dim Voyage AI vector
  createdAt: Date,
  updatedAt: Date,
  expiresAt?: Date,         // TTL auto-deletion
  timestamp: number         // Unix ms
}
```

**Indexes:**

- `{ agentId: 1, createdAt: -1 }` — Agent queries sorted by date
- `{ agentId: 1, projectId: 1, createdAt: -1 }` — Project-scoped queries
- `{ agentId: 1, tags: 1 }` — Tag filtering
- `{ text: "text", tags: "text" }` — Full-text search fallback
- `{ expiresAt: 1 }` — TTL auto-deletion (expireAfterSeconds: 0)

**Optional Atlas Vector Search index** (`memory_vector_index`):

```json
{
  "fields": [
    { "type": "vector", "path": "embedding", "numDimensions": 1024, "similarity": "cosine" },
    { "type": "filter", "path": "agentId" },
    { "type": "filter", "path": "projectId" },
    { "type": "filter", "path": "tags" }
  ]
}
```

### sessions collection

```typescript
{
  _id: ObjectId,
  agentId: string,
  startedAt: Date,
  expiresAt?: Date
}
```

## Search Strategy

The daemon automatically selects the best search method:

1. **Atlas Vector Search** — If `memory_vector_index` exists on the collection, uses `$vectorSearch` aggregation pipeline. Scales to millions of memories with <50ms latency.

2. **In-memory cosine similarity** — Fetches all embeddings for the agent, computes cosine similarity in Node.js. Fast for <10K memories per agent, uses more memory for larger datasets.

## Embedding System

- **Model:** Voyage AI `voyage-4` (1024 dimensions default, 256/512/2048 also available)
- **Mock mode:** Deterministic SHA-256 hash mapped to 1024 floats. Same input always produces the same vector, enabling consistent testing.
- **MongoDB Atlas AI:** Same Voyage models accessed through `https://ai.mongodb.com/v1` with Atlas API keys.

## Visualization Pipeline

### Word Cloud

1. Fetch all memory texts for agent
2. Tokenize, filter stop words, normalize
3. Count word frequencies
4. Return top-N words with counts and relative frequencies

### Memory Map (PCA)

1. Fetch embedding vectors for agent
2. Apply Principal Component Analysis (PCA) to reduce 1024-dim to 2D
3. Return (x, y) coordinates for scatter plot visualization

### Timeline Heatmap

1. Aggregate memory creation dates into daily buckets
2. Return day-by-day counts over configurable window (default 90 days)
