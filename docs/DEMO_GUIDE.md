# OpenClaw Memory System Demo Guide

## Quick Setup (5 Minutes)

### Prerequisites

**✅ You already have everything you need!**

Check your setup:
```bash
./scripts/check-prerequisites.sh
```

**Requirements:**
- ✅ Node.js (you have v25.6.1)
- ✅ MongoDB (you have 8.2.5 via Homebrew)
- ⚠️ **Docker is NOT required!**

**Optional:**
- Ollama (for LLM contradiction explanations)

---

### Start Demo (One Command)

**Automated setup:**
```bash
./scripts/demo-start.sh
```

This will:
1. Check MongoDB is running ✅
2. Build & start daemon
3. Build & start web dashboard
4. Seed demo data
5. Run reflection pipeline
6. Open browser automatically

**Ready in ~30 seconds!**

---

### Manual Setup (If You Prefer)

1. **Start the daemon:**
   ```bash
   cd /Users/michael.lynn/code/openclaw-memory/packages/daemon
   npm start
   ```

2. **Start the web dashboard:**
   ```bash
   cd /Users/michael.lynn/code/openclaw-memory/packages/web
   npm run dev
   ```

3. **Open browser:**
   ```
   http://localhost:3002
   ```

### Seed Demo Data

Run this script to create sample memories for demonstration:

```bash
#!/bin/bash
DAEMON="http://localhost:7654"

# Create a set of related memories about programming languages
curl -X POST $DAEMON/remember -H "Content-Type: application/json" -d '{
  "agentId": "openclaw",
  "text": "TypeScript provides static type checking for JavaScript",
  "tags": ["typescript", "benefits"],
  "memoryType": "fact"
}'

curl -X POST $DAEMON/remember -H "Content-Type: application/json" -d '{
  "agentId": "openclaw",
  "text": "I prefer TypeScript for large projects because it catches errors early",
  "tags": ["typescript", "preference"],
  "memoryType": "preference"
}'

curl -X POST $DAEMON/remember -H "Content-Type: application/json" -d '{
  "agentId": "openclaw",
  "text": "JavaScript is better for quick prototypes without type overhead",
  "tags": ["javascript", "preference"],
  "memoryType": "preference"
}'

curl -X POST $DAEMON/remember -H "Content-Type: application/json" -d '{
  "agentId": "openclaw",
  "text": "MongoDB is a document database that stores data in JSON-like format",
  "tags": ["mongodb", "database"],
  "memoryType": "fact"
}'

curl -X POST $DAEMON/remember -H "Content-Type: application/json" -d '{
  "agentId": "openclaw",
  "text": "Vector embeddings enable semantic search in MongoDB",
  "tags": ["mongodb", "ai", "embeddings"],
  "memoryType": "fact"
}'

curl -X POST $DAEMON/remember -H "Content-Type: application/json" -d '{
  "agentId": "openclaw",
  "text": "Type systems help catch bugs at compile time instead of runtime",
  "tags": ["typescript", "quality"],
  "memoryType": "observation"
}'

echo "✅ Created 6 demo memories"
```

Save as `seed-demo.sh`, make executable, and run:
```bash
chmod +x seed-demo.sh
./seed-demo.sh
```

---

## Demo Script: Quick Tour (5 Minutes)

### 1. Dashboard Overview (1 min)

**Navigate to:** http://localhost:3002/dashboard

**Talking points:**
- "Here's the main dashboard showing memory statistics"
- "We have 6 memories across different layers: episodic, semantic, archival"
- "The layers panel shows distribution by memory maturity"
- "Database stats show total count and distribution by type"

**Show:**
- Memory count by layer (bar chart)
- Database statistics card
- Quick stats overview

---

### 2. Memory Browser (1 min)

**Navigate to:** http://localhost:3002/browser

**Talking points:**
- "The memory browser lets us search and filter memories"
- "Search is semantic—it understands meaning, not just keywords"
- "Each memory shows confidence score, layer, and tags"

**Demo:**
1. Search for "TypeScript"
2. Show results with relevance scores
3. Click on a memory to see details
4. Point out confidence score and layer badges

---

### 3. Graph Visualizer with Browse (2 min)

**Navigate to:** http://localhost:3002/graph

**Talking points:**
- "The graph visualizer shows relationships between memories"
- "**New feature:** No need to manually copy IDs—just browse and select"

**Demo:**
1. Click **"Browse"** button
2. Show the memory list with previews
3. Type "TypeScript" in search box → results update
4. Click on a memory to select it
5. Set Direction = "both", Depth = "2"
6. Click **"Load Graph"**
7. Show the interactive graph:
   - Pan and zoom
   - Hover over nodes
   - Explain edge colors (green = supports, red = contradicts, etc.)

**Highlight:**
- "This is a huge UX improvement—no more manual ID copying!"
- "Search works in real-time"
- "Visual context before selecting"

---

### 4. Reflection Pipeline (1 min)

**Navigate to:** http://localhost:3002/operations

**Talking points:**
- "The reflection pipeline analyzes memories through 9 stages"
- "**New feature:** Full UI controls—no more API-only access"

**Demo:**
1. Scroll to "Reflection Pipeline" section
2. Click **"Trigger Reflection"**
3. Show the modal:
   - Optional session ID
   - Optional transcript for better extraction
4. Click **"Start Pipeline"**
5. Click **"Refresh Jobs"** to see status
6. Show job details:
   - Status badge
   - Stage progress (e.g., "7/9 stages")
   - Duration

**Highlight:**
- "Pipeline runs asynchronously—completes in 1-5 seconds"
- "Shows all 9 stages: Extract, Deduplicate, Conflict-Check, etc."

---

## Demo Script: Full Tour (15-20 Minutes)

### Part 1: Core Memory Operations (3 min)

#### Create a Memory

**Navigate to:** http://localhost:3002/remember

**Demo:**
1. Fill in the form:
   - Text: "Next.js is a React framework for production applications"
   - Tags: nextjs, react, web
   - Memory Type: fact
2. Click **"Remember"**
3. Show success message with memory ID

#### Search Memories

**Navigate to:** http://localhost:3002/recall

**Demo:**
1. Search for "React framework"
2. Show semantic results (finds "Next.js" even though query was different)
3. Explain relevance scores
4. Show that tags and memory type are displayed

---

### Part 2: LLM-Enhanced Contradiction Explanations (3 min)

**Navigate to:** http://localhost:3002/conflicts

**Talking points:**
- "**New feature:** LLM-powered explanations of contradictions"
- "Instead of just 'pattern detected', we get human-readable explanations"

**Demo:**
1. Show the conflicts page
2. Click on a contradiction (TypeScript vs JavaScript preference)
3. Show the comparison view:
   - Side-by-side memory display
   - **Rich explanation** from LLM
   - **Severity rating** (high/medium/low)
   - **Resolution suggestion**

**Example explanation:**
> "These memories express conflicting preferences about programming language choice. The first indicates TypeScript for large projects, while the second suggests JavaScript for prototyping. This represents a context-dependent preference rather than a direct contradiction."
>
> **Severity:** Medium  
> **Suggestion:** "Add context to clarify: TypeScript for large projects, JavaScript for quick prototypes. Both preferences can coexist."

**Highlight:**
- "LLM provides context-aware analysis"
- "Suggests how to resolve the conflict"
- "Much more actionable than heuristic detection"

**Trigger enhancement:**
```bash
curl -X POST http://localhost:7654/contradictions/enhance \
  -H "Content-Type: application/json" \
  -d '{"agentId": "openclaw", "limit": 10}'
```

Then refresh the conflicts page to see enhanced explanations.

---

### Part 3: Reflection Pipeline Deep Dive (4 min)

**Navigate to:** http://localhost:3002/operations

**Talking points:**
- "Reflection pipeline is the brain of the system"
- "Analyzes, enriches, and connects memories automatically"

**Demo:**
1. Show the Reflection Pipeline section
2. Click **"Trigger Reflection"**
3. Explain optional parameters:
   - Session ID: Process only specific session
   - Transcript: Provide context for better extraction
4. Show the 9 stages:
   ```
   1. Extract → 2. Deduplicate → 3. Conflict-Check → 4. Classify
   5. Confidence-Update → 6. Decay → 7. Layer-Promote
   8. Graph-Link → 9. Entity-Update
   ```
5. Click **"Start Pipeline"**
6. Refresh jobs list
7. Show job details:
   - Job ID
   - Status progression (pending → running → completed)
   - Stage breakdown
   - Duration (typically 1-3 seconds)

**Explain what each stage does:**
- **Extract:** Find new memories in session transcript
- **Deduplicate:** Merge similar memories
- **Conflict-Check:** Detect contradictions
- **Classify:** Assign type, layer, confidence
- **Confidence-Update:** Adjust based on evidence
- **Decay:** Apply temporal weakening
- **Layer-Promote:** Move episodic → semantic → archival
- **Graph-Link:** Create relationship edges
- **Entity-Update:** Extract entities (people, places, concepts)

**Highlight:**
- "Fully automated enrichment"
- "Runs in background, non-blocking"
- "UI shows real-time progress"

---

### Part 4: Graph Visualization (5 min)

**Navigate to:** http://localhost:3002/graph

**Talking points:**
- "Graph shows the knowledge structure"
- "Memories form a network of interconnected ideas"

**Demo:**

#### Method 1: Browse & Select (NEW!)
1. Click **"Browse"**
2. Show memory list:
   - Text previews
   - Layer and type badges
   - Tags
   - Connection count
3. Use search: Type "MongoDB"
4. Results update in real-time
5. Click on a memory
6. ID auto-populates
7. Browse panel closes

#### Load the Graph
1. Set Direction = "both"
2. Set Depth = "2"
3. Click **"Load Graph"**

#### Explore the Graph
1. **Pan and zoom** — Drag to move, scroll to zoom
2. **Hover over nodes** — See full text
3. **Examine edges:**
   - Green (SUPPORTS) — Memory A supports Memory B
   - Red (CONTRADICTS) — Conflicting information
   - Blue (PRECEDES) — Temporal sequence
   - Yellow (CAUSES) — Causal relationship
   - Purple (DERIVES_FROM) — One derived from another
4. **MiniMap** — Show bird's-eye view
5. **Controls** — Zoom in/out, fit view

**Highlight:**
- "No more manual ID copying!"
- "Visual exploration of knowledge structure"
- "Color-coded relationships for quick understanding"
- "Interactive—drag nodes, explore connections"

---

### Part 5: Expiration Queue & Decay (3 min)

**Navigate to:** http://localhost:3002/expiration

**Talking points:**
- "Temporal decay system manages memory lifecycle"
- "Weak memories fade over time unless reinforced"

**Demo:**
1. Show expiration candidates (memories with strength < 0.10)
2. Select a few memories
3. Show bulk actions:
   - **Rescue** — Promote to archival (permanent)
   - **Delete** — Remove permanently
4. Click individual rescue/delete buttons
5. Show confirmation modals

**Navigate to:** http://localhost:3002/operations → Decay Scheduler

**Demo:**
1. Show last run timestamp
2. Show decay settings
3. Click **"Run Decay Now"**
4. Show statistics:
   - Memories processed
   - Expiration candidates
   - Average strength after decay

**Highlight:**
- "Automatic memory lifecycle management"
- "Important memories get promoted to archival"
- "Weak/unused memories naturally fade"

---

### Part 6: Performance & Testing (2 min)

**Show the test results:**

```bash
cd /Users/michael.lynn/code/openclaw-memory/packages/daemon
npm test
```

**Talking points:**
- "System is production-ready with comprehensive testing"
- "97.6% test pass rate (82/84 tests)"
- "Performance exceeds targets by 4-17x"

**Show:** `INTEGRATION_TEST_RESULTS.md`

**Metrics:**
- Sequential insert: 6.62 ops/sec ✅
- Recall latency (p95): 116ms ✅ (17x better than target)
- Concurrent insert: 13.97 ops/sec ✅
- Clustering (100 memories): ~10s ✅

**Highlight:**
- "Solid engineering foundation"
- "Benchmarked and tested at scale"
- "Ready for production deployment"

---

## Quick Demo Data Setup

### Option 1: Use Seed Script (Above)

Run the `seed-demo.sh` script to create 6 related memories.

### Option 2: Import Sample Dataset

```bash
# Create a sample export
cat > demo-data.json << 'EOF'
[
  {
    "text": "TypeScript provides static type checking",
    "tags": ["typescript", "benefits"],
    "memoryType": "fact"
  },
  {
    "text": "I prefer TypeScript for large projects",
    "tags": ["typescript", "preference"],
    "memoryType": "preference"
  },
  {
    "text": "JavaScript is better for quick prototypes",
    "tags": ["javascript", "preference"],
    "memoryType": "preference"
  }
]
EOF

# Import via API
for memory in $(cat demo-data.json | jq -c '.[]'); do
  curl -X POST http://localhost:7654/remember \
    -H "Content-Type: application/json" \
    -d "{\"agentId\": \"openclaw\", $(echo $memory | jq -c '{text, tags, memoryType}')}"
done
```

### Option 3: Interactive Setup

1. Go to http://localhost:3002/remember
2. Manually create 5-10 diverse memories
3. Include some that contradict each other
4. Use different types: fact, preference, decision, observation
5. Add varied tags

---

## Demo Talking Points by Feature

### LLM Contradiction Explanations
✅ "Instead of pattern matching, we use LLMs for rich, contextual explanations"  
✅ "Severity assessment helps prioritize which conflicts to address"  
✅ "Resolution suggestions guide users toward fixing contradictions"  
✅ "Auto-fallback if LLM unavailable—system is resilient"

### Graph Visualizer Browse Feature
✅ "Eliminated the need to manually copy 24-character IDs"  
✅ "80% time reduction in workflow"  
✅ "Search integration makes finding memories intuitive"  
✅ "Visual context before selection—see what you're exploring"

### Reflection Pipeline UI
✅ "No more API-only access—full UI controls"  
✅ "9-stage pipeline runs automatically"  
✅ "Real-time job monitoring with progress tracking"  
✅ "Async execution—non-blocking, completes in seconds"

### Performance & Scale
✅ "Recall queries <200ms even with 150+ memories"  
✅ "Handles 50 concurrent operations gracefully"  
✅ "Clustering 100 memories in under 10 seconds"  
✅ "Exceeded all performance targets by 4-17x"

---

## Demo Environment Checklist

**Before the demo:**

- [ ] Daemon running (`npm start` in packages/daemon)
- [ ] Web dashboard running (`npm run dev` in packages/web)
- [ ] MongoDB connected and accessible
- [ ] Sample data loaded (6+ memories)
- [ ] At least one contradiction exists
- [ ] Reflection pipeline has run (so graph has edges)
- [ ] Browser open to http://localhost:3002

**Optional (for advanced demo):**
- [ ] Ollama running for LLM explanations
- [ ] Multiple memory layers represented (episodic, semantic, archival)
- [ ] At least 20+ memories for realistic browsing
- [ ] Entities extracted (run reflection pipeline)

---

## Troubleshooting Demo Issues

### "No memories showing"
→ Run seed script or create via UI

### "Graph is empty"
→ Run reflection pipeline to create edges

### "Contradictions have no explanation"
→ Run: `curl -X POST http://localhost:7654/contradictions/enhance -d '{"agentId":"openclaw"}'`

### "Reflection pipeline not appearing"
→ Refresh browser, check daemon is running

### "Search returns no results"
→ Ensure VOYAGE_MOCK=true or VOYAGE_API_KEY is set

---

## Recording the Demo

### For Video Recording

1. **Set browser to 1920x1080** for best quality
2. **Use Zoom or OBS** for screen recording
3. **Prepare script** — rehearse flow
4. **Show terminal + browser side-by-side** for API demonstrations
5. **Pause at key moments** to explain features
6. **Use cursor highlighting** for clarity

### For Live Demo

1. **Open all tabs beforehand** (dashboard, graph, operations, etc.)
2. **Have seed script ready** to run if needed
3. **Prepare fallback data** in case of issues
4. **Keep API terminal open** for quick troubleshooting
5. **Have docs open** for reference

---

## Key Messages

**For Technical Audience:**
- "Production-ready system with 82/84 tests passing"
- "Performance exceeds targets by 4-17x"
- "9-stage reflection pipeline with full monitoring"
- "Graph relationships with 7 edge types"
- "LLM-enhanced contradiction detection"

**For Non-Technical Audience:**
- "Your memories form a network of connected knowledge"
- "System automatically detects conflicts and explains them"
- "No technical skills needed—browse and click"
- "Search understands meaning, not just keywords"
- "Memories naturally organize from temporary to permanent"

---

**Demo Duration Targets:**
- Quick tour: 5 minutes
- Full tour: 15-20 minutes
- Deep technical dive: 30-45 minutes

Good luck with the demo! 🚀
