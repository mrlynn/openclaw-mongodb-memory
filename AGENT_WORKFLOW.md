# Agent Workflow Guide - When to Use Memory

> **For OpenClaw agents:** This guide explains WHEN and HOW to automatically use the memory system.

---

## The Pattern: Save as You Go

**Core principle:** Build memory during conversations, not after.

### ✅ Auto-Save Triggers

Save to MongoDB memory when:

| Trigger | Example | Tag |
|---------|---------|-----|
| **Problem solved** | Fixed a bug, answered a question | `problem-solved` |
| **Decision made** | User chooses approach, sets preference | `decision` |
| **Explanation given** | Taught a concept, explained how something works | `technical-explanation` |
| **User feedback** | User corrects you, expresses opinion | `user-feedback` |
| **Learning** | Discovered something new about user or project | `insight` |
| **Blocker identified** | Hit an obstacle, documented workaround | `blocker` |

### ❌ Don't Save

Skip saving for:
- ❌ Routine acknowledgments ("ok", "got it")
- ❌ Infrastructure status checks (unless something broke)
- ❌ Trivial Q&A with no lasting value
- ❌ Duplicate information already saved

---

## Quick Save Pattern

```bash
curl -X POST http://localhost:7751/remember \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "openclaw",
    "text": "[TIMESTAMP] Brief summary of what happened",
    "tags": ["relevant", "tags"],
    "ttl": 2592000
  }'
```

**Tag taxonomy:**
- `conversation` — General dialogue
- `decision` — Choices made
- `technical-explanation` — Concepts explained
- `user-feedback` — User insights
- `problem-solved` — Issues resolved
- `blocker` — Obstacles hit
- `project-name` — Project-specific (e.g., `vai`, `openclaw-memory`)

**TTL guidance:**
- `2592000` (30 days) — Most conversations
- `7776000` (90 days) — Important insights
- `31536000` (1 year) — Critical decisions

---

## Integration: Update Your AGENTS.md

Add this section to your workspace `AGENTS.md`:

```markdown
### 💾 MongoDB Memory - Auto-Save Conversations

**ALWAYS save to MongoDB when:**
- ✅ Problem solved or question answered
- ✅ Technical explanation given
- ✅ Decision made or preference stated
- ✅ User provides feedback or insight
- ✅ Learning something new about the user or project
- ✅ Blocker identified or resolved

**Quick save pattern:**
\`\`\`bash
curl -X POST http://localhost:7751/remember \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "openclaw",
    "text": "[DATE TIME] Brief summary of what happened",
    "tags": ["relevant", "tags"],
    "ttl": 2592000
  }'
\`\`\`

**Don't save:**
- ❌ Routine "ok" / "got it" acknowledgments
- ❌ Infrastructure status checks (unless something broke)
- ❌ Trivial questions with trivial answers
```

---

## Why This Matters

**Without the workflow:**
- Memory system is installed but unused
- Agents forget context between sessions
- Semantic search has nothing to search

**With the workflow:**
- Memory builds automatically during work
- Agents recall relevant context when needed
- System provides real value, not just infrastructure

---

## Examples

### ❌ Bad (No Memory)
```
User: "What did we decide about UI libraries?"
Agent: "I don't have that information."
```

### ✅ Good (With Memory)
```
User: "What did we decide about UI libraries?"
Agent: *searches memory_search("UI library decision")*
Agent: "We decided on Material UI over Tailwind on Feb 15. 
       You prefer its opinionated design system."
```

---

## Verification

After setup, test the workflow:

```bash
# 1. Have a conversation that triggers saves
# 2. Check memory count
curl http://localhost:7751/status | jq '.stats'

# 3. Test semantic recall
curl "http://localhost:7751/recall?agentId=openclaw&query=YOUR_QUESTION&limit=5"

# 4. Verify relevance scores (should be >0.5 for good matches)
```

---

## Post-Install Checklist

- [ ] Read this guide
- [ ] Update workspace `AGENTS.md` with auto-save pattern
- [ ] Test saving a memory manually
- [ ] Test recalling it semantically
- [ ] Integrate saves into your main agent loop

---

**Questions?** See [SKILL.md](./SKILL.md) for full API reference.
