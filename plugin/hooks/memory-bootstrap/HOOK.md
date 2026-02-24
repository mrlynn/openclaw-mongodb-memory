---
name: memory-bootstrap
description: Inject relevant memories into agent context at startup
metadata:
  openclaw:
    emoji: "\U0001F9E0"
    events:
      - agent:bootstrap
    export: default
---

# Memory Bootstrap Hook

On `agent:bootstrap`, queries the memory daemon for relevant context and
injects a formatted markdown file into the agent's bootstrap files. This gives
the agent access to prior decisions, preferences, and session history from
the very first message.

## How It Works

1. Quick health check — skips silently if daemon is unreachable
2. Two parallel queries:
   - **General context**: broad semantic search for preferences, decisions, conventions
   - **Pinned memories**: tag-filtered search for explicitly important memories
3. Results are formatted as a markdown file and injected into agent context

## Configuration

Set via hook env vars in `~/.openclaw/openclaw.json`:

```json
{
  "hooks": {
    "internal": {
      "entries": {
        "memory-bootstrap": {
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
