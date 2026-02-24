# Graph Visualizer Guide

## What is a Memory ID?

A **Memory ID** is a unique identifier for each memory in the system. It's a MongoDB ObjectId—a 24-character hexadecimal string that looks like this:

```
699db2ce1234567890abcdef
```

Every memory you create gets assigned a unique ID automatically.

## How the Graph Visualizer Works

The graph visualizer shows **relationships between memories** using a network diagram:

- **Nodes** = Individual memories
- **Edges** = Relationships between memories (SUPPORTS, CONTRADICTS, PRECEDES, etc.)
- **Center Node** = The memory you're exploring from
- **Connected Nodes** = Memories linked to the center node

### Visualization Features

1. **Interactive Canvas** — Pan, zoom, drag nodes around
2. **Color-Coded Relationships:**
   - 🟢 **Green (SUPPORTS)** — One memory supports/agrees with another
   - 🔴 **Red (CONTRADICTS)** — Memories conflict
   - 🔵 **Blue (PRECEDES)** — Temporal sequence (A happened before B)
   - 🟡 **Yellow (CAUSES)** — Causal relationship
   - 🟣 **Purple (DERIVES_FROM)** — One memory derived from another
   - 🟠 **Orange (CO_OCCURS)** — Memories from same context
   - ⚪ **Gray (MENTIONS_ENTITY)** — Memory mentions an entity

3. **Controls:**
   - **Direction** — Show outbound (memories this one points to), inbound (memories that point to this one), or both
   - **Depth** — How many levels deep to traverse (1-5)
   - **MiniMap** — Bird's-eye view of the full graph

## Finding Memory IDs

### Method 1: Via API

**List all memories:**
```bash
curl "http://localhost:7654/memories?agentId=openclaw&limit=10"
```

**Response:**
```json
{
  "success": true,
  "memories": [
    {
      "id": "699db2ce1234567890abcdef",
      "text": "TypeScript provides static type checking",
      "tags": ["typescript", "benefits"],
      ...
    }
  ]
}
```

**Search for specific memories:**
```bash
curl "http://localhost:7654/recall?agentId=openclaw&query=TypeScript&limit=5"
```

### Method 2: Via Memory Browser (Web Dashboard)

1. Go to **http://localhost:3002/browser** (or your web dashboard URL)
2. Search for a memory
3. Click on a memory card
4. The ID is shown in the detail view or URL

### Method 3: After Creating a Memory

```bash
curl -X POST http://localhost:7654/remember \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "openclaw",
    "text": "Graph visualization helps understand memory relationships"
  }'
```

**Response:**
```json
{
  "success": true,
  "id": "699db2ce1234567890abcdef",  ← This is your memory ID
  "message": "Memory stored"
}
```

## Using the Graph Visualizer

### Step-by-Step

1. **Get a Memory ID** (using methods above)

2. **Open Graph Visualizer**
   - Web: http://localhost:3002/graph
   - The page has a text input for the memory ID

3. **Enter Memory ID**
   ```
   699db2ce1234567890abcdef
   ```

4. **Configure Options:**
   - **Direction:** 
     - `outbound` — Show memories this one links to
     - `inbound` — Show memories that link to this one
     - `both` — Show all connections
   - **Max Depth:**
     - `1` — Only direct connections
     - `2` — Include connections of connections
     - `3-5` — Even deeper traversal

5. **Click "Load Graph"**

### Example Workflow

**Scenario:** You want to see how TypeScript-related memories connect

```bash
# 1. Find TypeScript memories
curl "http://localhost:7654/recall?agentId=openclaw&query=TypeScript&limit=5"

# Response shows memory ID: 699db2ce1234567890abcdef

# 2. View graph structure via API (if you want to script it)
curl "http://localhost:7654/graph/traverse/699db2ce1234567890abcdef?direction=both&maxDepth=2"

# 3. Or open web visualizer at:
#    http://localhost:3002/graph
#    Enter: 699db2ce1234567890abcdef
#    Set: Direction = both, Depth = 2
#    Click "Load Graph"
```

### What You'll See

**Center Node (Green):**
- Your starting memory
- Larger, prominently displayed
- Shows memory text (truncated), layer, confidence

**Connected Nodes (Circular Layout):**
- Arranged in a circle around the center
- Color-coded by relationship type
- Hoverable for full text

**Edges (Lines/Arrows):**
- Show relationship direction
- Labeled with relationship type
- Weighted by confidence (thicker = stronger)

## API Reference

### GET /graph/traverse/:id

Fetch graph data for visualization or analysis.

**Parameters:**
- `:id` — Memory ID to traverse from (required)
- `direction` — `outbound` | `inbound` | `both` (default: `outbound`)
- `maxDepth` — Integer 1-5 (default: `2`)

**Example:**
```bash
curl "http://localhost:7654/graph/traverse/699db2ce1234567890abcdef?direction=both&maxDepth=2"
```

**Response:**
```json
{
  "success": true,
  "centerNode": {
    "id": "699db2ce1234567890abcdef",
    "text": "TypeScript provides static type checking",
    "confidence": 0.9,
    "layer": "semantic",
    "memoryType": "fact",
    "tags": ["typescript", "benefits"]
  },
  "connectedMemories": [
    {
      "memory": {
        "id": "699db2ce1234567890abcde0",
        "text": "Static typing catches bugs at compile time",
        ...
      },
      "relationship": "SUPPORTS",
      "depth": 1,
      "path": ["699db2ce1234567890abcdef"]
    }
  ]
}
```

### GET /graph/node/:id

Get a single memory with all its edges.

**Example:**
```bash
curl "http://localhost:7654/graph/node/699db2ce1234567890abcdef"
```

**Response:**
```json
{
  "success": true,
  "node": {
    "id": "699db2ce1234567890abcdef",
    "text": "TypeScript provides static type checking",
    "edges": [
      {
        "type": "SUPPORTS",
        "targetId": "699db2ce1234567890abcde0",
        "weight": 0.9
      }
    ]
  }
}
```

## Common Use Cases

### 1. Explore Contradiction Networks

Find a memory with contradictions, then visualize the conflict graph:

```bash
# Find contradictions
curl "http://localhost:7654/conflicts?agentId=openclaw"

# Pick a memory ID with contradictions
# Load in graph visualizer with direction=both, depth=1
```

You'll see **red CONTRADICTS edges** connecting conflicting memories.

### 2. Trace Decision Chains

Find a decision memory, then trace what led to it:

```bash
# Find decision memories
curl "http://localhost:7654/memories?agentId=openclaw&memoryType=decision"

# Load in graph with direction=inbound, depth=3
```

Shows the **chain of reasoning** that led to the decision.

### 3. Map Topic Clusters

Find a central topic (e.g., "Python"), explore its connections:

```bash
# Find Python memories
curl "http://localhost:7654/recall?agentId=openclaw&query=Python"

# Load center node in graph with direction=both, depth=2
```

Shows the **ecosystem of related memories** around that topic.

### 4. Verify Knowledge Consistency

For critical facts, check for contradictions:

```bash
# Load important memory
# Set direction=both, depth=2
# Look for red (CONTRADICTS) edges
```

Visual inspection of contradiction networks.

## Tips & Tricks

### Finding Interesting Starting Points

**Highly connected memories:**
```bash
# Memories with the most edges
curl "http://localhost:7654/memories?agentId=openclaw&sort=edgeCount&limit=10"
```

**Recent contradictions:**
```bash
curl "http://localhost:7654/conflicts?agentId=openclaw&limit=5"
```

**Archival (important) memories:**
```bash
curl "http://localhost:7654/memories?agentId=openclaw&layer=archival&limit=10"
```

### Performance Tips

- **Start with depth=1** for large graphs
- **Use direction=outbound** for faster queries
- **Limit to recent memories** if you have 1000+ memories

### Troubleshooting

**"Memory not found"**
- Double-check the ID (24 hex characters)
- Ensure agentId matches (graph only shows memories for one agent)

**"Empty graph"**
- Memory might not have any edges yet
- Try a different memory or run the reflection pipeline first

**"Graph too large / slow"**
- Reduce depth (2 → 1)
- Use direction=outbound instead of both
- The system caps results at 100 nodes to prevent overload

## Integration with Reflection Pipeline

The graph is automatically built by the **reflection pipeline**:

1. **GraphLink stage** analyzes relationships between memories
2. Creates **pending edges** (require approval)
3. Once approved, edges appear in the graph
4. **EntityUpdate stage** creates MENTIONS_ENTITY edges

**Trigger reflection to build graph:**
```bash
curl -X POST http://localhost:7654/reflect \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "openclaw",
    "sessionId": "your-session-id"
  }'
```

After reflection runs, graph connections will appear.

## Future Enhancements

- [ ] Search for memories directly in graph UI (no manual ID entry)
- [ ] Node click → Show full memory details
- [ ] Edge click → Show relationship explanation
- [ ] Time-based filtering (show only memories from last week)
- [ ] Export graph as PNG/SVG
- [ ] Community detection (auto-identify topic clusters)
- [ ] Path finding (shortest path between two memories)

---

**Quick Start:**
1. List memories: `curl "http://localhost:7654/memories?agentId=openclaw&limit=10"`
2. Copy a memory ID
3. Open: http://localhost:3002/graph
4. Paste ID, click "Load Graph"
5. Explore! 🎉
