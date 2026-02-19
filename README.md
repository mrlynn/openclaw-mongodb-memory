# openclaw-memory

Production-grade long-term memory system for OpenClaw agents. MongoDB-backed vector storage with Voyage AI embeddings, API key auth, and Atlas Vector Search.

## Quick Start

```bash
pnpm install && pnpm build

# Start the daemon
cd packages/daemon && pnpm dev
```

```bash
# Store a memory
curl -X POST http://localhost:7751/remember \
  -H "Content-Type: application/json" \
  -d '{"agentId":"my-agent","text":"User prefers dark mode","tags":["prefs"]}'

# Recall by semantic similarity
curl "http://localhost:7751/recall?agentId=my-agent&query=user+preferences&limit=5"
```

---

## Architecture

```
Agent Code / CLI
    ↓ (HTTP + X-API-Key)
Daemon (Express.js, port 7751)
    ├→ Auth middleware (optional MEMORY_API_KEY)
    ├→ Embedder (singleton: real Voyage or mock)
    ├→ MongoDB Atlas Vector Search ($vectorSearch)
    │   └→ Fallback: in-memory cosine similarity (capped 10K docs)
    └→ CORS enabled
```

## Packages

| Package | Purpose |
|---------|---------|
| **daemon** | Express.js HTTP server — all memory operations |
| **client** | `@openclaw-memory/client` — typed SDK for agents |
| **cli** | `ocmem` — management commands (status, export, purge, clear) |
| **web** | Next.js + Material UI dashboard |

---

## Client SDK

```typescript
import { MemoryClient } from "@openclaw-memory/client";

const memory = new MemoryClient({
  daemonUrl: "http://localhost:7751",
  agentId: "my-agent",
  apiKey: "your-secret-key", // optional, if daemon has MEMORY_API_KEY set
});

// Store
const id = await memory.remember("Important context about the user", {
  tags: ["context", "user"],
  metadata: { source: "conversation" },
  ttl: 86400, // auto-expire in 24 hours
});

// Search
const results = await memory.recall("user preferences", { limit: 5 });
// [{id, text, score, tags, metadata, createdAt}, ...]

// Delete
await memory.forget(id);

// Management
const data = await memory.export();      // backup all memories
const deleted = await memory.purge(cutoffDate); // delete old memories
const count = await memory.clear();      // delete all memories for this agent
```

---

## HTTP API

All endpoints (except `/health`) require `X-API-Key` header when `MEMORY_API_KEY` is set.

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Ping (no auth) |
| `/remember` | POST | Store memory with embedding |
| `/recall` | GET | Search by semantic similarity |
| `/forget/:id` | DELETE | Delete single memory |
| `/status` | GET | Daemon health, MongoDB & Voyage status |
| `/export` | GET | Export all memories for an agent |
| `/purge` | POST | Delete memories older than date |
| `/clear` | DELETE | Delete all memories for an agent |

---

## CLI

```bash
ocmem status                                    # Daemon health
ocmem debug --agent my-agent                    # Detailed diagnostics
ocmem export --agent my-agent --output backup.json  # Backup to JSON
ocmem purge --agent my-agent --older-than-days 30   # Delete old
ocmem clear --agent my-agent                    # Delete all (confirms first)
```

All commands support `--api-key <key>` or `MEMORY_API_KEY` env var.

---

## Embedding Modes

### Mock (Default)
- Deterministic embeddings based on text hash
- Zero cost, works offline
- Set `VOYAGE_MOCK=true`

### Real (Production)
- Voyage AI semantic embeddings (1024 dims)
- ~$0.02 per 1M tokens
- Get free key at https://voyageai.com
- Set `VOYAGE_MOCK=false` and `VOYAGE_API_KEY=pa-...`

---

## Vector Search

Recall uses **MongoDB Atlas Vector Search** (`$vectorSearch` aggregation) when the index exists. Without it, falls back to in-memory cosine similarity (capped at 10K docs).

### Setup Atlas Vector Search

Create a search index named `memory_vector_index` on the `memories` collection:

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

---

## Authentication

Set `MEMORY_API_KEY` env var on the daemon to require `X-API-Key` header on all requests (except `/health`). Without it, the daemon is open.

```bash
# Daemon
MEMORY_API_KEY=my-secret-key pnpm dev

# Client
curl -H "X-API-Key: my-secret-key" http://localhost:7751/status

# CLI
ocmem status --api-key my-secret-key
# or
MEMORY_API_KEY=my-secret-key ocmem status
```

---

## Environment

Copy `.env.example` to `.env.local` and configure:

```bash
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/openclaw_memory
VOYAGE_API_KEY=pa-YOUR_KEY_HERE
VOYAGE_MOCK=true                    # false for real embeddings
MEMORY_DAEMON_PORT=7751
MEMORY_API_KEY=your-secret-key      # optional auth
NEXT_PUBLIC_DAEMON_URL=http://localhost:7751
```

---

## Development

```bash
pnpm install          # Install all workspaces
pnpm build            # Build all packages
pnpm dev              # Start all services in parallel

# Individual
cd packages/daemon && pnpm dev     # Daemon on :7751
cd packages/web && pnpm dev        # Dashboard on :3000
```

---

## Documentation

- **[QUICK_START.md](./QUICK_START.md)** — Step-by-step setup
- **[SCHEMA.md](./SCHEMA.md)** — MongoDB schema & scaling
- **[DEVELOPMENT.md](./DEVELOPMENT.md)** — Architecture & troubleshooting

## License

MIT
