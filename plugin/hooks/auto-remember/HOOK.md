---
name: auto-remember
description: Automatically extract facts, decisions, and preferences from conversations
metadata:
  openclaw:
    emoji: "\U0001F4DD"
    events:
      - message:sent
    export: default
---

# Auto-Remember Hook

Listens for outbound agent messages and extracts key facts using heuristic
pattern matching. Extracted facts are stored in MongoDB via the memory daemon
with appropriate tags and metadata for later semantic recall.

## Patterns Detected

- **Explicit notes**: "I'll remember...", "noted:..."
- **Preferences**: "preference:...", "I prefer...", "you prefer..."
- **Decisions**: "decision:...", "we decided...", "decided to..."
- **Save requests**: "remember that...", "save this...", "keep in mind..."
- **Key-value facts**: structured `Key: value` patterns

## Limits

- Maximum 5 facts extracted per message
- Minimum 10 characters per fact
- Messages under 50 characters are skipped
- Duplicate text within the same message is deduplicated

## Configuration

Set via hook env vars in `~/.openclaw/openclaw.json`:

```json
{
  "hooks": {
    "internal": {
      "entries": {
        "auto-remember": {
          "enabled": true,
          "env": {
            "OPENCLAW_MEMORY_DAEMON_URL": "http://localhost:7654",
            "OPENCLAW_MEMORY_AGENT_ID": "openclaw"
          }
        }
      }
    }
  }
}
```
