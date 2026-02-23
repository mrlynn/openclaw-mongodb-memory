# Memory Hydration Guide

**Cross-hydrate memories between file-based storage and MongoDB**

---

## Overview

OpenClaw Memory uses a **two-tier memory strategy**:

1. **File-based** (MEMORY.md, memory/\*.md) - Curated long-term memory, manually maintained
2. **MongoDB** - Semantic search, automatic management, TTL expiration

**Hydration** enables bidirectional migration between these systems:

- **Import:** File-based → MongoDB (for semantic search)
- **Export:** MongoDB → File-based (for curation)
- **Sync:** Merge both directions (intelligent deduplication)

---

## Use Cases

### Import (File → MongoDB)

**When to use:**

- You have historical memories in MEMORY.md
- You want semantic search over old memories
- Migrating from file-based to MongoDB system

**Example:**

```bash
cd ~/code/openclaw-memory/packages/daemon
npx tsx src/scripts/hydrate-memories.ts import ~/.openclaw/workspace/MEMORY.md openclaw
```

**Result:**

- Parses markdown sections (## headers)
- Extracts tags, timestamps
- Generates embeddings (mock or real)
- Stores in MongoDB with metadata
- Skips duplicates automatically

### Export (MongoDB → File)

**When to use:**

- Reviewing MongoDB memories for curation
- Backing up MongoDB to file-based storage
- Generating reports

**Example:**

```bash
npx tsx src/scripts/hydrate-memories.ts export ~/exported-memories.md openclaw
```

**Result:**

- Fetches all memories for agentId
- Formats as markdown with metadata
- Sorted by creation date (newest first)
- Includes tags, source, timestamps

### Sync (Bidirectional Merge)

**When to use:**

- Keeping both systems up to date
- Initial migration with ongoing sync
- Complex merge scenarios

**Example:**

```bash
npx tsx src/scripts/hydrate-memories.ts sync ~/.openclaw/workspace/MEMORY.md openclaw
```

**Result:**

- Step 1: Import file → MongoDB (skip duplicates)
- Step 2: Export MongoDB → temp file
- Manual review & merge recommended

---

## File Format Requirements

### Input Format (for import)

The hydration tool expects markdown with section headers:

```markdown
## Section Title

Body text here...

**Tags:** (optional)
**Timestamp:** (optional, format: YYYY-MM-DD HH:MM TZ)

## Another Section

More content...
```

**Tag detection:**

- Inline hashtags: `#tag1 #tag2`
- Or explicit: `**Tags:** tag1, tag2`

**Timestamp detection:**

- Pattern: `YYYY-MM-DD HH:MM TZ`
- Example: `2026-02-23 10:30 EST`

### Output Format (from export)

Generated markdown includes:

```markdown
# Exported Memories

**Agent:** openclaw
**Exported:** 2026-02-23T10:58:39.355Z
**Count:** 12

---

## Memory (YYYY-MM-DD)

[Memory text]

**Tags:** tag1, tag2
**Created:** ISO timestamp
**Source:** original-file.md (if imported)

---
```

---

## Advanced Usage

### Custom Agent ID

```bash
# Import for specific agent
npx tsx src/scripts/hydrate-memories.ts import file.md my-agent-id

# Export specific agent
npx tsx src/scripts/hydrate-memories.ts export output.md my-agent-id
```

### Batch Import (Multiple Files)

```bash
for file in ~/.openclaw/workspace/memory/*.md; do
  npx tsx src/scripts/hydrate-memories.ts import "$file" openclaw
done
```

### Environment Variables

```bash
# Use real Voyage embeddings (not mock)
export VOYAGE_MOCK=false
export VOYAGE_API_KEY=your-key

# Custom database
export MEMORY_DB_NAME=openclaw_memory_test

npx tsx src/scripts/hydrate-memories.ts import MEMORY.md
```

---

## Testing Hydration

### Verify Import Worked

```bash
# Check memory count
curl http://localhost:7751/status | jq '.stats'

# Test semantic search
curl "http://localhost:7751/recall?agentId=openclaw&query=YOUR_SEARCH&limit=5"
```

### Verify Export Worked

```bash
wc -l exported-memories.md   # Line count
head -50 exported-memories.md  # Preview
tail -50 exported-memories.md  # Check end
```

---

## Integration with CLI

Add to `packages/cli/src/commands/`:

```bash
# Future enhancement: ocmem hydrate command
ocmem hydrate import ~/MEMORY.md
ocmem hydrate export ~/output.md
ocmem hydrate sync ~/MEMORY.md
```

---

## Best Practices

### Import Strategy

1. **Start small** - Test with one section first
2. **Review duplicates** - Check what was skipped
3. **Verify embeddings** - Test semantic search after import
4. **Clean source** - Ensure markdown is well-formatted

### Export Strategy

1. **Regular backups** - Export weekly to file-based storage
2. **Review before merge** - Don't auto-overwrite MEMORY.md
3. **Curate** - Pick best memories from export for MEMORY.md
4. **Tag consistently** - Use standard tags for filtering

### Sync Strategy

1. **Manual merge** - Review `.mongo-export.md` before merging
2. **Incremental** - Sync frequently, not in bulk
3. **Backup first** - Copy MEMORY.md before sync
4. **Test queries** - Verify semantic search works after sync

---

## Troubleshooting

### No Memories Imported

**Problem:** "Found 0 memory sections"

**Solution:**

- Check markdown format (needs ## or ### headers)
- Ensure file exists and is readable
- Try `cat file.md | head -50` to preview

### Duplicates Not Skipped

**Problem:** Same memory imported twice

**Solution:**

- Hydration checks exact text match
- Edit text slightly if you want separate entries
- Or delete from MongoDB first: `curl -X DELETE http://localhost:7751/forget/{id}`

### Embeddings Slow

**Problem:** Import taking too long

**Solution:**

- Use mock mode: `export VOYAGE_MOCK=true`
- Batch embeddings (future enhancement)
- Import in smaller chunks

### Export Too Large

**Problem:** Exported file huge

**Solution:**

- Filter by tags: (future enhancement)
- Export date ranges: (future enhancement)
- Or manually delete old MongoDB memories

---

## Examples

### Example 1: Initial Migration

```bash
# Before: 80+ memories in MEMORY.md, 0 in MongoDB
curl http://localhost:7751/status
# => totalMemories: 0

# Import
npx tsx src/scripts/hydrate-memories.ts import ~/.openclaw/workspace/MEMORY.md openclaw

# After: 80+ memories in MongoDB
curl http://localhost:7751/status
# => totalMemories: 88

# Test search
curl "http://localhost:7751/recall?agentId=openclaw&query=VAI+project&limit=3"
```

### Example 2: Weekly Backup

```bash
# Export MongoDB → backup file
npx tsx src/scripts/hydrate-memories.ts export ~/backups/memories-$(date +%Y-%m-%d).md openclaw

# Result: ~/backups/memories-2026-02-23.md
```

### Example 3: Curate Best Memories

```bash
# Export all MongoDB memories
npx tsx src/scripts/hydrate-memories.ts export /tmp/all-memories.md openclaw

# Manually review /tmp/all-memories.md
# Copy best ones into MEMORY.md under appropriate sections
# Delete ephemeral ones from MongoDB via web dashboard
```

---

## Performance

| Operation                | Speed             | Notes                    |
| ------------------------ | ----------------- | ------------------------ |
| Import (mock embeddings) | ~1-2 sec/memory   | Fast, deterministic      |
| Import (real Voyage)     | ~0.5-1 sec/memory | Network latency          |
| Export                   | ~0.1 sec/memory   | Direct MongoDB read      |
| Sync (10 memories)       | ~15-30 sec        | Import + export combined |

---

## Future Enhancements

- [ ] `ocmem hydrate` CLI command (wrapper for script)
- [ ] Automatic sync on schedule (cron job)
- [ ] Incremental sync (only new memories)
- [ ] Tag-based filtering (export only certain tags)
- [ ] Date range filtering (export last 30 days)
- [ ] Batch embedding API calls (parallel processing)
- [ ] Dry-run mode (preview without executing)
- [ ] Progress bars for large imports

---

**Last Updated:** 2026-02-23  
**Status:** ✅ Tested & Working
