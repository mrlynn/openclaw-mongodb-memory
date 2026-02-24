# Memory Hooks

OpenClaw Memory includes four lifecycle hooks that make memory **automatic**. Instead of relying on the agent to explicitly call `memory_search`, these hooks observe conversations, extract facts, save session history, and inject context — all without any manual intervention.

---

## Overview

| Hook | Event | What Happens |
| ---- | ----- | ------------ |
| `auto-remember` | `message:sent` | Extracts facts, decisions, and preferences from agent responses |
| `session-to-memory` | `command:new` | Summarizes the ending session and stores it as searchable memory |
| `memory-bootstrap` | `agent:bootstrap` | Injects relevant memories into the agent's context at startup |
| `memory-enriched-tools` | `tool_result_persist` | Appends related memories to tool results before they are saved |

All hooks fail silently if the daemon is unreachable. They never block or break the agent.

---

## Installation

Hooks are bundled with the `openclaw-memory` plugin. Install both in one step:

```bash
# Install the plugin (tools + RPC)
openclaw plugins install openclaw-memory

# Install the hooks
openclaw hooks install openclaw-memory
```

For local development:

```bash
openclaw plugins install -l ./plugin
openclaw hooks install -l ./plugin
```

After installing, verify:

```bash
openclaw hooks list
```

You should see all four memory hooks with status `ready`.

> **Important:** The hooks installer registers the path to the `hooks/` directory inside the plugin. If OpenClaw only discovers the bundled hooks, check that `hooks.internal.load.extraDirs` in your config points to the `hooks/` subdirectory, not the plugin root.

---

## Configuration

Each hook reads its daemon connection from environment variables. Set these in `~/.openclaw/openclaw.json`:

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
        },
        "session-to-memory": {
          "enabled": true,
          "env": {
            "OPENCLAW_MEMORY_DAEMON_URL": "http://localhost:7654",
            "OPENCLAW_MEMORY_AGENT_ID": "openclaw"
          }
        },
        "memory-bootstrap": {
          "enabled": true,
          "env": {
            "OPENCLAW_MEMORY_DAEMON_URL": "http://localhost:7654",
            "OPENCLAW_MEMORY_AGENT_ID": "openclaw"
          }
        },
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

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `OPENCLAW_MEMORY_DAEMON_URL` | `http://localhost:7654` | Memory daemon HTTP endpoint |
| `OPENCLAW_MEMORY_AGENT_ID` | `openclaw` | Agent identity for memory storage |

To disable a specific hook, set `"enabled": false` in its entry.

Restart the gateway after changing hook configuration.

---

## Hook: auto-remember

**Event:** `message:sent` (fires after every agent response)

Scans outbound agent messages for facts, decisions, and preferences using heuristic pattern matching. When a pattern is detected, the extracted text is stored as a memory in MongoDB with Voyage AI embeddings for later semantic recall.

### Detected Patterns

| Pattern | Trigger Phrases | Tags Applied |
| ------- | --------------- | ------------ |
| Explicit notes | "I'll remember...", "noted:...", "recording:..." | `auto-extracted`, `noted` |
| Preferences | "preference:...", "I prefer...", "you prefer...", "user prefers..." | `auto-extracted`, `preference` |
| Decisions | "decision:...", "we decided...", "decided to...", "the decision is..." | `auto-extracted`, `decision` |
| Save requests | "remember that...", "save this...", "don't forget...", "keep in mind..." | `auto-extracted`, `user-requested` |
| Key-value facts | `Key: value` or `Key = value` patterns | `auto-extracted`, `fact` |

### Behavior

- Messages shorter than 50 characters are skipped
- Each extracted fact must be at least 10 characters
- Maximum 5 facts extracted per message
- Duplicate text within the same message is deduplicated
- Storage is fire-and-forget (non-blocking)

### Metadata Stored

Each extracted memory includes:

```json
{
  "source": "auto-remember",
  "sessionKey": "agent:main:main",
  "messageId": "msg_abc123",
  "extractedAt": "2026-02-23T15:30:00.000Z"
}
```

### Example

If the agent responds with:

> I'll remember that you prefer dark mode for all interfaces. We decided to use LeafyGreen UI for the component library.

Two memories are extracted and stored:

1. **"you prefer dark mode for all interfaces"** — tags: `auto-extracted`, `noted`
2. **"to use LeafyGreen UI for the component library"** — tags: `auto-extracted`, `decision`

---

## Hook: session-to-memory

**Event:** `command:new` (fires when the user starts a new session)

When a new session begins, this hook examines the previous session, builds a summary of the conversation, and stores it in MongoDB with embeddings. Every past session becomes semantically searchable.

### How It Works

1. Reads `event.context.sessionEntry` from the ending session
2. If the session has a `.summary` field, uses it directly
3. Otherwise, constructs a summary from conversation turns:
   - First line of each user message (as topic indicators)
   - Last paragraph of each assistant response (as conclusions)
4. Stores via `POST /remember` with tags `session-summary`, `auto`

### Limits

| Setting | Value | Description |
| ------- | ----- | ----------- |
| Maximum summary length | 2,000 characters | Longer summaries are truncated |
| Minimum turns | 2 | Sessions with fewer than 2 turns are skipped |
| Minimum summary length | 50 characters | Very short summaries are discarded |

### Metadata Stored

```json
{
  "source": "session-to-memory",
  "sessionId": "abc123",
  "sessionKey": "agent:main:main",
  "turnCount": 12,
  "startedAt": "2026-02-23T10:00:00.000Z",
  "endedAt": "2026-02-23T11:30:00.000Z"
}
```

### Relationship to Bundled session-memory Hook

OpenClaw ships a bundled `session-memory` hook that saves sessions to flat markdown files (`memory/YYYY-MM-DD-slug.md`). The `session-to-memory` hook from this plugin stores sessions in MongoDB with vector embeddings instead, making them **semantically searchable** rather than just text files on disk.

You can run both hooks simultaneously — they don't conflict. The bundled hook gives you human-readable files; this hook gives you AI-searchable memories.

---

## Hook: memory-bootstrap

**Event:** `agent:bootstrap` (fires when an agent session initializes)

Queries the memory daemon for relevant context and injects it into the agent's bootstrap files. The agent starts every session pre-loaded with relevant background knowledge — preferences, recent decisions, pinned items.

### How It Works

1. **Health check** — pings the daemon (2-second timeout). If unreachable, skips silently
2. **Two parallel queries:**
   - General context: `"user preferences, recent decisions, important context, project conventions"` (limit 5)
   - Pinned memories: tag-filtered for `pinned,important` (limit 3)
3. **Deduplicates** results by memory ID across both queries
4. **Formats** as a markdown file with sections for pinned and general context
5. **Writes** to a temp file and pushes its path into `event.context.bootstrapFiles`

### Bootstrap File Format

The injected file looks like this:

```markdown
# Memory Context

The following information was recalled from long-term memory.

## Pinned / Important

- User prefers dark mode for all interfaces [preference, pinned] (2/20/2026)
- API authentication uses JWT tokens with 24h expiry [architecture, pinned] (2/18/2026)

## Recent Context

- We decided to use LeafyGreen UI for the component library [decision] (2/22/2026)
- The deployment uses Docker Compose with MongoDB 7 [infrastructure] (2/21/2026)
```

### Scoring

| Setting | Value | Reason |
| ------- | ----- | ------ |
| Minimum score | 0.3 | Lower than the plugin default (0.5) — bootstrap should be inclusive |
| General context limit | 5 memories | Enough context without bloating the bootstrap |
| Pinned memories limit | 3 memories | Prioritize explicitly important items |

> **Tip:** Tag important memories with `pinned` or `important` to ensure they always appear in the bootstrap context.

---

## Hook: memory-enriched-tools

**Event:** `tool_result_persist` (fires before tool results are saved to transcript)

A synchronous transform hook that augments tool results with relevant memory context. When you read a file, search code, or run a command, the hook checks if any stored memories are related and appends them as context annotations.

### Supported Tools

| Tool Name | Type |
| --------- | ---- |
| `Read` / `read_file` | File reading |
| `Grep` / `search_files` | Code search |
| `Glob` / `list_files` | File discovery |
| `Bash` | Command execution |

### How It Works

1. Checks if the tool is in the supported list — skips if not
2. Checks if the result text is at least 100 characters — skips short results
3. Extracts the first 500 characters of the result as a semantic query
4. Calls `GET /recall` with a 3-second timeout (max 3 results, min score 0.5)
5. If relevant memories are found, appends them to the last text block:

```
---
**Related memories:**
- Previous implementation used a connection pool of 10 [architecture]
- The user prefers async/await over callbacks [preference]
```

6. Returns the modified payload (or `undefined` if no enrichment was needed)

### Handler Contract

Unlike the other three hooks (which are event handlers), this hook is a **synchronous transform**. It receives the tool result payload and must return either:

- A modified `ToolResultPayload` (with the enrichment appended)
- `undefined` (leave the result unchanged)

The hook uses `structuredClone()` to deep-copy the payload before modification, ensuring the original is never mutated.

### Performance

| Setting | Value | Purpose |
| ------- | ----- | ------- |
| Recall timeout | 3 seconds | Keeps the transform fast |
| Max query length | 500 characters | Avoids slow embedding of large results |
| Max memories appended | 3 | Keeps enrichment concise |
| Min result length | 100 characters | Skips trivial results |
| Min memory score | 0.5 | Only appends genuinely relevant memories |

If the daemon is slow or unreachable, the timeout fires and the result passes through unmodified.

---

## Architecture

All four hooks share a common HTTP client (`lib/daemon-client.ts`) that communicates with the memory daemon via its REST API.

```
Agent Lifecycle                    Memory Hooks                       Daemon
─────────────────                  ────────────                       ──────

agent:bootstrap  ───────────►  memory-bootstrap  ──── GET /recall ──► MongoDB
                               (inject context)   ◄── memories ──────

message:sent     ───────────►  auto-remember     ──── POST /remember ► MongoDB
                               (extract facts)

tool_result_     ───────────►  memory-enriched-  ──── GET /recall ──► MongoDB
  persist                        tools            ◄── memories ──────
                               (annotate results)

command:new      ───────────►  session-to-memory ──── POST /remember ► MongoDB
                               (save summary)
```

### Shared Configuration

Hooks read daemon connection details from environment variables rather than the plugin config. This is because hooks run in a separate context from plugins and don't have direct access to `api.config`. The env vars are set per-hook in `~/.openclaw/openclaw.json` under `hooks.internal.entries.<name>.env`.

### Error Handling

Every hook wraps its entire handler in a try-catch block. Hook failures are swallowed silently — they never propagate exceptions to the OpenClaw runtime. This is a strict requirement of the hook system to prevent third-party hooks from breaking agent functionality.

---

## Troubleshooting

**Hooks don't appear in `openclaw hooks list`:**

Check that `hooks.internal.load.extraDirs` points to the `hooks/` subdirectory inside the plugin, not the plugin root:

```json
{
  "hooks": {
    "internal": {
      "load": {
        "extraDirs": ["/path/to/openclaw-memory/plugin/hooks"]
      }
    }
  }
}
```

**Hooks show as "ready" but nothing happens:**

1. Make sure the gateway has been restarted after installing hooks
2. Verify the daemon is running: `curl http://localhost:7654/health`
3. Check the env vars — `OPENCLAW_MEMORY_DAEMON_URL` must match your daemon's actual port
4. Check the gateway logs for `[memory]` prefixed messages

**auto-remember isn't extracting anything:**

The patterns are conservative by design. The agent must use specific trigger phrases like "I'll remember", "preference:", "we decided", etc. Generic statements are not extracted. If you want broader extraction, the `PATTERNS` array in `hooks/auto-remember/handler.ts` can be extended.

**memory-bootstrap context is empty:**

The daemon must have existing memories to recall. If you just installed the system, try storing a few memories first via the web dashboard or the `POST /remember` API, then start a new agent session.

**memory-enriched-tools isn't augmenting results:**

- The tool must be in the supported list (`Read`, `Grep`, `Glob`, `Bash`)
- The result text must be at least 100 characters
- Related memories must score at least 0.5 similarity
- The recall must complete within 3 seconds

---

## Related Documentation

- [Getting Started](./getting-started.md) — Install and configure the full system
- [API Reference](./api-reference.md) — All daemon REST endpoints
- [Configuration](./configuration.md) — Environment variables and config options
- [Architecture](./architecture.md) — System design overview
