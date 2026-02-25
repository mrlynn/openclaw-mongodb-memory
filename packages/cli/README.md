# @openclaw-memory/cli

Command-line interface for managing OpenClaw memory daemon (`ocmem`).

## Installation

```bash
npm install -g @openclaw-memory/cli
```

## Quick Start

```bash
# Check daemon status
ocmem status

# View daemon health and memory stats
ocmem debug

# Export all memories to JSON
ocmem export my-agent > backup.json

# Clear all memories for an agent
ocmem clear my-agent

# Purge expired memories
ocmem purge
```

## Commands

### `ocmem init`

Initialize OpenClaw Memory configuration (creates .env files).

```bash
ocmem init
ocmem init --port 7654 --mock  # Use mock embeddings (no API key needed)
```

### `ocmem start`

Start the memory daemon.

```bash
ocmem start
ocmem start --web           # Also start web dashboard
ocmem start --foreground    # Run in foreground (don't detach)
ocmem start --port 7654     # Override daemon port
```

### `ocmem dashboard`

Open the web dashboard in your browser.

```bash
ocmem dashboard              # Opens http://localhost:3002 in browser
ocmem dashboard --port 3003  # Use custom port
ocmem dashboard --no-open    # Just check status, don't open browser
```

**Dashboard pages:**

- `/` — Overview with stats and memory layers
- `/memories` — Memory browser with semantic search
- `/graph` — Interactive relationship graph visualizer
- `/conflicts` — Contradiction detection and resolution
- `/expiration` — Expiration queue management
- `/operations` — System operations and settings

### `ocmem status`

Check if the daemon is running and show connection info.

```bash
ocmem status
ocmem status --url http://localhost:7654  # Custom daemon URL
```

### `ocmem debug`

Display detailed daemon health, MongoDB status, and memory statistics.

```bash
ocmem debug
ocmem debug --agent openclaw  # Agent-specific stats
```

### `ocmem search <query>`

Semantic search across stored memories.

```bash
ocmem search "database preferences" --agent openclaw
ocmem search "decision" --agent openclaw --limit 5 --tags decision,database
ocmem search "typescript" --agent openclaw --json  # Raw JSON output
```

### `ocmem export`

Export all memories for an agent to JSON file.

```bash
ocmem export --agent openclaw --output backup.json
ocmem export --agent openclaw  # Outputs to memories-openclaw-YYYYMMDD-HHMMSS.json
```

### `ocmem purge`

Remove old memories based on age.

```bash
ocmem purge --agent openclaw --older-than-days 30
ocmem purge --agent openclaw --older-than-days 7  # Delete memories >7 days old
```

### `ocmem clear`

Delete all memories for a specific agent (DANGEROUS).

```bash
ocmem clear --agent openclaw --force  # Skip confirmation
ocmem clear --agent openclaw          # Asks for confirmation
```

## Configuration

The CLI connects to the daemon via `http://localhost:7654` by default.

Override with environment variable:

```bash
export MEMORY_DAEMON_URL=http://localhost:8080
ocmem status
```

## Documentation

Full documentation: [github.com/mrlynn/openclaw-mongodb-memory](https://github.com/mrlynn/openclaw-mongodb-memory)

## License

MIT
