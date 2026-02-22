# OpenClaw Memory - Management Scripts

Helper scripts for installation, maintenance, and cleanup.

---

## 📦 Installation & Setup

### `install.sh`
**Purpose:** Install and configure openclaw-memory plugin for OpenClaw.

**Usage:**
```bash
./scripts/install.sh
```

**What it does:**
- Checks prerequisites (Node.js, pnpm, MongoDB, OpenClaw)
- Installs dependencies
- Builds daemon and web packages
- Guides you through OpenClaw configuration
- Provides post-install verification steps

**When to use:** First-time installation or re-installation after removal.

---

## 🗑️ Uninstall & Cleanup

### `uninstall.sh`
**Purpose:** Remove openclaw-memory plugin integration from OpenClaw.

**Usage:**
```bash
./scripts/uninstall.sh
```

**What it does:**
- Stops running daemon and web dashboard
- Backs up OpenClaw config
- Removes plugin artifacts from `~/.openclaw/`
- Provides instructions for manual config cleanup
- Verifies removal

**What it DOESN'T do:**
- Delete the source code (at `~/code/openclaw-memory`)
- Remove data from MongoDB (use `cleanup.sh` for that)

**When to use:** 
- Testing fresh installation
- Removing the plugin permanently
- Troubleshooting integration issues

---

### `cleanup.sh`
**Purpose:** Remove test data and memories from MongoDB.

**Usage:**
```bash
./scripts/cleanup.sh
```

**What it does:**
- Offers 3 cleanup options:
  1. **Remove test agents** (recommended) - Removes `test-user`, `demo-agent`, `e2e-test`, etc.
  2. **Drop memories collection** (⚠️ destroys all data)
  3. **Drop entire database** (⚠️ full reset)
- Requires explicit confirmation for safety
- Works with both local MongoDB and remote/Atlas

**When to use:**
- After running test suite
- Before fresh install testing
- Cleaning up development/demo data

**Safety:** Requires manual confirmation and displays what will be deleted.

---

## 🔍 Monitoring & Diagnostics

### `status.sh`
**Purpose:** Quick health check of all openclaw-memory components.

**Usage:**
```bash
./scripts/status.sh
```

**What it checks:**
- **Daemon Service** - Running? MongoDB connected? Memory count?
- **Web Dashboard** - Accessible at http://localhost:3002?
- **OpenClaw Plugin** - Configured and enabled?
- **Source Code** - Properly installed?
- **Old Artifacts** - Any leftover files from previous installs?

**Output example:**
```
✅ Daemon Service: Running at http://localhost:7751
   Status: ready | MongoDB: connected | Voyage: ready
   Memories: 74

✅ Web Dashboard: Running at http://localhost:3002

✅ OpenClaw Plugin: Configured and enabled

✅ Source Code: Installed at /Users/you/code/openclaw-memory

✅ All systems operational!
```

**When to use:**
- Verifying installation
- Troubleshooting issues
- Quick health check before demos/testing

---

## 📝 Distribution

### `package.sh`
**Purpose:** Create distribution archives for release.

**Usage:**
```bash
./scripts/package.sh
```

**What it does:**
- Builds both daemon and web packages
- Creates versioned tarballs and zip files
- Places them in `dist/` directory

**Output:**
- `openclaw-memory-v0.1.0.tar.gz`
- `openclaw-memory-v0.1.0.zip`

**When to use:** Preparing releases for distribution.

---

## Workflow Examples

### Fresh Install Testing
```bash
# 1. Remove existing installation
./scripts/uninstall.sh

# 2. Clean test data
./scripts/cleanup.sh
# Select option 1 (remove test agents)

# 3. Fresh install
./scripts/install.sh

# 4. Verify
./scripts/status.sh
```

### Daily Development
```bash
# Quick health check
./scripts/status.sh

# If something's off, check logs or restart services
```

### Pre-Release Cleanup
```bash
# Remove test data
./scripts/cleanup.sh

# Verify clean state
./scripts/status.sh

# Package for distribution
./scripts/package.sh
```

---

## Requirements

- **Bash** 4.0+ (macOS/Linux)
- **jq** - JSON parsing (`brew install jq`)
- **curl** - HTTP requests (usually pre-installed)
- **mongosh** - MongoDB shell (for cleanup.sh)
- **OpenClaw** installed at `~/.openclaw/`

---

## Notes

- Scripts are safe to run multiple times
- Always backs up configs before modifications
- Requires explicit confirmation for destructive operations
- Compatible with both local MongoDB and MongoDB Atlas
