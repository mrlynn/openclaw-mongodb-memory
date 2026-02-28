# pre-response-recall Hook

**Type:** Event hook  
**Trigger:** `message:received`  
**Purpose:** Automatically search memory and inject relevant context before agent responds

---

## Overview

This hook analyzes incoming user messages for questions about past work, decisions, or context. When detected, it:

1. Searches the memory daemon for relevant past context
2. Injects top matches into the agent's working context
3. Enables automatic memory recall without manual `memory_search` calls

## When It Fires

**Trigger patterns:**

- "What did we...?"
- "Do you remember...?"
- "Last time..."
- "Status of...?"
- "Progress on...?"
- Questions about blockers, issues, recent work

**Does NOT fire:**

- Short messages (<10 chars)
- Messages without past-context indicators
- When memory daemon is unhealthy

## How It Works

```typescript
message:received →
  isPastContextQuery? →
    extractSearchTerms →
      recall(searchTerms) →
        filter by score (>0.6) →
          format as markdown →
            inject into bootstrapFiles
```

## Configuration

**Environment variables:**

```bash
# Disable all memory hooks
OPENCLAW_MEMORY_HOOKS_ENABLED=false

# Memory daemon URL (default: http://localhost:7751)
MEMORY_DAEMON_URL=http://localhost:7751

# Agent ID for memory storage
MEMORY_AGENT_ID=openclaw
```

**Tuning parameters (in handler.ts):**

```typescript
MAX_MEMORIES = 5; // Max memories to inject
MIN_SCORE = 0.6; // Minimum relevance (0-1)
RECALL_TIMEOUT_MS = 2000; // Timeout for memory search
```

## Example

**User asks:** "What did we decide about the Atlas provisioning?"

**Hook behavior:**

1. Detects pattern: "What did we"
2. Extracts terms: "decide Atlas provisioning"
3. Searches memory daemon
4. Finds 3 relevant memories (scores 0.91, 0.88, 0.85)
5. Injects markdown file into agent context:

```markdown
# Pre-Response Memory Recall

**User asked:** "What did we decide about the Atlas provisioning?"

## Relevant Past Context

_The following information was automatically recalled from memory:_

- **[91% match]** Decision: Use M0 clusters only, one per team [atlas, decision] _(2026-02-28)_
- **[88% match]** Atlas provisioning: Enable per-event via admin toggle [atlas, admin] _(2026-02-27)_
- **[85% match]** Cloud provider restrictions: Support sponsor-specific configs [atlas, feature] _(2026-02-28)_

_Use this context when formulating your response._
```

## Benefits

**For users:**

- No need to manually ask "search my memory"
- Automatic context injection feels natural
- Responses are more informed about past work

**For agents:**

- Reduced cognitive load (don't have to remember to search)
- Better context continuity across sessions
- More accurate answers to "what did we..." questions

## Debugging

**Check if hook is running:**

```bash
# Look for "[memory] Auto-recalled N memories" in logs
tail -f ~/.openclaw/logs/*.log | grep "Auto-recalled"
```

**Test the hook:**

```bash
# Send a message that should trigger it
echo '{"type":"message","action":"received","context":{"message":"What did we decide about X?"}}' | \
  curl -X POST http://localhost:8080/hooks/test -d @-
```

**Disable for testing:**

```bash
export OPENCLAW_MEMORY_HOOKS_ENABLED=false
openclaw gateway restart
```

## Limitations

- **2-second timeout:** If memory search takes >2s, skips injection
- **Pattern-based:** May miss queries phrased unusually
- **No cross-session guarantee:** Only searches current agent's memories
- **Score threshold:** Memories <60% relevance are filtered out

## Future Enhancements

- [ ] ML-based query classification (vs regex patterns)
- [ ] User-specific relevance tuning
- [ ] Multi-agent memory federation
- [ ] Proactive memory suggestions (not just reactive)
- [ ] Memory freshness weighting (prefer recent over old)

---

**Part of:** `openclaw-memory` plugin  
**Companion hooks:** `auto-remember`, `memory-bootstrap`, `memory-enriched-tools`
