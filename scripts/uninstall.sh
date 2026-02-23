#!/bin/bash
# OpenClaw Memory - Uninstall Script
# Removes plugin integration and cleans up artifacts

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

OPENCLAW_DIR="${HOME}/.openclaw"
OPENCLAW_CONFIG="${OPENCLAW_DIR}/openclaw.json"

echo "🧹 OpenClaw Memory Uninstall"
echo "=============================="
echo ""

# Step 1: Stop running services
echo "📋 Step 1: Stopping services..."
echo ""

echo "  → Stopping daemon processes..."
pkill -f "openclaw-memory.*daemon" 2>/dev/null && echo "    ✓ Daemon stopped" || echo "    ℹ No daemon running"

echo "  → Stopping web dashboard..."
pkill -f "openclaw-memory.*web" 2>/dev/null && echo "    ✓ Web dashboard stopped" || echo "    ℹ No web dashboard running"

echo ""
sleep 2

# Step 2: Verify ports are free
echo "📋 Step 2: Verifying ports are free..."
echo ""

if curl -s http://localhost:7751/health > /dev/null 2>&1; then
  echo "  ⚠ Warning: Port 7751 still in use"
else
  echo "  ✓ Port 7751 is free"
fi

if curl -s http://localhost:3002 > /dev/null 2>&1; then
  echo "  ⚠ Warning: Port 3002 still in use"
else
  echo "  ✓ Port 3002 is free"
fi

echo ""

# Step 3: Backup OpenClaw config
echo "📋 Step 3: Backing up OpenClaw config..."
echo ""

if [ -f "$OPENCLAW_CONFIG" ]; then
  BACKUP_PATH="${OPENCLAW_CONFIG}.backup.$(date +%Y%m%d_%H%M%S)"
  cp "$OPENCLAW_CONFIG" "$BACKUP_PATH"
  echo "  ✓ Backed up to: $BACKUP_PATH"
else
  echo "  ℹ No OpenClaw config found at $OPENCLAW_CONFIG"
fi

echo ""

# Step 4: Remove plugin artifacts
echo "📋 Step 4: Removing plugin artifacts..."
echo ""

# Remove old extension copies
if [ -d "${OPENCLAW_DIR}/extensions/memory-mongodb" ]; then
  rm -rf "${OPENCLAW_DIR}/extensions/memory-mongodb"
  echo "  ✓ Removed extensions/memory-mongodb"
else
  echo "  ℹ No extensions/memory-mongodb found"
fi

# Remove old skill copies
SKILL_DIRS=$(find "${OPENCLAW_DIR}/workspace/skills" -name "openclaw-memory*" 2>/dev/null || true)
if [ -n "$SKILL_DIRS" ]; then
  while IFS= read -r dir; do
    rm -rf "$dir"
    echo "  ✓ Removed $(basename "$dir")"
  done <<< "$SKILL_DIRS"
else
  echo "  ℹ No skills/openclaw-memory* found"
fi

echo ""

# Step 5: Show manual config removal instructions
echo "📋 Step 5: OpenClaw config cleanup"
echo ""
echo "⚠️  MANUAL STEP REQUIRED:"
echo ""
echo "Edit $OPENCLAW_CONFIG and remove:"
echo ""
echo "1. From plugins.allow array:"
echo "   \"openclaw-memory\""
echo ""
echo "2. From plugins.entries object:"
echo "   \"openclaw-memory\": { ... }"
echo ""
echo "3. From plugins.load.paths array:"
echo "   \"/Users/<username>/code/openclaw-memory/plugin\""
echo ""
echo "4. From plugins.slots object:"
echo "   \"memory\": \"openclaw-memory\""
echo ""
echo "💡 TIP: You can restore from backup if needed:"
echo "   cp $BACKUP_PATH $OPENCLAW_CONFIG"
echo ""

# Step 6: Verify cleanup
echo "📋 Step 6: Verifying cleanup..."
echo ""

if ls "${OPENCLAW_DIR}/extensions/" 2>/dev/null | grep -q memory; then
  echo "  ⚠ Warning: memory-related files still in extensions/"
else
  echo "  ✓ No memory artifacts in extensions/"
fi

if ls "${OPENCLAW_DIR}/workspace/skills/" 2>/dev/null | grep -q memory; then
  echo "  ⚠ Warning: memory-related files still in skills/"
else
  echo "  ✓ No memory artifacts in skills/"
fi

echo ""
echo "=============================="
echo "✅ Uninstall Complete!"
echo ""
echo "The openclaw-memory source code remains at:"
echo "  $PROJECT_ROOT"
echo ""
echo "To fully remove everything:"
echo "  rm -rf $PROJECT_ROOT"
echo ""
echo "To clean test data from MongoDB, run:"
echo "  $SCRIPT_DIR/cleanup.sh"
echo ""
