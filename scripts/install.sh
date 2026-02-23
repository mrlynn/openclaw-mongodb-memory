#!/bin/bash
# OpenClaw Memory - Automated Installation Script

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🧠 OpenClaw Memory - Installation"
echo "=================================="
echo

# Check prerequisites
echo "Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+ first."
    exit 1
fi

if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm not found. Installing pnpm..."
    npm install -g pnpm
fi

if ! command -v mongosh &> /dev/null; then
    echo "⚠️  mongosh not found. Install it for MongoDB testing (optional)."
fi

echo "✅ Prerequisites OK"
echo

# Install dependencies
echo "Installing dependencies..."
cd "$PROJECT_ROOT"
pnpm install

echo "✅ Dependencies installed"
echo

# Setup environment
echo "Setting up environment..."

if [ ! -f "$PROJECT_ROOT/packages/daemon/.env.local" ]; then
    if [ -f "$PROJECT_ROOT/packages/daemon/.env.example" ]; then
        cp "$PROJECT_ROOT/packages/daemon/.env.example" "$PROJECT_ROOT/packages/daemon/.env.local"
        echo "✅ Created .env.local from .env.example"
        echo "⚠️  Please edit packages/daemon/.env.local with your MongoDB URI and API keys"
    else
        echo "⚠️  No .env.example found. You'll need to create .env.local manually."
    fi
else
    echo "✅ .env.local already exists"
fi

echo

# Install OpenClaw plugin
echo "Installing OpenClaw plugin..."

PLUGIN_SOURCE="$PROJECT_ROOT/plugin"
PLUGIN_DEST="$HOME/.openclaw/extensions/memory-mongodb"

if [ -d "$PLUGIN_SOURCE" ]; then
    mkdir -p "$HOME/.openclaw/extensions"
    cp -r "$PLUGIN_SOURCE" "$PLUGIN_DEST"
    echo "✅ Plugin installed to $PLUGIN_DEST"
else
    echo "⚠️  Plugin directory not found at $PLUGIN_SOURCE"
    echo "   You'll need to manually copy the plugin to ~/.openclaw/extensions/memory-mongodb"
fi

echo

# Build packages
echo "Building packages..."
cd "$PROJECT_ROOT"
pnpm run build

echo "✅ Packages built"
echo

# Summary
echo "=================================="
echo "✅ Installation complete!"
echo
echo "Next steps:"
echo
echo "1. Configure MongoDB:"
echo "   Edit packages/daemon/.env.local"
echo
echo "2. Start the daemon:"
echo "   cd packages/daemon && pnpm dev"
echo
echo "3. Enable in OpenClaw config (~/.openclaw/openclaw.json):"
echo '   "plugins": {'
echo '     "slots": { "memory": "memory-mongodb" },'
echo '     "allow": ["memory-mongodb"],'
echo '     "entries": {'
echo '       "memory-mongodb": {'
echo '         "enabled": true,'
echo '         "config": {'
echo '           "daemonUrl": "http://localhost:7751",'
echo '           "agentId": "openclaw"'
echo '         }'
echo '       }'
echo '     }'
echo '   }'
echo
echo "4. Restart OpenClaw:"
echo "   openclaw gateway restart"
echo
echo "5. Test it:"
echo '   curl http://localhost:7751/health'
echo
echo "6. Configure agent workflow:"
echo "   Read $PROJECT_ROOT/AGENT_WORKFLOW.md"
echo "   Update your workspace AGENTS.md with auto-save patterns"
echo "   Without this, agents won't know WHEN to save memories!"
echo
echo "📚 Documentation:"
echo "   - AGENT_WORKFLOW.md — When agents should save memories"
echo "   - INSTALL.md — Full setup guide"
echo "   - SKILL.md — Complete API reference"
echo "=================================="
