# Deployment Guide

## Docker Compose (Recommended)

The fastest way to run the full stack.

```bash
docker compose up -d
```

This starts:

- **MongoDB** on port 27017
- **Daemon** on port 7654
- **Web Dashboard** on port 3000

See [docker-setup.md](./docker-setup.md) for the complete Docker guide including Kubernetes, multi-environment, and troubleshooting.

## MongoDB Options

### Local MongoDB

For development without cloud dependencies.

See [mongodb-local-setup.md](./mongodb-local-setup.md) for platform-specific instructions (macOS, Linux, Windows).

### MongoDB Atlas (Production)

Free tier with native vector search for production deployments.

See [mongodb-atlas-setup.md](./mongodb-atlas-setup.md) for setup, vector search index creation, and scaling guide.

### Comparison

| Feature       | Docker       | Local MongoDB | Atlas (Cloud)              |
| ------------- | ------------ | ------------- | -------------------------- |
| Setup time    | 2 min        | 5-10 min      | 5 min                      |
| Cost          | Free         | Free          | Free tier available        |
| Vector search | In-memory    | In-memory     | Native Atlas Vector Search |
| Internet      | Not required | Not required  | Required                   |
| Backups       | Manual       | Manual        | Automatic                  |
| Scaling       | Limited      | Limited       | Auto-scale                 |

## Process Manager (PM2)

For production deployments without Docker:

```bash
# Build the daemon
pnpm --filter @openclaw-memory/daemon build

# Start with PM2
pm2 start packages/daemon/dist/server.js --name openclaw-memory

# Auto-start on reboot
pm2 save && pm2 startup
```

## Environment Setup

### Production Checklist

1. Set `MONGODB_URI` to your Atlas connection string
2. Set `VOYAGE_API_KEY` with a real Voyage AI key
3. Set `VOYAGE_MOCK=false` (or remove the variable)
4. Optionally set `MEMORY_API_KEY` for API authentication
5. Run `pnpm --filter @openclaw-memory/daemon db:setup` to create indexes

### Atlas Vector Search Index

For production-scale semantic search, create a vector search index:

1. Go to MongoDB Atlas > Database > Browse Collections
2. Select `openclaw_memory.memories`
3. Go to "Search Indexes" tab
4. Create a new index named `memory_vector_index`:

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 1024,
      "similarity": "cosine"
    },
    { "type": "filter", "path": "agentId" },
    { "type": "filter", "path": "projectId" },
    { "type": "filter", "path": "tags" }
  ]
}
```

The daemon automatically detects and uses the vector index when available.

## CI/CD

### GitHub Actions CI

The project includes two workflows:

**`.github/workflows/ci.yml`** — Runs on every PR and push to main:

- Type checking (`pnpm typecheck`)
- Linting (`pnpm lint`)
- Format check (`pnpm format:check`)
- Build (`pnpm build`)
- Tests (`pnpm test`) with MongoDB 7 service container

**`.github/workflows/docker.yml`** — Docker integration test on push to main:

- Builds Docker images
- Starts full stack
- Smoke tests daemon and web endpoints
- Tears down

## Scaling Considerations

| Memories per Agent | Recommended Setup                     |
| ------------------ | ------------------------------------- |
| < 10K              | In-memory cosine similarity (default) |
| 10K - 100K         | Atlas Vector Search recommended       |
| > 100K             | Atlas Vector Search required          |

**Performance benchmarks:**

- In-memory search: 50-200ms for 10K memories
- Atlas Vector Search: 10-50ms regardless of count
- Embedding generation: ~100ms per memory (Voyage AI)

## Monitoring

The daemon exposes health endpoints for monitoring:

- `GET /health` — Detailed health with service status, memory usage, uptime
- `GET /status` — Simplified status for load balancers
- `GET /health/setup` — Setup checklist for missing configuration

The web dashboard at `/health` provides a visual health monitoring interface.

## Database Maintenance

```bash
# Check database status
pnpm --filter @openclaw-memory/daemon db:status

# Set up indexes (idempotent, safe to re-run)
pnpm --filter @openclaw-memory/daemon db:setup

# Seed demo data for testing
pnpm --filter @openclaw-memory/daemon db:seed

# Seed with clear (remove existing demo data first)
pnpm --filter @openclaw-memory/daemon db:seed -- --clear
```
