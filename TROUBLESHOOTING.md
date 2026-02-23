# Troubleshooting Guide

Common issues and solutions for OpenClaw Memory.

---

## Installation Issues

### "Cannot find module 'mongodb'"

**Symptom:**
```
Error: Cannot find module 'mongodb'
```

**Cause:** Dependencies not installed

**Solution:**
```bash
cd packages/daemon
pnpm install
```

---

### "Address already in use :::7751"

**Symptom:**
```
Error: listen EADDRINUSE: address already in use :::7751
```

**Cause:** Daemon already running or port conflict

**Solution:**
```bash
# Find and kill process
lsof -ti:7751 | xargs kill -9

# Or change port
echo "MEMORY_DAEMON_PORT=7752" >> packages/daemon/.env.local
```

---

### "MONGODB_URI not set"

**Symptom:**
```
Error: MONGODB_URI not set. Please configure .env.local
```

**Cause:** Environment not configured

**Solution:**
```bash
cd packages/daemon
cp .env.example .env.local
# Edit .env.local with your MongoDB URI
```

---

## Connection Issues

### MongoDB Connection Timeout

**Symptom:**
```
MongoServerError: connection timeout
```

**Cause:** Network issue or incorrect URI

**Solution:**
1. Verify MongoDB URI:
   ```bash
   echo $MONGODB_URI
   ```

2. Test connection:
   ```bash
   curl -I https://your-cluster.mongodb.net
   ```

3. Check IP whitelist (Atlas):
   - Go to Network Access in Atlas UI
   - Add current IP: `curl ifconfig.me`

---

### "Database not initialized"

**Symptom:**
```
Error: Database not initialized. Call connectDatabase first.
```

**Cause:** Daemon started before DB connection

**Solution:**
```bash
# Restart daemon
pkill -f "packages/daemon"
cd packages/daemon && npm start
```

---

## Runtime Issues

### Daemon Won't Start

**Symptom:** `curl http://localhost:7751/health` fails

**Checklist:**
1. Check if already running:
   ```bash
   ps aux | grep "packages/daemon"
   ```

2. Check logs:
   ```bash
   tail -50 /tmp/openclaw-memory-daemon.log
   ```

3. Verify build:
   ```bash
   cd packages/daemon
   ls dist/server.js  # Should exist
   npm run build      # If not
   ```

4. Test manually:
   ```bash
   cd packages/daemon
   npm start
   ```

---

### Memory Not Stored

**Symptom:** `/remember` returns 200 but memory not in DB

**Debug steps:**
1. Check response:
   ```bash
   curl -X POST http://localhost:7751/remember \
     -H "Content-Type: application/json" \
     -d '{"agentId":"test","text":"debug"}' | jq
   ```

2. Verify in DB:
   ```bash
   curl http://localhost:7751/status | jq '.stats'
   ```

3. Check logs for errors:
   ```bash
   tail -50 /tmp/openclaw-memory-daemon.log | grep ERROR
   ```

---

### Semantic Search Returns Nothing

**Symptom:** `/recall` returns `count: 0` despite memories existing

**Possible causes:**

1. **Agent ID mismatch**
   ```bash
   # Check what agentIds exist
   curl http://localhost:7751/agents | jq
   ```

2. **No embeddings generated**
   - Check if `VOYAGE_MOCK=true` in `.env.local`
   - Verify embeddings exist in DB

3. **Query too specific**
   - Try broader queries
   - Check `minScore` threshold (default 0.5)

**Solution:**
```bash
# Lower minScore for debugging
curl "http://localhost:7751/recall?agentId=test&query=test&minScore=0&limit=10"
```

---

## Plugin Issues

### Plugin Not Loading

**Symptom:** OpenClaw gateway starts but memory tools unavailable

**Debug:**
1. Check plugin config:
   ```bash
   cat ~/.openclaw/openclaw.json | jq '.plugins'
   ```

2. Verify plugin path:
   ```bash
   ls ~/.openclaw/extensions/memory-mongodb
   # Or check load.paths in config
   ```

3. Check OpenClaw logs:
   ```bash
   tail -50 ~/.openclaw/logs/openclaw.log | grep -i memory
   ```

---

### Daemon Not Auto-Starting

**Symptom:** Plugin loaded but daemon not running

**Checklist:**
1. Verify `autoStartDaemon: true` in config
2. Check plugin directory exists:
   ```bash
   ls ~/code/openclaw-memory/packages/daemon
   ```

3. Test manual start:
   ```bash
   cd ~/code/openclaw-memory/packages/daemon
   npm start
   ```

---

## Performance Issues

### Slow Embeddings

**Symptom:** `/remember` takes >5 seconds

**Cause:** Real Voyage API calls (network latency)

**Solution:** Use mock embeddings for testing:
```bash
echo "VOYAGE_MOCK=true" >> packages/daemon/.env.local
# Restart daemon
```

---

### Slow Recall with Many Memories

**Symptom:** `/recall` slow with >10K memories

**Cause:** In-memory cosine similarity at scale

**Solution:** Use Atlas Vector Search (future enhancement)

**Workaround:**
```bash
# Reduce limit
curl "http://localhost:7751/recall?agentId=test&query=test&limit=5"
```

---

## Test Failures

### Unit Tests Failing

**Symptom:** `pnpm test` fails

**Common causes:**

1. **MongoDB not running**
   ```bash
   # Check MONGODB_URI in .env.local
   cat packages/daemon/.env.local
   ```

2. **Port conflict**
   ```bash
   # Kill daemon before tests
   pkill -f "packages/daemon"
   ```

3. **Stale build**
   ```bash
   cd packages/daemon
   rm -rf dist/
   npm run build
   ```

---

### Integration Tests Failing

**Symptom:** Fresh install test fails

**Debug:**
1. Clean slate:
   ```bash
   rm -rf /tmp/openclaw-memory-test
   ```

2. Check MongoDB connection:
   ```bash
   curl -I $MONGODB_URI
   ```

3. Run step-by-step (see INTEGRATION_TESTS.md)

---

## Web Dashboard Issues

### Dashboard Won't Load

**Symptom:** `http://localhost:3000` not responding

**Solution:**
```bash
cd packages/web
pnpm dev
```

---

### Dashboard Shows "Daemon not responding"

**Symptom:** Dashboard loads but shows error

**Checklist:**
1. Verify daemon running:
   ```bash
   curl http://localhost:7751/health
   ```

2. Check CORS (if accessing from different origin)

3. Verify `NEXT_PUBLIC_DAEMON_URL` in `.env.local`

---

## Data Issues

### Duplicate Memories

**Symptom:** Same memory appears multiple times

**Cause:** Hydration ran multiple times without deduplication

**Solution:**
```bash
# Delete duplicates via web dashboard
# Or use forget endpoint:
curl -X DELETE http://localhost:7751/forget/{id}
```

---

### Lost Memories After Restart

**Symptom:** Memories disappear after daemon restart

**Possible causes:**

1. **Wrong database**
   - Check `MEMORY_DB_NAME` env var
   - Verify MongoDB URI includes correct database

2. **TTL expired**
   - Check `expiresAt` field in MongoDB
   - Memories auto-delete after TTL

3. **Different agentId**
   ```bash
   # List all agentIds
   curl http://localhost:7751/agents
   ```

---

## Migration Issues

### Hydration Import Fails

**Symptom:** `hydrate-memories.ts import` returns errors

**Common causes:**

1. **Markdown format**
   - Needs `##` or `###` headers
   - Check with: `cat file.md | head -20`

2. **File not found**
   ```bash
   # Use absolute path
   npx tsx hydrate-memories.ts import ~/full/path/to/file.md
   ```

3. **Duplicate detection too strict**
   - Edit text slightly if you want separate entries

---

## Getting Help

### Enable Debug Logging

```bash
# Set in .env.local
DEBUG=openclaw:memory*

# Or environment variable
export DEBUG=openclaw:memory*
npm start
```

---

### Collect Debug Info

```bash
# System info
node --version
npm --version

# Daemon status
curl http://localhost:7751/status | jq

# Recent logs
tail -100 /tmp/openclaw-memory-daemon.log

# Database stats
curl http://localhost:7751/agents | jq
```

---

### Report an Issue

**Before filing a bug:**
1. Check this troubleshooting guide
2. Search existing issues: https://github.com/mrlynn/openclaw-mongodb-memory/issues
3. Collect debug info (above)

**Bug report template:**
```markdown
**Describe the bug**
A clear description of what's wrong.

**To Reproduce**
Steps to reproduce:
1. Run command...
2. See error...

**Expected behavior**
What should happen instead.

**Debug info**
- Node version: (output of `node --version`)
- MongoDB URI: (redact password)
- Daemon status: (output of `curl .../status`)
- Logs: (last 50 lines)

**Additional context**
Any other relevant information.
```

---

## Quick Reference

### Health Check Commands

```bash
# Daemon health
curl http://localhost:7751/health

# Full status
curl http://localhost:7751/status | jq

# List agents
curl http://localhost:7751/agents | jq

# Test memory storage
curl -X POST http://localhost:7751/remember \
  -H "Content-Type: application/json" \
  -d '{"agentId":"test","text":"debug"}'

# Test recall
curl "http://localhost:7751/recall?agentId=test&query=debug"
```

---

**Last Updated:** 2026-02-23  
**Version:** 0.1.0
