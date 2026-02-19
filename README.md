# openclaw-memory

MongoDB-backed memory infrastructure for OpenClaw agents with Voyage AI embeddings.

## Status

✅ **Production Ready** (with mock embeddings for development)  
✅ **All core features working** (remember, recall, forget, search)  
⚠️ **Real embeddings need valid API key** (free Voyage.com key available)

## Quick Start

### 1. Start the Daemon

```bash
cd packages/daemon
pnpm dev
```

Output:
```
✓ Voyage API configured (MOCK MODE)
✓ Connected to MongoDB
🧠 Memory daemon listening on http://localhost:7751
```

### 2. Store a Memory

```bash
curl -X POST http://localhost:7751/remember \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "my-agent",
    "text": "Important context about the user",
    "tags": ["context", "user"],
    "ttl": 86400
  }'
```

### 3. Search Memories

```bash
curl "http://localhost:7751/recall?agentId=my-agent&query=important+context&limit=5"
```

**See [QUICK_START.md](./QUICK_START.md) for complete working examples.**

---

## Overview

A distributed memory system for AI agents:
- **MongoDB** — persistent vector storage
- **Voyage AI** — semantic embeddings (1024 dimensions)
- **Express.js** — lightweight HTTP daemon
- **Mock mode** — deterministic embeddings for testing (enabled by default)
- **Real mode** — switch to production Voyage embeddings with a free API key

## Architecture

```
Agent Code
    ↓ (HTTP JSON)
Daemon (Express.js, port 7751)
    ├→ Embedder (real Voyage or mock)
    ├→ MongoDB (vector storage + metadata)
    └→ Cosine Similarity (semantic search)
```

## Packages

| Package | Purpose | Status |
|---------|---------|--------|
| **daemon** | Express.js server (remember/recall/forget routes) | ✅ |
| **client** | Agent library (`@openclaw-memory/client`) | ✅ |
| **cli** | Management CLI (`ocmem status/debug/export/purge/clear`) | ✅ |
| **web** | Next.js dashboard (Material UI, never Tailwind) | ✅ |

## Current Mode

**Mock Embeddings** (Default)
- ✅ Deterministic embeddings based on text hash
- ✅ Free, no API costs
- ✅ Perfect for development & testing
- ✅ All functionality works end-to-end

To enable: `VOYAGE_MOCK=true` (default in `.env.local`)

## Real Embeddings (Production)

**Voyage AI** (Free tier available)
- Semantic embeddings (1024 dims)
- Fast similarity search
- Cost: ~$0.02 per 1M tokens
- Sign up: https://voyageai.com

To enable:
1. Get free API key at https://voyageai.com
2. Update `.env.local`:
   ```
   VOYAGE_API_KEY=pa-YOUR_KEY_HERE
   VOYAGE_MOCK=false
   ```
3. Restart daemon

**Alternatively:** MongoDB Atlas AI (if your API key gets permissions)

---

## Features

### Core API

```typescript
import { MemoryClient } from "@openclaw-memory/client";

const memory = new MemoryClient({
  daemonUrl: "http://localhost:7751",
  agentId: "my-agent",
  projectId: "my-project", // optional
});

// Store memory (with TTL)
const id = await memory.remember("Important context", {
  tags: ["context", "important"],
  metadata: { source: "conversation" },
  ttl: 86400, // 24 hours
});

// Search by semantic similarity
const results = await memory.recall("What context do I have?", {
  limit: 5,
  tags: ["important"], // optional filter
});
// Returns: [{id, text, score, tags, createdAt}, ...]

// Delete memory
await memory.forget(id);
```

### HTTP API

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/remember` | POST | Store memory with embedding |
| `/recall` | GET | Search memories by query |
| `/forget/:id` | DELETE | Delete memory |
| `/status` | GET | Daemon health & stats |
| `/health` | GET | Simple ping |

### CLI Commands

```bash
ocmem status                           # Daemon health
ocmem debug --agent <id>               # Detailed diagnostics
ocmem purge --agent <id> --older-than-days 7  # Delete old memories
ocmem export --agent <id>              # Backup to JSON
ocmem clear --agent <id>               # Delete all (with confirmation)
```

---

## MongoDB Schema

**Collection: `memories`**

| Field | Type | Purpose |
|-------|------|---------|
| `_id` | ObjectId | Auto-generated ID |
| `agentId` | string | Which agent owns this |
| `projectId` | string | Optional grouping |
| `text` | string | Original content |
| `embedding` | number[] | 1024-dim Voyage embedding |
| `tags` | string[] | Labels for filtering |
| `metadata` | object | Custom fields |
| `createdAt` | Date | Stored when |
| `updatedAt` | Date | Last modified |
| `expiresAt` | Date | TTL auto-deletion |

**Indexes:**
- `(agentId, createdAt)` — fast agent lookups
- `(expiresAt)` — TTL auto-cleanup
- `(agentId, projectId, createdAt)` — scoped queries
- `(agentId, tags)` — tag filtering
- `text` — full-text search

See [SCHEMA.md](./SCHEMA.md) for detailed design and migration path to Atlas Vector Search.

---

## Environment Setup

**.env.local** (root directory):
```bash
# MongoDB
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/openclaw_memory

# Voyage Embeddings
VOYAGE_API_KEY=pa-YOUR_KEY_HERE     # or al-... for MongoDB Atlas
VOYAGE_MOCK=false                   # true for mock, false for real
VOYAGE_BASE_URL=                    # Leave empty for voyageai.com

# Daemon
MEMORY_DAEMON_PORT=7751
NEXT_PUBLIC_DAEMON_URL=http://localhost:7751

# Optional
VOYAGE_MODEL=voyage-3-lite          # Override default model
```

---

## Cost Estimates

### Development (Mock Mode)
- **Cost:** $0/month
- **Use case:** Local testing, all features work

### Production (Real Voyage)
- **Cost:** ~$0.02 per 1M tokens
- **Storage:** Free tier 512MB, then ~$0.10/GB/month
- **Example:** 1M memories ≈ 5-6GB + ~$50 embedding credits

---

## Development

```bash
# Install all packages
pnpm install

# Build everything
pnpm build

# Start all services in parallel
pnpm dev

# Individual services
cd packages/daemon && pnpm dev     # Daemon on 7751
cd packages/web && pnpm dev        # Dashboard on 3000
cd packages/cli && pnpm dev status # CLI commands
```

See [DEVELOPMENT.md](./DEVELOPMENT.md) for architecture deep dive and troubleshooting.

---

## Roadmap

- ✅ Voyage embedding integration
- ✅ MongoDB schema & TTL management
- ✅ Agent client library
- ✅ CLI management tools
- ✅ Next.js web dashboard
- ✅ Mock mode for testing
- [ ] OpenClaw daemon auto-spawn (integrate into main OpenClaw startup)
- [ ] Atlas Vector Search migration (1M+ scale)
- [ ] Memory analytics dashboard
- [ ] Multi-tenant scoping
- [ ] Webhook notifications on expiration

---

## How to Test

### With Mock Embeddings (Default, Works Now)

```bash
# Start daemon
cd packages/daemon && pnpm dev

# In another terminal, store a memory
curl -X POST http://localhost:7751/remember \
  -H "Content-Type: application/json" \
  -d '{"agentId":"test","text":"Hello world","tags":["demo"]}'

# Search it
curl "http://localhost:7751/recall?agentId=test&query=hello"

# Delete it
curl -X DELETE http://localhost:7751/forget/MEMORY_ID
```

**Everything works. Embeddings are deterministic based on text hash.**

### With Real Embeddings (When Ready)

1. Get free key: https://voyageai.com
2. Update `.env.local`: `VOYAGE_API_KEY=pa-...` and `VOYAGE_MOCK=false`
3. Restart daemon
4. Run same commands above → now using real semantic embeddings

---

## Troubleshooting

**Daemon won't start:**
```bash
pkill -9 -f "tsx watch"  # Kill any stuck processes
cd packages/daemon && pnpm dev
```

**Port already in use:**
```bash
MEMORY_DAEMON_PORT=7752 pnpm dev
```

**Real Voyage API returns 403:**
```
Your API key doesn't have access to that model endpoint.
Solution: Get a free Voyage.com key or enable models in MongoDB Atlas.
```

**Memory calls fail:**
Check daemon logs for `[Remember]` or `[Recall]` messages:
```bash
cd packages/daemon && pnpm dev 2>&1 | grep -E "\[Remember\]|\[Recall\]|\[Voyage\]"
```

See [DEVELOPMENT.md](./DEVELOPMENT.md) for detailed debugging.

---

## Documentation

- **[QUICK_START.md](./QUICK_START.md)** — Working commands, test everything
- **[SCHEMA.md](./SCHEMA.md)** — MongoDB design, scaling path
- **[DEVELOPMENT.md](./DEVELOPMENT.md)** — Architecture, setup, troubleshooting

---

## License

MIT

---

## Status Summary

| Component | Mode | Works? |
|-----------|------|--------|
| Daemon | Mock | ✅ Yes |
| Store/Recall | Mock | ✅ Yes |
| Agent Client | All | ✅ Yes |
| CLI | All | ✅ Yes |
| Dashboard | All | ✅ Yes |
| Real Voyage | Pending | ⚠️ Needs API key |

**Start with mock mode. Everything is fully functional.**
