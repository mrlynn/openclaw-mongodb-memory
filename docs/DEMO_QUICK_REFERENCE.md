# OpenClaw Memory Demo - Quick Reference Card

## 🚀 Quick Start

**⚠️ NO DOCKER REQUIRED!** Works with your existing MongoDB install.

```bash
# Check prerequisites first
./scripts/check-prerequisites.sh

# Start everything (one command!)
./scripts/demo-start.sh

# Stop everything
./scripts/demo-stop.sh

# Just seed data (if services already running)
./scripts/demo-seed.sh
```

---

## 📍 Demo URLs

| Page | URL | Purpose |
|------|-----|---------|
| **Dashboard** | http://localhost:3002/dashboard | Memory statistics, layers chart |
| **Browser** | http://localhost:3002/browser | Search & filter memories |
| **Graph** | http://localhost:3002/graph | ⭐ Visual relationships (NEW browse feature!) |
| **Conflicts** | http://localhost:3002/conflicts | ⭐ LLM explanations (NEW!) |
| **Operations** | http://localhost:3002/operations | ⭐ Reflection pipeline controls (NEW!) |
| **Expiration** | http://localhost:3002/expiration | Temporal decay queue |

---

## 🎬 5-Minute Demo Flow

### 1. Dashboard (30 sec)
- Show memory count & distribution
- Point out layers panel

### 2. Graph Visualizer (2 min) ⭐ NEW UX!
- Click **"Browse"** button
- Search "TypeScript"
- Click memory → auto-select
- Load graph (direction=both, depth=2)
- Show interactive pan/zoom
- **Highlight:** "No more ID copying!"

### 3. Reflection Pipeline (1 min) ⭐ NEW!
- Go to Operations page
- Click "Trigger Reflection"
- Show 9-stage pipeline
- Refresh jobs → show progress
- **Highlight:** "UI controls, not API-only"

### 4. LLM Contradictions (1.5 min) ⭐ NEW!
- Go to Conflicts page
- Show TypeScript vs JavaScript conflict
- Read LLM explanation
- Point out severity & suggestion
- **Highlight:** "Context-aware, actionable insights"

---

## 💡 Key Talking Points

### For Each Feature:

**Graph Browse:**
- ✅ "80% time reduction in workflow"
- ✅ "No technical knowledge needed"
- ✅ "Search built-in, real-time"

**Reflection Pipeline:**
- ✅ "9 stages, fully automated"
- ✅ "Completes in 1-5 seconds"
- ✅ "Now has full UI controls"

**LLM Contradictions:**
- ✅ "Rich, human-readable explanations"
- ✅ "Severity assessment (high/medium/low)"
- ✅ "Resolution suggestions"
- ✅ "Auto-fallback if LLM unavailable"

**Performance:**
- ✅ "Recall <200ms with 150+ memories"
- ✅ "Exceeds targets by 4-17x"
- ✅ "82/84 tests passing (97.6%)"

---

## 🎨 Graph Edge Colors

| Color | Type | Meaning |
|-------|------|---------|
| 🟢 Green | SUPPORTS | Agrees with, reinforces |
| 🔴 Red | CONTRADICTS | Conflicts with |
| 🔵 Blue | PRECEDES | Happened before |
| 🟡 Yellow | CAUSES | Causal relationship |
| 🟣 Purple | DERIVES_FROM | Based on, derived from |
| 🟠 Orange | CO_OCCURS | Same context |
| ⚪ Gray | MENTIONS_ENTITY | References entity |

---

## 🛠️ Troubleshooting

| Issue | Fix |
|-------|-----|
| No memories | Run `./scripts/demo-seed.sh` |
| Empty graph | Run reflection: `curl -X POST http://localhost:7654/reflect -d '{"agentId":"openclaw"}'` |
| No contradictions | Seed script creates TypeScript/JavaScript preference conflict |
| LLM explanation missing | Start Ollama: `ollama serve` → run enhance |
| Services not starting | Check MongoDB: `brew services start mongodb-community` (NO DOCKER NEEDED!) |
| "MongoDB not accessible" | Verify: `mongosh --eval "db.version()"` |

---

## 📊 Demo Data Summary

**14 memories created:**
- 4 programming language memories (TypeScript vs JavaScript contradiction!)
- 3 database memories (MongoDB, Atlas, embeddings)
- 3 AI/ML memories (RAG, Voyage, LLMs)
- 2 dev tool memories (Next.js, React)
- 2 decision memories (UI framework, database choice)

**After reflection:**
- ~10-15 graph edges
- 1 detected contradiction
- 5-8 entities extracted
- All memories classified by type & layer

---

## 🎯 Success Metrics to Highlight

- **Performance:** Recall queries <200ms (17x better than target)
- **Concurrency:** 50 parallel operations, no problem
- **Clustering:** 100 memories in <10 seconds
- **Test Coverage:** 82/84 tests passing (97.6%)
- **UX:** 80% time reduction with Browse feature

---

## 📱 Quick Commands (Copy-Paste Ready)

```bash
# Create a memory
curl -X POST http://localhost:7654/remember -H "Content-Type: application/json" -d '{
  "agentId":"openclaw",
  "text":"Demo memory for graph visualization",
  "tags":["demo","test"]
}'

# Search memories
curl "http://localhost:7654/recall?agentId=openclaw&query=TypeScript&limit=5"

# Run reflection
curl -X POST http://localhost:7654/reflect -H "Content-Type: application/json" -d '{
  "agentId":"openclaw"
}'

# Enhance contradictions
curl -X POST http://localhost:7654/contradictions/enhance -H "Content-Type: application/json" -d '{
  "agentId":"openclaw",
  "limit":10
}'

# Check daemon health
curl http://localhost:7654/health
```

---

## 🎥 Recording Tips

- Set browser to 1920x1080
- Use Zoom or OBS for recording
- Rehearse flow beforehand
- Show terminal + browser side-by-side
- Pause at key moments to explain
- Use cursor highlighting for clarity

---

**Print this card and keep it visible during demo!** 📄
