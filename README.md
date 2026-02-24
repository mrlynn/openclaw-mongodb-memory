# OpenClaw Memory

> **Persistent, semantically-searchable long-term memory for AI agents**

Give your AI agents a memory that **actually remembers**. Powered by MongoDB and Voyage AI embeddings, OpenClaw Memory lets agents recall context from weeks ago, understand meaning instead of keywords, and build continuity across sessions.

[![Status](https://img.shields.io/badge/status-production--ready-brightgreen)](.)
[![Version](https://img.shields.io/badge/version-0.2.0-blue)](.)
[![License](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)
[![CI](https://img.shields.io/badge/CI-passing-brightgreen)](.github/workflows/ci.yml)

---

## Why OpenClaw Memory?

**The Problem:** AI agents forget everything between sessions. No continuity, no context, no learning.

**The Solution:** A production-ready memory system that works like human memory — semantic, persistent, and practical.

```bash
# Your agent remembers this...
Agent: "I prefer TypeScript for all new projects" (2 weeks ago)

# ...and finds it semantically when you need it
User: "What language should we use?"
Agent: *searches memories for "language preference"*
       *finds: "I prefer TypeScript" with 0.89 relevance*
Agent: "Based on our past discussions, TypeScript would be a good fit."
```

**It just works.** No fine-tuning. No prompt engineering. Just pure RAG-powered memory.

---

## Features

| Feature                | Description                                                       |
| ---------------------- | ----------------------------------------------------------------- |
| **Semantic Search**    | Find memories by meaning, not keywords                            |
| **Persistent Storage** | MongoDB + TTL auto-expiration                                     |
| **RAG-Ready**          | Drop-in vector search for retrieval-augmented generation          |
| **Web Dashboard**      | Browse, search, and manage memories with visualizations           |
| **Mock Mode**          | Test without API costs using deterministic embeddings             |
| **Agent Discovery**    | See all agents with memories, filter by agent ID                  |
| **Visualizations**     | Word cloud, semantic memory map, activity timeline                |
| **Lifecycle Hooks**    | Auto-remember facts, bootstrap context, enrich tools, save sessions |
| **Fast**               | In-memory cosine for <10K memories, Atlas Vector Search for scale   |

---

## Quick Start

### One-command setup

```bash
git clone https://github.com/mrlynn/openclaw-memory.git
cd openclaw-memory
pnpm setup
```

The interactive setup wizard handles dependencies, environment configuration, building, database validation, and a smoke test.

### Start development

```bash
pnpm dev
```

This starts both services:

- **Daemon** at `http://localhost:7654` (memory API)
- **Web Dashboard** at `http://localhost:3000` (browse/search UI)

### Try it

```bash
# Store a memory
curl -X POST http://localhost:7654/remember \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "demo",
    "text": "I prefer dark mode for all my apps",
    "tags": ["preference", "ui"]
  }'

# Search semantically
curl "http://localhost:7654/recall?agentId=demo&query=theme+preference"
```

See the [Installation Guide](./docs/getting-started.md) for complete setup instructions including prerequisites and MongoDB options.

---

## Setup Paths

The [Installation Guide](./docs/getting-started.md) covers three paths:

| Path              | What you need     | Time     | Best for                                  |
| ----------------- | ----------------- | -------- | ----------------------------------------- |
| **Docker**        | Docker installed  | 30 sec   | `docker compose up` — everything included |
| **Local install** | Node.js + MongoDB | 5 min    | `pnpm setup` — interactive wizard         |
| **Manual**        | Node.js + MongoDB | 5-10 min | Full control over every step              |

Deep-dive guides:

- [Docker Setup](./docs/docker-setup.md) — Kubernetes, volumes, multi-env
- [Local MongoDB](./docs/mongodb-local-setup.md) — macOS, Linux, Windows
- [MongoDB Atlas](./docs/mongodb-atlas-setup.md) — free cloud tier with vector search

---

## Project Structure

```
openclaw-memory/
├── packages/
│   ├── daemon/     # Express API server (port 7654)
│   ├── web/        # Next.js + LeafyGreen UI dashboard (port 3000)
│   ├── client/     # TypeScript client library
│   └── cli/        # CLI tool (ocmem)
├── scripts/        # Setup and management scripts
├── docs/           # Documentation
└── .env.example    # Environment template
```

---

## Core API

### Remember (Store)

```
POST /remember
{ "agentId": "my-agent", "text": "User prefers dark mode", "tags": ["preference"] }
→ { "success": true, "id": "699ad..." }
```

### Recall (Search)

```
GET /recall?agentId=my-agent&query=theme+preference&limit=5
→ { "results": [{ "text": "User prefers dark mode", "score": 0.91 }] }
```

### Forget (Delete)

```
DELETE /forget/699ad...
→ { "success": true }
```

See the [full API Reference](./docs/api-reference.md) for all 13 endpoints including analytics, export, and health.

---

## Mock vs Real Embeddings

|             | Mock Mode          | Real Voyage AI          |
| ----------- | ------------------ | ----------------------- |
| **Cost**    | Free               | ~$0.10 per 1M tokens    |
| **Setup**   | `VOYAGE_MOCK=true` | `VOYAGE_API_KEY=pa-xxx` |
| **Quality** | Hash-based (dev)   | Semantic (production)   |

Start with mock mode. Switch to [Voyage AI](https://voyageai.com) when you need production-quality search.

---

## Performance

| Metric                 | In-Memory (Default) | Atlas Vector Search   |
| ---------------------- | ------------------- | --------------------- |
| **Max Memories/Agent** | 10,000              | 10,000,000+           |
| **Search Speed**       | 50-200ms            | 10-50ms               |
| **Setup**              | Zero config         | Vector index required |

---

## Documentation

| Guide                                            | Description                                 |
| ------------------------------------------------ | ------------------------------------------- |
| [**FAQ**](./docs/FAQ.md)                         | 💡 Frequently asked questions (start here!) |
| [**Getting Started**](./docs/getting-started.md) | Installation, setup, first steps            |
| [**Configuration**](./docs/configuration.md)     | All environment variables and options       |
| [**API Reference**](./docs/api-reference.md)     | Complete HTTP API documentation             |
| [**Architecture**](./docs/architecture.md)       | System design and data flow                 |
| [**Deployment**](./docs/deployment.md)           | Docker, production, CI/CD, scaling          |
| [**Memory Hooks**](./docs/hooks.md)              | Automatic memory via lifecycle hooks        |
| [**Hooks Quick Reference**](./docs/hooks-quick-reference.md) | Concise hooks cheatsheet         |
| [**Troubleshooting**](./docs/troubleshooting.md) | Common issues and fixes                     |
| [**Contributing**](./docs/contributing.md)       | Development workflow and testing            |

---

## TypeScript Client

```typescript
import { MemoryClient } from "@openclaw-memory/client";

const memory = new MemoryClient({
  daemonUrl: "http://localhost:7654",
  agentId: "my-agent",
});

// Store a memory
await memory.remember("User prefers dark mode", { tags: ["preference"] });

// Search by meaning
const results = await memory.recall("theme settings", { limit: 5 });

// Delete a memory
await memory.forget(results[0].id);
```

---

## Development

```bash
pnpm dev          # Start daemon + web concurrently
pnpm build        # Build all packages
pnpm test         # Run all tests
pnpm lint         # ESLint check
pnpm typecheck    # TypeScript type check
pnpm format:check # Prettier check
```

Pre-commit hooks (Husky + lint-staged) enforce code quality automatically.

---

## Roadmap

- [ ] Multi-modal embeddings (images, audio, video)
- [ ] Conversation threading (group related memories)
- [ ] Memory summarization (automatic compression)
- [ ] Collaborative memory (shared across agents)
- [ ] Additional embedding providers (OpenAI, Cohere)

---

## License

MIT License - see [LICENSE](./LICENSE) for details.

---

**Built by** [Michael Lynn](https://github.com/mrlynn)

**Powered by:**
[MongoDB](https://mongodb.com) | [Voyage AI](https://voyageai.com) | [Next.js](https://nextjs.org) | [LeafyGreen UI](https://www.mongodb.design/)
