# LLM-Enhanced Contradiction Explanations

## Overview

The contradiction detection system now includes **LLM-powered explanations** that provide rich, human-readable descriptions of why two memories contradict each other.

## Features

### Enhanced Contradiction Fields

Each contradiction now includes:

```typescript
{
  memoryId: string;              // ID of conflicting memory
  detectedAt: Date;              // When conflict was detected
  type: string;                  // "direct", "temporal", "preference", etc.
  explanation: string;           // LLM-generated human explanation
  probability: number;           // Confidence score (0.0-1.0)
  severity: "high"|"medium"|"low"; // Impact severity
  resolutionSuggestion: string;  // LLM suggestion for resolution
  resolution?: string;           // Current resolution status
  resolvedAt?: Date;
  resolutionNote?: string;
}
```

### API Endpoints

#### 1. Enhance Existing Contradictions

**POST /contradictions/enhance**

Generates LLM explanations for existing contradictions.

```bash
curl -X POST http://localhost:7654/contradictions/enhance \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "openclaw",
    "limit": 10
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Enhanced 5 contradictions with LLM explanations",
  "enhanced": 5
}
```

**Parameters:**
- `agentId` (required) — Agent whose contradictions to enhance
- `limit` (optional, default 10) — Maximum number to process

#### 2. Get Contradiction Details

**GET /contradictions/:memoryId**

Fetches detailed contradiction analysis for a specific memory.

```bash
curl http://localhost:7654/contradictions/699db2ce123456789abcdef0
```

**Response:**
```json
{
  "success": true,
  "memory": {
    "id": "699db2ce123456789abcdef0",
    "text": "I prefer TypeScript for large projects",
    "type": "preference",
    "createdAt": "2026-02-24T10:00:00Z",
    "tags": ["typescript", "preferences"],
    "contradictions": [
      {
        "id": "699db2ce123456789abcdef1",
        "text": "I always use JavaScript for quick prototypes",
        "type": "preference",
        "createdAt": "2026-02-24T11:00:00Z",
        "tags": ["javascript", "preferences"],
        "contradiction": {
          "type": "preference",
          "explanation": "These memories express conflicting preferences about programming language choice. The first memory indicates a preference for TypeScript in large projects, while the second suggests JavaScript is preferred for prototyping. This represents a context-dependent preference rather than a direct contradiction.",
          "severity": "medium",
          "resolutionSuggestion": "Add context to clarify: TypeScript for large, production applications; JavaScript for quick prototypes and experiments. Both preferences can coexist if properly contextualized.",
          "probability": 0.75,
          "detectedAt": "2026-02-24T11:00:05Z",
          "resolution": "unresolved"
        }
      }
    ]
  }
}
```

## Configuration

### LLM Endpoint

Set via environment variable:

```bash
# Use Ollama (local)
LLM_ENDPOINT=http://localhost:11434/api/generate
LLM_MODEL=llama3.2:3b

# Or use OpenAI-compatible endpoint
LLM_ENDPOINT=https://api.openai.com/v1/completions
LLM_MODEL=gpt-4o-mini
```

### Fallback Behavior

If the LLM endpoint is unavailable, the system automatically falls back to heuristic explanations:

```json
{
  "explanation": "These memories make directly opposing claims about the same topic. Memory A: \"I prefer TypeScript...\" vs Memory B: \"I always use JavaScript...\"",
  "severity": "medium",
  "resolutionSuggestion": "Review both memories and decide which reflects the current truth, or mark one as historical context."
}
```

## Usage Examples

### Automated Enhancement

Run periodically (e.g., daily cron job) to enhance new contradictions:

```bash
# Enhance up to 50 contradictions
curl -X POST http://localhost:7654/contradictions/enhance \
  -H "Content-Type: application/json" \
  -d '{"agentId": "openclaw", "limit": 50}'
```

### Dashboard Integration

Fetch contradiction details for display in UI:

```javascript
async function loadContradictionDetails(memoryId) {
  const response = await fetch(`/contradictions/${memoryId}`);
  const data = await response.json();
  
  // Display rich explanation
  console.log(data.memory.contradictions[0].contradiction.explanation);
  console.log("Severity:", data.memory.contradictions[0].contradiction.severity);
  console.log("Suggestion:", data.memory.contradictions[0].contradiction.resolutionSuggestion);
}
```

### Programmatic Enhancement

Use the service directly in code:

```typescript
import { enhanceContradictionExplanations } from './services/contradictionExplainer';

// Enhance contradictions for an agent
const enhanced = await enhanceContradictionExplanations(db, 'openclaw', 10);
console.log(`Enhanced ${enhanced} contradictions`);
```

## LLM Prompt Template

The system uses this prompt structure:

```
Analyze why these two memories contradict each other and explain the conflict clearly.

Memory A (2026-02-24):
"I prefer TypeScript for large projects"
Type: preference
Tags: typescript, preferences

Memory B (2026-02-24):
"I always use JavaScript for quick prototypes"
Type: preference
Tags: javascript, preferences

Detected contradiction type: preference

Provide:
1. A clear explanation of the contradiction in 1-2 sentences
2. Severity level (high/medium/low)
3. A suggestion for how to resolve this conflict

Format your response as:
EXPLANATION: [your explanation]
SEVERITY: [high/medium/low]
RESOLUTION: [suggestion]
```

## Performance

- **LLM call latency:** ~200-500ms per contradiction (with Ollama local)
- **Batch processing:** Enhances 10 contradictions in ~2-5 seconds
- **Fallback:** <1ms if LLM unavailable
- **Caching:** Already-enhanced contradictions (>100 chars) are skipped

## Best Practices

1. **Run periodically**: Schedule daily enhancement job during off-peak hours
2. **Limit batch size**: Process 10-50 contradictions at a time to avoid timeouts
3. **Monitor LLM availability**: Log failures and fall back gracefully
4. **Review explanations**: Periodically audit LLM explanations for quality
5. **Context matters**: Enhanced explanations work best with well-tagged memories

## Troubleshooting

### LLM Not Available

```json
{
  "error": "LLM request failed: ECONNREFUSED"
}
```

**Solution:**
- Check `LLM_ENDPOINT` is correct
- Verify Ollama or your LLM server is running
- System will use fallback explanations automatically

### Empty Explanations

If `explanation` is empty or generic:

**Causes:**
- LLM model doesn't support the prompt format
- Temperature too high (use 0.3 or lower)
- Model context window too small

**Solution:**
- Use a model with at least 8K context (e.g., `llama3.2:3b`)
- Lower `temperature` in request options
- Simplify the prompt (reduce memory text length)

### Slow Processing

If batch processing takes >10 seconds:

**Optimizations:**
- Reduce batch `limit` (10 instead of 50)
- Use a faster model (e.g., `llama3.2:1b`)
- Run enhancement asynchronously
- Cache enhanced contradictions (already done automatically)

## Future Enhancements

- [ ] Multi-language support
- [ ] Custom prompt templates per agent
- [ ] Automatic resolution suggestions with one-click apply
- [ ] Contradiction severity trending over time
- [ ] Batch processing with progress tracking
- [ ] Integration with reflection pipeline (auto-enhance on detection)

---

**Status:** ✅ Production-ready  
**Version:** 1.0.0  
**Updated:** 2026-02-24
