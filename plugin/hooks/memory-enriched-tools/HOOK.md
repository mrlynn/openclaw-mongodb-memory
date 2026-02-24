---
name: memory-enriched-tools
description: Augment tool results with relevant memory context
metadata:
  openclaw:
    emoji: "\U0001F50D"
    events:
      - tool_result_persist
    export: default
---

# Memory-Enriched Tools Hook

A synchronous transform hook that fires before tool results are persisted to
the session transcript. For qualifying tool results, it queries the memory
daemon for relevant context and appends a "Related memories" section.

## Supported Tools

- `Read`, `read_file` — file reading
- `Grep`, `search_files` — code search
- `Glob`, `list_files` — file discovery
- `Bash` — command execution

## Behavior

- Only enriches results longer than 100 characters
- Appends at most 3 related memories (minimum score: 0.5)
- 3-second timeout on daemon queries to keep things fast
- Returns unmodified result on any error or timeout
- Uses `structuredClone()` to avoid mutating the original payload

## Configuration

Set via hook env vars in `~/.openclaw/openclaw.json`:

```json
{
  "hooks": {
    "internal": {
      "entries": {
        "memory-enriched-tools": {
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
