# OpenClaw Memory

MongoDB-backed long-term memory with Voyage AI semantic search.

## When to Use

Use OpenClaw Memory when:

- Recalling prior conversations, decisions, or preferences
- Building context across multiple sessions
- Searching for relevant information semantically

## Tools

### memory_search

Semantically search long-term memory.

```typescript
memory_search({
  query: "What did we decide about the database?",
  maxResults: 6,
});
```

### memory_remember

Store facts, decisions, or preferences.

```typescript
memory_remember({
  text: "User prefers TypeScript over JavaScript",
  tags: ["preference"],
});
```

## Installation

```bash
openclaw plugins install openclaw-memory
```

## Requirements

- MongoDB 8.0+
- Node.js 18+
- OpenClaw CLI

## Configuration

Add to `~/.openclaw/openclaw.json`:

```json
{
  "plugins": {
    "entries": {
      "openclaw-memory": {
        "enabled": true,
        "config": {
          "daemonUrl": "http://localhost:7654"
        }
      }
    }
  }
}
```

## Author

Michael Lynn

## License

MIT
