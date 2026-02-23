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

### `ocmem status`

Check if the daemon is running and show connection info.

```bash
ocmem status
```

### `ocmem debug`

Display detailed daemon health, MongoDB status, and memory statistics.

```bash
ocmem debug
```

### `ocmem export <agentId>`

Export all memories for an agent to JSON (stdout).

```bash
ocmem export my-agent > backup.json
```

### `ocmem clear <agentId>`

Delete all memories for a specific agent.

```bash
ocmem clear my-agent --confirm
```

### `ocmem purge`

Remove expired memories (TTL-based cleanup).

```bash
ocmem purge
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
