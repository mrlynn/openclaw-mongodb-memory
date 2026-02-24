#!/bin/bash
# Check demo prerequisites (NO DOCKER REQUIRED!)

echo "🔍 Checking OpenClaw Memory demo prerequisites..."
echo ""

MISSING=0

# Check Node.js
echo -n "📦 Node.js: "
if command -v node > /dev/null 2>&1; then
  NODE_VERSION=$(node --version)
  echo "✅ $NODE_VERSION"
else
  echo "❌ Not found"
  echo "   Install: brew install node"
  MISSING=1
fi

# Check npm
echo -n "📦 npm: "
if command -v npm > /dev/null 2>&1; then
  NPM_VERSION=$(npm --version)
  echo "✅ $NPM_VERSION"
else
  echo "❌ Not found"
  MISSING=1
fi

# Check MongoDB (NO DOCKER REQUIRED!)
echo -n "💾 MongoDB: "
if command -v mongosh > /dev/null 2>&1; then
  if mongosh --quiet --eval "db.version()" > /dev/null 2>&1; then
    MONGO_VERSION=$(mongosh --quiet --eval "db.version()" 2>&1)
    MONGO_STATUS=$(brew services list | grep mongodb-community | awk '{print $2}')
    echo "✅ $MONGO_VERSION ($MONGO_STATUS)"
  else
    echo "⚠️  Installed but not running"
    echo "   Start: brew services start mongodb-community"
    MISSING=1
  fi
else
  echo "❌ Not found"
  echo "   Install: brew install mongodb-community"
  echo "   Or use MongoDB Atlas (cloud)"
  MISSING=1
fi

# Check Ollama (optional)
echo -n "🤖 Ollama (optional for LLM features): "
if command -v ollama > /dev/null 2>&1; then
  if curl -s http://localhost:11434/api/generate > /dev/null 2>&1; then
    echo "✅ Running"
  else
    echo "⚠️  Installed but not running"
    echo "   Start: ollama serve"
  fi
else
  echo "ℹ️  Not installed (LLM explanations will use fallback)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $MISSING -eq 0 ]; then
  echo "✅ All prerequisites met! Ready to run demo."
  echo ""
  echo "   Run: ./scripts/demo-start.sh"
  echo ""
  exit 0
else
  echo "❌ Missing prerequisites. Please install the items above."
  echo ""
  exit 1
fi
