# OpenClaw Memory

**Long-term memory system for OpenClaw agents powered by MongoDB and Voyage AI embeddings.**

[![Status](https://img.shields.io/badge/status-production--ready-green)](.) 
[![Version](https://img.shields.io/badge/version-0.1.0-blue)](.)
[![License](https://img.shields.io/badge/license-MIT-blue)](.)

## What is OpenClaw Memory?

OpenClaw Memory provides persistent, semantically-searchable long-term memory for OpenClaw agents using:

- **MongoDB** for scalable storage and TTL-based auto-expiration
- **Voyage AI embeddings** for semantic similarity search
- **HTTP REST API** for easy integration
- **OpenClaw plugin** for native memory_search tool integration

## Features

✅ **Persistent Memory** - Store and recall context across sessions  
✅ **Semantic Search** - Find memories by meaning, not just keywords  
✅ **Auto-Expiration** - TTL-based cleanup of temporary context  
✅ **Tag-Based Organization** - Categorize memories for easy filtering  
✅ **Mock Embeddings** - Test without API costs (deterministic, free)  
✅ **Real Voyage Embeddings** - Production-ready semantic search  
✅ **Web Dashboard** - Browse and manage memories via UI  
✅ **CLI Tools** - Command-line memory management  
✅ **Type-Safe Client** - TypeScript library for agents  

## Quick Start

```bash
# 1. Install
cd ~/code
git clone https://github.com/YOUR_USERNAME/openclaw-memory.git
cd openclaw-memory
pnpm install

# 2. Configure
cp packages/daemon/.env.example packages/daemon/.env.local
# Edit .env.local with your MongoDB URI

# 3. Start daemon
cd packages/daemon
pnpm dev

# 4. Test
curl http://localhost:7751/health
```

**Full installation guide:** [INSTALL.md](./INSTALL.md)

## Architecture

```
┌─────────────────┐
│  OpenClaw Agent │
│  (memory_search │
│   memory_get)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────┐
│  Memory Plugin  │◄────►│ HTTP Daemon  │
│  (OpenClaw)     │      │ (port 7751)  │
└─────────────────┘      └──────┬───────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │     MongoDB Atlas     │
                    │  (memories collection │
                    │   + vector index)     │
                    └───────────────────────┘
```

## Packages

| Package | Description |
|---------|-------------|
| `@openclaw-memory/daemon` | HTTP API server (port 7751) |
| `@openclaw-memory/client` | TypeScript client library |
| `@openclaw-memory/cli` | CLI management tools (`ocmem`) |
| `@openclaw-memory/web` | Next.js web dashboard (port 3002) |
| `plugin/` | OpenClaw plugin for memory_search integration |

## Usage

### Store a Memory

```bash
curl -X POST http://localhost:7751/remember \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "openclaw",
    "text": "I prefer Material UI over Tailwind for React projects",
    "tags": ["design", "preference"],
    "ttl": 2592000
  }'
```

### Search Memories

```bash
curl "http://localhost:7751/recall?agentId=openclaw&query=UI+preference&limit=5"
```

### Via OpenClaw Agent

Once the plugin is installed, agents can use the `memory_search` tool:

```
User: Search my memory for design preferences
Agent: [calls memory_search("design preferences")]
```

## Configuration

### Environment Variables

Create `packages/daemon/.env.local`:

```bash
MONGODB_URI=mongodb+srv://USER:PASS@cluster.mongodb.net/openclaw_memory
MEMORY_DAEMON_PORT=7751
VOYAGE_API_KEY=your-key-here  # Optional: use mock mode without this
VOYAGE_MOCK=true              # Set to false for real embeddings
```

### Plugin Config

In `~/.openclaw/openclaw.json`:

```json
{
  "plugins": {
    "slots": {
      "memory": "memory-mongodb"
    },
    "entries": {
      "memory-mongodb": {
        "enabled": true,
        "config": {
          "daemonUrl": "http://localhost:7751",
          "agentId": "openclaw",
          "defaultTtl": 2592000,
          "maxResults": 6,
          "minScore": 0.5
        }
      }
    }
  }
}
```

## API Reference

### POST /remember

Store a new memory.

**Request:**
```json
{
  "agentId": "openclaw",
  "text": "Memory text here",
  "tags": ["tag1", "tag2"],
  "ttl": 86400,
  "metadata": {}
}
```

**Response:**
```json
{
  "success": true,
  "id": "699ad0edbe622406688426d0",
  "text": "Memory text here",
  "tags": ["tag1", "tag2"],
  "ttl": 86400
}
```

### GET /recall

Search memories by semantic similarity.

**Query params:**
- `agentId` (required) - Agent identifier
- `query` (required) - Search query
- `limit` (optional) - Max results (default: 6)
- `projectId` (optional) - Filter by project
- `tags` (optional) - Filter by tags (comma-separated)

**Response:**
```json
{
  "success": true,
  "query": "design preferences",
  "results": [
    {
      "id": "...",
      "text": "I prefer Material UI over Tailwind",
      "score": 0.89,
      "tags": ["design", "preference"],
      "metadata": {},
      "createdAt": "2026-02-19T14:21:07.414Z"
    }
  ],
  "count": 1
}
```

### DELETE /forget/:id

Delete a memory by ID.

### GET /status

Daemon health and stats.

### GET /export

Export all memories for an agent (backup).

## Documentation

- **[INSTALL.md](./INSTALL.md)** - Complete installation guide
- **[FOR_ENGINEERS.md](./FOR_ENGINEERS.md)** - Code architecture and integration patterns
- **[SCHEMA.md](./SCHEMA.md)** - MongoDB schema and indexes
- **[SKILL.md](./SKILL.md)** - OpenClaw skill documentation
- **[VERIFIED.md](./VERIFIED.md)** - Tested and verified features

## Cost Estimates

**Mock embeddings (testing):**
- $0 (deterministic text-hash, no API calls)

**Real Voyage embeddings (production):**
- ~$0.02 per 1M embedding tokens
- Example: 10,000 memories ≈ $0.20

**MongoDB storage:**
- Free tier: 512 MB (enough for ~100K memories)
- ~5-6 KB per memory (text + embedding + metadata)

## Production Deployment

### MongoDB Atlas Vector Search Index

For production-scale recall (>10K memories/agent):

1. Atlas → Search → Create Search Index
2. Database: `openclaw_memory`, Collection: `memories`
3. Name: `memory_vector_index`
4. Definition:

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 1024,
      "similarity": "cosine"
    },
    {"type": "filter", "path": "agentId"},
    {"type": "filter", "path": "projectId"},
    {"type": "filter", "path": "tags"}
  ]
}
```

### Run as Service

**PM2:**
```bash
pm2 start packages/daemon/dist/index.js --name openclaw-memory
pm2 save && pm2 startup
```

**systemd:**
See [INSTALL.md](./INSTALL.md#production-deployment) for full systemd configuration.

## Troubleshooting

**Daemon won't start:**
- Check MongoDB connection string in `.env.local`
- Verify port 7751 is available: `lsof -i :7751`

**Plugin not loading:**
- Check OpenClaw logs: `tail -100 ~/.openclaw/logs/openclaw.log | grep memory-mongodb`
- Verify plugin structure: `ls ~/.openclaw/extensions/memory-mongodb/`

**No search results:**
- Check daemon is running: `curl http://localhost:7751/status`
- Verify agent ID matches between plugin config and stored memories

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm run build

# Run daemon in dev mode
cd packages/daemon && pnpm dev

# Run web dashboard
cd packages/web && pnpm dev

# Run tests
pnpm test
```

## Contributing

This is a working implementation built for production use. Contributions welcome!

1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a PR

## License

MIT

## Credits

Built by Michael Lynn for OpenClaw.

- MongoDB: https://mongodb.com
- Voyage AI: https://voyageai.com
- OpenClaw: https://openclaw.ai

---

**Version:** 0.1.0  
**Status:** Production-ready  
**Last Updated:** 2026-02-22
