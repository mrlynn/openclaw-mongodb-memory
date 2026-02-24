#!/bin/bash
# OpenClaw Memory Documentation Cleanup
# Removes implementation/development docs, keeps end-user docs

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "🧹 Cleaning up OpenClaw Memory documentation..."
echo ""
echo "This will remove implementation/development docs and keep only end-user documentation."
echo ""
read -p "Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi
echo ""

# Backup before cleanup
echo "📦 Creating backup..."
BACKUP_FILE="docs-backup-$(date +%Y%m%d-%H%M%S).tar.gz"
tar -czf "$BACKUP_FILE" \
  *.md \
  docs/ \
  packages/daemon/*.md \
  packages/web/*.md \
  2>/dev/null || true
echo "   ✓ Backup created: $BACKUP_FILE"
echo ""

# Delete implementation docs from root
echo "🗑️  Removing implementation docs from root..."
rm -f BUGFIX_GRAPH_BROWSE.md && echo "   - BUGFIX_GRAPH_BROWSE.md"
rm -f DEMO_SEED_UPDATE.md && echo "   - DEMO_SEED_UPDATE.md"
rm -f PLUGIN_DEVELOPMENT.md && echo "   - PLUGIN_DEVELOPMENT.md"
rm -f MARKETING_SITE.md && echo "   - MARKETING_SITE.md"
rm -f CLEANUP_STRATEGY.md && echo "   - CLEANUP_STRATEGY.md (this planning doc)"
echo "   ✓ Root cleanup complete"
echo ""

# Delete implementation docs from docs/
echo "🗑️  Removing implementation docs from docs/..."
rm -f docs/IMPLEMENTATION-SUMMARY.md && echo "   - IMPLEMENTATION-SUMMARY.md"
rm -f docs/OPENCLAW-MEMORY-SPEC.md && echo "   - OPENCLAW-MEMORY-SPEC.md"
rm -f docs/GRAPH_VISUALIZER_UX_UPDATE.md && echo "   - GRAPH_VISUALIZER_UX_UPDATE.md"
echo "   ✓ docs/ cleanup complete"
echo ""

# Delete package implementation docs
echo "🗑️  Removing package implementation docs..."
rm -f packages/daemon/INTEGRATION_TEST_RESULTS.md && echo "   - packages/daemon/INTEGRATION_TEST_RESULTS.md"
rm -f packages/web/AI_CHAT_INTEGRATION.md && echo "   - packages/web/AI_CHAT_INTEGRATION.md"
rm -f packages/web/COLORS.md && echo "   - packages/web/COLORS.md"
echo "   ✓ Package docs cleanup complete"
echo ""

# Delete archive directory
if [ -d docs/archive ]; then
    echo "🗑️  Removing docs/archive/..."
    FILE_COUNT=$(find docs/archive -type f | wc -l | xargs)
    rm -rf docs/archive/
    echo "   ✓ Removed $FILE_COUNT archived files"
    echo ""
fi

# Move root demo docs to docs/
echo "📁 Organizing demo docs..."
if [ -f DEMO_README.md ]; then
    mv DEMO_README.md docs/demo.md
    echo "   ✓ DEMO_README.md → docs/demo.md"
fi
echo ""

# Create docs index
echo "📝 Creating docs index..."
cat > docs/README.md << 'EOF'
# OpenClaw Memory Documentation

## Quick Start

**New to OpenClaw Memory?**
1. [Getting Started](getting-started.md) — Installation and first steps
2. [Demo Guide](DEMO_GUIDE.md) — Full walkthrough
3. [Demo Quick Reference](DEMO_QUICK_REFERENCE.md) — Quick reference card

## Features

- [Graph Visualizer](GRAPH_VISUALIZER_GUIDE.md) — Visualize memory relationships
- [Graph Quick Start](QUICK_START_GRAPH.md) — Get started with graphs
- [Reflection Pipeline](REFLECTION_PIPELINE_TRIGGERS.md) — Automated memory processing
- [LLM Explanations](LLM_CONTRADICTION_EXPLANATIONS.md) — AI-powered contradiction analysis

## Setup Guides

- [Configuration](configuration.md) — Configure OpenClaw Memory
- [Docker Setup](docker-setup.md) — Run with Docker
- [MongoDB Atlas](mongodb-atlas-setup.md) — Cloud database setup
- [MongoDB Local](mongodb-local-setup.md) — Local database setup
- [Voyage Configuration](voyage-model-configuration.md) — Embedding models

## Deployment

- [Deployment Guide](deployment.md) — Production deployment
- [Demo Walkthrough](demo.md) — Complete demo setup

## Reference

- [API Reference](api-reference.md) — HTTP API documentation
- [Architecture](architecture.md) — System overview
- [Hooks](hooks.md) — React hooks reference
- [Hooks Quick Reference](hooks-quick-reference.md) — Quick hook lookup

## Help

- [Troubleshooting](troubleshooting.md) — Common issues and solutions
- [FAQ](FAQ.md) — Frequently asked questions
- [Contributing](contributing.md) — Contribution guidelines

---

**Main README:** [../README.md](../README.md)  
**Installation:** [../INSTALL.md](../INSTALL.md)  
**Changelog:** [../CHANGELOG.md](../CHANGELOG.md)
EOF
echo "   ✓ docs/README.md created"
echo ""

echo "✅ Cleanup complete!"
echo ""
echo "📊 Remaining documentation:"
TOTAL=$(find . -maxdepth 3 -type f -name "*.md" \
  ! -path "*/node_modules/*" \
  ! -path "*/.next/*" \
  ! -path "*/dist/*" \
  | wc -l | xargs)
echo "   Total files: $TOTAL"
echo ""
echo "💾 Backup saved: $BACKUP_FILE"
echo ""
echo "🔍 Review remaining docs:"
echo "   find . -type f -name '*.md' ! -path '*/node_modules/*' ! -path '*/.next/*' | sort"
echo ""
echo "📝 Next steps:"
echo "   1. Review remaining documentation"
echo "   2. git status (see changes)"
echo "   3. git add -A && git commit -m 'docs: Clean up implementation docs'"
echo ""
