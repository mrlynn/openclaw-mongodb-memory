---
name: tool-result-capture
description: Automatically capture significant tool executions and results
metadata:
  openclaw:
    emoji: "🔧"
    events:
      - tool:after
    export: default
---

# Tool Result Capture Hook

Automatically captures tool executions that indicate learning, problem-solving,
or significant work. Uses heuristic rules to filter noise and save only
meaningful interactions.

## Auto-Capture Rules

**Always capture:**

- Tool failures followed by success (problem-solving)
- File edits (code changes)
- Long exec outputs (>500 chars)
- Web searches (research)
- Memory operations (meta-learning)

**Never capture:**

- Simple file reads
- Status checks
- Trivial exec commands (ls, pwd, etc.)
- Repeated identical operations

## Configuration

```json
{
  "hooks": {
    "internal": {
      "entries": {
        "tool-result-capture": {
          "enabled": true,
          "env": {
            "OPENCLAW_MEMORY_DAEMON_URL": "http://localhost:7751",
            "OPENCLAW_MEMORY_AGENT_ID": "openclaw",
            "CAPTURE_THRESHOLD": "significant"
          }
        }
      }
    }
  }
}
```

**Threshold levels:**

- `all` - Capture every tool call
- `significant` - Smart filtering (default)
- `minimal` - Only failures→success patterns
