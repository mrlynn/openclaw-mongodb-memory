#!/bin/bash
# OpenClaw Memory - Status Check Script
# Quickly verify installation and service health

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

DAEMON_URL="http://localhost:7751"
WEB_URL="http://localhost:3002"
OPENCLAW_DIR="${HOME}/.openclaw"

echo "🔍 OpenClaw Memory Status Check"
echo "=============================="
echo ""

# Check daemon
echo "📡 Daemon Service:"
if curl -s "${DAEMON_URL}/health" > /dev/null 2>&1; then
  STATUS=$(curl -s "${DAEMON_URL}/status" | jq -r '.daemon // "unknown"' 2>/dev/null || echo "unknown")
  MONGODB=$(curl -s "${DAEMON_URL}/status" | jq -r '.mongodb // "unknown"' 2>/dev/null || echo "unknown")
  VOYAGE=$(curl -s "${DAEMON_URL}/status" | jq -r '.voyage // "unknown"' 2>/dev/null || echo "unknown")
  COUNT=$(curl -s "${DAEMON_URL}/status" | jq -r '.stats.totalMemories // 0' 2>/dev/null || echo "0")
  
  echo "  ✅ Running at $DAEMON_URL"
  echo "     Status: $STATUS"
  echo "     MongoDB: $MONGODB"
  echo "     Voyage: $VOYAGE"
  echo "     Memories: $COUNT"
else
  echo "  ❌ Not running"
  echo "     Expected at: $DAEMON_URL"
fi

echo ""

# Check web dashboard
echo "🌐 Web Dashboard:"
if curl -s "${WEB_URL}" > /dev/null 2>&1; then
  echo "  ✅ Running at $WEB_URL"
else
  echo "  ❌ Not running"
  echo "     Expected at: $WEB_URL"
fi

echo ""

# Check OpenClaw plugin
echo "🔌 OpenClaw Plugin:"
if [ -f "${OPENCLAW_DIR}/openclaw.json" ]; then
  if grep -q "openclaw-memory" "${OPENCLAW_DIR}/openclaw.json"; then
    ENABLED=$(jq -r '.plugins.entries."openclaw-memory".enabled // false' "${OPENCLAW_DIR}/openclaw.json" 2>/dev/null || echo "false")
    if [ "$ENABLED" = "true" ]; then
      echo "  ✅ Configured and enabled"
    else
      echo "  ⚠️  Configured but disabled"
    fi
  else
    echo "  ❌ Not configured in openclaw.json"
  fi
else
  echo "  ⚠️  OpenClaw config not found"
fi

echo ""

# Check source installation
echo "📦 Source Code:"
if [ -d "$PROJECT_ROOT/plugin" ]; then
  PLUGIN_ID=$(jq -r '.id' "$PROJECT_ROOT/plugin/openclaw.plugin.json" 2>/dev/null || echo "unknown")
  echo "  ✅ Installed at $PROJECT_ROOT"
  echo "     Plugin ID: $PLUGIN_ID"
else
  echo "  ❌ Plugin directory not found"
fi

echo ""

# Check for old artifacts
echo "🧹 Cleanup Check:"
OLD_EXTENSIONS=0
OLD_SKILLS=0

if ls "${OPENCLAW_DIR}/extensions/" 2>/dev/null | grep -q memory; then
  OLD_EXTENSIONS=1
fi

if ls "${OPENCLAW_DIR}/workspace/skills/" 2>/dev/null | grep -q memory; then
  OLD_SKILLS=1
fi

if [ $OLD_EXTENSIONS -eq 0 ] && [ $OLD_SKILLS -eq 0 ]; then
  echo "  ✅ No old artifacts found"
else
  echo "  ⚠️  Old artifacts detected:"
  [ $OLD_EXTENSIONS -eq 1 ] && echo "     - Found in extensions/"
  [ $OLD_SKILLS -eq 1 ] && echo "     - Found in skills/"
  echo "     Run: $SCRIPT_DIR/uninstall.sh"
fi

echo ""
echo "=============================="

# Overall status
DAEMON_OK=0
WEB_OK=0
PLUGIN_OK=0

curl -s "${DAEMON_URL}/health" > /dev/null 2>&1 && DAEMON_OK=1
curl -s "${WEB_URL}" > /dev/null 2>&1 && WEB_OK=1
grep -q '"openclaw-memory".*"enabled".*true' "${OPENCLAW_DIR}/openclaw.json" 2>/dev/null && PLUGIN_OK=1

if [ $DAEMON_OK -eq 1 ] && [ $WEB_OK -eq 1 ] && [ $PLUGIN_OK -eq 1 ]; then
  echo "✅ All systems operational!"
elif [ $DAEMON_OK -eq 1 ] && [ $PLUGIN_OK -eq 1 ]; then
  echo "⚠️  Daemon + plugin working (web dashboard offline)"
elif [ $DAEMON_OK -eq 1 ]; then
  echo "⚠️  Daemon running (plugin + web need attention)"
else
  echo "❌ Services need to be started"
  echo ""
  echo "To start daemon:"
  echo "  cd $PROJECT_ROOT/packages/daemon && npm start"
  echo ""
  echo "To start web dashboard:"
  echo "  cd $PROJECT_ROOT/packages/web && pnpm dev"
fi

echo ""
