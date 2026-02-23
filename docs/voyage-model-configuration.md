# Voyage AI Model Configuration

Guide to configuring which Voyage AI embedding model is used by OpenClaw Memory.

---

## Current Model

**Check what's currently running:**

```bash
curl http://localhost:7751/status | jq '{voyage, voyageModel, voyageBaseUrl}'
```

**Example output:**

```json
{
  "voyage": "ready",
  "voyageModel": "voyage-3",
  "voyageBaseUrl": "https://api.voyageai.com/v1"
}
```

---

## Configuration Methods

### 1. Environment Variables (Recommended)

**Location:** Root `.env.local` or `packages/daemon/.env.local`

```bash
# Required: API Key
VOYAGE_API_KEY=pa-your-key-here

# Optional: Model (defaults vary by endpoint)
VOYAGE_MODEL=voyage-3

# Optional: Base URL (defaults to Voyage API)
VOYAGE_BASE_URL=https://api.voyageai.com/v1

# Optional: Mock mode for testing
VOYAGE_MOCK=false
```

**Precedence:**

1. `packages/daemon/.env.local` (highest priority)
2. Root `.env.local`
3. Environment variables
4. Defaults (lowest priority)

---

## Available Models

### Voyage AI Public API

**Endpoint:** `https://api.voyageai.com/v1`

| Model              | Dimensions | Speed     | Quality | Cost | Use Case                   |
| ------------------ | ---------- | --------- | ------- | ---- | -------------------------- |
| **voyage-3**       | 1024       | Fast      | High    | $$   | **Default** - Best balance |
| **voyage-3-lite**  | 512        | Very Fast | Good    | $    | Fast search, high volume   |
| **voyage-large-2** | 1536       | Slow      | Highest | $$$  | Best quality, low volume   |
| **voyage-code-3**  | 1024       | Fast      | High    | $$   | Code embeddings            |
| **voyage-2**       | 1024       | Fast      | Good    | $    | Previous generation        |

**Recommendation:** `voyage-3` (default) for most use cases.

---

### MongoDB Atlas AI Endpoint

**Endpoint:** `https://ai.mongodb.com/v1`

| Model               | Dimensions | Speed     | Quality | Cost | Use Case              |
| ------------------- | ---------- | --------- | ------- | ---- | --------------------- |
| **voyage-3-lite**   | 512        | Very Fast | Good    | $    | **Default** for Atlas |
| **voyage-3**        | 1024       | Fast      | High    | $$   | Better quality        |
| **voyage-3-5-lite** | 512        | Very Fast | Good    | $    | Latest lite model     |

**Why Atlas endpoint?**

- Integrated with MongoDB Atlas AI
- Simplified billing
- Native Atlas Vector Search integration
- Same models, different billing account

**Configuration:**

```bash
VOYAGE_API_KEY=al-your-atlas-key
VOYAGE_BASE_URL=https://ai.mongodb.com/v1
VOYAGE_MODEL=voyage-3-lite  # Or voyage-3
```

---

## Default Model Selection

The daemon automatically selects the appropriate default model based on the endpoint:

**Logic:**

```typescript
// From embedding.ts
const DEFAULT_MODELS = {
  "api.voyageai.com": "voyage-3", // Voyage.com public API
  "ai.mongodb.com": "voyage-3-lite", // MongoDB Atlas AI
};
```

**Override defaults:**

```bash
# Use voyage-3 on Atlas (instead of default voyage-3-lite)
VOYAGE_BASE_URL=https://ai.mongodb.com/v1
VOYAGE_MODEL=voyage-3
```

---

## Changing the Model

### Option 1: Edit .env.local (Recommended)

```bash
# Edit root .env.local
nano .env.local

# Set your desired model
VOYAGE_MODEL=voyage-3-lite

# Save and restart daemon
cd packages/daemon
pnpm run dev
```

### Option 2: Package-Level Override

```bash
# Create package-level config (overrides root)
cat > packages/daemon/.env.local << 'EOF'
VOYAGE_MODEL=voyage-large-2
EOF

# Restart daemon
cd packages/daemon
pnpm run dev
```

### Option 3: Environment Variable

```bash
# Temporary (current session only)
VOYAGE_MODEL=voyage-code-3 pnpm --filter @openclaw-memory/daemon dev

# Or export
export VOYAGE_MODEL=voyage-code-3
pnpm --filter @openclaw-memory/daemon dev
```

---

## Verification

**1. Check daemon logs on startup:**

```bash
cd packages/daemon
pnpm run dev

# Look for:
# "Voyage API configured: voyage-3"
```

**2. Query status endpoint:**

```bash
curl http://localhost:7751/status | jq .voyageModel
# "voyage-3"
```

**3. Test embedding:**

```bash
curl -X POST http://localhost:7751/remember \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "test",
    "text": "Testing embedding model"
  }'

# Check logs for embedding generation
```

---

## Model Comparison

### Embedding Dimensions

**Why it matters:**

- More dimensions = more nuanced semantic understanding
- Fewer dimensions = faster search, lower storage

**Storage impact:**

```
1024-dim embedding: ~4 KB per memory (float32)
512-dim embedding:  ~2 KB per memory
1536-dim embedding: ~6 KB per memory
```

**For 10,000 memories:**

- `voyage-3` (1024-dim): ~40 MB
- `voyage-3-lite` (512-dim): ~20 MB
- `voyage-large-2` (1536-dim): ~60 MB

### Performance

**Query speed (approximate):**

- In-memory cosine (< 10K memories): ~10-50ms (any model)
- Atlas Vector Search: ~20-100ms (optimized for 1024-dim)

**Embedding generation:**

- `voyage-3-lite`: ~100-200ms per request
- `voyage-3`: ~150-300ms per request
- `voyage-large-2`: ~200-400ms per request

---

## Cost Considerations

**Pricing (Voyage.com, approximate):**

```
voyage-3-lite:   $0.02  per 1M tokens
voyage-3:        $0.02  per 1M tokens
voyage-large-2:  $0.12  per 1M tokens
voyage-code-3:   $0.02  per 1M tokens
```

**Example cost for 1,000 memories:**

- Average memory: ~100 tokens
- Total: 100,000 tokens
- Cost (voyage-3): ~$0.002 (negligible)

**MongoDB Atlas AI pricing:** Similar, but billed through Atlas.

---

## Mock Mode (Free Alternative)

**For development/testing without API costs:**

```bash
# Enable mock embeddings
VOYAGE_MOCK=true

# No API key needed!
VOYAGE_API_KEY=
```

**How it works:**

- Deterministic text-hash based embeddings
- 1024 dimensions (matches real models)
- Zero cost, works offline
- Adequate for semantic search
- Good for testing infrastructure

**Trade-off:** Lower quality semantic understanding than real models.

---

## Migration Between Models

**Changing models requires re-embedding existing memories!**

### Option 1: Re-embed Script (Recommended)

```bash
cd packages/daemon

# Run re-embedding script
VOYAGE_MODEL=voyage-3-lite npm run reembed

# This will:
# 1. Connect to MongoDB
# 2. Read all memories
# 3. Generate new embeddings with new model
# 4. Update database
```

### Option 2: Fresh Start

```bash
# Clear existing memories (⚠️ destructive!)
curl -X DELETE "http://localhost:7751/clear?agentId=YOUR_AGENT_ID"

# Or drop collection in MongoDB:
mongosh
use openclaw_memory
db.memories.drop()

# Then start fresh with new model
```

### Option 3: Parallel Models (Advanced)

Run two daemons with different models:

```bash
# Daemon 1: voyage-3 on port 7751
VOYAGE_MODEL=voyage-3 MEMORY_DAEMON_PORT=7751 pnpm dev

# Daemon 2: voyage-3-lite on port 7752
VOYAGE_MODEL=voyage-3-lite MEMORY_DAEMON_PORT=7752 pnpm dev
```

---

## Recommendations

### Development

```bash
VOYAGE_MOCK=true  # Free, fast, good enough for testing
```

### Production (Low Volume)

```bash
VOYAGE_MODEL=voyage-3        # Best balance
VOYAGE_BASE_URL=https://api.voyageai.com/v1
```

### Production (High Volume)

```bash
VOYAGE_MODEL=voyage-3-lite   # Faster, cheaper, still good
VOYAGE_BASE_URL=https://api.voyageai.com/v1
```

### MongoDB Atlas Integration

```bash
VOYAGE_MODEL=voyage-3-lite   # Atlas default
VOYAGE_BASE_URL=https://ai.mongodb.com/v1
```

### Code Search Specific

```bash
VOYAGE_MODEL=voyage-code-3   # Optimized for code
```

---

## Troubleshooting

### "Model not found" error

**Cause:** Invalid model name or model not available on endpoint.

**Fix:**

```bash
# Check available models for your endpoint
curl https://api.voyageai.com/v1/models \
  -H "Authorization: Bearer $VOYAGE_API_KEY"

# Use a valid model name
VOYAGE_MODEL=voyage-3
```

### Embeddings seem low quality

**Cause:** Using mock mode or wrong model for use case.

**Fix:**

```bash
# Ensure real embeddings
VOYAGE_MOCK=false
VOYAGE_API_KEY=pa-your-actual-key

# Use voyage-3 or higher
VOYAGE_MODEL=voyage-3
```

### "Dimension mismatch" error

**Cause:** Changed models without re-embedding.

**Fix:** Run re-embedding script (see Migration section above).

---

## Advanced Configuration

### Fallback Models

The daemon automatically tries fallback models if the primary fails:

```typescript
// Fallback order (from embedding.ts)
const FALLBACK_MODELS = [
  "voyage-3",
  "voyage-3-lite",
  "voyage-3-5-lite",
  "voyage-2",
  "voyage-lite-02-instruct",
  "voyage-code-3-5",
];
```

**This ensures:** If your specified model fails, the daemon tries alternatives rather than crashing.

### Custom Endpoints

**For self-hosted Voyage AI or compatible APIs:**

```bash
VOYAGE_BASE_URL=https://your-custom-endpoint.com/v1
VOYAGE_MODEL=your-custom-model
```

---

## Summary

**Quick Reference:**

```bash
# Check current model
curl http://localhost:7751/status | jq .voyageModel

# Change model
echo "VOYAGE_MODEL=voyage-3-lite" >> .env.local

# Restart daemon
pnpm --filter @openclaw-memory/daemon dev

# Verify change
curl http://localhost:7751/status | jq .voyageModel
```

**Best Practices:**

1. Use `voyage-3` for most production use cases
2. Use `voyage-3-lite` for high-volume, cost-sensitive deployments
3. Use `VOYAGE_MOCK=true` for development/testing
4. Re-embed when changing models
5. Monitor costs via Voyage.com dashboard

---

**Questions?** See the Voyage AI documentation: https://docs.voyageai.com/
