# Auto-Capture Guide

OpenClaw Memory automatically captures important moments from your work sessions without requiring manual `memory_remember()` calls.

## How It Works

Three hooks work together to build your memory automatically:

### 1. **auto-remember** (Pattern-Based)

Triggers on specific phrases in agent responses:

```
✅ "I'll remember that..."
✅ "preference: dark mode"
✅ "decision: use MongoDB"
✅ "remember that NextAuth needs AUTH_SECRET"
✅ "Preferred editor: VS Code"
```

**When it saves:**

- Explicit memory statements
- Preferences and decisions
- Structured key-value facts

**Configuration:**

```json
{
  "hooks": {
    "internal": {
      "entries": {
        "auto-remember": {
          "enabled": true
        }
      }
    }
  }
}
```

### 2. **tool-result-capture** (NEW - Action-Based)

Captures significant tool executions automatically:

```
✅ File edits (code changes)
✅ Long command outputs (>500 chars)
✅ Web searches (research)
✅ Tool failures (for learning)
✅ Memory operations (meta-learning)

❌ Trivial reads (ls, pwd, cat)
❌ Status checks
❌ Repeated identical operations
```

**When it saves:**

- After every significant tool execution
- Problem-solving patterns (failure → success)
- Research and exploration
- Code changes

**Configuration:**

```json
{
  "hooks": {
    "internal": {
      "entries": {
        "tool-result-capture": {
          "enabled": true,
          "env": {
            "CAPTURE_THRESHOLD": "significant"
          }
        }
      }
    }
  }
}
```

**Threshold levels:**

- `all` - Capture every tool call (very verbose)
- `significant` - Smart filtering (default, recommended)
- `minimal` - Only failure→success patterns

### 3. **session-to-memory** (Session Summaries)

Saves entire session summaries when you start a new session:

```bash
# Manually trigger
/new

# Or at end of session
/status  # then /new
```

**When it saves:**

- On `/new` command
- Summarizes previous session
- Includes all context and outcomes

## Installation

### For New Users (Automatic)

When installing openclaw-memory, auto-capture is **enabled by default**:

```bash
npm install -g openclaw-memory
openclaw plugins install openclaw-memory
```

All three hooks are enabled automatically with sensible defaults.

### For Existing Users (Manual Enable)

Edit `~/.openclaw/openclaw.json`:

```json
{
  "hooks": {
    "internal": {
      "enabled": true,
      "entries": {
        "auto-remember": {
          "enabled": true,
          "env": {
            "OPENCLAW_MEMORY_DAEMON_URL": "http://localhost:7751",
            "OPENCLAW_MEMORY_AGENT_ID": "openclaw"
          }
        },
        "tool-result-capture": {
          "enabled": true,
          "env": {
            "OPENCLAW_MEMORY_DAEMON_URL": "http://localhost:7751",
            "OPENCLAW_MEMORY_AGENT_ID": "openclaw",
            "CAPTURE_THRESHOLD": "significant"
          }
        },
        "session-to-memory": {
          "enabled": true,
          "env": {
            "OPENCLAW_MEMORY_DAEMON_URL": "http://localhost:7751",
            "OPENCLAW_MEMORY_AGENT_ID": "openclaw"
          }
        }
      }
    }
  }
}
```

Then restart OpenClaw:

```bash
openclaw restart
```

## Verification

Check if auto-capture is working:

```bash
# 1. Check hook status
openclaw hooks list

# 2. Do some work (edit a file, run a command)
# 3. Check memories
curl http://localhost:7751/recall?agentId=openclaw&query=recent&limit=10 | jq '.results[] | {text, tags}'
```

You should see memories tagged with:

- `auto-extracted` (from auto-remember)
- `auto-captured` (from tool-result-capture)
- `session-summary` (from session-to-memory)

## Tuning

### Reduce Noise

If you're getting too many captures:

```json
{
  "tool-result-capture": {
    "env": {
      "CAPTURE_THRESHOLD": "minimal" // Only critical moments
    }
  }
}
```

### Increase Coverage

If you're missing important moments:

```json
{
  "tool-result-capture": {
    "env": {
      "CAPTURE_THRESHOLD": "all" // Everything (verbose)
    }
  }
}
```

### Disable Specific Hooks

```json
{
  "hooks": {
    "internal": {
      "entries": {
        "tool-result-capture": {
          "enabled": false // Disable action-based capture
        }
      }
    }
  }
}
```

## Privacy Note

Auto-capture only stores:

- ✅ Tool names and parameters
- ✅ Result summaries (first 200 chars)
- ✅ Success/failure status

It does **not** store:

- ❌ Full file contents
- ❌ Sensitive env vars
- ❌ API keys or credentials

All memories are stored locally in your MongoDB instance.

## Troubleshooting

**Not capturing anything?**

1. Check hook status: `openclaw hooks list`
2. Verify daemon is running: `curl http://localhost:7751/health`
3. Check OpenClaw logs: `tail -f ~/.openclaw/logs/openclaw.log | grep memory`
4. Test manual capture: `memory_remember("test memory")`

**Too much noise?**

1. Lower threshold to `minimal`
2. Disable `tool-result-capture` temporarily
3. Review captured memories and tune filters

**Missing important moments?**

1. Increase threshold to `all` temporarily
2. Check if patterns match (see hook HOOK.md files)
3. Use manual `memory_remember()` for critical items

## Best Practices

1. **Let it run for a week** - Auto-capture learns your patterns
2. **Review weekly** - `curl http://localhost:7751/recall?agentId=openclaw&limit=100 | less`
3. **Prune noise** - `curl -X DELETE http://localhost:7751/forget/{id}` for junk
4. **Complement with manual** - Still use `memory_remember()` for key decisions
5. **Use sessions** - `/new` at natural breakpoints captures summaries

## Examples

### Pattern-Based Capture

```
Agent: "I'll remember that NextAuth v5 requires AUTH_SECRET env var"
→ Saved as: tags=["auto-extracted", "noted"]
```

### Action-Based Capture

```
Tool: edit(file="theme.ts", old="#00ED64", new="#00684A")
→ Saved as: tags=["auto-captured", "tool-execution", "edit"]
```

### Session Summary

```
User: /new
→ Saved as: Full session summary with tags=["session-summary", "2026-02-25"]
```

## Future Enhancements

- [ ] LLM-based summarization (use Ollama for smart extraction)
- [ ] Automatic clustering of related memories
- [ ] Failure pattern detection
- [ ] Project-specific tagging
- [ ] Integration with git commits

---

**Bottom line:** With auto-capture enabled, you can focus on your work. The system learns from your actions and builds memory automatically.
