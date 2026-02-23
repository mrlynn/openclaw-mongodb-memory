# MongoDB Atlas Setup Guide

**Goal:** Get a free MongoDB Atlas cluster running with vector search in under 5 minutes.

---

## Why MongoDB Atlas?

- **Free tier:** M0 cluster (512 MB storage, shared CPU) - perfect for development
- **Vector search:** Native support for semantic similarity search
- **Auto-scaling:** Upgrade as your memory grows
- **Global:** Deploy close to your users
- **Managed:** No servers to maintain

---

## Step 1: Create Free Atlas Account

1. **Visit:** https://www.mongodb.com/cloud/atlas/register
2. **Sign up** with email, Google, or GitHub
3. **Verify email** (check spam if needed)
4. **Login** at https://cloud.mongodb.com

---

## Step 2: Create Your First Cluster

1. **Click "Build a Database"** (green button)

2. **Choose deployment:**
   - Select **M0 (Free)**
   - Provider: AWS (or Google Cloud / Azure)
   - Region: Choose closest to you (e.g., `us-east-1`)
   - Cluster name: `openclaw-memory-cluster` (or your preference)

3. **Click "Create Deployment"**

4. **Security Quickstart:**

   **Username & Password:**
   - Username: `openclaw` (or your choice)
   - Password: Click "Autogenerate Secure Password" → **COPY IT** (you'll need this)
   - Click "Create Database User"

   **Network Access:**
   - Click "Add My Current IP Address"
   - Or click "Allow Access from Anywhere" (0.0.0.0/0) for development
   - **Production:** Restrict to your server's IP

5. **Click "Finish and Close"**

---

## Step 3: Get Your Connection String

1. **From the Clusters view**, click **"Connect"** on your cluster

2. **Choose "Drivers"**

3. **Select:**
   - Driver: Node.js
   - Version: 6.0 or later

4. **Copy the connection string:**

   ```
   mongodb+srv://openclaw:<password>@openclaw-memory-cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority&appName=openclaw-memory-cluster
   ```

5. **Replace `<password>`** with the password you copied earlier

6. **Add database name:**

   Change:
   ```
   mongodb+srv://openclaw:YourPassword@cluster.mongodb.net/
   ```

   To:
   ```
   mongodb+srv://openclaw:YourPassword@cluster.mongodb.net/openclaw_memory
   ```

   *(Add `/openclaw_memory` before the `?`)*

---

## Step 4: Configure OpenClaw Memory

1. **Create `.env.local`** in your project root:

   ```bash
   cd /path/to/openclaw-memory
   cp .env.example .env.local
   ```

2. **Edit `.env.local`:**

   ```bash
   MONGODB_URI=mongodb+srv://openclaw:YourPassword@cluster.mongodb.net/openclaw_memory
   VOYAGE_MOCK=true  # Use mock embeddings for now (free)
   MEMORY_DAEMON_PORT=7654
   ```

3. **Save the file**

---

## Step 5: Test Connection

```bash
# Start the daemon
pnpm --filter @openclaw-memory/daemon dev

# In another terminal, test the connection
curl http://localhost:7654/health

# Expected response:
# {
#   "status": "healthy",
#   "mongodb": "connected",
#   "voyage": "mock"
# }
```

If you see `"mongodb": "connected"`, you're done! ✅

---

## Step 6: Create Vector Search Index (Optional but Recommended)

For production-quality semantic search, create an Atlas Vector Search index:

### Via Atlas UI:

1. **Go to your cluster** → **Browse Collections**

2. **Select the `openclaw_memory` database** → **`memories` collection**

3. **Click "Search Indexes" tab**

4. **Click "Create Search Index"**

5. **Choose "JSON Editor"**

6. **Paste this configuration:**

   ```json
   {
     "name": "memory_vector_index",
     "type": "vectorSearch",
     "fields": [
       {
         "type": "vector",
         "path": "embedding",
         "numDimensions": 1024,
         "similarity": "cosine"
       },
       {
         "type": "filter",
         "path": "agentId"
       },
       {
         "type": "filter",
         "path": "tags"
       }
     ]
   }
   ```

7. **Click "Create Search Index"**

8. **Wait 1-2 minutes** for index to build (status will show "Active")

### Via mongosh (Alternative):

```bash
mongosh "mongodb+srv://openclaw:YourPassword@cluster.mongodb.net/openclaw_memory"

# Run this command:
db.runCommand({
  createSearchIndexes: "memories",
  indexes: [{
    name: "memory_vector_index",
    type: "vectorSearch",
    definition: {
      fields: [
        {
          type: "vector",
          path: "embedding",
          numDimensions: 1024,
          similarity: "cosine"
        },
        {
          type: "filter",
          path: "agentId"
        },
        {
          type: "filter",
          path: "tags"
        }
      ]
    }
  }]
})
```

---

## Step 7: Enable Real Voyage Embeddings (Optional)

For production semantic search quality:

1. **Get Voyage API key:**
   - Visit https://dash.voyageai.com/
   - Sign up (free tier available)
   - Go to API Keys → Create new key
   - Copy your API key

2. **Update `.env.local`:**

   ```bash
   VOYAGE_API_KEY=your-voyage-api-key-here
   VOYAGE_MOCK=false
   ```

3. **Restart daemon:**

   ```bash
   pnpm --filter @openclaw-memory/daemon dev
   ```

---

## Capability Tiers

Your setup now supports one of three tiers:

| Tier | Config | Search Quality | Scale |
|------|--------|----------------|-------|
| **Minimal** | MongoDB Atlas + mock embeddings | Good (deterministic text hash) | <10K memories |
| **Standard** | + Voyage API key | Excellent (real semantic vectors) | <100K memories |
| **Production** | + Vector Search Index | Best (Atlas native search) | Millions+ |

---

## Troubleshooting

### "Authentication failed"

**Problem:** Wrong username or password in connection string.

**Fix:** Double-check the password. If lost, go to Atlas → Database Access → Edit User → Reset Password.

### "IP not whitelisted"

**Problem:** Your IP isn't in the Network Access list.

**Fix:** Atlas → Network Access → Add IP Address → Add Current IP.

### "MongoServerError: bad auth"

**Problem:** URL-encoded password issue (password has special characters).

**Fix:** URL-encode the password:
- `@` → `%40`
- `#` → `%23`
- `/` → `%2F`

Example: Password `P@ss/123` becomes `P%40ss%2F123`

### "Connection timeout"

**Problem:** Firewall blocking port 27017, or cluster still initializing.

**Fix:**
1. Wait 2-3 minutes for cluster to fully deploy
2. Check Network Access (allow 0.0.0.0/0 for testing)
3. Try a different network (corporate firewalls often block MongoDB)

### "Database doesn't exist"

**Not a problem!** MongoDB creates databases on first write. Just start using it.

---

## Cost & Limits

**M0 Free Tier:**
- Storage: 512 MB
- RAM: Shared
- Connections: Max 500
- Network: Unlimited (ingress/egress)
- **No credit card required**

**When to upgrade:**
- Storage > 500 MB → M2 ($9/mo) or M5 ($25/mo)
- Need dedicated CPU → M10+ ($57+/mo)
- Need backups → M2+

**Rough estimate:** 512 MB holds ~50,000 memories (10KB each with embeddings).

---

## Next Steps

1. ✅ MongoDB Atlas cluster running
2. ✅ Connection string configured
3. ✅ Daemon connected successfully
4. 🔜 Create vector search index (for production)
5. 🔜 Get Voyage API key (for real embeddings)
6. 🔜 Deploy your agent (OpenClaw plugin)

**Ready to build!** 🚀

See also:
- [Docker Setup](./docker-setup.md) - For local development without Atlas
- [Configuration Guide](./configuration.md) - All environment variables
- [API Reference](./api-reference.md) - REST endpoints
