# Graph Visualizer Quick Start

## New! No Need to Find Memory IDs Manually

The graph visualizer now includes a **Browse** feature that lets you select memories visually—no need to copy/paste IDs!

## Quick Start (The Easy Way)

**3 Simple Steps:**

1. **Open the graph page:** http://localhost:3002/graph
2. **Click "Browse"** next to the memory ID field
3. **Click on any memory** from the list to visualize it

That's it! The memory ID fills in automatically.

## What is a Memory ID? (If You're Curious)

A **Memory ID** is like a unique address for each memory—a 24-character code like:

```
699db2ce1234567890abcdef
```

Think of it like a tracking number for a package. Every memory gets one automatically when it's created.

**Good news:** You don't need to worry about this anymore! The Browse feature handles it for you.

## How to Browse & Select Memories

## Manual Method (Still Available)

If you prefer to work with memory IDs directly, you can still:

### Method 1: After Creating a Memory

When you save a memory, the response includes its ID:

```bash
curl -X POST http://localhost:7654/remember \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "openclaw",
    "text": "I learned how graph visualization works"
  }'
```

**Response:**
```json
{
  "success": true,
  "id": "699db2ce1234567890abcdef",  ← Copy this!
  "message": "Memory stored"
}
```

### Method 2: Via API Search

Find memories by keyword via terminal:

```bash
# Search for "TypeScript" memories
curl "http://localhost:7654/recall?agentId=openclaw&query=TypeScript&limit=5"
```

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "id": "699db2ce1234567890abcdef",  ← Copy any ID here
      "text": "TypeScript provides static type checking",
      "score": 0.95
    }
  ]
}
```

### Method 3: List via API

Get your most recent memories via terminal:

```bash
curl "http://localhost:7654/memories?agentId=openclaw&limit=10"
```

Pick any `id` from the list.

### Step-by-Step

**1. Open the graph visualizer:**
```
http://localhost:3002/graph
```

**2. Click the "Browse" button**

A panel appears showing your recent memories with:
- Memory text preview
- Layer (episodic, semantic, archival)
- Memory type (fact, preference, decision)
- Tags
- Connection count

**3. Select a memory**

**Option A: Browse recent memories**
- Scroll through the list
- Click on any memory

**Option B: Search for specific content**
- Type keywords (e.g., "TypeScript") in the search box
- Results update automatically
- Click on a matching memory

**4. Click "Load Graph"**

The memory ID fills in automatically, and you'll see:
- **Center node** (your starting memory) in green
- **Connected memories** arranged in a circle
- **Colored lines** showing relationships

## What the Colors Mean

- 🟢 **Green** = SUPPORTS (agrees with)
- 🔴 **Red** = CONTRADICTS (conflicts with)
- 🔵 **Blue** = PRECEDES (happened before)
- 🟡 **Yellow** = CAUSES (caused by)
- 🟣 **Purple** = DERIVES_FROM (based on)

## Controls

**Direction:**
- **outbound** — Show memories this one links TO
- **inbound** — Show memories that link to THIS one
- **both** — Show all connections

**Depth:**
- **1** — Only direct connections
- **2** — Include connections of connections (recommended)
- **3-5** — Go deeper (may be slow with large graphs)

## Example Session

```bash
# 1. Create a test memory
curl -X POST http://localhost:7654/remember \
  -H "Content-Type: application/json" \
  -d '{"agentId": "openclaw", "text": "Testing graph visualization"}'

# Response: {"id": "699db2ce1234567890abcdef", ...}

# 2. Open graph visualizer
open http://localhost:3002/graph

# 3. Paste the ID: 699db2ce1234567890abcdef

# 4. Click "Load Graph"
```

## No Graph Showing?

If you see an empty graph, it means the memory doesn't have connections yet. Memories get connected when:

1. **Reflection pipeline runs** (analyzes relationships automatically)
2. **You explicitly create edges** via pending edge approval

**Run reflection to build connections:**
```bash
curl -X POST http://localhost:7654/reflect \
  -H "Content-Type: application/json" \
  -d '{"agentId": "openclaw", "sessionId": "test-session"}'
```

After reflection completes, reload the graph—connections will appear!

## Pro Tips

- **Start with recent memories** — they're more likely to have connections
- **Use depth=2** for a good balance of detail vs performance
- **Look for contradiction clusters** — red edges show conflicting info
- **Explore decision chains** — use inbound direction on decision memories

## Need Help?

**Common issues:**

**"Memory not found"**
→ Double-check you copied the full 24-character ID

**"Empty graph"**
→ Memory has no connections yet. Run reflection or try another memory.

**"Graph too big"**
→ Reduce depth to 1, or use outbound only

---

**That's it!** The graph visualizer is a powerful way to see how your memories connect. 

Start by creating a few memories, run reflection, then explore! 🚀
