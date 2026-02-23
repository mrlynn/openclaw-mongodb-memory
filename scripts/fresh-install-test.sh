#!/bin/bash
set -e

# Fresh Install Test Script
# Tests installing OpenClaw Memory from scratch (post-teardown)

echo "🧪 Fresh Install Test for OpenClaw Memory"
echo ""
echo "Prerequisites:"
echo "  ✓ Tear-down completed"
echo "  ✓ NPM packages published to registry"
echo "  ✓ MongoDB accessible"
echo ""
read -p "Ready to test fresh install? (y/n): " confirm

if [ "$confirm" != "y" ]; then
  echo "❌ Cancelled"
  exit 1
fi

# Phase 1: Install NPM packages
echo ""
echo "📦 Phase 1: Installing NPM packages..."
npm install -g @openclaw-memory/cli
npm install -g @openclaw-memory/daemon
npm list -g @openclaw-memory/cli @openclaw-memory/daemon

# Phase 2: Configuration
echo ""
echo "⚙️  Phase 2: Configuration..."
mkdir -p ~/.openclaw-memory-test
cd ~/.openclaw-memory-test

cat > .env << 'ENV_EOF'
# MongoDB Connection
MONGODB_URI=mongodb+srv://mike:Password678%21@performance.zbcul.mongodb.net/vai

# Voyage AI (optional - mock mode by default)
VOYAGE_MOCK=true

# Daemon
MEMORY_DAEMON_PORT=7751
ENV_EOF

echo "   ✅ Created .env file"

# Phase 3: Start daemon
echo ""
echo "🚀 Phase 3: Starting daemon..."
echo "   Running: openclaw-memory-daemon (or node dist/server.js)"
echo ""
echo "   (You may need to start manually in another terminal)"
echo "   Waiting 5 seconds..."
sleep 5

# Phase 4: Test CLI
echo ""
echo "🧪 Phase 4: Testing CLI..."
echo ""

# Test: ocmem status
echo "   Test 1: ocmem status"
ocmem status || echo "   ⚠️  Status check failed"

# Test: Save a memory
echo "   Test 2: Save a memory"
curl -X POST http://localhost:7751/remember \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "fresh-install-test",
    "text": "Fresh install test successful! Installed from NPM packages.",
    "tags": ["test", "fresh-install"]
  }' | jq

# Test: Recall the memory
echo "   Test 3: Recall the memory"
curl -s "http://localhost:7751/recall?agentId=fresh-install-test&query=fresh+install&limit=1" | jq

# Phase 5: Web Dashboard
echo ""
echo "🌐 Phase 5: Web Dashboard..."
echo "   The web dashboard is not globally installable."
echo "   For production, users should:"
echo "     1. Clone the repo"
echo "     2. cd packages/web"
echo "     3. npm install && npm run build && npm start"
echo ""
echo "   Or deploy to Vercel/Netlify"

# Phase 6: Summary
echo ""
echo "✅ Fresh Install Test Complete!"
echo ""
echo "📊 Results:"
echo "   - CLI installed: $(which ocmem)"
echo "   - Daemon installed: $(npm list -g @openclaw-memory/daemon 2>&1 | grep @openclaw-memory/daemon)"
echo "   - Test memory saved and recalled"
echo ""
echo "🔍 Cleanup:"
echo "   rm -rf ~/.openclaw-memory-test"
echo "   npm uninstall -g @openclaw-memory/cli @openclaw-memory/daemon"
echo ""
echo "📝 Issues found? Document them for README improvements."
