# OpenClaw Memory - Installation Guide

Complete guide to installing and running OpenClaw Memory system.

---

## Quick Start (5 minutes)

### 1. Install Packages

```bash
# Install the CLI globally
npm install -g @openclaw-memory/cli

# Install the daemon
npm install -g @openclaw-memory/daemon

# Or install both at once
npm install -g @openclaw-memory/cli @openclaw-memory/daemon
```

### 2. Set Up MongoDB

**Option A: MongoDB Atlas (Recommended)**

1. Create a free cluster at [mongodb.com/cloud/atlas](https://mongodb.com/cloud/atlas)
2. Get your connection string (looks like `mongodb+srv://user:pass@cluster.mongodb.net/`)
3. Create a database called `openclaw_memory`

**Option B: Local MongoDB**

```bash
# macOS
brew install mongodb-community
brew services start mongodb-community

# Linux
sudo apt-get install mongodb
sudo systemctl start mongod

# Connection string: mongodb://localhost:27017/openclaw_memory
```

### 3. Configure the Daemon

Create `~/.openclaw-memory/.env`:

```bash
mkdir -p ~/.openclaw-memory
cat > ~/.openclaw-memory/.env << 'EOF'
# MongoDB Connection
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/openclaw_memory

# Daemon Port (default: 7751)
MEMORY_DAEMON_PORT=7751

# Voyage AI Embeddings (optional - defaults to mock mode)
VOYAGE_API_KEY=your-voyage-key-here
VOYAGE_MOCK=true  # Set to false to use real embeddings

# Database Name (optional - defaults to openclaw_memory)
MEMORY_DB_NAME=openclaw_memory
EOF
```

**Edit the file** and add your MongoDB connection string:

```bash
nano ~/.openclaw-memory/.env
# or
code ~/.openclaw-memory/.env
```

### 4. Start the Daemon

```bash
openclaw-memory-daemon
```

You should see:

```
🧠 OpenClaw Memory Daemon v0.2.1
✅ Connected to MongoDB: openclaw_memory
✅ Voyage embeddings: mock mode
🚀 Server running on http://localhost:7751
```

**Test it:**

```bash
curl http://localhost:7751/health
```

### 5. Test CLI Tools

```bash
# Check status
ocmem status

# Save a memory
curl -X POST http://localhost:7751/remember \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "test-agent",
    "text": "OpenClaw Memory is working!",
    "tags": ["test"]
  }'

# Search memories
curl "http://localhost:7751/recall?agentId=test-agent&query=working"

# Export all memories
ocmem export --agent test-agent
```

---

## Web Dashboard (Optional)

The web dashboard is **not** published to NPM (it's a Next.js app, not a library).

### Install from Source

```bash
# Clone the repo
git clone https://github.com/mrlynn/openclaw-mongodb-memory.git
cd openclaw-mongodb-memory/packages/web

# Install dependencies
npm install

# Configure
cp .env.local.example .env.local
nano .env.local
```

Add to `.env.local`:

```env
MEMORY_DAEMON_URL=http://localhost:7751
NEXT_PUBLIC_DEFAULT_AGENT_ID=openclaw
```

### Run Development Server

```bash
npm run dev
```

Open http://localhost:3000

### Deploy to Production

**Option A: Vercel (Recommended)**

```bash
npm install -g vercel
vercel
```

**Option B: Docker**

```bash
cd packages/web
docker build -t openclaw-memory-web .
docker run -p 3000:3000 --env-file .env.local openclaw-memory-web
```

**Option C: Build Static**

```bash
npm run build
npm start
```

---

## Configuration Reference

### Environment Variables

| Variable             | Default           | Description                               |
| -------------------- | ----------------- | ----------------------------------------- |
| `MONGODB_URI`        | _required_        | MongoDB connection string                 |
| `MEMORY_DAEMON_PORT` | `7751`            | HTTP API port                             |
| `MEMORY_DB_NAME`     | `openclaw_memory` | Database name                             |
| `VOYAGE_API_KEY`     | _(optional)_      | Voyage AI API key                         |
| `VOYAGE_MOCK`        | `true`            | Use mock embeddings (free, deterministic) |
| `VOYAGE_MODEL`       | `voyage-3`        | Embedding model                           |

### CLI Commands

```bash
# Daemon status and health
ocmem status

# Export memories
ocmem export --agent <agentId> [--output file.json]

# Clear all memories for an agent
ocmem clear --agent <agentId>

# Purge old memories
ocmem purge --agent <agentId> --before 2026-01-01

# Debug mode (verbose logging)
ocmem debug
```

### API Endpoints

| Endpoint      | Method | Description                           |
| ------------- | ------ | ------------------------------------- |
| `/health`     | GET    | Health check                          |
| `/status`     | GET    | Daemon status (MongoDB, memory count) |
| `/remember`   | POST   | Save a memory                         |
| `/recall`     | GET    | Search memories                       |
| `/forget/:id` | DELETE | Delete a memory                       |
| `/clear`      | DELETE | Clear all memories for agent          |
| `/export`     | GET    | Export memories as JSON               |
| `/agents`     | GET    | List all agents with memory counts    |
| `/timeline`   | GET    | Memory timeline (day buckets)         |
| `/wordcloud`  | GET    | Word frequency analysis               |

---

## Troubleshooting

### Daemon won't start

```bash
# Check if port 7751 is already in use
lsof -i :7751

# Kill existing process
pkill -f openclaw-memory-daemon

# Try a different port
MEMORY_DAEMON_PORT=7752 openclaw-memory-daemon
```

### MongoDB connection fails

```bash
# Test connection manually
mongosh "mongodb+srv://user:pass@cluster.mongodb.net/openclaw_memory"

# Check firewall rules (Atlas IP allowlist)
# Add your IP at: mongodb.com/cloud/atlas

# Verify connection string format
echo $MONGODB_URI
```

### Tests failing

```bash
# Use test database (not production!)
export MEMORY_DB_NAME=openclaw_memory_test
export MONGODB_URI="mongodb://localhost:27017/openclaw_memory_test"

# Run tests
cd packages/daemon
npm test
```

### CLI not found after install

```bash
# Check npm global bin directory
npm bin -g

# Add to PATH (add to ~/.zshrc or ~/.bashrc)
export PATH="$(npm bin -g):$PATH"

# Or use npx
npx @openclaw-memory/cli status
```

---

## Next Steps

1. **Integrate with OpenClaw**: Add the plugin to `~/.openclaw/openclaw.json`
2. **Configure workflows**: Define when to auto-save memories (see `AGENT_WORKFLOW.md`)
3. **Monitor usage**: Check `ocmem status` regularly
4. **Set up backups**: Export memories periodically (`ocmem export`)
5. **Deploy dashboard**: Host the web UI for easier memory browsing

---

## Support

- **Documentation**: https://github.com/mrlynn/openclaw-mongodb-memory/tree/main/docs
- **Issues**: https://github.com/mrlynn/openclaw-mongodb-memory/issues
- **Discord**: _(coming soon)_
- **Email**: michael.lynn@mongodb.com

---

## Version

Current release: **v0.2.1**

Check for updates:

```bash
npm outdated -g @openclaw-memory/cli
npm update -g @openclaw-memory/cli @openclaw-memory/daemon
```
