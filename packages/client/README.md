# @openclaw-memory/client

TypeScript client library for OpenClaw memory daemon - semantic memory with MongoDB and Voyage AI.

## Installation

```bash
npm install @openclaw-memory/client
```

## Quick Start

```typescript
import { MemoryClient } from '@openclaw-memory/client';

const client = new MemoryClient({ baseURL: 'http://localhost:7654' });

// Store a memory
await client.remember({
  agentId: 'my-agent',
  text: 'User prefers dark mode',
  tags: ['preference', 'ui'],
  ttl: 2592000  // 30 days
});

// Search memories semantically
const results = await client.recall({
  agentId: 'my-agent',
  query: 'what UI preferences does the user have?',
  limit: 5
});

console.log(results.results);  // [{ text, score, tags, ... }]
```

## API

### `remember(params)`

Store a new memory.

```typescript
await client.remember({
  agentId: string;      // Agent identifier
  text: string;         // Memory content
  tags?: string[];      // Optional tags for filtering
  ttl?: number;         // Time-to-live in seconds (auto-expire)
  metadata?: object;    // Optional JSON metadata
});
```

### `recall(params)`

Search memories semantically.

```typescript
const results = await client.recall({
  agentId: string;      // Agent identifier
  query: string;        // Search query (semantic, not keyword)
  limit?: number;       // Max results (default: 10)
  tags?: string[];      // Filter by tags
});
```

### `forget(id)`

Delete a memory by ID.

```typescript
await client.forget('memory-id-here');
```

### `getStatus()`

Get daemon status and memory statistics.

```typescript
const status = await client.getStatus();
console.log(status.stats.totalMemories);
```

## Documentation

Full documentation: [github.com/mrlynn/openclaw-mongodb-memory](https://github.com/mrlynn/openclaw-mongodb-memory)

## License

MIT
