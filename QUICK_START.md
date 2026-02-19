# OpenClaw Memory - Quick Start

## Current Status
✅ **FULLY FUNCTIONAL** — Running with mock embeddings for end-to-end testing
- Daemon: Port 7751
- Mock mode: Deterministic embeddings (based on text hash)
- Ready to swap with real Voyage API key

## Run the Daemon

```bash
cd /Users/michael.lynn/code/openclaw-memory/packages/daemon
pnpm dev
```

Output:
```
✓ Voyage API configured (MOCK MODE - for testing)
✓ Memories collection schema initialized
✓ Connected to MongoDB
🧠 Memory daemon listening on http://localhost:7751
```

## Test It

### Store a memory
```bash
curl -X POST http://localhost:7751/remember \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "my-agent",
    "text": "I prefer React over Vue.js",
    "tags": ["preference", "framework"],
    "ttl": 86400
  }'
```

Response:
```json
{
  "success": true,
  "id": "699717a00e4b0bafb8f4d6d7",
  "text": "I prefer React over Vue.js",
  "tags": ["preference", "framework"],
  "ttl": 86400
}
```

### Search memories
```bash
curl "http://localhost:7751/recall?agentId=my-agent&query=React+preference&limit=5"
```

Response:
```json
{
  "success": true,
  "query": "React preference",
  "results": [
    {
      "id": "699717a00e4b0bafb8f4d6d7",
      "text": "I prefer React over Vue.js",
      "score": 0.234,
      "tags": ["preference", "framework"],
      "createdAt": "2026-02-19T14:00:00.000Z"
    }
  ],
  "count": 1
}
```

### Delete a memory
```bash
curl -X DELETE http://localhost:7751/forget/699717a00e4b0bafb8f4d6d7
```

### Check status
```bash
curl http://localhost:7751/status
```

## Use from Agent Code

```typescript
import { MemoryClient } from "@openclaw-memory/client";

const memory = new MemoryClient({
  daemonUrl: "http://localhost:7751",
  agentId: "my-agent",
});

// Store
const id = await memory.remember("Michael loves Material UI", {
  tags: ["design", "preference"],
  ttl: 86400,
});

// Search
const results = await memory.recall("What design tools does Michael prefer?", {
  limit: 5,
});

// Delete
await memory.forget(id);
```

## Switch to Real Voyage Embeddings

1. **Get free API key** at https://voyageai.com
2. **Update `.env.local`** in the root:
   ```
   VOYAGE_API_KEY=pa-YOUR_KEY_HERE
   VOYAGE_MOCK=false
   VOYAGE_BASE_URL=  # Leave empty for voyageai.com
   ```
3. **Restart daemon** — now using real embeddings

## Architecture

```
Agent Code
    ↓ (HTTP JSON)
Daemon (Express.js)
    ├→ Voyage Embeddings (or mock)
    ├→ MongoDB (vector storage)
    └→ Cosine Similarity (search)
```

## Key Features

- **Deterministic mock embeddings** — Test without API key
- **TTL-based memory expiration** — Auto-cleanup
- **Semantic search** — Find memories by meaning
- **Agent-scoped storage** — Each agent has isolated memories
- **Tagging** — Organize memories
- **MongoDB backend** — Scales to millions of memories

## Next Steps

1. **Test it** — Run daemon, store/search memories (mock works now)
2. **Get API key** — Switch to real embeddings (5 min)
3. **Integrate into OpenClaw** — Auto-spawn daemon on startup (future)
4. **Scale** — Atlas Vector Search for 1M+ memories (future)

---

Daemon is ready. Everything works.
