# @openclaw-memory/daemon

Memory daemon for OpenClaw agents with MongoDB and Voyage AI semantic search.

## Installation

```bash
npm install @openclaw-memory/daemon
```

## Quick Start

```bash
# Set environment variables
export MONGODB_URI="mongodb+srv://user:pass@cluster.mongodb.net/openclaw_memory"
export VOYAGE_API_KEY="your-voyage-api-key"  # Optional: defaults to mock embeddings

# Start the daemon
npx @openclaw-memory/daemon
```

The daemon will start on `http://localhost:7654` by default.

## API Endpoints

- `POST /remember` - Store a memory
- `GET /recall` - Search memories semantically
- `DELETE /forget/:id` - Delete a memory
- `GET /status` - Daemon status & memory stats
- `GET /health` - Health check

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MONGODB_URI` | Yes | - | MongoDB connection string |
| `MONGODB_DB_NAME` | No | `openclaw_memory` | Database name |
| `VOYAGE_API_KEY` | No | - | Voyage AI API key (uses mock if absent) |
| `VOYAGE_MOCK` | No | `false` | Force mock embeddings (free, deterministic) |
| `PORT` | No | `7654` | HTTP server port |

## Documentation

Full documentation: [github.com/mrlynn/openclaw-mongodb-memory](https://github.com/mrlynn/openclaw-mongodb-memory)

## License

MIT
