# 🧠 OpenClaw Memory

> **Persistent, semantically-searchable long-term memory for OpenClaw agents**

Give your AI agents a memory that **actually remembers**. Powered by MongoDB and Voyage AI embeddings, OpenClaw Memory lets agents recall context from weeks ago, understand meaning instead of keywords, and build continuity across sessions.

[![Status](https://img.shields.io/badge/status-production--ready-brightgreen)](.) 
[![Version](https://img.shields.io/badge/version-0.1.0-blue)](.)
[![License](https://img.shields.io/badge/license-MIT-blue)](.)
[![Tested](https://img.shields.io/badge/tested-verified-green)](./VERIFIED.md)

---

## 🎯 Why OpenClaw Memory?

**The Problem:** AI agents forget everything between sessions. No continuity, no context, no learning.

**The Solution:** A production-ready memory system that works like human memory — semantic, persistent, and practical.

```bash
# Your agent remembers this...
Agent: "I prefer Material UI for React projects" (2 weeks ago)

# ...and finds it semantically when you need it
User: "What UI library should we use?"
Agent: *searches memories for "UI library preference"*
       *finds: "I prefer Material UI" with 0.89 relevance*
Agent: "Based on our past discussions, Material UI would be a good fit."
```

**It just works.** No fine-tuning. No prompt engineering. Just pure RAG-powered memory.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🔍 **Semantic Search** | Find memories by meaning, not keywords. "What do I like for breakfast?" finds "I love scrambled eggs" |
| 💾 **Persistent Storage** | MongoDB + TTL auto-expiration. Memories survive restarts, old ones fade naturally |
| 🎯 **RAG-Ready** | Drop-in vector search for retrieval-augmented generation workflows |
| 🏷️ **Tagging & Filtering** | Organize by project, topic, or any custom taxonomy |
| 🌐 **Web Dashboard** | Beautiful UI to browse, search, and manage memories |
| 🔌 **OpenClaw Plugin** | Native integration — agents use `memory_search` tool automatically |
| 🧪 **Mock Mode** | Test without API costs using deterministic embeddings |
| 📊 **Agent Discovery** | See all agents with memories, filter by agent ID |
| ⚡ **Fast** | In-memory cosine for <10K memories, Atlas Vector Search for scale |
| 🔒 **Private** | Self-hosted, your data stays yours |

---

## 🚀 Quick Start

### 1️⃣ Install

```bash
git clone https://github.com/YOUR_USERNAME/openclaw-memory.git
cd openclaw-memory
pnpm install
```

### 2️⃣ Configure

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```bash
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/openclaw_memory
VOYAGE_API_KEY=pa-xxx  # Or use VOYAGE_MOCK=true for testing
```

### 3️⃣ Start

```bash
# Start daemon
cd packages/daemon && npm start

# Start web dashboard (optional)
cd packages/web && pnpm dev
```

### 4️⃣ Test

```bash
# Store a memory
curl -X POST http://localhost:7751/remember \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "demo",
    "text": "I prefer dark mode for all my apps",
    "tags": ["preference", "ui"]
  }'

# Search semantically
curl "http://localhost:7751/recall?agentId=demo&query=theme+preference"

# 🎉 Returns: "I prefer dark mode..." with relevance score
```

### 5️⃣ Configure Agent Workflow ⚠️ **IMPORTANT**

The system is installed, but agents won't use it automatically without workflow guidance:

```bash
# Read the workflow guide
cat AGENT_WORKFLOW.md

# Update your workspace AGENTS.md with the auto-save pattern
# This tells agents WHEN to save memories (problem solved, decision made, etc.)
```

**Without this step, your memory system will sit unused!**

---

## 📚 Detailed Setup Guides

Choose your setup path:

### 🐳 Docker (Recommended for local development)
**Complete stack in one command** — MongoDB, daemon, and web dashboard.

👉 **[Docker Setup Guide](./docs/docker-setup.md)**

```bash
docker compose up
# Everything running on http://localhost:7654
```

### ☁️ MongoDB Atlas (Recommended for production)
**Free cloud database with vector search** — No local MongoDB needed.

👉 **[MongoDB Atlas Setup Guide](./docs/mongodb-atlas-setup.md)**

- Free M0 cluster (512 MB)
- Built-in vector search
- Global deployment
- Step-by-step with screenshots

### 🛠️ Manual Setup
Install and configure each component yourself:

1. Install MongoDB locally or use Atlas
2. Follow Quick Start above
3. Configure `.env.local`
4. Run `pnpm install && pnpm build`

---

## 🎨 What It Looks Like

### Memory Browser with RAG Search

Search 73 memories semantically in milliseconds:

```
┌─────────────────────────────────────────────────────────────┐
│ Agent: openclaw (73 memories)  🔍 Search: "what color dog"  │
├──────────┬──────────────────────────┬──────────┬────────────┤
│ Relevance│ Text                     │ Tags     │ Created    │
├──────────┼──────────────────────────┼──────────┼────────────┤
│  0.872   │ the red dog watched...   │ dog, mem │ 2/22, 5:47 │
│  0.654   │ heartbeat checkpoint...  │ infrastr │ 2/21, 3:48 │
│  0.521   │ color preferences in...  │ design   │ 2/19, 4:01 │
└──────────┴──────────────────────────┴──────────┴────────────┘
```

### Dashboard Overview

```
┌──────────────────────────────────────────┐
│ 🧠 Memory Daemon Status                  │
├──────────────────────────────────────────┤
│ ✅ Daemon: ready                         │
│ ✅ MongoDB: connected                    │
│ ✅ Voyage: ready (mock mode)             │
│ 📊 Total Memories: 74                    │
│ ⏱️  Uptime: 3d 2h 15m                    │
└──────────────────────────────────────────┘
```

---

## 📦 Project Structure

```
openclaw-memory/
├── packages/
│   ├── daemon/          # HTTP API server (port 7751)
│   ├── client/          # TypeScript client library
│   ├── cli/             # CLI tools (ocmem)
│   └── web/             # Next.js dashboard (port 3002)
├── plugin/              # OpenClaw plugin
│   ├── index.ts         # Plugin implementation
│   └── openclaw.plugin.json
├── scripts/             # Management utilities
│   ├── install.sh       # Automated installation
│   ├── uninstall.sh     # Clean removal
│   ├── cleanup.sh       # Database cleanup
│   └── status.sh        # Health check
└── docs/                # Full documentation
```

---

## 🔧 Core API

### Remember (Store)

```typescript
POST /remember

{
  "agentId": "openclaw",
  "text": "The user prefers terse responses without fluff",
  "tags": ["preference", "communication-style"],
  "ttl": 2592000  // 30 days
}

→ { "success": true, "id": "699ad..." }
```

### Recall (Search)

```typescript
GET /recall?agentId=openclaw&query=communication+style&limit=5

→ {
    "success": true,
    "results": [
      {
        "id": "699ad...",
        "text": "The user prefers terse responses...",
        "score": 0.91,  // ← Semantic similarity
        "tags": ["preference", "communication-style"]
      }
    ]
  }
```

### Forget (Delete)

```typescript
DELETE /forget/699ad...

→ { "success": true }
```

---

## 🎯 Use Cases

| Scenario | How OpenClaw Memory Helps |
|----------|---------------------------|
| **Personal Assistant** | Remembers user preferences, past decisions, and context from weeks ago |
| **Customer Support** | Recalls prior interactions, tickets, and solutions for continuity |
| **Code Review** | Remembers architecture decisions, coding standards, and past discussions |
| **Research** | Stores findings, sources, and insights for later recall |
| **Project Management** | Tracks decisions, blockers, and status updates across sprints |
| **Learning Companion** | Remembers what the user has learned, struggles with, and wants to explore |

---

## 🧪 Mock vs Real Embeddings

### Mock Mode (Testing)

**Cost:** $0  
**Speed:** Instant (deterministic hash)  
**Accuracy:** Good for testing, not production  

```bash
VOYAGE_MOCK=true
```

### Real Voyage Embeddings (Production)

**Cost:** ~$0.02 per 1M tokens (~5,000 memories)  
**Speed:** ~100ms per embedding  
**Accuracy:** State-of-the-art semantic search  

```bash
VOYAGE_API_KEY=pa-xxx  # Get free key: voyageai.com
VOYAGE_MOCK=false
```

**MongoDB Atlas AI** also supported:

```bash
VOYAGE_API_KEY=al-xxx  # MongoDB Atlas AI key
VOYAGE_BASE_URL=https://ai.mongodb.com/v1
VOYAGE_MODEL=voyage-3
```

---

## 🔌 OpenClaw Integration

### Install Plugin

```bash
cd /Users/michael.lynn/code/openclaw-memory
./scripts/install.sh
```

### Configure

Edit `~/.openclaw/openclaw.json`:

```json
{
  "plugins": {
    "slots": { "memory": "openclaw-memory" },
    "load": {
      "paths": ["/path/to/openclaw-memory/plugin"]
    },
    "allow": ["openclaw-memory"],
    "entries": {
      "openclaw-memory": {
        "enabled": true,
        "config": {
          "daemonUrl": "http://localhost:7751",
          "agentId": "openclaw",
          "autoStartDaemon": true
        }
      }
    }
  }
}
```

### Use in Agents

```typescript
// Automatically available to agents
User: "What do I prefer for breakfast?"

Agent: [calls memory_search("breakfast preference")]
       [finds: "I love scrambled eggs and toast" (score: 0.89)]

Agent: "Based on what I remember, you love scrambled eggs and toast!"
```

---

## 📊 Performance & Scale

| Metric | In-Memory (Default) | Atlas Vector Search |
|--------|---------------------|---------------------|
| **Max Memories/Agent** | 10,000 | 10,000,000+ |
| **Search Speed** | 50-200ms | 10-50ms |
| **Cost** | Free (compute only) | Free tier: 512MB |
| **Setup** | Zero config | Vector index required |

**When to use Atlas Vector Search:**
- \>10K memories per agent
- Multiple agents with 1K+ memories each
- Production workloads requiring <50ms latency

See [Production Deployment](#-production-deployment) for setup guide.

---

## 📚 Documentation

| Guide | Description |
|-------|-------------|
| **[FRESH_INSTALL_TEST.md](./FRESH_INSTALL_TEST.md)** | Complete end-to-end test plan (6 phases) |
| **[scripts/README.md](./scripts/README.md)** | Management script documentation |
| **[FOR_ENGINEERS.md](./FOR_ENGINEERS.md)** | Architecture deep-dive |
| **[SKILL.md](./SKILL.md)** | OpenClaw skill reference |
| **[SCHEMA.md](./SCHEMA.md)** | MongoDB schema and indexes |

---

## 🛠️ Management Scripts

```bash
# Quick health check
./scripts/status.sh

# Install (automated)
./scripts/install.sh

# Uninstall (clean removal)
./scripts/uninstall.sh

# Clean test data
./scripts/cleanup.sh
```

---

## 🚀 Production Deployment

### Step 1: MongoDB Atlas Vector Search Index

1. Create a **Search Index** in MongoDB Atlas
2. Database: `openclaw_memory`, Collection: `memories`
3. Index definition:

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
    {"type": "filter", "path": "tags"}
  ]
}
```

### Step 2: Run as Service (PM2)

```bash
pm2 start packages/daemon/dist/server.js --name openclaw-memory
pm2 save && pm2 startup
```

### Step 3: Enable Auto-Start in OpenClaw

```json
{
  "plugins": {
    "entries": {
      "openclaw-memory": {
        "config": {
          "autoStartDaemon": true
        }
      }
    }
  }
}
```

---

## 💡 Tips & Best Practices

**Organize with Tags:**
```javascript
// Good
{ tags: ["preference", "ui", "theme"] }

// Better
{ tags: ["user-preference", "interface-theme"] }
```

**Use TTL for Ephemeral Context:**
```javascript
// Temporary context (1 day)
{ text: "Working on feature X", ttl: 86400 }

// Long-term preferences (30 days)
{ text: "Prefers Material UI", ttl: 2592000 }
```

**Batch Similar Memories:**
```javascript
// Instead of 10 tiny memories:
"I like blue"
"I like Material UI"
"I like dark mode"

// Use one rich memory:
"UI Preferences: blue color scheme, Material UI framework, dark mode enabled"
```

---

## 🐛 Troubleshooting

### Daemon Won't Start

```bash
# Check MongoDB connection
mongosh "$MONGODB_URI"

# Check port availability
lsof -i :7751

# Check logs
tail -f /tmp/openclaw-memory-daemon.log
```

### Plugin Not Loading

```bash
# Run OpenClaw doctor
openclaw doctor

# Check plugin manifest
cat /path/to/plugin/openclaw.plugin.json

# Verify load path
grep openclaw-memory ~/.openclaw/openclaw.json
```

### No Search Results

```bash
# Verify daemon is running
curl http://localhost:7751/status

# List all agents
curl http://localhost:7751/agents

# Check if memories exist
curl "http://localhost:7751/export?agentId=YOUR_AGENT_ID" | jq '.count'
```

---

## 🤝 Contributing

Contributions welcome! This is a working production system, battle-tested and ready for real use.

**Areas for contribution:**
- Additional embedding providers (OpenAI, Cohere, etc.)
- Web dashboard enhancements
- Performance optimizations
- Documentation improvements
- Example workflows and templates

**Process:**
1. Fork the repo
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Test thoroughly (see `FRESH_INSTALL_TEST.md`)
4. Commit with clear messages
5. Push and open a PR

---

## 📈 Roadmap

- [ ] **Multi-modal embeddings** (images, audio, video)
- [ ] **Conversation threading** (group related memories)
- [ ] **Memory summarization** (automatic compression of old context)
- [ ] **Collaborative memory** (shared across multiple agents)
- [ ] **Memory analytics** (usage patterns, popular queries)
- [ ] **Export/import** (backup and restore workflows)

---

## 📝 License

MIT License - see [LICENSE](./LICENSE) for details.

---

## 🙏 Credits

**Built by:** [Michael Lynn](https://github.com/mrlynn)  
**For:** [OpenClaw](https://openclaw.ai)

**Powered by:**
- [MongoDB](https://mongodb.com) - Database and vector search
- [Voyage AI](https://voyageai.com) - State-of-the-art embeddings
- [Next.js](https://nextjs.org) - Web dashboard framework

---

## 📞 Support

- **Issues:** [GitHub Issues](https://github.com/YOUR_USERNAME/openclaw-memory/issues)
- **Discussions:** [GitHub Discussions](https://github.com/YOUR_USERNAME/openclaw-memory/discussions)
- **OpenClaw Discord:** [discord.com/invite/clawd](https://discord.com/invite/clawd)

---

<div align="center">

**🧠 Give your agents a memory that actually remembers.**

[Get Started](#-quick-start) · [Documentation](./docs) · [Examples](./examples) · [Report Bug](https://github.com/YOUR_USERNAME/openclaw-memory/issues)

Made with ❤️ and ☕ by the OpenClaw community

</div>
