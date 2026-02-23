# Getting Started

Get OpenClaw Memory running from scratch. Pick the path that fits your situation.

## Prerequisites

You need **Node.js 18+** and **pnpm 8+**. If you don't have them:

```bash
# Install Node.js (macOS)
brew install node

# Install Node.js (Linux)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install pnpm (all platforms)
npm install -g pnpm
```

Verify:

```bash
node --version   # v18+ required
pnpm --version   # v8+ required
```

---

## Path 1: Docker (Fastest)

**Everything in one command.** Docker handles MongoDB, the daemon, and the web dashboard. No local MongoDB needed.

```bash
git clone https://github.com/mrlynn/openclaw-memory.git
cd openclaw-memory
docker compose up -d
```

That's it. Services are running:

- **Daemon API** at `http://localhost:7654`
- **Web Dashboard** at `http://localhost:3000`
- **MongoDB** on port 27017 (internal)

Skip to [Verify It Works](#verify-it-works) below.

> For Docker details (Kubernetes, multi-env, volumes, troubleshooting): [Docker Setup Guide](./docker-setup.md)

---

## Path 2: Local Install (Recommended for development)

### Step 1: Get MongoDB

You need a MongoDB instance. Pick one:

**Option A — Local MongoDB (macOS)**

```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

**Option A — Local MongoDB (Linux)**

```bash
# Ubuntu/Debian
sudo apt-get install -y gnupg curl
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt-get update && sudo apt-get install -y mongodb-org
sudo systemctl start mongod
```

**Option B — MongoDB via Docker (just the database)**

```bash
docker run -d --name mongo -p 27017:27017 mongo:7
```

**Option C — MongoDB Atlas (cloud, free tier)**

Create a free cluster at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas). See [Atlas Setup Guide](./mongodb-atlas-setup.md) for step-by-step instructions.

> Detailed platform instructions: [Local MongoDB Guide](./mongodb-local-setup.md)

### Step 2: Clone and setup

```bash
git clone https://github.com/mrlynn/openclaw-memory.git
cd openclaw-memory
pnpm setup
```

The interactive setup wizard will:

1. Check Node.js and pnpm versions
2. Install all dependencies (`pnpm install`)
3. Generate `.env.local` — prompts for your MongoDB URI, Voyage API key, and port
4. Build all packages (`pnpm build`)
5. Validate your MongoDB connection
6. Run a smoke test (start daemon, hit `/health`, stop)

If you don't have a Voyage AI key, just press Enter — it enables mock mode automatically.

### Step 3: Start development

```bash
pnpm dev
```

This starts both services concurrently:

- **Daemon** at `http://localhost:7654` (memory API)
- **Web Dashboard** at `http://localhost:3000` (browse/search UI)

---

## Path 3: Manual Configuration

If you prefer full control over every step:

```bash
git clone https://github.com/mrlynn/openclaw-memory.git
cd openclaw-memory
pnpm install
cp .env.example .env.local
```

Edit `.env.local`:

```bash
# MongoDB connection (required)
MONGODB_URI=mongodb://localhost:27017

# Voyage AI embeddings (optional — leave empty for mock mode)
# Get a free key at https://voyageai.com
# VOYAGE_API_KEY=pa-xxx

# Enable mock mode for development (no API key needed)
VOYAGE_MOCK=true

# Daemon port (default: 7654)
# MEMORY_DAEMON_PORT=7654
```

Build and start:

```bash
pnpm build
pnpm dev
```

---

## Verify It Works

Once services are running (any path above):

```bash
# Check daemon health
curl http://localhost:7654/health
# → {"status":"ok","timestamp":"..."}

# Store a memory
curl -X POST http://localhost:7654/remember \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "test",
    "text": "The user prefers dark mode for all apps",
    "tags": ["preference", "ui"]
  }'

# Search semantically
curl "http://localhost:7654/recall?agentId=test&query=theme+preference"
# → returns the memory with a relevance score
```

Open the web dashboard at `http://localhost:3000` to browse memories visually.

---

## Seed Demo Data

To populate the database with 50 realistic demo memories:

```bash
pnpm --filter @openclaw-memory/daemon db:seed
```

This creates memories across 2 agents (`demo-agent` and `assistant-agent`) spread over 90 days. Great for exploring the dashboard visualizations.

---

## Mock Mode vs Real Embeddings

|                    | Mock Mode                 | Real Voyage AI              |
| ------------------ | ------------------------- | --------------------------- |
| **Cost**           | Free                      | ~$0.10 per 1M tokens        |
| **Setup**          | `VOYAGE_MOCK=true`        | `VOYAGE_API_KEY=pa-xxx`     |
| **Search quality** | Hash-based (good for dev) | Semantic (production-ready) |
| **Speed**          | Instant                   | ~100ms per embedding        |

Start with mock mode for development. When you need production-quality semantic search, get a free API key from [voyageai.com](https://voyageai.com) and set `VOYAGE_API_KEY` in `.env.local`.

---

## What's Included

```
openclaw-memory/
├── packages/
│   ├── daemon/     # Express API server (port 7654)
│   ├── web/        # Next.js + LeafyGreen UI dashboard (port 3000)
│   ├── client/     # TypeScript client SDK
│   └── cli/        # CLI tool (ocmem)
├── scripts/        # Setup and management
├── docs/           # Documentation
└── .env.example    # Environment template
```

## Next Steps

- [Configuration Reference](./configuration.md) — all environment variables and options
- [API Reference](./api-reference.md) — complete HTTP API documentation
- [Architecture](./architecture.md) — how the system works internally
- [Deployment Guide](./deployment.md) — Docker, production, CI/CD, and scaling
- [Contributing](./contributing.md) — development workflow and testing
