# Hooks Quick Reference

A concise reference for the four memory lifecycle hooks. For full details, see [Memory Hooks](./hooks.md).

---

## At a Glance

```
  Session Start          Conversation            Session End
  ─────────────          ────────────            ───────────
  memory-bootstrap       auto-remember           session-to-memory
  injects context ───►   extracts facts ───►     saves summary
  into agent             from responses          to MongoDB

                         memory-enriched-tools
                         annotates tool results
                         with related memories
```

---

## auto-remember

| | |
|-|-|
| **Event** | `message:sent` |
| **Trigger** | Every agent response |
| **Action** | Extract facts via regex patterns, store each as a memory |
| **Tags** | `auto-extracted` + `noted` / `preference` / `decision` / `user-requested` / `fact` |
| **Blocking** | No (fire-and-forget) |

**Patterns:** "I'll remember...", "preference:...", "we decided...", "remember that...", `Key: value`

---

## session-to-memory

| | |
|-|-|
| **Event** | `command:new` |
| **Trigger** | User starts a new session |
| **Action** | Summarize previous session, store as memory |
| **Tags** | `session-summary`, `auto` |
| **Blocking** | Yes (awaits storage confirmation) |

**Summary:** First line of user messages + last paragraph of assistant responses. Max 2,000 chars.

---

## memory-bootstrap

| | |
|-|-|
| **Event** | `agent:bootstrap` |
| **Trigger** | Agent session initializes |
| **Action** | Recall relevant memories, inject as markdown file into agent context |
| **Queries** | General context (5 results) + pinned memories (3 results) |
| **Blocking** | Yes (must complete before bootstrap finishes) |

**Min score:** 0.3 (inclusive). **Health check:** 2s timeout, skips if daemon down.

---

## memory-enriched-tools

| | |
|-|-|
| **Event** | `tool_result_persist` |
| **Trigger** | Tool result saved to transcript |
| **Action** | Append related memories to Read/Grep/Glob/Bash results |
| **Tools** | `Read`, `Grep`, `Glob`, `Bash`, `read_file`, `search_files`, `list_files` |
| **Blocking** | Yes (synchronous transform, 3s timeout) |

**Min result:** 100 chars. **Max memories:** 3. **Min score:** 0.5.

---

## Environment Variables

Set per-hook in `~/.openclaw/openclaw.json` under `hooks.internal.entries.<name>.env`:

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `OPENCLAW_MEMORY_DAEMON_URL` | `http://localhost:7654` | Daemon endpoint |
| `OPENCLAW_MEMORY_AGENT_ID` | `openclaw` | Agent ID for storage |

---

## Install

```bash
openclaw plugins install openclaw-memory    # tools + RPC
openclaw hooks install openclaw-memory      # hooks
openclaw hooks list                         # verify: 4 memory hooks should show "ready"
```

Restart gateway after installation.

---

## Disable Individual Hooks

Set `"enabled": false` in `~/.openclaw/openclaw.json`:

```json
{
  "hooks": {
    "internal": {
      "entries": {
        "auto-remember": { "enabled": false }
      }
    }
  }
}
```
