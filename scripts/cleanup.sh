#!/bin/bash
# OpenClaw Memory - Cleanup Script
# Removes test data from MongoDB

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Load environment
if [ -f "$PROJECT_ROOT/.env.local" ]; then
  export $(grep -v '^#' "$PROJECT_ROOT/.env.local" | xargs)
elif [ -f "$PROJECT_ROOT/.env" ]; then
  export $(grep -v '^#' "$PROJECT_ROOT/.env" | xargs)
fi

MONGODB_URI="${MONGODB_URI:-mongodb://localhost:27017/openclaw_memory}"

echo "🧹 OpenClaw Memory Cleanup"
echo "=============================="
echo ""
echo "This will remove test data from MongoDB."
echo "MongoDB URI: $MONGODB_URI"
echo ""

# Safety check
read -p "⚠️  Are you sure you want to clean up test data? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo ""
  echo "❌ Cleanup cancelled."
  exit 0
fi

echo ""

# Option 1: Clear specific test agents
echo "📋 Cleanup Options:"
echo ""
echo "1. Remove specific test agent data (recommended)"
echo "2. Drop all memories collection (⚠️  DESTROYS ALL DATA)"
echo "3. Drop all collections (⚠️  FULL RESET)"
echo "4. Cancel"
echo ""

read -p "Select option (1-4): " OPTION

case $OPTION in
  1)
    echo ""
    echo "🔍 Finding test agents..."
    echo ""
    
    # List common test agent IDs
    TEST_AGENTS=(
      "test-user"
      "demo-agent"
      "e2e-test"
      "openclaw-integration-check"
    )
    
    echo "The following test agents will be removed:"
    for agent in "${TEST_AGENTS[@]}"; do
      echo "  - $agent"
    done
    echo ""
    
    read -p "Proceed with removal? (yes/no): " CONFIRM2
    
    if [ "$CONFIRM2" != "yes" ]; then
      echo ""
      echo "❌ Cleanup cancelled."
      exit 0
    fi
    
    echo ""
    echo "🗑️  Removing test agent data..."
    
    for agent in "${TEST_AGENTS[@]}"; do
      if command -v mongosh &> /dev/null; then
        COUNT=$(mongosh "$MONGODB_URI" --quiet --eval "db.memories.countDocuments({agentId: '$agent'})")
        if [ "$COUNT" -gt 0 ]; then
          mongosh "$MONGODB_URI" --quiet --eval "db.memories.deleteMany({agentId: '$agent'})" > /dev/null
          echo "  ✓ Removed $COUNT memories for agent: $agent"
        else
          echo "  ℹ No memories found for agent: $agent"
        fi
      else
        echo "  ⚠ mongosh not found - skipping MongoDB cleanup"
        echo "    Install mongosh: https://www.mongodb.com/docs/mongodb-shell/install/"
        break
      fi
    done
    
    echo ""
    echo "✅ Test agent cleanup complete!"
    ;;
    
  2)
    echo ""
    echo "⚠️  WARNING: This will DELETE ALL MEMORIES!"
    read -p "Type 'DELETE ALL' to confirm: " CONFIRM3
    
    if [ "$CONFIRM3" != "DELETE ALL" ]; then
      echo ""
      echo "❌ Cleanup cancelled."
      exit 0
    fi
    
    echo ""
    echo "🗑️  Dropping memories collection..."
    
    if command -v mongosh &> /dev/null; then
      mongosh "$MONGODB_URI" --quiet --eval "db.memories.drop()" > /dev/null
      echo "  ✓ Memories collection dropped"
    else
      echo "  ⚠ mongosh not found"
      echo "    Install mongosh: https://www.mongodb.com/docs/mongodb-shell/install/"
      exit 1
    fi
    
    echo ""
    echo "✅ Memories collection cleared!"
    ;;
    
  3)
    echo ""
    echo "⚠️  WARNING: This will RESET THE ENTIRE DATABASE!"
    read -p "Type 'RESET DATABASE' to confirm: " CONFIRM4
    
    if [ "$CONFIRM4" != "RESET DATABASE" ]; then
      echo ""
      echo "❌ Cleanup cancelled."
      exit 0
    fi
    
    echo ""
    echo "🗑️  Dropping all collections..."
    
    if command -v mongosh &> /dev/null; then
      mongosh "$MONGODB_URI" --quiet --eval "db.dropDatabase()" > /dev/null
      echo "  ✓ Database dropped"
    else
      echo "  ⚠ mongosh not found"
      echo "    Install mongosh: https://www.mongodb.com/docs/mongodb-shell/install/"
      exit 1
    fi
    
    echo ""
    echo "✅ Database reset complete!"
    ;;
    
  4)
    echo ""
    echo "❌ Cleanup cancelled."
    exit 0
    ;;
    
  *)
    echo ""
    echo "❌ Invalid option. Cleanup cancelled."
    exit 1
    ;;
esac

echo ""
echo "=============================="
echo "🎉 Cleanup finished!"
echo ""
