# openclaw-memory

MongoDB-backed long-term memory plugin for [OpenClaw](https://openclaw.ai) agents, powered by Voyage AI semantic embeddings.

## Quick Start

### 1. Start the Memory Daemon

The plugin requires a running [openclaw-memory daemon](https://github.com/mrlynn/openclaw-mongodb-memory). Choose one method:

**Docker (easiest):**
```bash
git clone https://github.com/mrlynn/openclaw-mongodb-memory.git
cd openclaw-mongodb-memory
docker compose up -d
```

**Local:**
```bash
git clone https://github.com/mrlynn/openclaw-mongodb-memory.git
cd openclaw-mongodb-memory
pnpm install && pnpm setup && pnpm build
pnpm dev:daemon
```

The daemon runs at `http://localhost:7654` by default.

### 2. Install the Plugin

```bash
openclaw plugins install openclaw-memory
```

### 3. Configure

Add to `~/.openclaw/openclaw.json`:

```json5
{
  plugins: {
    entries: {
      "openclaw-memory": {
        enabled: true,
        config: {
          daemonUrl: "http://localhost:7654",
          agentId: "openclaw"
        }
      }
    }
  }
}
```

### 4. Restart the Gateway

```bash
# Restart your OpenClaw gateway for the plugin to load
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `daemonUrl` | string | `http://localhost:7654` | Memory daemon HTTP endpoint |
| `agentId` | string | `openclaw` | Agent ID for memory storage |
| `apiKey` | string | — | API key for daemon authentication (matches `MEMORY_API_KEY` on daemon) |
| `projectId` | string | — | Project ID for multi-project memory isolation |
| `defaultTtl` | number | `2592000` | Default TTL in seconds (30 days) |
| `maxResults` | number | `6` | Max results for memory_search |
| `minScore` | number | `0.5` | Minimum similarity score threshold |
| `autoStartDaemon` | boolean | `true` | Auto-start daemon on gateway launch (requires daemon installed locally) |
| `hooksEnabled` | boolean | `true` | Enable memory lifecycle hooks |

Config set in `openclaw.json` is automatically bridged to hooks via environment variables — no separate hook env config needed.

## Agent Tools

Five tools are registered for the AI agent to use during conversations:

### `memory_search`

Semantically search long-term memory. Use this to recall prior decisions, preferences, context, or facts.

```
Parameters:
  query (required): Search query (semantic, not keyword-based)
  maxResults (optional): Maximum number of results (default: 6)

Returns: Memory ID, similarity score, text, and tags for each result
```

### `memory_remember`

Store a fact, decision, preference, or important context in long-term memory.

```
Parameters:
  text (required): The memory text to store
  tags (optional): Tags for categorization (e.g., ["preference", "ui"])
  ttl (optional): Time-to-live in seconds (default: 30 days)

Returns: Stored memory ID and confirmation
```

### `memory_forget`

Delete a specific memory by ID. Use `memory_search` first to find the memory ID.

```
Parameters:
  memoryId (required): The memory ID to delete

Returns: Confirmation or error
```

### `memory_list`

Browse stored memories by recency or tag.

```
Parameters:
  tags (optional): Comma-separated tags to filter by
  limit (optional): Max memories to return (default: 10)
  sort (optional): "desc" or "asc" by creation date (default: desc)

Returns: Memory ID, text, tags, and creation date for each result
```

### `memory_status`

Check memory system health and stats.

```
Parameters: none

Returns: Daemon status, MongoDB connection, Voyage AI status, total memories, uptime
```

## Hooks

The plugin includes 4 lifecycle hooks that make memory **automatic** — no manual tool calls needed.

### `auto-remember`

Fires after every agent response (`message:sent`). Scans for facts, decisions, and preferences using heuristic pattern matching and stores them automatically.

**Detected patterns:**
- Explicit notes: "I'll remember...", "noted:..."
- Preferences: "I prefer...", "you prefer..."
- Decisions: "we decided...", "decided to..."
- Save requests: "remember that...", "keep in mind..."
- Key-value facts: `Key: value` patterns (uppercase key, colon separator, 10+ char value)

**Limits:** Max 5 extractions per message, min 10 chars per fact, deduplicates within message.

### `session-to-memory`

Fires when starting a new session (`command:new`). Summarizes the ending session and stores it as a searchable memory — making every past conversation semantically searchable.

### `memory-bootstrap`

Fires on `agent:bootstrap`. Queries for relevant memories (preferences, recent decisions, pinned items) and injects them into the agent's context at startup. Incorporates workspace/project name for better relevance.

### `memory-enriched-tools`

Fires on `tool_result_persist`. Before tool results (from Read, Grep, Glob, Bash) are saved to the transcript, appends related memories as context annotations. 3-second timeout ensures it never blocks.

### Disabling Hooks

Set `hooksEnabled: false` in plugin config to disable all hooks. Individual hooks can be disabled via the standard OpenClaw hook config.

All hooks fail silently if the daemon is unreachable — they never break the agent.

## Gateway RPC Methods

| Method | Description |
|--------|-------------|
| `memory.status` | Get daemon status and memory stats |
| `memory.remember` | Store a new memory (`{ text, tags, metadata, ttl }`) |
| `memory.recall` | Search memories (`{ query, limit }`) |
| `memory.forget` | Delete a memory (`{ memoryId }`) |

## Web Dashboard

The full openclaw-memory installation includes a web dashboard at `http://localhost:3000` with:

- Memory browser and search
- Semantic memory map visualization
- Activity timeline and word cloud
- Chat interface with memory-augmented AI
- Backup and restore operations

## Development

For plugin development with symlink:

```bash
cd openclaw-mongodb-memory
pnpm build
openclaw plugins install -l ./plugin
```

Run tests:

```bash
cd plugin
pnpm test
```

## Requirements

- Node.js 18+
- Running openclaw-memory daemon (MongoDB + Voyage AI / mock mode)
- OpenClaw CLI

## License

MIT
