# openclaw-memory

MongoDB-backed memory infrastructure for OpenClaw agents.

## Overview

A production-ready distributed memory system for AI agents, built on:
- **MongoDB** — persistent vector storage with TTL management
- **Voyage AI** — semantic embeddings (1024 dimensions)
- **Express.js** — lightweight HTTP daemon
- **Next.js + Material UI** — modern web dashboard

**Problem solved:** OpenClaw agents need persistent, searchable memory that survives across sessions and scales beyond file-based storage.

## Architecture

```
┌─────────────┐
│   Agents    │ (OpenClaw, any LLM framework)
└──────┬──────┘
       │
       │ HTTP (JSON)
       ↓
┌──────────────────────────────────────────┐
│     Memory Daemon (Express.js)           │
│  - /remember   (store + embed)           │
│  - /recall     (vector search)           │
│  - /forget     (delete)                  │
│  - /status     (health check)            │
└──────┬─────────────────────────────────┬─┘
       │                                 │
       │ Voyage API                      │ MongoDB Atlas
       ↓                                 ↓
    embeddings(text)          db.memories.find({...})
                             + TTL indexes + tagging
```

## Packages

- **daemon** — Long-running HTTP server (port 7654)
  - Voyage embedding integration
  - MongoDB vector storage & retrieval
  - TTL-based memory expiration
  - ~5-6KB per memory

- **client** — Agent library (`@openclaw-memory/client`)
  - Simple 3-method API: `remember()`, `recall()`, `forget()`
  - Type-safe TypeScript
  - Axios-based HTTP

- **cli** — Management CLI (`ocmem`)
  - `status` — daemon health
  - `debug` — detailed diagnostics
  - `purge` — delete old memories
  - `export` — backup to JSON
  - `clear` — wipe agent memories (with confirmation)

- **web** — Next.js + Material UI dashboard
  - Remember new memories
  - Search/recall with live results
  - Daemon status monitor
  - Agent-scoped views

## Quick Start

### 1. Install & Setup

```bash
# Install dependencies (pnpm required)
pnpm install

# Create .env with your credentials
export MONGODB_URI="mongodb+srv://user:pass@cluster.mongodb.net/openclaw_memory"
export VOYAGE_API_KEY="pa-..."  # From voyageai.com
export MEMORY_DAEMON_PORT=7654
```

### 2. Start Daemon

```bash
pnpm dev -F @openclaw-memory/daemon
# → Listening on http://localhost:7654
```

### 3. Use from Agent

```typescript
import { MemoryClient } from "@openclaw-memory/client";

const memory = new MemoryClient({
  daemonUrl: "http://localhost:7654",
  agentId: "my-agent-123",
});

// Store a memory
await memory.remember("User prefers React over Vue", {
  tags: ["user-preference", "frontend"],
  ttl: 604800, // 7 days
});

// Search memories
const results = await memory.recall("What framework does the user prefer?", {
  limit: 5,
});
// → [{id, text, score, tags, createdAt}, ...]

// Delete specific memory
await memory.forget(memoryId);
```

### 4. Manage via CLI

```bash
# Check status
ocmem status --url http://localhost:7654

# See detailed info
ocmem debug --agent my-agent-123

# Delete old memories (>7 days)
ocmem purge --agent my-agent-123 --older-than-days 7

# Backup before deleting
ocmem export --agent my-agent-123 --output backup.json

# Clear everything (dangerous!)
ocmem clear --agent my-agent-123
```

### 5. Dashboard (Optional)

```bash
pnpm dev -F @openclaw-memory/web
# → http://localhost:3000
```

## Schema

**memories collection:**
- `agentId` — which agent owns this
- `projectId` — optional grouping
- `text` — original content
- `embedding` — Voyage vector (1024 dims)
- `tags` — categorical labels
- `metadata` — custom fields
- `createdAt`, `updatedAt`, `expiresAt`

**Indexes:**
- `(agentId, createdAt)` — fast agent lookups
- `(expiresAt)` — TTL auto-deletion
- `(agentId, projectId, createdAt)` — scoped queries
- `(agentId, tags)` — tag filtering
- `text` — full-text search

See [SCHEMA.md](./SCHEMA.md) for detailed migration path to Atlas Vector Search.

## Cost Estimates

- **Voyage embedding**: ~$0.02 per 1M tokens (batched)
- **MongoDB storage**: Free tier up to 512MB, then ~$0.10/GB/month
- **Daemon overhead**: Negligible (in-memory similarity for <100K memories/agent)

At scale: 1M memories ≈ 5-6GB MongoDB + ~$50 embedding credits.

## Development

```bash
# Build all packages
pnpm build

# Run tests
pnpm test

# Watch mode
pnpm dev
```

## TODO (Roadmap)

- [x] Voyage embedding integration
- [x] MongoDB schema & indexes
- [x] Daemon + routing
- [x] Agent client
- [x] CLI management
- [x] Web dashboard scaffold
- [ ] OpenClaw daemon auto-spawn integration
- [ ] Atlas Vector Search migration (1M+ scale)
- [ ] Memory analytics & retention graphs
- [ ] Multi-tenant scoping
- [ ] Webhook notifications on expiration
- [ ] Backup/restore tools

## License

MIT
