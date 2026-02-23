# OpenClaw Memory - Frequently Asked Questions

## Architecture & Design

### What's the difference between OpenClaw session compaction and this memory system?

**OpenClaw Session Compaction (Built-in):**

- Automatic conversation history summarization within a chat session
- Triggered when token count approaches context limits (~200K tokens)
- Compresses older messages into summaries while keeping recent context
- You don't control this - it's OpenClaw's internal behavior

**OpenClaw Memory (This Package):**

- Persistent semantic memory storage across sessions
- Stores facts, decisions, insights with vector embeddings
- Searchable via natural language queries
- Survives restarts, accessible from any session
- You control what gets saved and when

**Think of it this way:**

- Session compaction = short-term memory (what we talked about _today_)
- OpenClaw Memory = long-term memory (what we learned over _weeks/months_)

---

### Why two memory systems (files + MongoDB)?

We use a **two-tier strategy** for different use cases:

**File-Based Memory (`MEMORY.md`, `memory/YYYY-MM-DD.md`):**

- ✅ Human-readable, version-controlled
- ✅ Permanent, curated knowledge
- ✅ Works offline
- ✅ Git-tracked, reviewable
- ❌ No semantic search
- ❌ Manual maintenance

**MongoDB Memory (This Package):**

- ✅ Semantic search via vector embeddings
- ✅ Automatic time-based expiration (TTL)
- ✅ Fast recall across sessions
- ✅ Auto-save via workflows
- ❌ Requires MongoDB + daemon running
- ❌ Not human-browsable without tools

**Use both:**

- MongoDB for ephemeral, searchable working memory (30-90 days)
- Files for permanent, curated long-term knowledge
- Hydration scripts to sync between them

---

### How does semantic search work?

1. **Storage:** When you save a memory, the text is converted to a 1024-dimensional vector using Voyage embeddings
2. **Search:** When you query, your query text is also embedded
3. **Matching:** MongoDB compares vectors using cosine similarity (currently in-memory, Atlas Vector Search coming soon)
4. **Ranking:** Results sorted by relevance score (0-1)

**Example:**

```
Memory: "Built AI chat feature using Ollama for synthesis"
Query:  "tell me about the chat interface"
Score:  0.78 (high relevance - semantically related)
```

Even though the words don't match exactly, the _meaning_ does.

---

## Storage & Lifecycle

### When are memories automatically saved?

Per `AGENT_WORKFLOW.md`, memories are auto-saved when:

✅ **Always save:**

- Problem solved or question answered
- Technical explanation given
- Decision made or preference stated
- User provides feedback or insight
- Learning something new about the user/project
- Blocker identified or resolved

❌ **Never save:**

- Routine "ok" / "got it" acknowledgments
- Infrastructure status checks (unless something broke)
- Trivial questions with trivial answers

**Manual save:**

```bash
curl -X POST http://localhost:7751/remember \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "openclaw",
    "text": "User prefers Material UI over Tailwind for all projects",
    "tags": ["preference", "ui"],
    "ttl": 31536000
  }'
```

---

### What is TTL and how does it work?

**TTL = Time To Live** (in seconds)

MongoDB automatically deletes memories after their TTL expires.

**Recommended values:**

- `2592000` (30 days) - Most conversations, working context
- `7776000` (90 days) - Important insights, decisions
- `31536000` (1 year) - Critical long-term knowledge
- `null` or `0` - Never expires (use sparingly)

**Why expire memories?**

- Prevents database bloat
- Keeps search results relevant
- Reduces noise from outdated context
- Saves storage costs (if using Atlas)

**How to extend TTL:**
If you realize a memory is more important than you thought, there's no built-in "update TTL" endpoint yet. Workaround:

1. Export the memory
2. Delete the old one
3. Re-save with longer TTL

---

### How much does this cost?

**Voyage Embeddings:**

- ~$0.02 per 1M tokens embedded
- Average memory ~100 tokens = $0.000002 per save
- 10,000 saves = $0.20

**MongoDB Storage:**

- Free tier: 512 MB (thousands of memories)
- Atlas Vector Search: Free on M10+ clusters ($57/month minimum)
- Local MongoDB: Free unlimited

**Ollama (Memory Chat AI):**

- $0 (local inference)
- llama3.2:3b runs on consumer hardware

**Total cost for typical usage:** < $1/month

---

## Features & Workflows

### What's "Memory Chat" and how does it work?

Memory Chat (`http://localhost:3000/chat`) is a conversational interface for semantic search.

**Flow:**

1. You ask: "What did we decide about authentication?"
2. Daemon searches memories semantically (top 5 results)
3. Memories sent to Ollama (local LLM) with synthesis prompt
4. AI distills info and provides conversational answer
5. Source memories shown for transparency

**Not just search - synthesis:**
Instead of showing 5 disconnected memories, the AI connects them and answers your question naturally.

**Fallback mode:**
If Ollama isn't running, falls back to formatted memory list (still useful, just not conversational).

---

### Can I use this without Ollama?

**Yes.** Ollama is only needed for Memory Chat's AI-powered answers.

Everything else works fine:

- ✅ Storing memories
- ✅ Semantic search via `/recall` endpoint
- ✅ Memory browser UI
- ✅ CLI tools (`ocmem`)
- ✅ Hydration scripts

Memory Chat will fall back to simple formatted lists if Ollama isn't available.

To add AI answers without Ollama, set `ANTHROPIC_API_KEY` in `.env.local` (code supports this but requires uncommenting the Anthropic API implementation).

---

### What's memory hydration?

**Hydration** = syncing between file-based memory and MongoDB.

**Three modes:**

**Import** (file → MongoDB):

```bash
npx tsx packages/daemon/src/scripts/hydrate-memories.ts import ~/.openclaw/workspace/MEMORY.md openclaw
```

- Reads markdown file
- Creates MongoDB memories with `imported` tag
- Useful for seeding MongoDB with existing knowledge

**Export** (MongoDB → file):

```bash
npx tsx packages/daemon/src/scripts/hydrate-memories.ts export ~/backup.md openclaw
```

- Queries all memories for agent
- Writes to markdown with timestamps
- Useful for backups or human review

**Sync** (bidirectional):

```bash
npx tsx packages/daemon/src/scripts/hydrate-memories.ts sync ~/.openclaw/workspace/MEMORY.md openclaw
```

- Import file → MongoDB
- Export MongoDB → file
- Keeps both systems aligned

**Why use it:**

- Start with file-based memory, migrate to MongoDB
- Backup MongoDB memories to version-controlled files
- Review/edit memories in markdown, re-import

---

## Troubleshooting

### Why are my memories not showing up in search?

**Check these:**

1. **Daemon running?**

   ```bash
   curl http://localhost:7751/health
   ```

2. **Memories actually saved?**

   ```bash
   curl "http://localhost:7751/recall?agentId=openclaw&query=test&limit=10"
   ```

3. **Using correct agentId?**
   - Memories are namespaced by agent
   - Default: `openclaw`
   - Check with: `curl http://localhost:7751/agents`

4. **Embeddings mode?**
   - Mock mode: Fast, deterministic, free (default)
   - Real Voyage: Requires `VOYAGE_API_KEY` in `.env`
   - Check: `curl http://localhost:7751/status | jq .tier`

5. **TTL expired?**
   - Memories auto-delete after TTL
   - Check `createdAt` timestamp vs TTL

---

### How do I switch from mock to real Voyage embeddings?

**Steps:**

1. Get API key from [Voyage AI](https://www.voyageai.com/)

2. Add to `.env`:

   ```bash
   VOYAGE_API_KEY=your_key_here
   VOYAGE_MOCK=false
   ```

3. Restart daemon:

   ```bash
   npm run dev  # or pkill -f daemon && npm run dev
   ```

4. Verify:
   ```bash
   curl http://localhost:7751/status | jq .tier
   # Should show: "Standard — Real embeddings"
   ```

**Note:** Real embeddings give better semantic search quality but cost ~$0.02 per 1M tokens. Mock mode is free and good enough for development.

---

### Can I search memories from other sessions?

**Yes**, if they share the same `agentId`.

Memories are **not** session-specific - they're agent-specific. Any session using `agentId: "openclaw"` can recall memories saved by other sessions with that same ID.

**Use cases:**

- Share context across web UI + CLI
- Background tasks save memories, interactive sessions recall them
- Multiple team members using shared agent

**Privacy note:**
If you want session-specific memory, use unique agent IDs per session (e.g., `agentId: "openclaw-session-abc123"`).

---

### How do I delete all memories?

**⚠️ WARNING: This is destructive and cannot be undone.**

**Via CLI:**

```bash
ocmem clear openclaw
```

**Via HTTP:**

```bash
curl -X DELETE "http://localhost:7751/clear?agentId=openclaw"
```

**Backup first:**

```bash
ocmem export openclaw ~/backup-$(date +%Y%m%d).md
```

**Selective deletion:**
To delete specific memories, use `forget`:

```bash
curl -X DELETE http://localhost:7751/forget/{memory_id}
```

Get IDs via:

```bash
curl "http://localhost:7751/recall?agentId=openclaw&query=test"
```

---

### Memory Chat isn't giving AI answers - just listing memories

**Check these:**

1. **Ollama running?**

   ```bash
   curl http://localhost:11434/api/tags
   ```

2. **llama3.2:3b installed?**

   ```bash
   ollama list | grep llama3.2
   ```

   If not: `ollama pull llama3.2:3b`

3. **Check browser console:**
   - Open DevTools → Console
   - Look for API errors
   - Check Network tab for `/api/chat` request

4. **Fallback mode?**
   - If Ollama fails, it falls back to simple lists
   - Check daemon logs: `tail -100 ~/.openclaw/logs/openclaw-memory-daemon.log`

5. **Test direct Ollama:**
   ```bash
   curl http://localhost:11434/api/generate -d '{
     "model": "llama3.2:3b",
     "prompt": "Say hello",
     "stream": false
   }'
   ```

---

## Advanced Usage

### Can I use this with OpenClaw's built-in memory tools?

**Yes!** The plugin provides two tools accessible in OpenClaw sessions:

**`memory_search(query, maxResults)`**

```typescript
memory_search("authentication decisions", 5);
```

**`memory_get(path, from, lines)`**

```typescript
memory_get("MEMORY.md", 1, 100);
```

These are available automatically once the plugin is installed.

**Gateway RPC methods:**

- `memory.status` - Daemon health
- `memory.remember` - Save memory
- `memory.recall` - Search memories
- `memory.forget` - Delete memory

---

### How do I migrate from file-based memory to MongoDB?

**Step-by-step:**

1. **Install OpenClaw Memory** (if not already done)
2. **Start daemon:**

   ```bash
   cd packages/daemon && npm run dev
   ```

3. **Import existing MEMORY.md:**

   ```bash
   npx tsx packages/daemon/src/scripts/hydrate-memories.ts \
     import ~/.openclaw/workspace/MEMORY.md openclaw
   ```

4. **Verify import:**

   ```bash
   curl "http://localhost:7751/recall?agentId=openclaw&query=test"
   ```

5. **Update workflows:**
   - Add auto-save calls per `AGENT_WORKFLOW.md`
   - Keep file as backup, MongoDB as primary

6. **Optional: Set up periodic sync:**
   ```bash
   # Add to cron or heartbeat
   npx tsx packages/daemon/src/scripts/hydrate-memories.ts \
     sync ~/.openclaw/workspace/MEMORY.md openclaw
   ```

---

### Can I use this in production?

**Yes**, with these considerations:

**For MongoDB:**

- Use Atlas (managed) vs self-hosted
- Enable authentication (`MONGODB_URI` with credentials)
- Set up backups (Atlas has auto-backup)
- Use separate database per environment

**For daemon:**

- Run with process manager (PM2, systemd)
- Set up logging/monitoring
- Configure `MEMORY_API_KEY` for authentication
- Use environment variables for secrets

**For web UI:**

- Deploy with Vercel/Netlify/etc
- Set production env vars
- Consider API rate limiting
- Add authentication if publicly accessible

See `docs/production-deployment.md` (coming soon) for full guide.

---

## Still have questions?

- **Documentation:** [/docs](./getting-started.md)
- **GitHub Issues:** [mrlynn/openclaw-mongodb-memory](https://github.com/mrlynn/openclaw-mongodb-memory/issues)
- **Discord:** [OpenClaw Community](https://discord.com/invite/clawd)
- **Troubleshooting Guide:** [TROUBLESHOOTING.md](../TROUBLESHOOTING.md)
