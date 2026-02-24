# Troubleshooting Guide

## "Failed to load memories" Error

### Symptom
Console shows: `Failed to load memories`  
Dashboard shows: "Failed to load layer statistics"

### Root Cause
The **daemon is not running**.

### Quick Fix

**1. Check if daemon is running:**
```bash
curl http://localhost:7654/health
```

**Expected:** `{"status":"ok","timestamp":"..."}`  
**If no response:** Daemon is not running

**2. Start the daemon:**
```bash
cd /Users/michael.lynn/code/openclaw-memory/packages/daemon
npm start
```

**3. Refresh browser**
The "Failed to load memories" error should disappear.

---

## Common Errors & Solutions

### Error: "HTTP 404: Not Found"
**Cause:** API endpoint doesn't exist  
**Fix:** Make sure you're running the latest daemon build:
```bash
cd packages/daemon
npm run build
npm start
```

### Error: "HTTP 500: Internal Server Error"
**Cause:** Daemon crashed or MongoDB issue  
**Fix:**
```bash
# Check daemon logs
tail -100 /tmp/openclaw-daemon.log

# Restart daemon
cd packages/daemon
npm start
```

### Error: "Failed to fetch"
**Cause:** CORS or network issue  
**Fix:**
```bash
# Check daemon is accessible
curl http://localhost:7654/health

# Check MongoDB is running
mongosh --quiet --eval "db.version()"
```

### Error: "No memories yet" (but you have memories)
**Cause:** Wrong agentId or daemon URL  
**Fix:**
1. Check agent selector shows correct agent
2. Check Settings → Daemon URL is correct
3. Verify memories exist:
   ```bash
   curl "http://localhost:7654/memories?agentId=openclaw&limit=5"
   ```

---

## Quick Health Check

Run this one-liner to check all services:

```bash
echo "🔍 Health Check" && \
echo "MongoDB: $(mongosh --quiet --eval 'db.version()' 2>&1 || echo '❌ Not running')" && \
echo "Daemon: $(curl -s http://localhost:7654/health 2>&1 | grep -o 'ok' || echo '❌ Not running')" && \
echo "Web: $(curl -s http://localhost:3002 2>&1 | grep -o 'OpenClaw' || echo '❌ Not running')"
```

**Expected output:**
```
🔍 Health Check
MongoDB: 8.2.5
Daemon: ok
Web: OpenClaw
```

---

## Start All Services

**One-command start:**
```bash
./scripts/demo-start.sh
```

**Manual start:**
```bash
# Terminal 1: Start daemon
cd packages/daemon
npm start

# Terminal 2: Start web
cd packages/web
npm run dev
```

---

## Debug Mode

**Enable verbose logging:**

Add to `packages/daemon/.env.local`:
```bash
DEBUG=openclaw:*
LOG_LEVEL=debug
```

Restart daemon and check logs:
```bash
tail -f /tmp/openclaw-daemon.log
```

---

## Browser Console Debugging

**Open browser DevTools (F12) and check:**

1. **Console tab** — Look for error details
2. **Network tab** — Check failed requests
3. **Application tab** → Local Storage → Check:
   - `openclaw-agent-id`
   - `openclaw-daemon-url`

**Fix localStorage issues:**
```javascript
// In browser console
localStorage.setItem('openclaw-agent-id', 'openclaw');
localStorage.setItem('openclaw-daemon-url', 'http://localhost:7654');
location.reload();
```

---

## Still Having Issues?

**Check the logs:**
```bash
# Daemon logs
tail -100 ~/.openclaw/logs/openclaw-memory.log

# Or if using demo script
tail -100 /tmp/openclaw-daemon.log
tail -100 /tmp/openclaw-web.log
```

**Restart everything:**
```bash
# Stop all
./scripts/demo-stop.sh

# Start fresh
./scripts/demo-start.sh
```

**Nuclear option (reset everything):**
```bash
# Stop services
./scripts/demo-stop.sh

# Clear data (WARNING: deletes all memories!)
mongosh openclaw-memory --eval "db.dropDatabase()"

# Fresh start
./scripts/demo-start.sh
```

---

**Quick fixes summary:**
- ❌ "Failed to load memories" → Start daemon
- ❌ "No memories yet" → Check agent selector
- ❌ Can't connect → Check MongoDB running
- ❌ Stale data → Clear browser cache
