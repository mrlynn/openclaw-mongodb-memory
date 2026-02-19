# openclaw-memory

MongoDB-backed memory infrastructure for OpenClaw agents.

## Overview

A distributed memory system for AI agents built on:
- **MongoDB** — persistent storage
- **Voyage AI** — embeddings
- **OpenClaw** — agent framework

## Architecture

```
Agents → MemoryClient → HTTP → Daemon → MongoDB
                                    ↓
                              Voyage (embeddings)
```

## Packages

- **daemon** — Long-running HTTP server managing memory storage & retrieval
- **client** — NPM package agents use (`@openclaw-memory/client`)
- **cli** — Management CLI (`ocmem` command)
- **web** — Future: Next.js + Material UI dashboard

## Quick Start

### Setup

```bash
# Install dependencies
pnpm install

# Set environment variables
export MONGODB_URI="mongodb+srv://..."
export VOYAGE_API_KEY="pa-..."
export MEMORY_DAEMON_PORT=7654
```

### Development

```bash
# Start daemon (port 7654)
pnpm dev -F @openclaw-memory/daemon

# Start CLI
pnpm dev -F @openclaw-memory/cli

# Run all in parallel
pnpm dev
```

### Agent Usage

```typescript
import { MemoryClient } from "@openclaw-memory/client";

const memory = new MemoryClient({
  daemonUrl: "http://localhost:7654",
  agentId: "my-agent",
  projectId: "my-project",
});

// Remember something
const id = await memory.remember("Important info about the user", {
  tags: ["user", "context"],
  ttl: 86400, // 24 hours
});

// Recall relevant memories
const results = await memory.recall("What do I know about this user?", {
  limit: 10,
});

// Forget something
await memory.forget(id);
```

## CLI

```bash
# Check daemon status
ocmem status --url http://localhost:7654

# View memory statistics
ocmem stats --url http://localhost:7654
```

## TODO

- [ ] Implement Voyage embedding integration
- [ ] Implement MongoDB vector search
- [ ] Implement stats/metrics endpoints
- [ ] Build Next.js dashboard
- [ ] OpenClaw daemon auto-spawn integration
- [ ] Memory lifecycle management (TTL, archival)
- [ ] Cross-agent memory sharing (optional)
- [ ] Monitoring & alerting

## License

MIT
