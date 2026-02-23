# API Reference

The daemon exposes a REST API on port 7654 (configurable via `MEMORY_DAEMON_PORT`).

Base URL: `http://localhost:7654`

---

## Memory Operations

### POST /remember

Store a new memory with optional embedding.

**Request Body:**

```json
{
  "agentId": "my-agent",
  "text": "The user prefers dark mode",
  "tags": ["preference", "ui"],
  "projectId": "project-123",
  "metadata": {},
  "ttl": 2592000
}
```

| Field       | Type     | Required | Description             |
| ----------- | -------- | -------- | ----------------------- |
| `agentId`   | string   | Yes      | Agent identifier        |
| `text`      | string   | Yes      | Memory content          |
| `tags`      | string[] | No       | Categorization tags     |
| `projectId` | string   | No       | Project scoping         |
| `metadata`  | object   | No       | Arbitrary metadata      |
| `ttl`       | number   | No       | Time-to-live in seconds |

**Response:**

```json
{
  "success": true,
  "id": "699ad...",
  "text": "The user prefers dark mode",
  "tags": ["preference", "ui"],
  "ttl": 2592000
}
```

---

### GET /recall

Semantic search across memories.

**Query Parameters:**

| Param       | Type   | Required | Default | Description                           |
| ----------- | ------ | -------- | ------- | ------------------------------------- |
| `agentId`   | string | Yes      | —       | Agent identifier                      |
| `query`     | string | Yes      | —       | Search text (embedded for similarity) |
| `limit`     | number | No       | 10      | Max results (1-100)                   |
| `tags`      | string | No       | —       | Comma-separated tag filter            |
| `projectId` | string | No       | —       | Project filter                        |

**Response:**

```json
{
  "success": true,
  "query": "theme preference",
  "results": [
    {
      "id": "699ad...",
      "text": "The user prefers dark mode",
      "score": 0.91,
      "tags": ["preference", "ui"],
      "createdAt": "2026-02-19T14:20:00.000Z"
    }
  ],
  "count": 1,
  "method": "in_memory"
}
```

The `method` field indicates whether Atlas Vector Search (`vector_search`) or in-memory cosine similarity (`in_memory`) was used.

---

### DELETE /forget/:id

Delete a specific memory by ID.

**Response:**

```json
{
  "success": true,
  "id": "699ad...",
  "message": "Memory deleted"
}
```

---

## Bulk Operations

### POST /purge

Delete memories older than a given date.

**Request Body:**

```json
{
  "agentId": "my-agent",
  "olderThan": "2026-01-01T00:00:00.000Z"
}
```

**Response:**

```json
{
  "success": true,
  "agentId": "my-agent",
  "olderThan": "2026-01-01T00:00:00.000Z",
  "deleted": 42
}
```

---

### GET /clear

Delete all memories for an agent.

**Query Parameters:** `agentId` (required)

**Response:**

```json
{
  "success": true,
  "agentId": "my-agent",
  "deleted": 73
}
```

---

### GET /export

Export all memories for an agent (without embedding vectors).

**Query Parameters:** `agentId` (required), `projectId` (optional)

**Response:**

```json
{
  "success": true,
  "agentId": "my-agent",
  "projectId": null,
  "count": 73,
  "exportedAt": "2026-02-23T12:00:00.000Z",
  "memories": [
    {
      "id": "699ad...",
      "text": "The user prefers dark mode",
      "tags": ["preference", "ui"],
      "metadata": {},
      "createdAt": "2026-02-19T14:20:00.000Z",
      "updatedAt": "2026-02-19T14:20:00.000Z",
      "expiresAt": null
    }
  ]
}
```

---

## Analytics

### GET /wordcloud

Word frequency analysis across an agent's memories.

**Query Parameters:** `agentId` (required), `limit` (optional, default 100), `minCount` (optional, default 1)

**Response:**

```json
{
  "success": true,
  "agentId": "my-agent",
  "totalMemories": 73,
  "totalUniqueWords": 245,
  "words": [{ "text": "preference", "count": 12, "frequency": 0.164 }]
}
```

---

### GET /embeddings

2D PCA projection of memory embeddings for visualization.

**Query Parameters:** `agentId` (required), `limit` (optional, default 200)

**Response:**

```json
{
  "success": true,
  "agentId": "my-agent",
  "count": 73,
  "points": [
    {
      "id": "699ad...",
      "x": 0.45,
      "y": -0.32,
      "text": "The user prefers dark mode",
      "tags": ["preference"],
      "createdAt": "2026-02-19T14:20:00.000Z"
    }
  ]
}
```

---

### GET /timeline

Memory creation frequency over time (daily buckets).

**Query Parameters:** `agentId` (required), `days` (optional, default 90)

**Response:**

```json
{
  "success": true,
  "agentId": "my-agent",
  "days": [{ "date": "2026-02-23", "count": 5 }],
  "total": 73,
  "dateRange": {
    "from": "2025-11-25",
    "to": "2026-02-23"
  }
}
```

---

### GET /agents

List all agents with memory counts.

**Response:**

```json
{
  "success": true,
  "count": 2,
  "agents": [
    {
      "agentId": "my-agent",
      "count": 73,
      "lastUpdated": "2026-02-23T12:00:00.000Z"
    }
  ]
}
```

---

## Health & Status

### GET /health

Detailed health check with service status.

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2026-02-23T12:00:00.000Z",
  "uptime": 3600,
  "memory": { "heapUsed": 45, "heapTotal": 120 },
  "database": "connected",
  "voyage": "ready (mock mode)",
  "system": { "nodeVersion": "v20.11.0", "platform": "darwin" },
  "checks": { "mongodb": "ok", "voyage": "ok" }
}
```

---

### GET /status

Simplified status overview.

**Response:**

```json
{
  "success": true,
  "daemon": "running",
  "mongodb": "connected",
  "voyage": "ready",
  "uptime": 3600,
  "memory": { "heapUsed": 45, "heapTotal": 120 },
  "stats": { "totalMemories": 73 }
}
```

---

### GET /health/setup

Setup checklist for the dashboard widget.

**Response:**

```json
{
  "success": true,
  "complete": false,
  "checks": [
    {
      "id": "mongodb",
      "label": "MongoDB Connection",
      "status": "ok",
      "detail": "Connected to openclaw_memory",
      "fix": null
    },
    {
      "id": "embeddings",
      "label": "Embedding Mode",
      "status": "warning",
      "detail": "Using mock embeddings",
      "fix": "Set VOYAGE_API_KEY in .env.local for real semantic search"
    }
  ]
}
```

---

## TypeScript Client

```typescript
import { MemoryClient } from "@openclaw-memory/client";

const memory = new MemoryClient({
  daemonUrl: "http://localhost:7654",
  agentId: "my-agent",
});

// Store
await memory.remember("User prefers dark mode", {
  tags: ["preference"],
  ttl: 2592000,
});

// Search
const results = await memory.recall("theme settings", { limit: 5 });

// Delete
await memory.forget(results[0].id);
```
