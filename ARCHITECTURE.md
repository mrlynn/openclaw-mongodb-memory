# Architecture Overview

**OpenClaw Memory System Design**

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ OpenClaw Agent                                              │
│ ├─ memory_search(query) → semantic results                 │
│ ├─ memory_get(path) → file-based memory                    │
│ └─ Auto-save pattern (via AGENT_WORKFLOW.md)               │
└─────────────────────────────────────────────────────────────┘
                          │
                          ↓ HTTP/JSON
┌─────────────────────────────────────────────────────────────┐
│ OpenClaw Memory Plugin                                      │
│ ├─ Auto-starts daemon on gateway launch                    │
│ ├─ Provides tools (memory_search, memory_get)              │
│ ├─ Gateway RPC (memory.status, remember, recall, forget)   │
│ └─ Health monitoring & auto-restart                        │
└─────────────────────────────────────────────────────────────┘
                          │
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Memory Daemon (Express.js HTTP Server)                     │
│ Port: 7751 (default)                                        │
│ ├─ POST /remember → Store memory with embedding            │
│ ├─ GET /recall → Semantic search via cosine similarity     │
│ ├─ DELETE /forget/:id → Delete memory                      │
│ ├─ GET /status → Daemon status + MongoDB health            │
│ ├─ GET /health → Simple health check                       │
│ ├─ GET /agents → List all agent IDs with memory counts     │
│ └─ Error handling (Zod validation → 400, generic → 500)    │
└─────────────────────────────────────────────────────────────┘
           │                          │
           ↓                          ↓
┌────────────────────┐   ┌──────────────────────────────┐
│ Voyage AI          │   │ MongoDB Atlas                │
│ (or Mock)          │   │ Database: openclaw_memory    │
│                    │   │ Collection: memories         │
│ - voyage-3 model   │   │ ├─ Vector embeddings         │
│ - 1024-dim vectors │   │ ├─ Text + metadata           │
│ - ~$0.02/1M tokens │   │ ├─ TTL indexes (auto-expire) │
│ - Mock mode: free  │   │ └─ Agent isolation           │
└────────────────────┘   └──────────────────────────────┘
```

---

## Two-Tier Memory Strategy

### File-Based Memory (Tier 1)

**Location:** `~/.openclaw/workspace/MEMORY.md`, `memory/*.md`

**Purpose:**
- Curated long-term wisdom
- Human-readable, manually maintained
- Stable, permanent knowledge

**Format:** Markdown with sections
```markdown
## Section Title

Content here...

**Tags:** optional
**Timestamp:** YYYY-MM-DD HH:MM TZ
```

**Pros:**
- Version controlled (Git)
- Human-editable
- Portable (just markdown)
- No API dependencies

**Cons:**
- No semantic search
- Manual curation required
- Limited to grep/keyword search

---

### MongoDB Memory (Tier 2)

**Location:** MongoDB Atlas (`openclaw_memory` database)

**Purpose:**
- Semantic search over all memories
- Automatic management (TTL, indexing)
- Scalable to 100K+ memories

**Schema:** See [MongoDB Schema](#mongodb-schema) below

**Pros:**
- Semantic search (meaning, not keywords)
- Auto-expiration via TTL
- Scales to millions of memories
- Structured queries + filtering

**Cons:**
- Requires MongoDB Atlas (or local instance)
- API dependency (Voyage for embeddings)
- More complex setup

---

### Hydration (Bridge Between Tiers)

**Tool:** `packages/daemon/src/scripts/hydrate-memories.ts`

**Capabilities:**
- **Import:** File-based → MongoDB (for semantic search)
- **Export:** MongoDB → File-based (for curation)
- **Sync:** Bidirectional merge (deduplication)

**Use case:** Migrate historical file-based memories into MongoDB for semantic search, or export MongoDB for backup/curation.

See: [MEMORY_HYDRATION.md](./MEMORY_HYDRATION.md)

---

## Component Architecture

### 1. Plugin (`plugin/index.ts`)

**Responsibility:** OpenClaw integration

**Lifecycle:**
1. Gateway starts → Plugin loads
2. Plugin checks daemon health
3. If unhealthy → Spawns daemon process
4. Registers tools: `memory_search`, `memory_get`
5. Registers RPC: `memory.status`, `memory.remember`, etc.
6. Monitors daemon health (30s intervals)

**Key functions:**
- `startDaemonProcess()` - Spawn daemon with npm start
- `checkDaemonHealth()` - HTTP health check
- `toolMemorySearch()` - Semantic search tool
- `toolMemoryGet()` - File-based memory reader

**Configuration:**
```json
{
  "daemonUrl": "http://localhost:7751",
  "agentId": "openclaw",
  "defaultTtl": 2592000,
  "maxResults": 6,
  "minScore": 0.5,
  "autoStartDaemon": true
}
```

---

### 2. Daemon (`packages/daemon/`)

**Responsibility:** HTTP API server for memory operations

**Tech stack:**
- Express.js (HTTP server)
- MongoDB Node.js Driver
- Voyage AI SDK (or mock embeddings)
- Zod (validation)

**Key modules:**

#### `server.ts` - Entry point
- Initialize Express app
- Connect to MongoDB
- Initialize VoyageEmbedder
- Mount routes
- Start HTTP server

#### `routes/remember.ts` - Store memories
```typescript
POST /remember
Body: { agentId, text, tags?, metadata?, ttl? }
→ Generate embedding
→ Store in MongoDB
← { success: true, id, text, tags }
```

#### `routes/recall.ts` - Semantic search
```typescript
GET /recall?agentId=X&query=Y&limit=N
→ Generate query embedding
→ Fetch all memories for agentId
→ Compute cosine similarity
→ Sort by relevance
← { results: [{text, score, tags, ...}], count }
```

#### `routes/forget.ts` - Delete memory
```typescript
DELETE /forget/:id
→ Delete from MongoDB by _id
← { success: true, message }
```

#### `db/index.ts` - MongoDB connection
- Connection pooling (singleton)
- Schema initialization
- TTL index creation

#### `embedding.ts` - VoyageEmbedder class
- **Mock mode:** Deterministic text-hash embeddings (free, fast)
- **Real mode:** Voyage AI API calls (~$0.02/1M tokens)
- Cosine similarity calculation
- Batch embedding support

---

### 3. Web Dashboard (`packages/web/`)

**Responsibility:** UI for browsing, searching, managing memories

**Tech stack:**
- Next.js 15 (React framework)
- Material UI (component library)
- React Query (data fetching)

**Pages:**
- `/` - Dashboard overview
- `/remember` - Create new memory
- `/recall` - Semantic search
- `/browser` - Browse all memories (with agent filter)
- `/health` - System health monitoring
- `/settings` - Daemon URL configuration

**Key features:**
- Agent discovery (dropdown)
- RAG-style semantic search
- Relevance scores (0-1)
- Memory detail drawer
- Delete confirmation dialogs
- Dark mode support

---

### 4. CLI (`packages/cli/`)

**Responsibility:** Command-line management tools

**Commands:**
- `ocmem status` - Daemon + MongoDB health
- `ocmem debug` - Full diagnostic output
- `ocmem export` - Backup memories to JSON
- `ocmem purge` - Delete old memories (by TTL or age)
- `ocmem clear` - Delete all memories for agent

**Example:**
```bash
ocmem status
# → Daemon: ready, MongoDB: connected, Memories: 42

ocmem purge --older-than 90d
# → Deleted 15 memories older than 90 days
```

---

### 5. Client Library (`packages/client/`)

**Responsibility:** Agent integration SDK

**Usage:**
```typescript
import { MemoryClient } from '@openclaw-memory/client';

const client = new MemoryClient('http://localhost:7751', 'my-agent');

// Store memory
await client.remember({
  text: 'Important fact',
  tags: ['work', 'priority'],
});

// Search memories
const results = await client.recall('find important facts', 5);
results.forEach(m => console.log(m.text, m.score));
```

---

## MongoDB Schema

### Collection: `memories`

```typescript
interface Memory {
  _id: ObjectId;                    // MongoDB ID
  agentId: string;                  // Agent namespace (isolation)
  projectId?: string;               // Optional project grouping
  text: string;                     // Memory content (max 50K chars)
  embedding: number[];              // Vector (1024-dim for voyage-3)
  tags: string[];                   // Metadata tags (max 50)
  metadata: Record<string, unknown>; // Custom metadata
  createdAt: Date;                  // Creation timestamp
  updatedAt: Date;                  // Last update timestamp
  expiresAt?: Date;                 // Auto-delete time (TTL)
}
```

### Indexes

```javascript
// TTL index (auto-delete expired memories)
db.memories.createIndex(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);

// Agent query optimization
db.memories.createIndex({ agentId: 1, createdAt: -1 });

// Tag filtering
db.memories.createIndex({ agentId: 1, tags: 1 });

// Future: Atlas Vector Search index
// (for >10K memories, ANN search)
```

---

## Semantic Search Algorithm

**Current Implementation:** In-Memory Cosine Similarity

### Step-by-Step Process

1. **Generate Query Embedding**
   ```typescript
   const queryEmbedding = await embedder.embedOne(query, 'query');
   // → [0.123, -0.456, 0.789, ...] (1024 dimensions)
   ```

2. **Fetch All Memories for Agent**
   ```typescript
   const memories = await collection
     .find({ agentId })
     .toArray();
   ```

3. **Compute Cosine Similarity**
   ```typescript
   memories.forEach(memory => {
     memory.score = cosineSimilarity(queryEmbedding, memory.embedding);
   });
   ```

4. **Filter by Minimum Score**
   ```typescript
   const filtered = memories.filter(m => m.score >= minScore);
   ```

5. **Sort by Relevance (Descending)**
   ```typescript
   filtered.sort((a, b) => b.score - a.score);
   ```

6. **Limit Results**
   ```typescript
   const results = filtered.slice(0, limit);
   ```

### Cosine Similarity Formula

```
similarity(A, B) = (A · B) / (||A|| × ||B||)

Where:
  A · B = dot product = Σ(a_i × b_i)
  ||A|| = magnitude = sqrt(Σ(a_i²))
  ||B|| = magnitude = sqrt(Σ(b_i²))

Result: -1 to 1
  1.0 = identical vectors (same meaning)
  0.0 = orthogonal (unrelated)
 -1.0 = opposite vectors (opposite meaning)
```

### Scaling Considerations

**Current limits:**
- Works well: <10K memories per agent
- Starts slowing: 10K-100K memories
- Not feasible: >100K memories

**Solution for scale:** Atlas Vector Search
- ANN (Approximate Nearest Neighbor) index
- Sub-100ms queries even at millions of memories
- Planned for v1.1.0

---

## Plugin Integration Flow

### Gateway Start Sequence

```
1. OpenClaw Gateway starts
   ↓
2. Load plugins from ~/.openclaw/openclaw.json
   ↓
3. openclaw-memory plugin loads
   ↓
4. Plugin checks: http://localhost:7751/health
   ↓
5a. If healthy: Done ✅
   │
5b. If unhealthy: Spawn daemon
    ↓
    cd ~/code/openclaw-memory/packages/daemon
    npm start (background)
    ↓
    Wait up to 30s for health check
    ↓
    Retry health check every 500ms
    ↓
    Success ✅ or Timeout ❌
```

### Tool Invocation Flow

```
Agent calls: memory_search("find my goals")
   ↓
Plugin receives tool call
   ↓
Parse arguments (query, limit, minScore)
   ↓
HTTP GET http://localhost:7751/recall?agentId=X&query=Y
   ↓
Daemon processes (see Semantic Search above)
   ↓
Returns JSON: { results: [...], count }
   ↓
Plugin formats for agent
   ↓
Agent receives results
```

---

## Security Considerations

### Agent Isolation

**Mechanism:** `agentId` field in all queries

**Guarantee:** Agent A cannot access Agent B's memories

**Implementation:**
```typescript
// All queries filtered by agentId
collection.find({ agentId: currentAgent });
```

### Data Privacy

**MongoDB:**
- Connection string includes credentials (keep in `.env.local`)
- Use MongoDB Atlas encryption at rest
- Enable network access controls (IP whitelist)

**Voyage API:**
- API key in `.env.local` (never commit)
- Text sent to Voyage for embedding (not stored)
- Use mock mode for sensitive data: `VOYAGE_MOCK=true`

### File-Based Memory

**Location:** `~/.openclaw/workspace/`

**Protection:**
- File system permissions (user-only read/write)
- Git ignored (`.gitignore` includes `.env.local`)
- No network exposure

---

## Performance Characteristics

### Latency Benchmarks

| Operation | Latency | Notes |
|-----------|---------|-------|
| `/remember` (mock) | 50-100ms | Fast, deterministic |
| `/remember` (real Voyage) | 500-1000ms | Network RTT |
| `/recall` (100 memories) | 50-100ms | In-memory compute |
| `/recall` (10K memories) | 200-500ms | Scales linearly |
| `/forget/:id` | 10-20ms | Single MongoDB delete |
| `/health` | <10ms | No database query |

### Memory Footprint

| Component | RAM Usage | Notes |
|-----------|-----------|-------|
| Daemon (idle) | ~50MB | Node.js + Express |
| Daemon (10K memories loaded) | ~200MB | Embeddings in RAM |
| Web dashboard | ~100MB | Next.js dev server |
| MongoDB (Atlas) | N/A | Cloud-hosted |

### Storage Requirements

| Data | Size | Formula |
|------|------|---------|
| Memory text (avg) | 200 bytes | Variable (max 50KB) |
| Embedding (1024-dim) | 4KB | 1024 × 4 bytes (float32) |
| Metadata | ~100 bytes | Tags, timestamps |
| **Total per memory** | ~4.3KB | |
| **10K memories** | ~43MB | Manageable |
| **100K memories** | ~430MB | Needs optimization |

---

## Future Enhancements

### v1.1.0 (Month 3)
- Atlas Vector Search (for >10K memories)
- Memory analytics dashboard
- Export/import workflows
- Multi-language support (i18n)

### v1.2.0 (Month 4)
- Workflow marketplace
- Pre-built templates
- LangChain/LlamaIndex integration

### v2.0.0 (Month 6)
- Multi-modal memory (images, audio)
- Memory threading (conversation context)
- Collaborative memory (multi-agent)
- Memory decay (importance-weighted TTL)

---

## Development Workflow

### Local Development

```bash
# Terminal 1: Daemon (watch mode)
cd packages/daemon
pnpm dev

# Terminal 2: Web dashboard (watch mode)
cd packages/web
pnpm dev

# Terminal 3: Tests
cd packages/daemon
pnpm test --watch
```

### Building for Production

```bash
# Build all packages
pnpm build

# Or individually
cd packages/daemon && pnpm build
cd packages/web && pnpm build
```

### Testing

```bash
# Unit tests
cd packages/daemon
pnpm test

# Integration tests
./scripts/test-integration.sh

# Manual testing
curl http://localhost:7751/health
```

---

## Deployment Architecture

### Option 1: Single Machine (Development)

```
┌─────────────────────────────────┐
│ MacBook / Workstation           │
│ ├─ OpenClaw Gateway             │
│ ├─ Memory Daemon (:7751)        │
│ └─ Web Dashboard (:3000)        │
└─────────────────────────────────┘
         │
         ↓ Internet
┌─────────────────────────────────┐
│ MongoDB Atlas (Cloud)           │
│ └─ openclaw_memory DB           │
└─────────────────────────────────┘
```

### Option 2: Distributed (Production)

```
┌─────────────────────────────────┐
│ User's Machine                  │
│ └─ OpenClaw Gateway + Plugin    │
└─────────────────────────────────┘
         │
         ↓ HTTP
┌─────────────────────────────────┐
│ VPS / Cloud Server              │
│ ├─ Memory Daemon (:7751)        │
│ ├─ Web Dashboard (:3000)        │
│ └─ Nginx (reverse proxy)        │
└─────────────────────────────────┘
         │
         ↓ MongoDB Wire Protocol
┌─────────────────────────────────┐
│ MongoDB Atlas                   │
│ └─ openclaw_memory DB           │
└─────────────────────────────────┘
```

---

**Last Updated:** 2026-02-23  
**Version:** 0.1.0
