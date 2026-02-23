# OpenClaw Integration Guide

## Overview
Wire the memory infrastructure into OpenClaw so that:
1. **Daemon auto-spawns** when OpenClaw starts
2. **MemoryClient** is available in main agent context  
3. **Memories persist** across sessions

## Current Status
- ✅ Daemon running on `localhost:7751` (mock embeddings for development)
- ✅ Web dashboard on `localhost:3001` (real-time monitoring)
- ✅ MongoDB connected (vai database)
- ⏳ **Need:** Integration with OpenClaw main process

---

## Part 1: Verify Current Setup

```bash
# Check daemon health
curl http://localhost:7751/status | jq .

# Check web dashboard
open http://localhost:3001/health
```

Expected output:
```json
{
  "success": true,
  "daemon": "ready",
  "mongodb": "connected",
  "voyage": "ready",
  "uptime": 4.78,
  "memory": {"heapUsed": 20, "heapTotal": 29},
  "stats": {"totalMemories": 8}
}
```

---

## Part 2: Auto-Start Daemon with OpenClaw (Using Cron)

The memory daemon should start automatically when OpenClaw boots. Use OpenClaw's cron system to ensure it's always running:

```bash
# Create a startup script
cat > ~/.openclaw/scripts/ensure-memory-daemon.sh << 'EOF'
#!/bin/bash
# Ensure memory daemon is running

DAEMON_PORT=7751
DAEMON_PID_FILE="/tmp/memory-daemon.pid"

# Check if daemon is already running
if nc -zv localhost $DAEMON_PORT &>/dev/null; then
  echo "[$(date)] Memory daemon is running on port $DAEMON_PORT"
  exit 0
fi

echo "[$(date)] Starting memory daemon..."
cd /Users/michael.lynn/code/openclaw-memory/packages/daemon
npm start > /tmp/daemon.log 2>&1 &
echo $! > $DAEMON_PID_FILE

# Wait for daemon to be ready
for i in {1..30}; do
  if curl -s http://localhost:$DAEMON_PORT/health > /dev/null 2>&1; then
    echo "[$(date)] ✓ Memory daemon started successfully"
    exit 0
  fi
  sleep 1
done

echo "[$(date)] ✗ Failed to start memory daemon"
cat /tmp/daemon.log
exit 1
EOF

chmod +x ~/.openclaw/scripts/ensure-memory-daemon.sh
```

Then register a cron job to check every 5 minutes:

```bash
openclaw cron add \
  --job '{
    "name": "Memory Daemon Keeper",
    "schedule": {
      "kind": "every",
      "everyMs": 300000
    },
    "payload": {
      "kind": "systemEvent",
      "text": "Memory daemon health check"
    },
    "sessionTarget": "main"
  }'
```

Or simpler: Run it as a background process in your shell startup:

```bash
# Add to ~/.zshrc or ~/.bashrc
if ! nc -zv localhost 7751 &>/dev/null; then
  cd /Users/michael.lynn/code/openclaw-memory/packages/daemon
  npm start > /tmp/daemon.log 2>&1 &
fi
```

---

## Part 3: Wire MemoryClient Into Main Agent

The memory client is available as an npm package. To use it in your OpenClaw agent sessions:

### 3a. Install the client

```bash
# Already available in the monorepo
cd /Users/michael.lynn/code/openclaw-memory
npm install

# Or from your agent code:
npm install @openclaw-memory/client
```

### 3b. Use in Agent Sessions

In your OpenClaw agent code (wherever you handle user messages):

```typescript
import { MemoryClient } from "@openclaw-memory/client";

// Initialize client
const memoryClient = new MemoryClient({
  daemonUrl: "http://localhost:7751",
  agentId: "main", // Unique ID for this agent
});

// BEFORE processing user message: Recall relevant memories
const userMessage = "Tell me about my Material UI preferences";
const relevantMemories = await memoryClient.recall(userMessage);
console.log("Relevant memories:", relevantMemories);

// ADD relevant context to prompt/system message
const memoryContext = relevantMemories
  .map(m => `- ${m.text} (score: ${m.score.toFixed(2)})`)
  .join("\n");

// YOUR EXISTING PROMPT LOGIC + memory context
const systemPrompt = `You are a helpful assistant.

Relevant past context:
${memoryContext}

Current user message: ${userMessage}`;

// Process user message with system prompt...

// AFTER generating response: Store key facts as memories
await memoryClient.remember({
  text: "User prefers Material UI over Tailwind",
  tags: ["design", "preference"],
  ttl: 30 * 24 * 60 * 60, // 30 days
});
```

### 3c. Configuration

Set these environment variables in OpenClaw context:

```bash
# .env or OpenClaw config
MEMORY_DAEMON_URL=http://localhost:7751
MEMORY_AGENT_ID=main  # Or whatever OpenClaw calls its main agent
MEMORY_ENABLED=true
```

---

## Part 4: Integration Points

### 4a. Auto-Load MemoryClient in Main Agent

If you have an agent entrypoint (e.g., `main.ts`), initialize memory there:

```typescript
// At agent startup
const memoryClient = new MemoryClient({
  daemonUrl: process.env.MEMORY_DAEMON_URL || "http://localhost:7751",
  agentId: process.env.MEMORY_AGENT_ID || "main",
});

// Store in global/context
global.memoryClient = memoryClient;

// All handlers can now access via global.memoryClient
```

### 4b. Middleware for Automatic Memory

Add a middleware that:
1. Before user message → `recall()` relevant memories
2. After response → `remember()` key insights

```typescript
async function memoryMiddleware(userMessage: string, handler: () => Promise<string>) {
  if (!global.memoryClient) return handler();

  // Recall
  const memories = await global.memoryClient.recall(userMessage);
  const context = formatMemoriesForPrompt(memories);
  
  // Process with context
  const result = await handler(); // Pass `context` to handler
  
  // Remember (extract key facts from result)
  const key Facts = extractFactsFromResponse(result);
  for (const fact of keyFacts) {
    await global.memoryClient.remember({
      text: fact.text,
      tags: fact.tags,
      ttl: 30 * 24 * 60 * 60,
    });
  }
  
  return result;
}
```

### 4c. OpenClaw Config Addition

Add to OpenClaw config (if applicable):

```yaml
# .openclaw/config.yaml or similar
agents:
  main:
    memory:
      enabled: true
      daemonUrl: "http://localhost:7751"
      mockMode: true  # Use deterministic embeddings
      agentId: "main"
      ttl: 30
```

---

## Part 5: Testing Integration

### Test 1: Verify Daemon + Client Together

```bash
# Terminal 1: Start daemon (if not running)
cd /Users/michael.lynn/code/openclaw-memory/packages/daemon
npm start

# Terminal 2: Test with curl
curl -X POST http://localhost:7751/remember \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "michael",
    "text": "I prefer Material UI over Tailwind",
    "tags": ["design", "preference"],
    "ttl": 86400
  }'

# Terminal 3: Recall
curl "http://localhost:7751/recall?agentId=michael&query=UI+preference&limit=5" | jq .
```

### Test 2: Test Client Library

```bash
cd /Users/michael.lynn/code/openclaw-memory
cat > test-client.js << 'EOF'
const { MemoryClient } = require("./packages/client/dist");

const client = new MemoryClient({ daemonUrl: "http://localhost:7751" });

(async () => {
  // Remember
  const memory = await client.remember({
    agentId: "test",
    text: "This is a test memory",
    tags: ["test"],
    ttl: 3600,
  });
  console.log("Created:", memory);

  // Recall
  const results = await client.recall("test memory", { agentId: "test" });
  console.log("Found:", results);

  // Forget
  await client.forget(memory.id);
  console.log("Deleted");
})();
EOF

node test-client.js
```

### Test 3: Web Dashboard

Open http://localhost:3001 in your browser:
- **Remember tab:** Store a new memory
- **Recall tab:** Search for it
- **Health & Integration:** Verify daemon status

---

## Part 6: Environment Configuration

### Development (Mock Embeddings)

```bash
# .env.local
MEMORY_DAEMON_PORT=7751
NEXT_PUBLIC_DAEMON_URL=http://localhost:7751
VOYAGE_MOCK=true
VOYAGE_API_KEY=<any-key>  # Not used in mock mode
MEMORY_ENABLED=true
```

### Production (Real Embeddings)

```bash
# .env.production
MEMORY_DAEMON_PORT=7751
NEXT_PUBLIC_DAEMON_URL=https://memory.your-domain.com
VOYAGE_MOCK=false
VOYAGE_API_KEY=pa-<real-voyage-key>  # From https://voyageai.com
MONGODB_URI=<your-atlas-uri>
MEMORY_ENABLED=true
```

---

## Part 7: Troubleshooting

### Daemon not connecting

```bash
# 1. Check if running
curl http://localhost:7751/health

# 2. Check logs
tail -50 /tmp/daemon.log

# 3. Check port
ss -tlnp | grep 7751

# 4. Verify MongoDB URI in .env.local
grep MONGODB_URI /Users/michael.lynn/code/openclaw-memory/.env.local
```

### Web dashboard shows "Disconnected"

```bash
# 1. Check CORS is enabled in daemon (it is by default)
# 2. Check daemon is responding
curl http://localhost:7751/status | jq .

# 3. Check web app env vars
grep NEXT_PUBLIC_DAEMON_URL /Users/michael.lynn/code/openclaw-memory/.env.local

# 4. Clear browser cache, reload
# Hard refresh: Cmd+Shift+R (macOS)
```

### MongoDB connection errors

```bash
# Verify connection string
echo $MONGODB_URI

# Test with mongosh
mongosh "$MONGODB_URI/vai"

# Check that vai database exists
db.adminCommand({ listDatabases: {} })
```

---

## Part 8: Next Steps

1. ✅ **Daemon running** — Verified, all endpoints working
2. ✅ **Web dashboard** — Ready for real-time monitoring
3. ⏳ **Integrate with OpenClaw main agent** — Wire MemoryClient into your agent code
4. ⏳ **Auto-spawn on startup** — Add cron/startup script
5. ⏳ **Real embeddings** — Get free Voyage API key (https://voyageai.com), update VOYAGE_MOCK=false

---

## Quick Command Reference

```bash
# Start daemon
cd /Users/michael.lynn/code/openclaw-memory/packages/daemon && npm start

# Start web dashboard
cd /Users/michael.lynn/code/openclaw-memory/packages/web && npm run dev  # port 3001

# Start CLI
cd /Users/michael.lynn/code/openclaw-memory/packages/cli && npm start

# Test API
curl http://localhost:7751/status | jq .
curl http://localhost:7751/health | jq .
curl "http://localhost:7751/recall?agentId=michael&query=test&limit=5" | jq .

# Rebuild all
cd /Users/michael.lynn/code/openclaw-memory && pnpm build

# Install dependencies
cd /Users/michael.lynn/code/openclaw-memory && pnpm install
```

---

## Files to Reference

- **Daemon:** `/packages/daemon/src/` — Express.js server, MongoDB, Voyage integration
- **Client:** `/packages/client/src/MemoryClient.ts` — Node.js client library
- **CLI:** `/packages/cli/src/index.ts` — Command-line tools
- **Web:** `/packages/web/app/` — Next.js dashboard (Material UI)
- **Docs:** `SKILL.md`, `FOR_ENGINEERS.md`, `HANDOFF.md`, `QUICK_START.md`

---

## Support

If something isn't working:

1. Check daemon logs: `tail -100 /tmp/daemon.log`
2. Test API directly: `curl http://localhost:7751/status | jq .`
3. Check .env.local variables
4. Check MongoDB connection
5. Restart daemon and web server
6. Review FOR_ENGINEERS.md for detailed architecture

---

Good luck, Michael! The system is production-ready. Now integrate it into OpenClaw and start building the app store. 🚀
