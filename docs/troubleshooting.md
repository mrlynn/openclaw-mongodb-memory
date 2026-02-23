# Troubleshooting

## Daemon Won't Start

### Port already in use

```
┌──────────────────────────────────────────────────────┐
│   Port 7654 is already in use                        │
└──────────────────────────────────────────────────────┘
```

**Fix:**

```bash
# Find what's using the port
lsof -i :7654

# Kill it
kill <PID>

# Or use a different port
MEMORY_DAEMON_PORT=7655 pnpm dev:daemon
```

### Missing MongoDB URI

```
┌──────────────────────────────────────────────────────┐
│   Missing MONGODB_URI                                │
└──────────────────────────────────────────────────────┘
```

**Fix:**

```bash
# Add to .env.local
echo 'MONGODB_URI=mongodb://localhost:27017' >> .env.local

# Or run the interactive setup
pnpm setup
```

### Missing Voyage API Key

The daemon requires either a Voyage API key or mock mode enabled.

**Fix (mock mode — recommended for development):**

```bash
echo 'VOYAGE_MOCK=true' >> .env.local
```

**Fix (real embeddings):**

```bash
# Get a free key from https://voyageai.com
echo 'VOYAGE_API_KEY=pa-xxx' >> .env.local
```

## MongoDB Connection Issues

### Connection timeout

```bash
# Test connection directly
mongosh "mongodb://localhost:27017"

# For Atlas, check your IP is whitelisted
# Go to Atlas > Network Access > Add Current IP Address
```

### Authentication failure

```bash
# Verify your connection string includes credentials
# Format: mongodb+srv://USER:PASSWORD@cluster.mongodb.net/openclaw_memory

# URL-encode special characters in password
# @ → %40, # → %23, etc.
```

## Search Returns No Results

```bash
# 1. Verify daemon is running
curl http://localhost:7654/health

# 2. Check if agent has memories
curl http://localhost:7654/agents

# 3. Check memory count for your agent
curl "http://localhost:7654/export?agentId=YOUR_AGENT_ID" | python3 -c "import sys,json; print(json.load(sys.stdin)['count'])"

# 4. Try a broader search
curl "http://localhost:7654/recall?agentId=YOUR_AGENT_ID&query=test&limit=50"
```

## Build Failures

### pnpm install fails

```bash
# Clear cache and reinstall
pnpm store prune
rm -rf node_modules
pnpm install
```

### TypeScript compilation errors

```bash
# Check for type errors across all packages
pnpm typecheck

# Build a specific package
pnpm --filter @openclaw-memory/daemon build
```

### Web build fails

```bash
# Clear Next.js cache
rm -rf packages/web/.next

# Rebuild
pnpm --filter @openclaw-memory/web build
```

## Docker Issues

### Containers won't start

```bash
# Check container logs
docker compose logs daemon
docker compose logs web

# Rebuild images
docker compose build --no-cache

# Start fresh
docker compose down -v && docker compose up -d
```

### Daemon can't reach MongoDB in Docker

The daemon uses the service name `mongo` within Docker Compose. Ensure `MONGODB_URI=mongodb://mongo:27017` is set in the Docker environment (this is already configured in docker-compose.yml).

## Web Dashboard Issues

### Dashboard shows "Daemon Unreachable"

1. Verify the daemon is running: `curl http://localhost:7654/health`
2. Check the daemon URL in Settings (default: `http://localhost:7654`)
3. If running in Docker, use `http://localhost:7654` from the browser (not the internal Docker hostname)

### CORS errors in browser console

The daemon includes CORS headers for all origins by default. If you see CORS errors:

- Ensure you're accessing the daemon via the correct URL
- Check that no reverse proxy is stripping CORS headers

## Test Failures

### Tests require MONGODB_URI

Daemon tests need a real MongoDB connection:

```bash
# Start local MongoDB
mongod --dbpath /tmp/mongo-test

# Or use Docker
docker run -d -p 27017:27017 mongo:7

# Run tests
MONGODB_URI=mongodb://localhost:27017 pnpm --filter @openclaw-memory/daemon test
```

### vitest watch mode hangs

Tests are configured with `vitest run` (not watch mode). If tests hang, press `q` to quit or use:

```bash
pnpm --filter @openclaw-memory/daemon test -- --run
```
