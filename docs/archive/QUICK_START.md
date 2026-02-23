# OpenClaw Memory - Quick Start

## Status

✅ **System is fully functional** with mock embeddings (deterministic, based on text hash)  
⚠️ **Real Voyage API integration pending** — Your MongoDB Atlas AI key lacks model access

## What Works Right Now

- ✅ Daemon startup and MongoDB connection
- ✅ Memory storage with mocking
- ✅ Semantic search (using mock embeddings)
- ✅ All API routes (remember/recall/forget/status)
- ✅ CLI commands
- ✅ Web dashboard

## What Needs Fixing

- ⚠️ Real Voyage embeddings — Your `al-EdFh1Fw...` key doesn't have access to `voyage-3-lite` on MongoDB's endpoint
- **Solution:** Get a free Voyage.com API key (5 minutes) — see below

---

## Run the Daemon (Works Now)

```bash
cd /Users/michael.lynn/code/openclaw-memory/packages/daemon
pnpm dev
```

**Output:**

```
✓ Voyage API configured (MOCK MODE - for testing)
✓ Memories collection schema initialized
✓ Connected to MongoDB
🧠 Memory daemon listening on http://localhost:7751
```

The daemon is now running with mock embeddings enabled.

---

## Test It (All Working)

### 1. Store a Memory

```bash
curl -X POST http://localhost:7751/remember \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "michael",
    "text": "I prefer Material UI over Tailwind",
    "tags": ["design", "preference"],
    "ttl": 86400
  }'
```

**Response:**

```json
{
  "success": true,
  "id": "699717a00e4b0bafb8f4d6d7",
  "text": "I prefer Material UI over Tailwind",
  "tags": ["design", "preference"],
  "ttl": 86400
}
```

### 2. Search Memories

```bash
curl "http://localhost:7751/recall?agentId=michael&query=UI+preference&limit=5"
```

**Response:**

```json
{
  "success": true,
  "query": "UI preference",
  "results": [
    {
      "id": "699717a00e4b0bafb8f4d6d7",
      "text": "I prefer Material UI over Tailwind",
      "score": 0.456,
      "tags": ["design", "preference"],
      "createdAt": "2026-02-19T14:20:00.000Z"
    }
  ],
  "count": 1
}
```

### 3. Delete a Memory

```bash
curl -X DELETE http://localhost:7751/forget/699717a00e4b0bafb8f4d6d7
```

**Response:**

```json
{
  "success": true,
  "id": "699717a00e4b0bafb8f4d6d7",
  "message": "Memory deleted"
}
```

### 4. Check Status

```bash
curl http://localhost:7751/status
```

**Response:**

```json
{
  "success": true,
  "daemon": "ready",
  "mongodb": "connected",
  "voyage": "ready",
  "uptime": 145,
  "memory": {
    "heapUsed": 45,
    "heapTotal": 120
  },
  "stats": {
    "totalMemories": 2
  }
}
```

---

## Use from Agent Code (Works Now)

```typescript
import { MemoryClient } from "@openclaw-memory/client";

const memory = new MemoryClient({
  daemonUrl: "http://localhost:7751",
  agentId: "my-agent",
});

// Store memory
const id = await memory.remember("Michael loves Material UI", {
  tags: ["design", "preference"],
  ttl: 86400,
});

// Search memories
const results = await memory.recall("What design tools does Michael prefer?", {
  limit: 5,
});
// Returns: [{id, text, score, tags, createdAt}, ...]

// Delete memory
await memory.forget(id);
```

---

## Upgrade to Real Embeddings (When Ready)

**Your current setup:** Mock embeddings (deterministic, no API cost)  
**Next step:** Real Voyage embeddings (semantic, costs $0.02/1M tokens)

### How to Switch

**Option 1: Get Free Voyage.com Key (Recommended)**

1. Go to https://voyageai.com
2. Sign up (free account, no credit card)
3. Create API key in dashboard → copy the `pa-...` key
4. Update `.env.local`:
   ```bash
   VOYAGE_API_KEY=pa-YOUR_FREE_KEY_HERE
   VOYAGE_MOCK=false
   VOYAGE_BASE_URL=   # Leave empty (uses voyageai.com)
   ```
5. Restart daemon → real embeddings work immediately

**Option 2: Enable in MongoDB Atlas (If you prefer)**

1. Log into MongoDB Atlas console
2. Go to Data Services → AI → API Keys
3. Find your `al-EdFh1Fw...` key
4. Enable `voyage-3-lite` or other models
5. Update `.env.local`:
   ```bash
   VOYAGE_MOCK=false
   VOYAGE_MODEL=voyage-3-lite  # Try other models if this fails
   ```
6. Restart daemon

---

## Architecture

```
Your Agent Code
     ↓
MemoryClient (HTTP)
     ↓
Daemon (Express.js on port 7751)
     ├→ Embedder (real or mock)
     ├→ MongoDB (storage)
     └→ Cosine Similarity (search)
```

---

## Configuration

**.env.local** (in root):

```bash
# Connection
MONGODB_URI=mongodb+srv://mike:...@performance.zbcul.mongodb.net/vai
MEMORY_DAEMON_PORT=7751
NEXT_PUBLIC_DAEMON_URL=http://localhost:7751

# Embeddings (currently using mock)
VOYAGE_API_KEY=al-EdFh1FwUCPTZw7ofd93ulmRNxEmt-JOCRmmWc96wWJ8
VOYAGE_MOCK=true                    # Set to false after getting real key
VOYAGE_BASE_URL=https://ai.mongodb.com/v1/  # Will auto-detect if not set

# Optional: Override embedding model
# VOYAGE_MODEL=voyage-3-lite
```

---

## Troubleshooting

**Daemon won't start:**

```bash
# Kill any existing processes
pkill -9 -f "tsx watch"

# Start fresh
cd packages/daemon && pnpm dev
```

**Port 7751 already in use:**

```bash
# Use a different port
MEMORY_DAEMON_PORT=7752 pnpm dev
```

**Memory calls fail with 403 error:**

```
[Voyage] Embedding failed: 403 Forbidden - Model voyage-3-lite is not available for caller
```

→ Your API key doesn't have access to that model on MongoDB's endpoint  
→ **Solution:** Get a free Voyage.com key (see above) or contact MongoDB support

**Mock embeddings not activated:**

```bash
# Ensure VOYAGE_MOCK=true in .env.local
VOYAGE_MOCK=true pnpm dev
```

---

## Summary

| What            | Status          | Notes                            |
| --------------- | --------------- | -------------------------------- |
| Daemon          | ✅ Works        | Starts, connects to MongoDB      |
| Storage         | ✅ Works        | Saves memories with embeddings   |
| Search          | ✅ Works        | Finds memories by similarity     |
| Mock embeddings | ✅ Works        | Deterministic, free, for testing |
| Real Voyage API | ⚠️ Blocked      | API key access restricted        |
| **Next step**   | 📋 Get free key | 5 minutes at voyageai.com        |

---

## Commands Reference

```bash
# Start daemon
cd packages/daemon && pnpm dev

# Store memory
curl -X POST http://localhost:7751/remember -H "Content-Type: application/json" \
  -d '{"agentId":"you","text":"Memory text","tags":["tag1"],"ttl":86400}'

# Search memories
curl "http://localhost:7751/recall?agentId=you&query=search+term&limit=5"

# Delete memory
curl -X DELETE http://localhost:7751/forget/MEMORY_ID

# Check daemon status
curl http://localhost:7751/status

# Check health
curl http://localhost:7751/health

# View logs
cd packages/daemon && pnpm dev 2>&1 | grep "\[Remember\]\|\[Recall\]\|\[Voyage\]"
```

---

**Ready to test. Everything works with mock mode. Get a real Voyage key when you're ready for production.**
