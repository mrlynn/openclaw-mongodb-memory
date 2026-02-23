# Local MongoDB Setup Guide

**Goal:** Run MongoDB locally on your machine (no cloud, no Docker).

---

## Why Local MongoDB?

- **Offline development:** No internet required
- **Zero cost:** No Atlas account needed
- **Full control:** Your data stays on your machine
- **Fast iteration:** No network latency

**Trade-offs:**
- No automatic backups (Atlas does this)
- No vector search index (Atlas feature, use in-memory cosine instead)
- Manual updates (Atlas auto-updates)

---

## macOS Setup

### Method 1: Homebrew (Recommended)

```bash
# Install MongoDB
brew tap mongodb/brew
brew install mongodb-community@7.0

# Start MongoDB as a service (auto-starts on boot)
brew services start mongodb-community@7.0

# Or start manually (stops when terminal closes)
mongod --config /opt/homebrew/etc/mongod.conf --fork
```

**Verify it's running:**
```bash
mongosh
# Should connect to mongodb://localhost:27017
# Type: db.version()
# Expected: 7.0.x
```

**Stop MongoDB:**
```bash
brew services stop mongodb-community@7.0
```

### Method 2: Download Binary

1. **Download:** https://www.mongodb.com/try/download/community
   - Select: macOS, version 7.0+, tgz
2. **Extract:**
   ```bash
   tar -zxvf mongodb-macos-*.tgz
   mv mongodb-macos-* ~/mongodb
   ```
3. **Create data directory:**
   ```bash
   mkdir -p ~/mongodb-data
   ```
4. **Start MongoDB:**
   ```bash
   ~/mongodb/bin/mongod --dbpath ~/mongodb-data
   ```

---

## Linux Setup

### Ubuntu/Debian

```bash
# Import MongoDB GPG key
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
   sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

# Add MongoDB repository
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \
   sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Install MongoDB
sudo apt-get update
sudo apt-get install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod  # Auto-start on boot

# Verify
mongosh
```

### Fedora/RHEL/CentOS

```bash
# Create repo file
sudo tee /etc/yum.repos.d/mongodb-org-7.0.repo << EOF
[mongodb-org-7.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/redhat/\$releasever/mongodb-org/7.0/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://www.mongodb.org/static/pgp/server-7.0.asc
EOF

# Install MongoDB
sudo yum install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod

# Verify
mongosh
```

### Arch Linux

```bash
# Install from AUR
yay -S mongodb-bin

# Start MongoDB
sudo systemctl start mongodb
sudo systemctl enable mongodb

# Verify
mongosh
```

---

## Windows Setup

### Method 1: Windows Installer (Recommended)

1. **Download:** https://www.mongodb.com/try/download/community
   - Select: Windows, version 7.0+, msi
2. **Run installer:**
   - Choose "Complete" installation
   - Check "Install MongoDB as a Service"
   - Check "Install MongoDB Compass" (GUI tool)
3. **Verify:**
   ```powershell
   mongosh
   ```

### Method 2: Chocolatey

```powershell
# Install MongoDB
choco install mongodb

# Start MongoDB service
net start MongoDB

# Verify
mongosh
```

### Method 3: Scoop

```powershell
scoop install mongodb

# Create data directory
mkdir C:\data\db

# Start MongoDB
mongod --dbpath C:\data\db
```

---

## Configure OpenClaw Memory

Once MongoDB is running locally:

### 1. Create `.env.local`

```bash
cd /path/to/openclaw-memory
cp .env.example .env.local
```

### 2. Edit `.env.local`

**For local MongoDB:**

```bash
# Local connection (default)
MONGODB_URI=mongodb://localhost:27017

# Database name
MEMORY_DB_NAME=openclaw_memory

# Use mock embeddings (free, no API key needed)
VOYAGE_MOCK=true

# Daemon port
MEMORY_DAEMON_PORT=7654
```

**With authentication (if you enabled auth):**

```bash
MONGODB_URI=mongodb://username:password@localhost:27017
```

### 3. Test Connection

```bash
# Start daemon
pnpm --filter @openclaw-memory/daemon dev

# Test health endpoint
curl http://localhost:7654/health

# Expected:
# {
#   "status": "healthy",
#   "mongodb": "connected",
#   "voyage": "mock"
# }
```

---

## Create Indexes (Optional but Recommended)

OpenClaw Memory creates indexes automatically on first write, but you can create them manually:

```bash
mongosh openclaw_memory

# Create TTL index (auto-delete expired memories)
db.memories.createIndex(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
)

# Create compound index for agent queries
db.memories.createIndex(
  { agentId: 1, createdAt: -1 }
)

# Create text index for keyword search (optional)
db.memories.createIndex(
  { text: "text", tags: "text" }
)
```

---

## Capability Comparison

| Feature | Local MongoDB | MongoDB Atlas | Docker MongoDB |
|---------|---------------|---------------|----------------|
| **Cost** | Free | Free tier available | Free |
| **Setup time** | 5-10 min | 5 min | 2 min |
| **Vector search** | ❌ (use in-memory) | ✅ Native | ❌ (use in-memory) |
| **Backups** | Manual | Automatic | Manual |
| **Scaling** | Limited by machine | Auto-scale | Limited by machine |
| **Internet required** | No | Yes | No |
| **Updates** | Manual | Automatic | Manual (rebuild image) |
| **Best for** | Offline dev | Production | Quick local dev |

---

## Troubleshooting

### "Connection refused" on port 27017

**Problem:** MongoDB isn't running.

**macOS fix:**
```bash
brew services list  # Check if mongod is running
brew services start mongodb-community@7.0
```

**Linux fix:**
```bash
sudo systemctl status mongod
sudo systemctl start mongod
```

**Windows fix:**
```powershell
net start MongoDB
```

### "Command not found: mongosh"

**Problem:** MongoDB shell not in PATH.

**macOS fix:**
```bash
# Add to ~/.zshrc or ~/.bashrc
export PATH="/opt/homebrew/opt/mongodb-community@7.0/bin:$PATH"
source ~/.zshrc
```

**Linux fix:**
```bash
# mongosh is usually in /usr/bin, verify:
which mongosh
# If missing, reinstall mongodb-org
```

**Windows fix:**
```powershell
# Add to PATH: C:\Program Files\MongoDB\Server\7.0\bin
```

### "Data directory not found"

**Problem:** MongoDB can't find the data directory.

**Fix:**
```bash
# Create default data directory
mkdir -p /data/db  # macOS/Linux
# Or
mkdir C:\data\db  # Windows

# Or specify custom directory
mongod --dbpath /path/to/your/data
```

### "Permission denied" on data directory

**Problem:** User doesn't have write access to data directory.

**macOS/Linux fix:**
```bash
sudo chown -R $(whoami) /data/db
# Or use a directory you own:
mkdir ~/mongodb-data
mongod --dbpath ~/mongodb-data
```

**Windows fix:**
```powershell
# Run PowerShell as Administrator
icacls C:\data\db /grant Everyone:(OI)(CI)F
```

### MongoDB starts but can't connect

**Check if it's listening:**
```bash
# macOS/Linux
netstat -an | grep 27017
# Should show: *.27017.*LISTEN

# Windows
netstat -an | findstr 27017
```

**Check logs:**
```bash
# macOS (Homebrew)
tail -f /opt/homebrew/var/log/mongodb/mongo.log

# Linux (systemd)
sudo journalctl -u mongod -f

# Windows
# Check: C:\Program Files\MongoDB\Server\7.0\log\mongod.log
```

### "Authentication failed"

**Problem:** You enabled authentication but didn't provide credentials.

**Fix 1: Disable auth** (development only):
```bash
# Edit mongod.conf
# macOS: /opt/homebrew/etc/mongod.conf
# Linux: /etc/mongod.conf
# Windows: C:\Program Files\MongoDB\Server\7.0\bin\mongod.cfg

# Comment out or remove:
# security:
#   authorization: enabled

# Restart MongoDB
```

**Fix 2: Create user:**
```bash
mongosh

use admin
db.createUser({
  user: "openclaw",
  pwd: "your-secure-password",
  roles: ["readWriteAnyDatabase"]
})

# Update .env.local:
MONGODB_URI=mongodb://openclaw:your-secure-password@localhost:27017
```

---

## Performance Tuning

### Increase WiredTiger Cache (Large datasets)

```bash
# Edit mongod.conf
storage:
  wiredTiger:
    engineConfig:
      cacheSizeGB: 2  # Default is 50% of RAM
```

### Enable journaling (Production)

```bash
# mongod.conf
storage:
  journal:
    enabled: true
```

### Change default port

```bash
# mongod.conf
net:
  port: 27018  # Instead of 27017

# Update .env.local:
MONGODB_URI=mongodb://localhost:27018
```

---

## Backup & Restore

### Backup all data

```bash
# Dump entire database
mongodump --db openclaw_memory --out ~/mongodb-backups/$(date +%Y%m%d)

# Backup just memories collection
mongodump --db openclaw_memory --collection memories --out ~/backups
```

### Restore from backup

```bash
# Restore entire database
mongorestore --db openclaw_memory ~/mongodb-backups/20260223/openclaw_memory

# Restore just memories collection
mongorestore --db openclaw_memory --collection memories ~/backups/openclaw_memory/memories.bson
```

### Automated daily backups (cron)

```bash
# Add to crontab: crontab -e
0 2 * * * mongodump --db openclaw_memory --out ~/mongodb-backups/$(date +\%Y\%m\%d) --quiet
```

---

## Upgrading MongoDB

### macOS (Homebrew)

```bash
brew upgrade mongodb-community@7.0
brew services restart mongodb-community@7.0
```

### Ubuntu/Debian

```bash
sudo apt-get update
sudo apt-get upgrade mongodb-org
sudo systemctl restart mongod
```

### Windows

1. Download new MSI installer
2. Run installer (keeps data intact)
3. Restart MongoDB service

---

## Uninstalling MongoDB

### macOS (Homebrew)

```bash
brew services stop mongodb-community@7.0
brew uninstall mongodb-community@7.0
rm -rf /opt/homebrew/var/mongodb  # Remove data
```

### Ubuntu/Debian

```bash
sudo systemctl stop mongod
sudo apt-get purge mongodb-org*
sudo rm -rf /var/log/mongodb
sudo rm -rf /var/lib/mongodb
```

### Windows

1. Control Panel → Uninstall a program → MongoDB
2. Delete: `C:\Program Files\MongoDB`
3. Delete: `C:\data\db`

---

## Next Steps

1. ✅ MongoDB running locally
2. ✅ Connected to openclaw-memory daemon
3. 🔜 Start building: Store and recall memories
4. 🔜 Deploy to production: Switch to [MongoDB Atlas](./mongodb-atlas-setup.md)

**For production workloads:** We recommend [MongoDB Atlas](./mongodb-atlas-setup.md) for automatic backups, vector search, and scaling.

---

## Resources

- **Official docs:** https://www.mongodb.com/docs/manual/installation/
- **MongoDB Compass:** https://www.mongodb.com/products/compass (GUI for browsing data)
- **mongosh docs:** https://www.mongodb.com/docs/mongodb-shell/
- **Community forums:** https://www.mongodb.com/community/forums/
