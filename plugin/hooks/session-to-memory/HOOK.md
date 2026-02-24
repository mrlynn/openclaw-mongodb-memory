---
name: session-to-memory
description: Save session summaries to MongoDB memory when starting a new session
metadata:
  openclaw:
    emoji: "\U0001F4CB"
    events:
      - command:new
    export: default
---

# Session-to-Memory Hook

When a new session starts (`/new`), this hook examines the previous session,
extracts conversation content, builds a summary, and stores it via the memory
daemon with embeddings for later semantic recall.

Unlike flat-file session summaries, these are stored in MongoDB with Voyage AI
embeddings — making every past session semantically searchable.

## Configuration

Set via hook env vars in `~/.openclaw/openclaw.json`:

```json
{
  "hooks": {
    "internal": {
      "entries": {
        "session-to-memory": {
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
