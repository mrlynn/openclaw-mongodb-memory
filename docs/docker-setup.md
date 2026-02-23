# Docker Setup Guide

**Goal:** Run the complete openclaw-memory stack (MongoDB + daemon + web dashboard) with one command.

---

## Why Docker?

- **Zero config:** No MongoDB installation needed
- **Isolation:** Everything runs in containers, no conflicts
- **Reproducible:** Same environment on every machine
- **Quick start:** From clone to running in under 2 minutes

---

## Prerequisites

1. **Docker Desktop** (macOS/Windows) or **Docker Engine** (Linux)
   - Download: https://www.docker.com/get-started
   - Version: 20.10+ recommended

2. **Docker Compose** (usually included with Docker Desktop)
   - Check: `docker compose version`
   - Expected: v2.0+

---

## Quick Start (30 seconds)

```bash
# Clone the repo
git clone https://github.com/mrlynn/openclaw-mongodb-memory.git
cd openclaw-mongodb-memory

# Start everything
docker compose up

# Open in browser:
# - Daemon: http://localhost:7654
# - Dashboard: http://localhost:3000
```

That's it! The stack is running. Press `Ctrl+C` to stop.

---

## What's Running?

Docker Compose starts 3 services:

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| **mongodb** | mongo:7 | 27017 | Database storage |
| **daemon** | Custom (built from `packages/daemon`) | 7654 | Memory API |
| **web** | Custom (built from `packages/web`) | 3000 | Dashboard UI |

**Data persistence:** MongoDB data is stored in a Docker volume (`mongodb_data`), so it survives container restarts.

---

## Configuration

### Environment Variables

Create a `.env` file in the project root to customize:

```bash
# .env
MEMORY_DAEMON_PORT=7654
WEB_PORT=3000
MEMORY_DB_NAME=openclaw_memory
VOYAGE_API_KEY=  # Leave empty for mock mode
VOYAGE_MOCK=true
```

**Common customizations:**

- Change daemon port: `MEMORY_DAEMON_PORT=8080`
- Change web port: `WEB_PORT=8080`
- Use real Voyage embeddings: `VOYAGE_API_KEY=va-... VOYAGE_MOCK=false`

Restart after changes: `docker compose down && docker compose up`

---

## Docker Compose File Explained

**File:** `docker-compose.yml`

```yaml
services:
  # MongoDB 7.0 database
  mongodb:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db  # Persistent storage
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Memory daemon (API server)
  daemon:
    build:
      context: .
      dockerfile: packages/daemon/Dockerfile
    ports:
      - "${MEMORY_DAEMON_PORT:-7654}:7654"
    environment:
      - MONGODB_URI=mongodb://mongodb:27017
      - MEMORY_DB_NAME=${MEMORY_DB_NAME:-openclaw_memory}
      - VOYAGE_API_KEY=${VOYAGE_API_KEY:-}
      - VOYAGE_MOCK=${VOYAGE_MOCK:-true}
      - MEMORY_DAEMON_PORT=7654
    depends_on:
      mongodb:
        condition: service_healthy  # Waits for MongoDB to be ready
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:7654/health"]
      interval: 10s
      timeout: 5s
      retries: 3

  # Web dashboard (Next.js)
  web:
    build:
      context: .
      dockerfile: packages/web/Dockerfile
    ports:
      - "${WEB_PORT:-3000}:3000"
    environment:
      - NEXT_PUBLIC_DAEMON_URL=http://localhost:${MEMORY_DAEMON_PORT:-7654}
    depends_on:
      daemon:
        condition: service_healthy  # Waits for daemon to be ready

volumes:
  mongodb_data:  # Named volume for MongoDB persistence
```

---

## Common Commands

### Start (detached mode)

Run in background:
```bash
docker compose up -d
```

Check status:
```bash
docker compose ps
```

### View logs

All services:
```bash
docker compose logs -f
```

Just daemon:
```bash
docker compose logs -f daemon
```

### Stop

```bash
docker compose down
```

### Rebuild (after code changes)

```bash
docker compose down
docker compose build --no-cache
docker compose up
```

### Reset everything (including data)

**⚠️ Warning:** This deletes all memories!

```bash
docker compose down -v  # -v removes volumes (data)
docker compose up
```

---

## Development Workflow

### Editing Code

1. **Make changes** to source code (e.g., `packages/daemon/src/routes/remember.ts`)

2. **Rebuild the service:**
   ```bash
   docker compose build daemon
   docker compose up daemon
   ```

3. **Test:** http://localhost:7654/health

### Hot Reload (Advanced)

Mount source code as a volume for instant rebuilds:

**Add to `docker-compose.yml`:**
```yaml
services:
  daemon:
    volumes:
      - ./packages/daemon/src:/app/src  # Mount source code
    command: ["npx", "tsx", "watch", "src/server.ts"]  # Watch mode
```

Now changes to `src/` trigger auto-restart.

---

## Production Deployment

### Using Docker Compose in Production

**⚠️ Not recommended.** Docker Compose is for development. For production:

1. **Use MongoDB Atlas** instead of containerized MongoDB
   - See: [MongoDB Atlas Setup](./mongodb-atlas-setup.md)

2. **Deploy daemon as a service:**
   - AWS: ECS, Fargate, or App Runner
   - Google Cloud: Cloud Run
   - Azure: Container Instances
   - Self-hosted: Docker Swarm or Kubernetes

3. **Deploy web dashboard:**
   - Vercel (recommended for Next.js)
   - Netlify
   - Self-hosted: Nginx reverse proxy + PM2

### Example: Production docker-compose.yml

```yaml
services:
  daemon:
    image: ghcr.io/mrlynn/openclaw-memory-daemon:0.2.0
    ports:
      - "7654:7654"
    environment:
      - MONGODB_URI=${MONGODB_ATLAS_URI}  # From Atlas
      - VOYAGE_API_KEY=${VOYAGE_API_KEY}
      - VOYAGE_MOCK=false
    restart: always
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:7654/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

No MongoDB container (using Atlas). Web deployed separately (Vercel).

---

## Dockerfile Breakdown

### Daemon Dockerfile

**File:** `packages/daemon/Dockerfile`

```dockerfile
# Build stage
FROM node:20-slim AS builder
WORKDIR /app

# Install dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/daemon/package.json packages/daemon/
RUN corepack enable && pnpm install --frozen-lockfile --filter @openclaw-memory/daemon

# Build TypeScript
COPY packages/daemon/ packages/daemon/
RUN pnpm --filter @openclaw-memory/daemon build

# Production stage
FROM node:20-slim
WORKDIR /app

# Copy built artifacts
COPY --from=builder /app/packages/daemon/dist ./dist
COPY --from=builder /app/packages/daemon/package.json ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 7654
CMD ["node", "dist/server.js"]
```

**Why multi-stage?**
- Smaller final image (no build tools, source code, or dev dependencies)
- Faster deploys (production image ~100 MB vs ~500 MB with build tools)

### Web Dockerfile

**File:** `packages/web/Dockerfile`

```dockerfile
FROM node:20-slim AS builder
WORKDIR /app
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm --filter @openclaw-memory/web build

FROM node:20-slim
WORKDIR /app
COPY --from=builder /app/packages/web/.next ./.next
COPY --from=builder /app/packages/web/public ./public
COPY --from=builder /app/packages/web/package.json ./
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["npx", "next", "start"]
```

---

## Troubleshooting

### "Port already in use"

**Problem:** Something is using port 7654 or 3000.

**Fix 1:** Stop the conflicting service:
```bash
lsof -ti:7654 | xargs kill
```

**Fix 2:** Change ports in `.env`:
```bash
MEMORY_DAEMON_PORT=8080
WEB_PORT=8080
```

### "Cannot connect to MongoDB"

**Problem:** MongoDB container isn't healthy.

**Check logs:**
```bash
docker compose logs mongodb
```

**Common causes:**
- Insufficient disk space
- Corrupted volume (fix: `docker compose down -v && docker compose up`)
- Port 27017 blocked by firewall

### "Build failed"

**Problem:** Syntax error, missing dependency, or network issue.

**Fix:**
```bash
docker compose build --no-cache --progress=plain
```

This shows full build output (not summarized).

### "Daemon shows 'unhealthy'"

**Check:**
```bash
docker compose ps
docker compose logs daemon
```

**Common causes:**
- MongoDB not ready (wait 30 seconds)
- Invalid `MONGODB_URI`
- Port conflict

### Changes not reflected

**Problem:** Docker is using cached layers.

**Fix:**
```bash
docker compose build --no-cache daemon
docker compose up daemon
```

Or force full rebuild:
```bash
docker compose down
docker system prune -a  # ⚠️ Removes all unused images
docker compose up --build
```

---

## Advanced: Kubernetes

For production clusters, use Kubernetes manifests instead of docker-compose.

**Example deployment:**

**`k8s/daemon-deployment.yaml`:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: openclaw-memory-daemon
spec:
  replicas: 3
  selector:
    matchLabels:
      app: daemon
  template:
    metadata:
      labels:
        app: daemon
    spec:
      containers:
      - name: daemon
        image: ghcr.io/mrlynn/openclaw-memory-daemon:0.2.0
        ports:
        - containerPort: 7654
        env:
        - name: MONGODB_URI
          valueFrom:
            secretKeyRef:
              name: mongodb-secret
              key: uri
        - name: VOYAGE_API_KEY
          valueFrom:
            secretKeyRef:
              name: voyage-secret
              key: api-key
        livenessProbe:
          httpGet:
            path: /health
            port: 7654
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health
            port: 7654
          initialDelaySeconds: 5
          periodSeconds: 10
```

Full Kubernetes setup is beyond this guide. See Kubernetes docs for autoscaling, ingress, and secrets management.

---

## Next Steps

1. ✅ Docker Compose stack running
2. 🔜 Test the API: `curl http://localhost:7654/health`
3. 🔜 Open dashboard: http://localhost:3000
4. 🔜 Store a memory: `curl -X POST http://localhost:7654/remember -H "Content-Type: application/json" -d '{"agentId":"test","text":"Docker works!"}'`
5. 🔜 Recall it: `curl "http://localhost:7654/recall?agentId=test&query=docker"`

**For production:** Switch to [MongoDB Atlas](./mongodb-atlas-setup.md) and deploy daemon to a cloud service.

---

## Resources

- **Docker Compose docs:** https://docs.docker.com/compose/
- **Dockerfile best practices:** https://docs.docker.com/develop/develop-images/dockerfile_best-practices/
- **MongoDB Docker image:** https://hub.docker.com/_/mongo
- **Node.js Docker image:** https://hub.docker.com/_/node

---

**Questions?** Open an issue: https://github.com/mrlynn/openclaw-mongodb-memory/issues
