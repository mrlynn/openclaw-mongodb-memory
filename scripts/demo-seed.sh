#!/bin/bash
# OpenClaw Memory Demo Data Seeder with Graph Edges
# Creates sample memories and wires them up with graph edges

# Resolve daemon URL from env (same precedence as daemon config)
if [ -n "$DAEMON_URL" ]; then
  DAEMON="$DAEMON_URL"
elif [ -n "$MEMORY_DAEMON_PORT" ]; then
  DAEMON="http://localhost:$MEMORY_DAEMON_PORT"
else
  # Try to read from .env.local at the repo root
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  ENV_FILE="$SCRIPT_DIR/../.env.local"
  if [ -f "$ENV_FILE" ]; then
    PORT=$(grep -E '^MEMORY_DAEMON_PORT=' "$ENV_FILE" | cut -d= -f2)
    if [ -n "$PORT" ]; then
      DAEMON="http://localhost:$PORT"
    fi
  fi
  DAEMON="${DAEMON:-http://localhost:7751}"
fi

AGENT_ID="${AGENT_ID:-demo-agent}"

# Safety: never seed into a real agent that might have valuable data
if [ "$AGENT_ID" = "openclaw" ] && [ -z "$FORCE_OPENCLAW" ]; then
  echo "⛔ Refusing to seed into 'openclaw' — that's the primary agent."
  echo "   Use a dedicated demo agent instead (default: demo-agent)."
  echo "   Override with: FORCE_OPENCLAW=1 AGENT_ID=openclaw $0"
  exit 1
fi

echo "🌱 Seeding demo data with graph connections..."
echo "   Daemon: $DAEMON"
echo "   Agent: $AGENT_ID"
echo ""

# Verify daemon is reachable
if ! curl -s --max-time 3 "$DAEMON/health" > /dev/null 2>&1; then
  echo "❌ Cannot reach daemon at $DAEMON"
  echo "   Start it with: pnpm dev (or ocmem start)"
  echo "   Or set DAEMON_URL: DAEMON_URL=http://localhost:7751 $0"
  exit 1
fi

# Function to create memory and capture ID
create_memory() {
  local text="$1"
  local tags="$2"
  local type="$3"

  response=$(curl -s -X POST "$DAEMON/remember" -H "Content-Type: application/json" -d "{
    \"agentId\": \"$AGENT_ID\",
    \"text\": \"$text\",
    \"tags\": $tags,
    \"memoryType\": \"$type\"
  }")

  echo "$response" | grep -o '"id":"[^"]*"' | cut -d'"' -f4
}

# Function to create a graph edge between two memories
create_edge() {
  local source="$1"
  local target="$2"
  local type="$3"
  local weight="${4:-0.8}"

  if [ -z "$source" ] || [ -z "$target" ]; then
    echo "   ⚠️  Skipped edge (missing ID)"
    return
  fi

  response=$(curl -s -X POST "$DAEMON/graph/edges" -H "Content-Type: application/json" -d "{
    \"sourceId\": \"$source\",
    \"targetId\": \"$target\",
    \"edgeType\": \"$type\",
    \"weight\": $weight
  }")

  success=$(echo "$response" | grep -o '"success":true')
  if [ -n "$success" ]; then
    echo "   ✓ $type: $(echo "$source" | cut -c1-8)… → $(echo "$target" | cut -c1-8)…"
  else
    error=$(echo "$response" | grep -o '"error":"[^"]*"' | cut -d'"' -f4)
    echo "   ✗ $type failed: $error"
  fi
}

echo "📝 Creating interconnected memories..."
echo ""

# === Chain 1: TypeScript Knowledge Graph ===
echo "🔗 TypeScript chain..."

TS_FACT=$(create_memory \
  "TypeScript provides static type checking for JavaScript" \
  "[\"typescript\", \"benefits\"]" \
  "fact")
echo "   ✓ [1] TypeScript fact ($TS_FACT)"

TS_BENEFITS=$(create_memory \
  "Type systems catch errors at compile time instead of runtime" \
  "[\"typescript\", \"quality\"]" \
  "observation")
echo "   ✓ [2] Type benefits ($TS_BENEFITS)"

TS_TOOLING=$(create_memory \
  "IDE autocomplete and refactoring work better with TypeScript" \
  "[\"typescript\", \"tooling\"]" \
  "observation")
echo "   ✓ [3] TypeScript tooling ($TS_TOOLING)"

TS_PREF=$(create_memory \
  "I prefer TypeScript for large projects" \
  "[\"typescript\", \"preference\"]" \
  "preference")
echo "   ✓ [4] TypeScript preference ($TS_PREF)"

# === Chain 2: JavaScript (creates contradiction) ===
echo ""
echo "🔗 JavaScript chain..."

JS_PREF=$(create_memory \
  "JavaScript is better for quick prototypes" \
  "[\"javascript\", \"preference\"]" \
  "preference")
echo "   ✓ [5] JavaScript preference ($JS_PREF)"

JS_FACT=$(create_memory \
  "JavaScript is the most widely used programming language" \
  "[\"javascript\", \"popularity\"]" \
  "fact")
echo "   ✓ [6] JavaScript fact ($JS_FACT)"

# === Chain 3: MongoDB/Database ===
echo ""
echo "🔗 MongoDB chain..."

MONGO_FACT=$(create_memory \
  "MongoDB is a document database" \
  "[\"mongodb\", \"database\"]" \
  "fact")
echo "   ✓ [7] MongoDB fact ($MONGO_FACT)"

VECTOR_FACT=$(create_memory \
  "Vector embeddings enable semantic search in MongoDB" \
  "[\"mongodb\", \"ai\", \"embeddings\"]" \
  "fact")
echo "   ✓ [8] Vector embeddings ($VECTOR_FACT)"

ATLAS_FACT=$(create_memory \
  "MongoDB Atlas provides managed cloud database hosting" \
  "[\"mongodb\", \"cloud\", \"atlas\"]" \
  "fact")
echo "   ✓ [9] MongoDB Atlas ($ATLAS_FACT)"

# === Chain 4: AI/ML ===
echo ""
echo "🔗 AI/ML chain..."

RAG_FACT=$(create_memory \
  "RAG systems combine retrieval and generation" \
  "[\"ai\", \"rag\", \"llm\"]" \
  "fact")
echo "   ✓ [10] RAG fact ($RAG_FACT)"

VOYAGE_FACT=$(create_memory \
  "Voyage AI provides high-quality embeddings" \
  "[\"ai\", \"embeddings\", \"voyage\"]" \
  "fact")
echo "   ✓ [11] Voyage AI ($VOYAGE_FACT)"

LLM_OBS=$(create_memory \
  "LLMs explain contradictions better than heuristics" \
  "[\"ai\", \"llm\", \"reasoning\"]" \
  "observation")
echo "   ✓ [12] LLM observation ($LLM_OBS)"

# === Chain 5: Development Tools ===
echo ""
echo "🔗 Development tools..."

NEXTJS_FACT=$(create_memory \
  "Next.js is a React framework for production apps" \
  "[\"nextjs\", \"react\", \"web\"]" \
  "fact")
echo "   ✓ [13] Next.js ($NEXTJS_FACT)"

REACT_FACT=$(create_memory \
  "React enables component-based UIs" \
  "[\"react\", \"web\", \"ui\"]" \
  "fact")
echo "   ✓ [14] React ($REACT_FACT)"

echo ""
echo "✅ Created 14 memories"
echo ""

# ===================================================================
# Create graph edges directly via POST /graph/edges
# ===================================================================

echo "🔗 Creating graph edges..."
echo ""

# --- TypeScript chain (SUPPORTS) ---
echo "   TypeScript chain:"
create_edge "$TS_FACT"     "$TS_BENEFITS" "SUPPORTS"  0.9
create_edge "$TS_BENEFITS" "$TS_TOOLING"  "SUPPORTS"  0.85
create_edge "$TS_TOOLING"  "$TS_PREF"     "SUPPORTS"  0.8
create_edge "$TS_FACT"     "$TS_PREF"     "SUPPORTS"  0.75

# --- JavaScript chain ---
echo ""
echo "   JavaScript chain:"
create_edge "$JS_PREF"    "$JS_FACT"     "SUPPORTS"     0.7

# --- TypeScript ↔ JavaScript contradiction (bidirectional auto) ---
echo ""
echo "   Cross-chain contradiction:"
create_edge "$TS_PREF"    "$JS_PREF"     "CONTRADICTS"  0.9

# --- MongoDB chain (SUPPORTS) ---
echo ""
echo "   MongoDB chain:"
create_edge "$MONGO_FACT"   "$VECTOR_FACT" "SUPPORTS" 0.9
create_edge "$MONGO_FACT"   "$ATLAS_FACT"  "SUPPORTS" 0.85
create_edge "$VECTOR_FACT"  "$ATLAS_FACT"  "CO_OCCURS" 0.8

# --- AI/ML chain (SUPPORTS + CO_OCCURS) ---
echo ""
echo "   AI/ML chain:"
create_edge "$RAG_FACT"     "$VOYAGE_FACT" "SUPPORTS"  0.9
create_edge "$VOYAGE_FACT"  "$VECTOR_FACT" "SUPPORTS"  0.85
create_edge "$RAG_FACT"     "$LLM_OBS"    "SUPPORTS"  0.8
create_edge "$VOYAGE_FACT"  "$LLM_OBS"    "CO_OCCURS" 0.7

# --- Development tools chain ---
echo ""
echo "   Development tools chain:"
create_edge "$NEXTJS_FACT"  "$REACT_FACT"  "DERIVES_FROM" 0.95
create_edge "$REACT_FACT"   "$TS_FACT"     "SUPPORTS"     0.7

# --- Cross-chain connections ---
echo ""
echo "   Cross-chain connections:"
create_edge "$VECTOR_FACT"  "$RAG_FACT"    "SUPPORTS"  0.85
create_edge "$MONGO_FACT"   "$RAG_FACT"    "SUPPORTS"  0.7

echo ""
echo "📊 Demo graph structure:"
echo ""
echo "   TypeScript ─SUPPORTS→ Type Benefits ─SUPPORTS→ Tooling ─SUPPORTS→ TS Pref"
echo "       │                                                                │"
echo "       └─SUPPORTS→ TS Preference ←─CONTRADICTS─→ JS Preference         │"
echo "                                                       │                │"
echo "   MongoDB ─SUPPORTS→ Vector Search ←─CO_OCCURS─→ Atlas               │"
echo "       │         │                                                      │"
echo "       └─────────┼─SUPPORTS→ RAG ─SUPPORTS→ Voyage ─CO_OCCURS→ LLM   │"
echo "                 │                    │                                  │"
echo "                 └────────────────────┘                                 │"
echo "                                                                        │"
echo "   Next.js ─DERIVES_FROM→ React ─SUPPORTS──────────────────────────────┘"
echo ""
echo "   Total: 14 nodes, 17 edges (+ reverse edges for CO_OCCURS & CONTRADICTS)"
echo ""
echo "🎯 Good starting points for graph visualization:"
if [ -n "$TS_FACT" ]; then
  echo "   TypeScript: $TS_FACT"
fi
if [ -n "$MONGO_FACT" ]; then
  echo "   MongoDB:    $MONGO_FACT"
fi
if [ -n "$RAG_FACT" ]; then
  echo "   RAG:        $RAG_FACT"
fi
echo ""
echo "🎉 Demo ready! Open http://localhost:3000/graph"
echo "   1. Select agent '$AGENT_ID'"
echo "   2. Click 'Browse' and pick any memory"
echo "   3. Direction is set to 'Both' by default — you'll see connections!"
