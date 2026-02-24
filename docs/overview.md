# OpenClaw Memory — System Overview

**MongoDB-backed semantic memory for AI agents and workflows.**

OpenClaw Memory gives AI agents persistent, semantically-searchable long-term memory. Instead of losing context between sessions, agents can store facts, decisions, and preferences — then recall them weeks later through natural language queries powered by vector embeddings.

---

## How It Works

```
Agent / User                    Daemon (Express)                  Storage
    │                               │                               │
    │  POST /remember               │                               │
    │  "User prefers dark mode"     │                               │
    │──────────────────────────────>│                               │
    │                               │  Embed text (Voyage AI)       │
    │                               │  ──> 1024-dim vector          │
    │                               │                               │
    │                               │  Store doc + vector           │
    │                               │──────────────────────────────>│
    │                               │                     MongoDB   │
    │  GET /recall                  │                               │
    │  "What theme does the         │                               │
    │   user prefer?"               │                               │
    │──────────────────────────────>│                               │
    │                               │  Embed query (Voyage AI)      │
    │                               │  ──> 1024-dim vector          │
    │                               │                               │
    │                               │  Vector similarity search     │
    │                               │──────────────────────────────>│
    │                               │                               │
    │   Results ranked by           │<──────────────────────────────│
    │   semantic similarity         │                               │
    │<──────────────────────────────│                               │
    │   score: 0.91                 │                               │
```

**Remember** — Text is embedded into a 1024-dimensional vector via Voyage AI, then stored in MongoDB alongside tags, metadata, and timestamps.

**Recall** — A query is embedded the same way. The daemon finds the most semantically similar memories using either MongoDB Atlas Vector Search (production) or in-memory cosine similarity (development).

**Forget** — Memories can be deleted individually, purged by age, or cleared per agent. TTL-based auto-expiration is also supported.

---

## Architecture

The project is a pnpm monorepo with four packages plus a plugin:

```
openclaw-memory/
├── packages/
│   ├── daemon/     Express.js REST API — core memory engine
│   ├── web/        Next.js 15 dashboard with LeafyGreen UI
│   ├── client/     TypeScript SDK for programmatic access
│   └── cli/        `ocmem` command-line tool
├── plugin/         OpenClaw agent framework integration
├── docs/           Documentation
└── scripts/        Setup and management utilities
```

### Daemon (`packages/daemon`)

The heart of the system. An Express.js server that handles all memory operations.

**Startup flow:**
1. Validate config via Zod (with rich error messages if misconfigured)
2. Check port availability
3. Initialize Voyage AI embedder (real or mock mode)
4. Connect to MongoDB, ensure indexes
5. Start listening (default port 7654)

**Key files:**
- `src/server.ts` — App setup, middleware, route registration
- `src/config.ts` — Zod-validated environment configuration
- `src/embedding.ts` — Voyage AI embedder with mock mode
- `src/routes/` — 16 HTTP endpoint handlers

### Web Dashboard (`packages/web`)

A full-featured Next.js 15 application for visual memory management.

| Page | What it does |
|------|-------------|
| `/dashboard` | Overview: word cloud, semantic map, timeline, health |
| `/recall` | Semantic search with similarity scores |
| `/remember` | Store new memories with tags |
| `/browser` | Browse, filter, and export all memories |
| `/chat` | Conversational memory search |
| `/timeline` | GitHub-style activity heatmap |
| `/operations` | Bulk purge, clear, restore |
| `/health` | Service health monitoring and setup checklist |
| `/settings` | Configure daemon URL and preferences |
| `/docs` | In-app documentation |

### Client SDK (`packages/client`)

Lightweight TypeScript library for agents to call the daemon programmatically.

```typescript
import { MemoryClient } from "@openclaw-memory/client";

const memory = new MemoryClient({
  daemonUrl: "http://localhost:7654",
  agentId: "my-agent",
});

// Store a memory
await memory.remember("User prefers dark mode", {
  tags: ["preference", "ui"],
  ttl: 2592000, // 30 days
});

// Search by meaning
const results = await memory.recall("theme settings", { limit: 5 });
// => [{ text: "User prefers dark mode", score: 0.91, tags: [...] }]

// Delete a specific memory
await memory.forget(results[0].id);
```

### CLI (`packages/cli`)

The `ocmem` command-line tool for setup and management.

```bash
ocmem init          # Interactive .env.local setup
ocmem start         # Start daemon in background
ocmem status        # Check daemon health
ocmem debug         # Detailed debug info
ocmem export        # Export memories to JSON
ocmem purge         # Delete old memories
ocmem clear         # Delete all agent memories
```

**Smart port resolution** — All commands automatically discover the daemon URL. The resolution order is:

1. `MEMORY_DAEMON_URL` environment variable (explicit override)
2. `MEMORY_DAEMON_PORT` from `.env.local` in the project root
3. Fallback to `http://localhost:7654`

The project root is found by walking up from cwd, or from `~/.ocmem/config.json` (saved by `ocmem init`). This means `ocmem status` works from any directory — it reads the same port config that `ocmem start` uses.

---

## OpenClaw Integration

The plugin (`plugin/`) connects OpenClaw Memory directly into the OpenClaw agent framework, providing three integration layers:

### 1. Agent Tools

Five tools are available to agents during conversations:

| Tool | Parameters | What it does |
|------|-----------|-------------|
| **`memory_search`** | `query`, `maxResults?` (default 6) | Semantic search across stored memories. Returns ID, score, text, and tags for each result. Filters by `minScore` (default 0.5). |
| **`memory_remember`** | `text`, `tags?`, `ttl?` (default 30 days) | Store a fact, decision, or preference. Includes session metadata automatically. |
| **`memory_forget`** | `memoryId` | Delete a specific memory by ID. |
| **`memory_list`** | `tags?`, `limit?` (default 10), `sort?` | Browse memories by recency or filter by tag. Returns paginated results. |
| **`memory_status`** | _(none)_ | Check daemon health, MongoDB connection, Voyage AI status, uptime, and total memory count. |

### 2. Gateway RPC

Backend-to-backend API for programmatic access:

- `memory.remember(text, tags, ttl)` — Store memory
- `memory.recall(query, limit)` — Search memories
- `memory.forget(id)` — Delete memory
- `memory.status()` — Health check

### 3. Lifecycle Hooks

Four hooks automate memory management without explicit function calls. All hooks respect the `hooksEnabled` config flag and can be disabled per-hook or globally via the `OPENCLAW_MEMORY_HOOKS_ENABLED` environment variable.

| Hook | Event | What it does |
|------|-------|-------------|
| **auto-remember** | `message:sent` | Extracts facts, decisions, and preferences from agent responses and stores them automatically |
| **memory-bootstrap** | `agent:bootstrap` | Injects relevant memories into agent context before the conversation begins |
| **session-to-memory** | `command:new` | Summarizes the ending session and saves it as a memory for continuity |
| **memory-enriched-tools** | `tool_result_persist` | Appends related memories to tool results (e.g., file reads, searches) |

**auto-remember** uses heuristic regex patterns to extract up to 5 facts per message:
- Explicit remember: "I'll remember that...", "Note to self..."
- Preferences: "I prefer...", "I always use..."
- Decisions: "We decided to...", "Let's go with..."
- Save requests: "Save this...", "Store that..."
- Key-value pairs: `Key: value` format

Each extraction is tagged automatically (`auto-extracted`, plus `preference`/`decision`/`noted`/`user-requested` by type). Fire-and-forget — non-blocking to avoid slowing responses.

**memory-bootstrap** runs a health check first, then fires two parallel queries — general context (5 results) and pinned/important (3 results) — using a lower `minScore` of 0.3 for broader recall. It deduplicates by memory ID and generates a markdown file injected into the agent's `bootstrapFiles`:

```markdown
# Memory Context

## Pinned / Important
- Project uses TypeScript + React stack [architecture] (02/18)

## Recent Context
- User prefers dark mode [preference, ui] (02/19)
- API rate limit is 100 req/min [limits] (02/18)
```

**session-to-memory** builds a summary from conversation turns (min 2 turns, max 2000 chars) and stores it tagged `session-summary, auto` with metadata including session ID, turn count, and timestamps.

**memory-enriched-tools** is a synchronous transform that augments Read/Grep/Glob/Bash tool results. It extracts a query from the tool result (filtering noise like line numbers and decorative characters), searches for up to 3 related memories (min score 0.5), and appends them. A 3-second timeout keeps it fast.

### 4. Reliability

The plugin's daemon client (`plugin/lib/daemon-client.ts`) provides production-grade HTTP communication:

| Concern | Behavior |
|---------|----------|
| **Authentication** | `X-API-Key` header on all daemon calls when `apiKey` is configured |
| **Timeouts** | 10s default, 2s for health checks, 3s for tool-result enrichment |
| **Retries** | Exponential backoff (200ms base, max 2 retries) on 5xx and network errors. 4xx errors fail fast. |
| **Graceful shutdown** | Process listener cleanup on exit to prevent orphaned connections |
| **Project isolation** | Optional `projectId` on all operations for multi-project memory scoping |

The plugin also bridges its config to environment variables so hooks can access settings without direct config access:

| Environment Variable | Source |
|---------------------|--------|
| `OPENCLAW_MEMORY_DAEMON_URL` | `config.daemonUrl` |
| `OPENCLAW_MEMORY_AGENT_ID` | `config.agentId` |
| `OPENCLAW_MEMORY_API_KEY` | `config.apiKey` |
| `OPENCLAW_MEMORY_PROJECT_ID` | `config.projectId` |
| `OPENCLAW_MEMORY_HOOKS_ENABLED` | `config.hooksEnabled` |

### Plugin Configuration

In `~/.openclaw/openclaw.json`:

```json
{
  "plugins": {
    "entries": {
      "openclaw-memory": {
        "enabled": true,
        "config": {
          "daemonUrl": "http://localhost:7654",
          "agentId": "openclaw",
          "projectId": "my-project",
          "apiKey": "optional-secret",
          "defaultTtl": 2592000,
          "maxResults": 6,
          "minScore": 0.5,
          "autoStartDaemon": true,
          "hooksEnabled": true
        }
      }
    }
  }
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `daemonUrl` | `http://localhost:7654` | Where the memory daemon is running |
| `agentId` | `"openclaw"` | Agent identity for memory isolation |
| `projectId` | _(none)_ | Optional project scope for multi-project setups |
| `apiKey` | _(none)_ | API key if daemon authentication is enabled |
| `defaultTtl` | `2592000` (30 days) | Default time-to-live for new memories (seconds) |
| `maxResults` | `6` | Max results returned by `memory_search` |
| `minScore` | `0.5` | Minimum similarity score for search results |
| `autoStartDaemon` | `true` | Spawn daemon automatically if not running |
| `hooksEnabled` | `true` | Enable/disable all lifecycle hooks |

When `autoStartDaemon` is true, the plugin checks for the daemon package as a monorepo sibling (`../packages/daemon`) or via the `OPENCLAW_MEMORY_DAEMON_DIR` env var, spawns it detached, and waits up to 30 seconds for a health check. Logs go to `/tmp/openclaw-memory-daemon.log`.

### Plugin Public API

The plugin also exports functions for programmatic use outside of the OpenClaw hook system:

```typescript
import { recall, remember, forget, getStatus, listMemories } from "openclaw-memory/plugin";

const results = await recall("theme settings");
await remember("User prefers dark mode", ["preference", "ui"]);
await forget(results[0]._id);
const health = await getStatus();
const recent = await listMemories({ limit: 10, sort: "desc" });
```

---

## Embedding & Search

### Voyage AI

Memories are embedded using Voyage AI's `voyage-4` model (1024 dimensions by default, with 256/512/2048 options). The system uses asymmetric input types for better retrieval:

- **Storing:** `input_type="document"` — optimized for indexing
- **Searching:** `input_type="query"` — optimized for retrieval

### Search Strategies

The daemon selects the best search strategy automatically:

| Strategy | When used | Scale | Latency |
|----------|-----------|-------|---------|
| Atlas Vector Search | Vector index exists on Atlas | 10M+ memories | 10-50ms |
| In-memory cosine similarity | No vector index (local dev) | ~10K memories | 50-200ms |

### Mock Mode

Set `VOYAGE_MOCK=true` to run without a Voyage API key. Mock mode uses SHA-256 hashing to generate deterministic pseudo-random vectors. All features work — it's just not semantically meaningful. Great for development, testing, and CI.

---

## MongoDB Schema

### Memory Document

```javascript
{
  _id: ObjectId,
  agentId: "my-agent",           // Required — isolates per agent
  projectId: "optional-scope",    // Optional project grouping
  text: "User prefers dark mode", // The memory content (max 50KB)
  embedding: [0.012, -0.034, ...], // 1024-dim Voyage vector
  tags: ["preference", "ui"],     // Categorization
  metadata: { source: "chat" },   // Arbitrary JSON
  createdAt: ISODate,
  updatedAt: ISODate,
  expiresAt: ISODate              // TTL auto-deletion (optional)
}
```

### Indexes

| Index | Purpose |
|-------|---------|
| `{ agentId: 1, createdAt: -1 }` | Agent queries sorted by date |
| `{ expiresAt: 1 }` (TTL) | Auto-delete expired memories |
| `{ agentId: 1, projectId: 1, createdAt: -1 }` | Project-scoped queries |
| `{ agentId: 1, tags: 1 }` | Tag filtering |
| `{ text: "text", tags: "text" }` | Full-text search fallback |

### Atlas Vector Search Index

For production scale, create the `memory_vector_index` on Atlas:

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

Or run `pnpm --filter @openclaw-memory/daemon db:setup` to create it automatically.

---

## API Reference (Summary)

### Core Operations

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/remember` | Store a new memory |
| `GET` | `/recall` | Semantic search |
| `DELETE` | `/forget/:id` | Delete a memory |

### Bulk Operations

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/purge` | Delete memories older than a date |
| `DELETE` | `/clear` | Delete all memories for an agent |
| `GET` | `/export` | Export memories to JSON |
| `POST` | `/restore` | Import memories from JSON |

### Analytics

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/wordcloud` | Word frequency data |
| `GET` | `/embeddings` | 2D PCA projection of vectors |
| `GET` | `/timeline` | Daily memory creation counts |
| `GET` | `/memories` | List/filter memories |
| `GET` | `/sources` | Memory sources and metadata |

### Health & Discovery

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/health` | Quick health check (no auth) |
| `GET` | `/health/detailed` | Full status with services |
| `GET` | `/health/setup` | Setup checklist for dashboard |
| `GET` | `/status` | Simplified status |
| `GET` | `/agents` | List all agents with counts |

### Authentication

Optional. Set `MEMORY_API_KEY` in your environment, and all requests (except `/health`) require an `X-API-Key` header.

---

## Configuration

### Environment Variables

```bash
# Required
MONGODB_URI=mongodb://localhost:27017

# Embeddings (pick one)
VOYAGE_API_KEY=pa-xxx              # Real embeddings
VOYAGE_MOCK=true                   # OR mock mode (no key needed)

# Optional
MEMORY_DAEMON_PORT=7654            # Daemon port
MEMORY_API_KEY=secret              # API authentication
MEMORY_FILE_PATH=~/.openclaw/workspace/MEMORY.md
NEXT_PUBLIC_DAEMON_URL=http://localhost:7654
```

### Deployment Tiers

| Tier | Embeddings | Search | Scale | Best for |
|------|-----------|--------|-------|----------|
| Minimal | Mock (`VOYAGE_MOCK=true`) | In-memory | Dev/test | Local development, CI |
| Standard | Real (Voyage AI) | In-memory | ~10K memories | Small deployments |
| Production | Real (Voyage AI) | Atlas Vector Search | 10M+ memories | Enterprise scale |

---

## Testing

The project uses **vitest** for unit testing across the daemon and plugin packages.

**Plugin tests** — 99 tests across 6 test files covering:
- All 5 agent tools (search, remember, forget, list, status)
- All 4 RPC gateway methods
- All 4 lifecycle hooks (auto-remember pattern matching, session summarization, bootstrap injection, tool enrichment)
- Daemon client (retries, timeouts, auth headers, error handling)
- Plugin initialization, config bridging, and graceful shutdown

**Daemon tests** — Integration tests using `mongodb-memory-server` and `supertest` for endpoint validation.

```bash
# Run all tests
pnpm test

# Run plugin tests only
pnpm --filter openclaw-memory-plugin test

# Run daemon tests only
pnpm --filter @openclaw-memory/daemon test
```

---

## Quick Start

```bash
# Install globally
npm install -g @openclaw-memory/cli

# Initialize (interactive setup)
ocmem init

# Start the daemon
ocmem start

# Verify
ocmem status
```

Or from source:

```bash
git clone https://github.com/mrlynn/openclaw-mongodb-memory.git
cd openclaw-mongodb-memory
pnpm install && pnpm build
pnpm dev    # Starts daemon + web dashboard
```

Dashboard: http://localhost:3000
Daemon API: http://localhost:7654
