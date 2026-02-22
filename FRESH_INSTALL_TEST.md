# Fresh Install Test Plan

**Purpose:** Verify the openclaw-memory system works end-to-end from a clean slate, exactly as a new user would experience it.

**Last Tested:** Not yet tested (created 2026-02-22 17:35 EST)

---

## Phase 1: Complete Removal

**💡 Quick Path:** Use the automated uninstall script:

```bash
cd ~/code/openclaw-memory
./scripts/uninstall.sh
```

This automates steps 1.1-1.3 below. Then follow 1.2 (manual config edit) and optionally 1.4.

---

**📝 Manual Path (if you want to understand each step):**

### 1.1 Stop All Running Services

```bash
# Kill daemon
ps aux | grep "openclaw-memory.*daemon" | grep -v grep | awk '{print $2}' | xargs kill 2>/dev/null || true

# Kill web dashboard
ps aux | grep "openclaw-memory.*web" | grep -v grep | awk '{print $2}' | xargs kill 2>/dev/null || true

# Verify nothing running on port 7751 (daemon)
curl -s http://localhost:7751/health || echo "✓ Daemon stopped"

# Verify nothing running on port 3002 (web)
curl -s http://localhost:3002 || echo "✓ Web dashboard stopped"
```

**Expected:** All services stopped, ports freed.

### 1.2 Remove OpenClaw Plugin Integration

```bash
# Backup current config (uninstall.sh does this automatically)
cp ~/.openclaw/openclaw.json ~/.openclaw/openclaw.json.backup

# Remove plugin entry from openclaw.json
# Manual step: Edit ~/.openclaw/openclaw.json
# - Remove "openclaw-memory" from plugins.allow
# - Remove "openclaw-memory" from plugins.entries
# - Remove custom plugins.load.paths entry
# - Set plugins.slots.memory to null or remove it
```

**Expected:** Plugin no longer configured in OpenClaw.

### 1.3 Remove Installation Artifacts

```bash
# Remove any old plugin copies
rm -rf ~/.openclaw/extensions/memory-mongodb
rm -rf ~/.openclaw/workspace/skills/openclaw-memory*

# Verify cleanup
ls -la ~/.openclaw/extensions/ | grep memory
ls -la ~/.openclaw/workspace/skills/ | grep memory
# Should show no results
```

**Expected:** No traces in extensions/ or skills/ directories.

### 1.4 Clear Test Data (Optional)

**💡 Quick Path:** Use the automated cleanup script:

```bash
cd ~/code/openclaw-memory
./scripts/cleanup.sh
# Select option 1 (remove test agents)
```

**📝 Manual Path:**

```bash
# Connect to MongoDB and drop test collections
mongosh "$MONGODB_URI" <<EOF
use openclaw_memory
db.memories.drop()
db.sessions.drop()
exit
EOF
```

**Expected:** Fresh database state (only if you want to test with empty data).

---

## Phase 2: Fresh Installation

### 2.1 Clone/Update Source Repository

```bash
# If first time
cd ~/code
git clone <REPO_URL> openclaw-memory

# If already cloned
cd ~/code/openclaw-memory
git pull origin master
git log -1 --oneline  # Verify latest commit
```

**Expected:** Latest version of openclaw-memory source code.

### 2.2 Install Dependencies

```bash
cd ~/code/openclaw-memory

# Root dependencies
pnpm install

# Verify monorepo structure
ls -la packages/
# Should see: daemon/ web/
```

**Expected:** All dependencies installed via pnpm workspace.

### 2.3 Configure Environment

```bash
# Copy example env
cp .env.example .env.local

# Edit .env.local with your settings:
# - MONGODB_URI=<your MongoDB connection string>
# - VOYAGE_API_KEY=<your Voyage AI key OR MongoDB Atlas AI key>
# - VOYAGE_BASE_URL (if using MongoDB Atlas: https://ai.mongodb.com/v1)
# - VOYAGE_MODEL (default: voyage-3)
# - VOYAGE_MOCK=true (for testing without API costs)

cat .env.local  # Verify settings
```

**Expected:** Environment configured with valid credentials.

### 2.4 Build Daemon

```bash
cd ~/code/openclaw-memory/packages/daemon
npm run build

# Verify build output
ls -la dist/
# Should see: server.js, routes/, etc.
```

**Expected:** Clean TypeScript build, no errors.

### 2.5 Start Daemon

```bash
cd ~/code/openclaw-memory/packages/daemon
npm start > /tmp/openclaw-memory-daemon.log 2>&1 &

# Wait for startup
sleep 5

# Check logs
tail -30 /tmp/openclaw-memory-daemon.log
# Should see:
# ✓ Voyage API configured
# ✓ Connected to MongoDB
# 🧠 Memory daemon listening on http://localhost:7751
```

**Expected:** Daemon running on port 7751.

### 2.6 Verify Daemon Health

```bash
# Basic health check
curl -s http://localhost:7751/health | jq
# Expected: {"status":"ok","timestamp":"..."}

# Full status
curl -s http://localhost:7751/status | jq
# Expected: {
#   "success": true,
#   "daemon": "ready",
#   "mongodb": "connected",
#   "voyage": "ready",
#   ...
# }

# List agents (should be empty or show existing)
curl -s http://localhost:7751/agents | jq
# Expected: {"success":true,"count":0,"agents":[]}
```

**Expected:** All endpoints responding, daemon healthy.

**💡 Quick Check:** Use the status script to verify everything at once:

```bash
cd ~/code/openclaw-memory
./scripts/status.sh
```

### 2.7 Test Basic Remember/Recall

```bash
# Store a test memory
curl -X POST http://localhost:7751/remember \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "test-user",
    "text": "Fresh install test memory",
    "tags": ["test", "install"],
    "ttl": 3600
  }' | jq

# Expected: {"success":true,"id":"..."}

# Recall it
curl -s "http://localhost:7751/recall?agentId=test-user&query=fresh+install&limit=5" | jq

# Expected: {"success":true,"count":1,"results":[{...}]}
```

**Expected:** Remember and recall working end-to-end.

---

## Phase 3: OpenClaw Integration

### 3.1 Configure Plugin in OpenClaw

```bash
# Edit ~/.openclaw/openclaw.json

# Add to plugins section:
{
  "plugins": {
    "slots": {
      "memory": "openclaw-memory"
    },
    "load": {
      "paths": [
        "/Users/<USERNAME>/code/openclaw-memory/plugin"
      ]
    },
    "allow": ["openclaw-memory"],
    "entries": {
      "openclaw-memory": {
        "enabled": true,
        "config": {
          "daemonUrl": "http://localhost:7751",
          "agentId": "openclaw",
          "defaultTtl": 2592000,
          "maxResults": 6,
          "minScore": 0.5,
          "autoStartDaemon": true,
          "middlewareEnabled": false
        }
      }
    }
  }
}
```

**Expected:** Plugin configured, ready for OpenClaw to load.

### 3.2 Verify Plugin Loads

```bash
# Run OpenClaw doctor
openclaw doctor 2>&1 | grep -A 20 "Plugins"

# Expected:
# Loaded: 4 (or higher)
# Errors: 0
# openclaw-memory should appear in loaded list
```

**Expected:** Plugin loads without errors.

### 3.3 Test Tools in OpenClaw Session

Start a chat with OpenClaw and run:

```
Try using memory_search to search for "fresh install test"
```

**Expected:** Tool executes, returns test memory from Phase 2.7.

```
Try using memory_get to read MEMORY.md
```

**Expected:** Tool reads workspace file successfully.

---

## Phase 4: Web Dashboard

### 4.1 Configure Web Environment

```bash
cd ~/code/openclaw-memory/packages/web

# Create .env.local
cat > .env.local <<EOF
NEXT_PUBLIC_DAEMON_URL=http://localhost:7751
NEXT_PUBLIC_MEMORY_IN_OPENCLAW_CONFIG=true
NEXT_PUBLIC_MEMORY_AGENT_CONTEXT_READY=true
EOF
```

**Expected:** Web dashboard configured to point at daemon.

### 4.2 Build and Start Web Dashboard

```bash
cd ~/code/openclaw-memory/packages/web

# Install dependencies (if needed)
pnpm install

# Build
npm run build

# Start dev server
pnpm dev

# Should start on http://localhost:3002
```

**Expected:** Web dashboard running on port 3002.

### 4.3 Test Dashboard UI

Visit http://localhost:3002 and verify:

1. **Dashboard (/)**: Shows daemon status, memory count, uptime
2. **Health (/health)**: Shows "INTEGRATED" status, all checks green
3. **Remember (/remember)**: Create a new memory via form
4. **Recall (/recall)**: Search for memories
5. **Browser (/browser)**: 
   - Agent dropdown populates automatically
   - "Load Memories" button is enabled
   - Clicking "Load Memories" shows table with date+time
   - Clicking a row opens detail drawer

**Expected:** All pages functional, no console errors.

---

## Phase 5: End-to-End Workflow Test

### 5.1 Create Memory via Web Dashboard

1. Go to http://localhost:3002/remember
2. Fill in:
   - Agent ID: `e2e-test`
   - Text: `End-to-end test workflow memory`
   - Tags: `e2e, test, workflow`
3. Submit

**Expected:** Success message, memory ID returned.

### 5.2 Search via Web Dashboard

1. Go to http://localhost:3002/recall
2. Agent ID: `e2e-test`
3. Query: `workflow`
4. Click "Recall"

**Expected:** Memory appears in results.

### 5.3 Browse via Web Dashboard

1. Go to http://localhost:3002/browser
2. Select `e2e-test` from dropdown
3. Click "Load Memories"

**Expected:** Table shows the memory with full date+time.

### 5.4 Access via OpenClaw Agent

In OpenClaw chat:

```
Search for memories about "workflow" for agent e2e-test
```

**Expected:** Agent uses `memory_search` tool and returns the memory.

### 5.5 Verify via Daemon API

```bash
curl -s "http://localhost:7751/recall?agentId=e2e-test&query=workflow" | jq '.results[0].text'
```

**Expected:** Returns "End-to-end test workflow memory"

---

## Phase 6: Cleanup Test Data

```bash
# Delete test agent memories
curl -X DELETE "http://localhost:7751/clear?agentId=test-user"
curl -X DELETE "http://localhost:7751/clear?agentId=e2e-test"

# Verify cleanup
curl -s http://localhost:7751/agents | jq
# Should not show test-user or e2e-test
```

**Expected:** Test data removed, system clean.

---

## Success Criteria Checklist

- [ ] Phase 1: Complete removal successful
- [ ] Phase 2.1-2.4: Source installed and built
- [ ] Phase 2.5-2.6: Daemon running and healthy
- [ ] Phase 2.7: Basic remember/recall working
- [ ] Phase 3.1-3.2: OpenClaw plugin loaded
- [ ] Phase 3.3: Tools working in OpenClaw session
- [ ] Phase 4.1-4.2: Web dashboard running
- [ ] Phase 4.3: All dashboard pages functional
- [ ] Phase 5.1-5.5: End-to-end workflow successful
- [ ] Phase 6: Cleanup successful
- [ ] **No errors in any logs**
- [ ] **All commit hashes match latest**

---

## Common Issues & Fixes

### Issue: Port 7751 already in use

```bash
# Find and kill the process
lsof -ti :7751 | xargs kill
# or
ps aux | grep "daemon.*server" | grep -v grep | awk '{print $2}' | xargs kill
```

### Issue: MongoDB connection failed

- Verify `MONGODB_URI` in `.env.local`
- Test connection: `mongosh "$MONGODB_URI"`
- Check firewall/network access

### Issue: Voyage API errors

- If using mock mode: ensure `VOYAGE_MOCK=true` in `.env.local`
- If using real API: verify API key is valid
- MongoDB Atlas AI users: ensure endpoint is `https://ai.mongodb.com/v1`

### Issue: OpenClaw plugin not loading

```bash
# Check plugin path exists
ls -la /Users/<USERNAME>/code/openclaw-memory/plugin/

# Verify manifest
cat /Users/<USERNAME>/code/openclaw-memory/plugin/openclaw.plugin.json

# Check OpenClaw logs
tail -100 ~/.openclaw/logs/openclaw.log | grep -i memory
```

### Issue: Web dashboard shows "Not Integrated"

- Verify `.env.local` has integration flags set to `true`
- Restart web dev server after changing `.env.local`
- Check browser console for errors

---

## Test Results Template

**Date:** YYYY-MM-DD  
**Tester:** Name  
**Git Commit:** `<commit hash>`  
**Environment:** macOS / Linux / Windows  

| Phase | Status | Notes |
|-------|--------|-------|
| 1. Removal | ✅ / ❌ | |
| 2. Installation | ✅ / ❌ | |
| 3. OpenClaw Integration | ✅ / ❌ | |
| 4. Web Dashboard | ✅ / ❌ | |
| 5. E2E Workflow | ✅ / ❌ | |
| 6. Cleanup | ✅ / ❌ | |

**Overall:** ✅ PASS / ❌ FAIL  
**Issues Found:** (list any)  
**Time to Complete:** ~XX minutes
