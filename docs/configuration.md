# Configuration Reference

All configuration is done through environment variables. The daemon loads `.env` files from multiple locations in this order (first value wins):

1. System environment variables (highest priority)
2. `packages/daemon/.env.local`
3. `packages/daemon/.env`
4. `.env.local` (monorepo root)
5. `.env` (monorepo root)

## Environment Variables

### Required

| Variable      | Description               | Default                     |
| ------------- | ------------------------- | --------------------------- |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017` |

### Embedding Provider

| Variable          | Description                                            | Default                       |
| ----------------- | ------------------------------------------------------ | ----------------------------- |
| `VOYAGE_API_KEY`  | Voyage AI API key (required unless `VOYAGE_MOCK=true`) | —                             |
| `VOYAGE_MOCK`     | Use deterministic mock embeddings                      | `false`                       |
| `VOYAGE_MODEL`    | Embedding model name                                   | `voyage-4`                    |
| `VOYAGE_BASE_URL` | Custom API base URL (for MongoDB Atlas AI)             | `https://api.voyageai.com/v1` |

### Daemon

| Variable             | Description                                  | Default           |
| -------------------- | -------------------------------------------- | ----------------- |
| `MEMORY_DAEMON_PORT` | HTTP port for the daemon                     | `7654`            |
| `MEMORY_API_KEY`     | Optional Bearer token for API authentication | —                 |
| `MEMORY_DB_NAME`     | MongoDB database name                        | `openclaw_memory` |

### Web Dashboard

| Variable                 | Description                      | Default                 |
| ------------------------ | -------------------------------- | ----------------------- |
| `NEXT_PUBLIC_DAEMON_URL` | Daemon URL for the web dashboard | `http://localhost:7654` |

## Degradation Tiers

The daemon runs in different modes depending on available services:

### Minimal (Mock Mode)

- `VOYAGE_MOCK=true`, no Voyage API key needed
- Deterministic hash-based embeddings
- All features work, search quality is hash-based
- Best for: local development, testing, CI

### Standard (Real Embeddings)

- Real Voyage AI embeddings (`VOYAGE_API_KEY` set)
- In-memory cosine similarity search
- Production-quality semantic search up to ~10K memories per agent
- Best for: small-to-medium deployments

### Production (Atlas Vector Search)

- Real Voyage AI embeddings
- MongoDB Atlas with Vector Search index
- Scales to millions of memories
- Best for: large-scale production deployments

## MongoDB Atlas AI

To use MongoDB Atlas as your embedding provider instead of Voyage AI directly:

```bash
VOYAGE_API_KEY=al-xxx  # MongoDB Atlas AI key
VOYAGE_BASE_URL=https://ai.mongodb.com/v1
VOYAGE_MODEL=voyage-4
```

## Config Validation

The daemon validates all configuration at startup using Zod schemas. If any required value is missing or invalid, it shows a boxed error message with fix instructions:

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│   Missing Voyage AI API key                          │
│                                                      │
│   The daemon requires a Voyage API key for real      │
│   embeddings, or mock mode must be enabled.          │
│                                                      │
│   How to fix:                                        │
│     1. Get a free key: https://voyageai.com          │
│     2. Add to .env.local: VOYAGE_API_KEY=pa-xxx      │
│     3. Or enable mock mode: VOYAGE_MOCK=true         │
│                                                      │
└──────────────────────────────────────────────────────┘
```
