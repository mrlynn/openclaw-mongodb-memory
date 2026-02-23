#!/bin/bash
set -e

# Backup script for OpenClaw Memory System tear-down test
# Creates timestamped backup of all configuration and data

BACKUP_DIR="${HOME}/openclaw-memory-backup-$(date +%Y%m%d-%H%M%S)"
echo "📦 Creating backup in: $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"

# 1. OpenClaw configuration
echo "🔧 Backing up OpenClaw config..."
if [ -d "${HOME}/.openclaw" ]; then
  cp -r "${HOME}/.openclaw" "$BACKUP_DIR/openclaw-config"
  echo "   ✅ Saved ~/.openclaw"
else
  echo "   ⚠️  No ~/.openclaw directory found"
fi

# 2. MongoDB data export
echo "💾 Exporting MongoDB data..."
MONGODB_URI=$(grep MONGODB_URI /Users/michael.lynn/code/openclaw-memory/.env.local | cut -d= -f2)
if [ -n "$MONGODB_URI" ]; then
  # Export openclaw_memory database
  mongodump --uri="$MONGODB_URI" --db=openclaw_memory --out="$BACKUP_DIR/mongodb-dump" 2>/dev/null || echo "   ⚠️  mongodump failed (is it installed?)"
  
  # Also export as JSON for easier inspection
  curl -s http://localhost:7751/export?agentId=openclaw > "$BACKUP_DIR/openclaw-memories-export.json" 2>/dev/null || echo "   ⚠️  HTTP export failed (is daemon running?)"
  
  echo "   ✅ MongoDB data exported"
else
  echo "   ⚠️  No MONGODB_URI found"
fi

# 3. Workspace files (your actual memory files)
echo "📝 Backing up workspace files..."
if [ -d "${HOME}/.openclaw/workspace" ]; then
  cp -r "${HOME}/.openclaw/workspace" "$BACKUP_DIR/workspace"
  echo "   ✅ Saved workspace (MEMORY.md, daily files)"
fi

# 4. NPM global packages (if cli is installed globally)
echo "📦 Recording NPM packages..."
npm list -g --depth=0 | grep openclaw > "$BACKUP_DIR/npm-global-packages.txt" 2>/dev/null || echo "   ℹ️  No global openclaw packages"

# 5. Environment files
echo "⚙️  Backing up environment files..."
cp /Users/michael.lynn/code/openclaw-memory/.env.local "$BACKUP_DIR/env.local" 2>/dev/null || echo "   ⚠️  No .env.local"
cp /Users/michael.lynn/code/openclaw-memory/packages/daemon/.env.example "$BACKUP_DIR/daemon-env.example" 2>/dev/null

# 6. Current git state
echo "📊 Recording git state..."
cd /Users/michael.lynn/code/openclaw-memory
git log -1 --oneline > "$BACKUP_DIR/git-commit.txt"
git status > "$BACKUP_DIR/git-status.txt"
git diff > "$BACKUP_DIR/git-diff.txt" 2>/dev/null || true

# 7. Running processes
echo "🔍 Recording running processes..."
ps aux | grep -E "(openclaw|daemon)" > "$BACKUP_DIR/running-processes.txt" || true
lsof -i :7751 > "$BACKUP_DIR/port-7751.txt" 2>/dev/null || echo "Port 7751 not in use" > "$BACKUP_DIR/port-7751.txt"

# 8. Package versions
echo "📋 Recording package versions..."
cd /Users/michael.lynn/code/openclaw-memory
cat packages/daemon/package.json | jq '{name, version}' > "$BACKUP_DIR/daemon-version.json"
cat packages/client/package.json | jq '{name, version}' > "$BACKUP_DIR/client-version.json"
cat packages/cli/package.json | jq '{name, version}' > "$BACKUP_DIR/cli-version.json"

# 9. Create restoration script
echo "📜 Creating restoration script..."
cat > "$BACKUP_DIR/restore.sh" << 'RESTORE_EOF'
#!/bin/bash
set -e

BACKUP_DIR="$(cd "$(dirname "$0")" && pwd)"
echo "🔄 Restoring from: $BACKUP_DIR"

# Stop any running daemons
echo "⏹️  Stopping daemons..."
pkill -f "openclaw-memory" || true
sleep 2

# Restore OpenClaw config
echo "🔧 Restoring OpenClaw config..."
if [ -d "$BACKUP_DIR/openclaw-config" ]; then
  rm -rf "${HOME}/.openclaw"
  cp -r "$BACKUP_DIR/openclaw-config" "${HOME}/.openclaw"
  echo "   ✅ Restored ~/.openclaw"
fi

# Restore workspace
echo "📝 Restoring workspace..."
if [ -d "$BACKUP_DIR/workspace" ]; then
  cp -r "$BACKUP_DIR/workspace" "${HOME}/.openclaw/"
  echo "   ✅ Restored workspace"
fi

# Restore env files
echo "⚙️  Restoring env files..."
if [ -f "$BACKUP_DIR/env.local" ]; then
  cp "$BACKUP_DIR/env.local" /Users/michael.lynn/code/openclaw-memory/.env.local
  echo "   ✅ Restored .env.local"
fi

# Restore MongoDB data
echo "💾 Restoring MongoDB data..."
if [ -d "$BACKUP_DIR/mongodb-dump" ]; then
  MONGODB_URI=$(grep MONGODB_URI "$BACKUP_DIR/env.local" | cut -d= -f2)
  mongorestore --uri="$MONGODB_URI" --db=openclaw_memory "$BACKUP_DIR/mongodb-dump/openclaw_memory" --drop 2>/dev/null || echo "   ⚠️  mongorestore failed"
fi

echo ""
echo "✅ Restoration complete!"
echo ""
echo "Next steps:"
echo "1. cd /Users/michael.lynn/code/openclaw-memory"
echo "2. pnpm install"
echo "3. pnpm build"
echo "4. Start daemon: cd packages/daemon && npm run dev"
RESTORE_EOF

chmod +x "$BACKUP_DIR/restore.sh"

# 10. Create tear-down script
echo "🗑️  Creating tear-down script..."
cat > "$BACKUP_DIR/teardown.sh" << 'TEARDOWN_EOF'
#!/bin/bash
set -e

echo "🔴 TEAR-DOWN: Removing OpenClaw Memory System"
echo ""
echo "This will:"
echo "  1. Stop the daemon"
echo "  2. Uninstall NPM packages"
echo "  3. Remove ~/.openclaw config"
echo "  4. Drop MongoDB database"
echo "  5. Remove source code"
echo ""
read -p "Are you sure? (type 'yes' to confirm): " confirm

if [ "$confirm" != "yes" ]; then
  echo "❌ Cancelled"
  exit 1
fi

# Stop daemon
echo "⏹️  Stopping daemon..."
pkill -f "openclaw-memory" || true
pkill -f "tsx watch src/server.ts" || true
sleep 2

# Uninstall NPM packages
echo "📦 Uninstalling NPM packages..."
npm uninstall -g @openclaw-memory/cli 2>/dev/null || true
npm uninstall -g @openclaw-memory/client 2>/dev/null || true
npm uninstall -g @openclaw-memory/daemon 2>/dev/null || true

# Remove OpenClaw config (BACKUP FIRST!)
echo "🔧 Removing OpenClaw config..."
if [ -d "${HOME}/.openclaw" ]; then
  # Keep a safety backup
  mv "${HOME}/.openclaw" "${HOME}/.openclaw.teardown-backup-$(date +%s)" 2>/dev/null || true
fi

# Drop MongoDB database
echo "💾 Dropping MongoDB database..."
MONGODB_URI=$(grep MONGODB_URI /Users/michael.lynn/code/openclaw-memory/.env.local 2>/dev/null | cut -d= -f2)
if [ -n "$MONGODB_URI" ]; then
  mongo "$MONGODB_URI" --eval "db.getSiblingDB('openclaw_memory').dropDatabase()" 2>/dev/null || echo "   ⚠️  Could not drop database (mongo CLI not available)"
fi

# Remove source code
echo "📁 Removing source code..."
cd /Users/michael.lynn/code
if [ -d "openclaw-memory" ]; then
  # Safety: move to trash instead of rm
  mv openclaw-memory openclaw-memory.teardown-$(date +%s) 2>/dev/null || true
fi

echo ""
echo "✅ Tear-down complete!"
echo ""
echo "To restore, run: ./restore.sh"
TEARDOWN_EOF

chmod +x "$BACKUP_DIR/teardown.sh"

# 11. Summary
echo ""
echo "✅ Backup complete!"
echo ""
echo "📦 Backup location: $BACKUP_DIR"
echo ""
echo "📂 Backed up:"
echo "   - OpenClaw config (~/.openclaw)"
echo "   - MongoDB data (openclaw_memory database)"
echo "   - Workspace files (MEMORY.md, daily logs)"
echo "   - Environment files (.env.local)"
echo "   - Git state (commit, status, diff)"
echo "   - Running processes"
echo "   - Package versions"
echo ""
echo "🔧 Scripts created:"
echo "   - $BACKUP_DIR/teardown.sh  (remove everything)"
echo "   - $BACKUP_DIR/restore.sh   (restore from backup)"
echo ""
echo "📝 Next steps:"
echo "   1. Review backup: ls -lah $BACKUP_DIR"
echo "   2. Run tear-down: cd $BACKUP_DIR && ./teardown.sh"
echo "   3. Test fresh install from published NPM packages"
echo "   4. If issues, restore: cd $BACKUP_DIR && ./restore.sh"
