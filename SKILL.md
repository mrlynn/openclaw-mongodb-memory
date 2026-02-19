# OpenClaw Memory Skill

**Type:** Infrastructure & Agent Integration  
**Status:** Production Ready  
**Last Updated:** 2026-02-19  
**Maintainer:** Michael Lynn

---

## Overview

This skill provides a MongoDB-backed memory system for OpenClaw agents with Voyage AI semantic embeddings.

**What it does:**
- Agents store memories with semantic embeddings
- Query by meaning (not keywords) using cosine similarity
- Automatic TTL-based cleanup
- MongoDB persistent storage
- Works with mock (testing) or real Voyage embeddings

**Who uses it:**
- OpenClaw agents needing persistent, searchable memory
- Any agent that wants to remember context across sessions
- Applications requiring semantic search over stored data

---

## Architecture

```
Agent Code
    ↓ (HTTP JSON)
Memory Daemon (Express.js)
    ├→ Embedder (mock or real Voyage)
    ├→ MongoDB (persistent vectors)
    └→ Cosine Similarity (search)
```

**Components:**
- **daemon** — Express.js HTTP server (port 7751 default)
- **client** — Agent library (`@openclaw-memory/client`)
- **cli** — Management tools (`ocmem` command)
- **web** — Next.js dashboard (port 3000)

---

## Installation

### 1. Install the Skill Package

```bash
# From OpenClaw workspace
npm install @openclaw-memory/client
```

Or use directly from source:
```bash
git clone https://github.com/yourusername/openclaw-memory.git
cd openclaw-memory
pnpm install
pnpm build
```

### 2. Start the Daemon

The daemon must be running for agents to store/recall memories.

**Option A: Manual (Development)**
```bash
cd packages/daemon
MEMORY_DAEMON_PORT=7751 VOYAGE_MOCK=true pnpm dev
```

**Option B: As OpenClaw Service (Production)**
*(To be integrated into OpenClaw startup)*

```bash
# Add to openclaw.yaml config
memory:
  enabled: true
  daemonPort: 7751
  mongoUri: ${MONGODB_URI}
  voyageApiKey: ${VOYAGE_API_KEY}
  mockMode: false  # Set true for testing
```

### 3. Set Environment Variables

```bash
# .env or .env.local
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/openclaw_memory
VOYAGE_API_KEY=pa-YOUR_KEY_HERE  # Get free key at https://voyageai.com
VOYAGE_MOCK=true                 # false for real embeddings
MEMORY_DAEMON_PORT=7751
```

---

## Usage

### In Agent Code

```typescript
import { MemoryClient } from "@openclaw-memory/client";

// Initialize client
const memory = new MemoryClient({
  daemonUrl: "http://localhost:7751",  // Daemon endpoint
  agentId: "my-agent-123",              // Unique agent ID
  projectId: "my-project",              // Optional grouping
});

// Store a memory
const id = await memory.remember(
  "The user prefers Material UI for design systems",
  {
    tags: ["user-preference", "design", "ui"],
    metadata: { source: "conversation", confidence: 0.95 },
    ttl: 86400,  // 24 hours
  }
);
// Returns: "699717a00e4b0bafb8f4d6d7"

// Search memories by semantic similarity
const results = await memory.recall(
  "What UI framework does the user like?",
  {
    limit: 5,
    tags: ["user-preference"],  // Optional filter
  }
);
// Returns: [
//   {
//     id: "699717a00e4b0bafb8f4d6d7",
//     text: "The user prefers Material UI for design systems",
//     score: 0.87,
//     tags: ["user-preference", "design", "ui"],
//     createdAt: "2026-02-19T14:20:00.000Z"
//   }
// ]

// Delete a memory
await memory.forget(id);
```

### With OpenClaw Session

```typescript
// In an OpenClaw agent handler
import { MemoryClient } from "@openclaw-memory/client";

export async function handleUserMessage(message: string, sessionKey: string) {
  const memory = new MemoryClient({
    daemonUrl: process.env.MEMORY_DAEMON_URL || "http://localhost:7751",
    agentId: sessionKey,  // Use session as agent ID
    projectId: "openclaws-agents",
  });

  // Recall relevant context before processing
  const context = await memory.recall(message, { limit: 3 });
  
  // Build context string for LLM
  const contextStr = context
    .map((m) => `- ${m.text} (confidence: ${m.score.toFixed(2)})`)
    .join("\n");

  // Process message with context
  const response = await llm.generate({
    prompt: `Context about user:\n${contextStr}\n\nUser: ${message}`,
  });

  // Store important information from this conversation
  if (response.hasImportantInfo) {
    await memory.remember(response.importantInfo, {
      tags: ["session-memory"],
      ttl: 604800,  // 7 days
    });
  }

  return response;
}
```

---

## HTTP API

If you prefer direct HTTP calls instead of the client library:

### Store Memory
```bash
POST /remember HTTP/1.1
Host: localhost:7751
Content-Type: application/json

{
  "agentId": "my-agent",
  "text": "Memory text",
  "tags": ["tag1", "tag2"],
  "metadata": { "custom": "field" },
  "ttl": 86400
}
```

**Response:**
```json
{
  "success": true,
  "id": "699717a00e4b0bafb8f4d6d7",
  "text": "Memory text",
  "tags": ["tag1", "tag2"],
  "ttl": 86400
}
```

### Recall Memory
```bash
GET /recall?agentId=my-agent&query=search+term&limit=5 HTTP/1.1
Host: localhost:7751
```

**Response:**
```json
{
  "success": true,
  "query": "search term",
  "results": [
    {
      "id": "699717a00e4b0bafb8f4d6d7",
      "text": "Memory text",
      "score": 0.87,
      "tags": ["tag1", "tag2"],
      "createdAt": "2026-02-19T14:20:00.000Z"
    }
  ],
  "count": 1
}
```

### Delete Memory
```bash
DELETE /forget/699717a00e4b0bafb8f4d6d7 HTTP/1.1
Host: localhost:7751
```

**Response:**
```json
{
  "success": true,
  "id": "699717a00e4b0bafb8f4d6d7",
  "message": "Memory deleted"
}
```

### Check Status
```bash
GET /health HTTP/1.1
Host: localhost:7751
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-02-19T14:20:00.000Z"
}
```

---

## CLI Management

The `ocmem` CLI tool is included for operational management:

```bash
# Check daemon status
ocmem status --url http://localhost:7751

# Detailed diagnostics
ocmem debug --agent my-agent

# Delete memories older than 7 days
ocmem purge --agent my-agent --older-than-days 7

# Backup all memories to JSON
ocmem export --agent my-agent --output backup.json

# Delete all memories for an agent (with confirmation)
ocmem clear --agent my-agent
```

---

## Configuration

### Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `MONGODB_URI` | Yes | - | MongoDB connection string |
| `VOYAGE_API_KEY` | Yes | - | Voyage AI API key |
| `MEMORY_DAEMON_PORT` | No | 7751 | Daemon HTTP port |
| `VOYAGE_MOCK` | No | true | Use mock embeddings (no API cost) |
| `VOYAGE_BASE_URL` | No | api.voyageai.com | Voyage endpoint |
| `VOYAGE_MODEL` | No | auto-detected | Override embedding model |
| `NEXT_PUBLIC_DAEMON_URL` | No | http://localhost:7751 | Dashboard daemon URL |

### Mock vs Real Embeddings

**Mock Mode (Default)**
- Cost: $0
- Embeddings: Deterministic hash-based (same input = same vector)
- Use case: Development, testing, demos
- Enable: `VOYAGE_MOCK=true`

**Real Mode (Production)**
- Cost: ~$0.02 per 1M tokens
- Embeddings: Actual Voyage AI semantic vectors
- Use case: Production applications
- Enable: 
  1. Get free API key at https://voyageai.com
  2. Set `VOYAGE_API_KEY=pa-...`
  3. Set `VOYAGE_MOCK=false`

---

## Features

### Semantic Search
Queries work by meaning, not keywords:

```typescript
// These all find the same memory
await memory.recall("Material UI framework");
await memory.recall("What design systems do you like?");
await memory.recall("MUI or Tailwind?");
// All return: "The user prefers Material UI for design systems"
```

### TTL & Auto-Cleanup
Memories automatically expire after the specified time:

```typescript
await memory.remember("Temporary context", {
  ttl: 3600,  // 1 hour
});
// Memory is automatically deleted after 1 hour
```

### Tagging & Filtering
Organize memories with tags:

```typescript
// Store with tags
await memory.remember("Important info", {
  tags: ["important", "user-preference", "design"],
});

// Filter by tags
const results = await memory.recall(query, {
  tags: ["important"],  // Only return memories tagged as "important"
});
```

### Metadata
Store custom data with each memory:

```typescript
await memory.remember("User preference", {
  metadata: {
    source: "conversation",
    confidence: 0.95,
    conversationId: "conv-123",
    userId: "user-456",
  },
});
```

### Multi-Agent
Each agent has isolated memory:

```typescript
const agentA = new MemoryClient({ agentId: "agent-a" });
const agentB = new MemoryClient({ agentId: "agent-b" });

// Agents don't see each other's memories
await agentA.remember("Agent A memory");
const resultsB = await agentB.recall("memory");
// resultsB is empty
```

---

## Scaling

### Current (In-Memory Search)
- Efficient up to ~100K memories per agent
- No additional cost
- Fine for most use cases

### Future (Atlas Vector Search)
- For 1M+ memories per agent
- Paid MongoDB Atlas feature
- ~1-line code change to enable
- See [SCHEMA.md](./SCHEMA.md) for migration path

---

## Troubleshooting

### Daemon won't start
```bash
# Check if port is in use
lsof -i :7751

# Kill existing process
pkill -9 -f "tsx watch"

# Try different port
MEMORY_DAEMON_PORT=7752 pnpm dev
```

### Real Voyage API returns 403
```
Error: Voyage API error: 403 Forbidden - Model voyage-3-lite is not available
```

**Cause:** Your API key doesn't have access to that model  
**Solution:** 
1. Get free Voyage.com key (recommended)
2. Or request model access in your API key settings
3. Or use mock mode: `VOYAGE_MOCK=true`

### Memories not persisting
- Check MongoDB connection: `MONGODB_URI` is correct
- Check MongoDB is running and accessible
- Check network connectivity to MongoDB Atlas (if cloud)

### Slow recall queries
- More than 100K memories per agent? → Consider Atlas Vector Search
- Network latency? → Run daemon on same network
- MongoDB query slow? → Check indexes are created (automatic on startup)

---

## Testing

### Unit Tests
```bash
cd packages/client
pnpm test
```

### Integration Tests
```bash
# Start daemon
cd packages/daemon && pnpm dev &

# Run integration tests
npm run test:integration
```

### Manual Testing
```bash
# Store memory
curl -X POST http://localhost:7751/remember \
  -H "Content-Type: application/json" \
  -d '{"agentId":"test","text":"Test memory","tags":["test"]}'

# Search
curl "http://localhost:7751/recall?agentId=test&query=memory"

# Check status
curl http://localhost:7751/status
```

---

## Development

### Project Structure
```
openclaw-memory/
├── packages/
│   ├── daemon/        # Express.js server
│   ├── client/        # Agent library (npm package)
│   ├── cli/          # Management CLI
│   └── web/          # Next.js dashboard
├── QUICK_START.md    # Getting started guide
├── SCHEMA.md         # MongoDB design
├── DEVELOPMENT.md    # Architecture deep dive
└── VERIFIED.md       # Test results
```

### Build
```bash
pnpm install
pnpm build
```

### Watch Mode
```bash
pnpm dev  # All packages in watch mode
```

---

## Integration Checklist

For OpenClaw maintainers integrating this as a core skill:

- [ ] Review [QUICK_START.md](./QUICK_START.md) — understand the system
- [ ] Test with mock embeddings first (`VOYAGE_MOCK=true`)
- [ ] Add `@openclaw-memory/client` to OpenClaw dependencies
- [ ] Create OpenClaw config option for memory (enable/disable)
- [ ] Auto-spawn daemon on OpenClaw startup
- [ ] Add memory client initialization to agent context
- [ ] Document usage in OpenClaw agent guide
- [ ] Add cost tracking for real Voyage embeddings
- [ ] Set up monitoring/alerting for daemon health
- [ ] Create upgrade guide for switching mock → real

---

## Support & Documentation

| Document | Purpose |
|----------|---------|
| [QUICK_START.md](./QUICK_START.md) | Working commands, setup guide |
| [README.md](./README.md) | Feature overview, architecture |
| [SCHEMA.md](./SCHEMA.md) | MongoDB design, scaling path |
| [DEVELOPMENT.md](./DEVELOPMENT.md) | Architecture, troubleshooting |
| [VERIFIED.md](./VERIFIED.md) | Test results, verified working |

---

## License

MIT

---

## Authors

- **Michael Lynn** — Design, implementation, integration

---

**Ready to integrate. All documentation provided. System tested and verified working.**
