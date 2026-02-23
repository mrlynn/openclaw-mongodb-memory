# OpenClaw Memory - Installation Guide

Complete installation guide for the OpenClaw Memory system with MongoDB and Voyage AI embeddings.

## Prerequisites

- OpenClaw installed and configured
- MongoDB Atlas cluster (free tier works)
- Node.js 18+ and pnpm
- (Optional) Free Voyage AI API key from https://voyageai.com

## Quick Install

```bash
# 1. Clone or extract the openclaw-memory package
cd ~/code
git clone https://github.com/YOUR_USERNAME/openclaw-memory.git
# OR extract from .zip/.tar.gz

# 2. Install dependencies
cd openclaw-memory
pnpm install

# 3. Configure environment
cp .env.example .env.local
# Edit .env.local with your MongoDB URI and API keys

# 4. Start the daemon
cd packages/daemon
pnpm dev
```

## Step-by-Step Installation

### 1. Install the npm packages

```bash
cd ~/code/openclaw-memory
pnpm install
```

This installs:

- `@openclaw-memory/daemon` - HTTP API server
- `@openclaw-memory/client` - TypeScript client library
- `@openclaw-memory/cli` - CLI management tools
- `@openclaw-memory/web` - Next.js web dashboard

### 2. Configure MongoDB

Create a `.env.local` file in `packages/daemon/`:

```bash
MONGODB_URI=mongodb+srv://USER:PASS@cluster.mongodb.net/openclaw_memory
MEMORY_DAEMON_PORT=7751
VOYAGE_API_KEY=your-voyage-key-here  # Optional: use mock mode without this
VOYAGE_MOCK=true  # Set to false when you have a real Voyage key
```

**Using mock embeddings** (recommended for testing):

- Set `VOYAGE_MOCK=true`
- No Voyage API key needed
- Deterministic, free, zero API calls

**Using real Voyage embeddings**:

- Get free API key from https://voyageai.com
- Set `VOYAGE_MOCK=false`
- Set `VOYAGE_API_KEY=pa-YOUR_KEY_HERE`

### 3. Start the Memory Daemon

```bash
cd packages/daemon
pnpm dev
```

The daemon will:

- Connect to MongoDB
- Create required indexes automatically
- Listen on port 7751 (configurable)
- Log to console

**Verify it's running:**

```bash
curl http://localhost:7751/health
# Should return: {"status":"ok","timestamp":"..."}
```

### 4. Install the OpenClaw Plugin

Copy the plugin to OpenClaw's extensions directory:

```bash
cp -r ~/code/openclaw-memory/plugin ~/.openclaw/extensions/memory-mongodb
```

**Enable in OpenClaw config** (`~/.openclaw/openclaw.json`):

```json
{
  "plugins": {
    "slots": {
      "memory": "memory-mongodb"
    },
    "allow": ["memory-mongodb"],
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

**Restart OpenClaw gateway:**

```bash
openclaw gateway restart
```

### 5. Test the Integration

```bash
# Check plugin loaded
openclaw plugins list | grep memory-mongodb

# Test memory search tool (via OpenClaw agent)
# Send a message: "Search my memory for heartbeat"
```

Or test the daemon directly:

```bash
# Store a memory
curl -X POST http://localhost:7751/remember \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "openclaw",
    "text": "OpenClaw memory system installed successfully",
    "tags": ["installation", "test"]
  }'

# Search memories
curl "http://localhost:7751/recall?agentId=openclaw&query=installation&limit=5"
```

### 6. (Optional) Start the Web Dashboard

```bash
cd packages/web
pnpm dev
```

Open http://localhost:3002 in your browser.

### 7. (Optional) Install CLI Tools

```bash
cd packages/cli
pnpm link --global
```

Now you can use:

```bash
ocmem status       # Check daemon status
ocmem remember "Test memory"
ocmem recall "test"
ocmem export > backup.json
```

## Production Deployment

### Run Daemon as Background Service

**Using PM2:**

```bash
pm2 start packages/daemon/dist/index.js --name openclaw-memory
pm2 save
pm2 startup
```

**Using systemd (Linux):**
Create `/etc/systemd/system/openclaw-memory.service`:

```ini
[Unit]
Description=OpenClaw Memory Daemon
After=network.target

[Service]
Type=simple
User=YOUR_USER
WorkingDirectory=/home/YOUR_USER/code/openclaw-memory/packages/daemon
ExecStart=/usr/bin/node dist/index.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable openclaw-memory
sudo systemctl start openclaw-memory
```

### MongoDB Atlas Vector Search Index

For production-scale memory search (>10K memories/agent), create an Atlas Vector Search index:

1. Go to Atlas → Search → Create Search Index
2. Choose "JSON Editor"
3. Database: `openclaw_memory`, Collection: `memories`
4. Name: `memory_vector_index`
5. Paste this definition:

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 1024,
      "similarity": "cosine"
    },
    {
      "type": "filter",
      "path": "agentId"
    },
    {
      "type": "filter",
      "path": "projectId"
    },
    {
      "type": "filter",
      "path": "tags"
    }
  ]
}
```

The daemon will auto-detect and use the index when available.

## Troubleshooting

### Daemon Won't Start

**Check MongoDB connection:**

```bash
# Test connection string
mongosh "mongodb+srv://USER:PASS@cluster.mongodb.net/openclaw_memory"
```

**Check port availability:**

```bash
lsof -i :7751
```

### Plugin Not Loading

**Check OpenClaw logs:**

```bash
tail -100 ~/.openclaw/logs/openclaw.log | grep memory-mongodb
```

**Verify plugin structure:**

```bash
ls -la ~/.openclaw/extensions/memory-mongodb/
# Should contain: index.ts, openclaw.plugin.json
```

### Memory Search Returns No Results

**Check daemon is running:**

```bash
curl http://localhost:7751/status
```

**Verify memories exist:**

```bash
curl "http://localhost:7751/recall?agentId=openclaw&query=test&limit=100"
```

**Check agent ID matches:**

- Plugin config: `agentId: "openclaw"`
- Stored memories must use same agent ID

## Uninstall

```bash
# Stop daemon
pm2 stop openclaw-memory  # or systemctl stop openclaw-memory

# Remove plugin
rm -rf ~/.openclaw/extensions/memory-mongodb

# Remove from config
# Edit ~/.openclaw/openclaw.json and remove memory-mongodb entries

# Remove packages
cd ~/code
rm -rf openclaw-memory

# (Optional) Delete MongoDB data
# Use MongoDB Atlas UI or mongosh to drop the openclaw_memory database
```

## Support

- Documentation: `/Users/michael.lynn/code/openclaw-memory/README.md`
- Engineering docs: `FOR_ENGINEERS.md`
- Integration guide: `OPENCLAW_INTEGRATION.md`
- Schema reference: `SCHEMA.md`

---

**Version:** 0.1.0  
**Last Updated:** 2026-02-22
