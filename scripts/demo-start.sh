#!/bin/bash
# OpenClaw Memory Demo Launcher
# Starts services and prepares demo environment

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DAEMON_DIR="$PROJECT_ROOT/packages/daemon"
WEB_DIR="$PROJECT_ROOT/packages/web"

echo "🚀 Starting OpenClaw Memory Demo..."
echo ""

# Check if MongoDB is accessible
echo "🔍 Checking MongoDB connection..."
if ! mongosh --quiet --eval "db.version()" > /dev/null 2>&1; then
  echo "❌ MongoDB not accessible!"
  echo ""
  echo "   If MongoDB is installed but not running:"
  echo "   - macOS (Homebrew): brew services start mongodb-community"
  echo "   - Linux (systemd): sudo systemctl start mongod"
  echo ""
  echo "   If MongoDB is not installed:"
  echo "   - macOS: brew install mongodb-community"
  echo "   - Linux: Follow https://docs.mongodb.com/manual/installation/"
  echo "   - Or use MongoDB Atlas (cloud): https://www.mongodb.com/cloud/atlas"
  echo ""
  echo "   Note: Docker is NOT required!"
  exit 1
fi
MONGO_VERSION=$(mongosh --quiet --eval "db.version()" 2>&1)
echo "   ✓ MongoDB $MONGO_VERSION running"
echo ""

# Start daemon
echo "📡 Starting daemon..."
cd "$DAEMON_DIR"
if ! npm run build > /dev/null 2>&1; then
  echo "❌ Daemon build failed"
  exit 1
fi

# Start daemon in background
npm start > /tmp/openclaw-daemon.log 2>&1 &
DAEMON_PID=$!
echo "   ✓ Daemon started (PID: $DAEMON_PID)"
echo "   Log: /tmp/openclaw-daemon.log"

# Wait for daemon to be ready
echo "   Waiting for daemon..."
sleep 3
for i in {1..10}; do
  if curl -s http://localhost:7751/health > /dev/null 2>&1; then
    echo "   ✓ Daemon ready"
    break
  fi
  if [ $i -eq 10 ]; then
    echo "❌ Daemon failed to start"
    kill $DAEMON_PID 2>/dev/null
    exit 1
  fi
  sleep 1
done
echo ""

# Start web dashboard
echo "🌐 Starting web dashboard..."
cd "$WEB_DIR"
if ! pnpm run build > /dev/null 2>&1; then
  echo "❌ Web build failed"
  kill $DAEMON_PID 2>/dev/null
  exit 1
fi

# Start web in background (PORT=3002 to avoid conflicts)
PORT=3002 pnpm start > /tmp/openclaw-web.log 2>&1 &
WEB_PID=$!
echo "   ✓ Web dashboard started (PID: $WEB_PID)"
echo "   Log: /tmp/openclaw-web.log"

# Wait for web to be ready
echo "   Waiting for web dashboard..."
sleep 5
for i in {1..15}; do
  if curl -s http://localhost:3002 > /dev/null 2>&1; then
    echo "   ✓ Web dashboard ready"
    break
  fi
  if [ $i -eq 15 ]; then
    echo "❌ Web dashboard failed to start"
    kill $DAEMON_PID $WEB_PID 2>/dev/null
    exit 1
  fi
  sleep 1
done
echo ""

# Seed demo data
echo "🌱 Seeding demo data..."
"$PROJECT_ROOT/scripts/demo-seed.sh"
echo ""

# Run reflection pipeline
echo "🔄 Running reflection pipeline..."
curl -s -X POST http://localhost:7751/reflect \
  -H "Content-Type: application/json" \
  -d '{"agentId":"openclaw"}' > /tmp/reflect-job.json
REFLECT_JOB_ID=$(cat /tmp/reflect-job.json | grep -o '"jobId":"[^"]*"' | cut -d'"' -f4)
echo "   ✓ Reflection job started: $REFLECT_JOB_ID"

# Wait for reflection to complete
echo "   Waiting for reflection to complete..."
for i in {1..30}; do
  sleep 1
  STATUS=$(curl -s "http://localhost:7751/reflect/status?jobId=$REFLECT_JOB_ID" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
  if [ "$STATUS" = "completed" ]; then
    echo "   ✓ Reflection completed"
    break
  fi
  if [ "$STATUS" = "failed" ]; then
    echo "   ⚠️  Reflection failed (demo will still work)"
    break
  fi
done
echo ""

# Enhance contradictions
echo "🧠 Enhancing contradictions with LLM..."
if curl -s http://localhost:11434/api/generate > /dev/null 2>&1; then
  curl -s -X POST http://localhost:7751/contradictions/enhance \
    -H "Content-Type: application/json" \
    -d '{"agentId":"openclaw","limit":10}' > /dev/null
  echo "   ✓ Contradictions enhanced"
else
  echo "   ⚠️  Ollama not running (LLM explanations unavailable)"
  echo "   Start Ollama: ollama serve"
fi
echo ""

# Save PIDs for cleanup
echo "$DAEMON_PID" > /tmp/openclaw-demo-daemon.pid
echo "$WEB_PID" > /tmp/openclaw-demo-web.pid

echo "✅ Demo environment ready!"
echo ""
echo "📊 Services running:"
echo "   - Daemon: http://localhost:7751"
echo "   - Dashboard: http://localhost:3002"
echo ""
echo "🎯 Demo starting points:"
echo "   1. Dashboard: http://localhost:3002/dashboard"
echo "   2. Memory Browser: http://localhost:3002/browser"
echo "   3. Graph Visualizer: http://localhost:3002/graph"
echo "   4. Conflicts: http://localhost:3002/conflicts"
echo "   5. Operations: http://localhost:3002/operations"
echo ""
echo "📚 Demo guide: $PROJECT_ROOT/docs/DEMO_GUIDE.md"
echo ""
echo "🛑 To stop demo:"
echo "   kill $DAEMON_PID $WEB_PID"
echo "   or: $PROJECT_ROOT/scripts/demo-stop.sh"
echo ""

# Open browser (macOS/Linux)
if command -v open > /dev/null 2>&1; then
  sleep 2
  open http://localhost:3002/dashboard
elif command -v xdg-open > /dev/null 2>&1; then
  sleep 2
  xdg-open http://localhost:3002/dashboard
fi

echo "🎉 Ready for demo! Browser should open automatically."
echo "   (If not, visit http://localhost:3002/dashboard)"
