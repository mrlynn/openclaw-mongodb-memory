# Reflection Pipeline Triggers

## Overview

The **Reflection Pipeline** is the system that analyzes and enriches memories through 9 stages. Here's how it gets triggered and controlled.

## Current Trigger Methods

### 1. Manual Trigger (Web UI)

**Location:** Operations page → Reflection Pipeline section

**Steps:**
1. Go to http://localhost:3002/operations
2. Click **"Trigger Reflection"** button
3. (Optional) Enter session ID to process specific session
4. (Optional) Provide session transcript for better extraction
5. Click **"Start Pipeline"**

**Result:** Pipeline runs asynchronously, typically completes in 1-5 seconds

**Use Cases:**
- Process a batch of newly created memories
- Re-analyze a specific session after corrections
- Force graph relationship updates

### 2. API Trigger

**Endpoint:** `POST /reflect`

**Example:**
```bash
curl -X POST http://localhost:7654/reflect \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "openclaw",
    "sessionId": "optional-session-id",
    "sessionTranscript": "Optional context for better extraction"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Reflection pipeline started",
  "jobId": "699db2ce1234567890abcdef"
}
```

**Use Cases:**
- Integrate with external workflows
- Trigger from cron jobs
- Script-based batch processing
- Post-import processing

### 3. Programmatic Trigger (From Code)

```typescript
import { runPipeline, createFullPipeline } from './reflection/pipeline';
import { createJob } from './reflection/jobQueue';

// Create job
const jobId = await createJob(db, agentId, sessionId, {
  triggeredBy: "automated",
  triggeredAt: new Date().toISOString(),
});

// Build context
const context = {
  agentId,
  sessionId,
  jobId,
  sessionTranscript: "...",
  stats: {},
};

// Get pipeline stages
const stages = await createFullPipeline(db, embedder);

// Run pipeline
await runPipeline(db, jobId, context, stages);
```

## Pipeline Stages (9 Total)

When triggered, the pipeline executes these stages in order:

1. **Extract** — Extract candidate memories from session transcript
2. **Deduplicate** — Find and merge duplicate/similar memories
3. **Conflict-Check** — Detect contradictions between memories
4. **Classify** — Assign memory type, layer, confidence
5. **Confidence-Update** — Adjust confidence based on reinforcement/contradictions
6. **Decay Pass** — Apply temporal decay to all memories
7. **Layer-Promote** — Promote memories between layers (episodic → semantic → archival)
8. **Graph-Link** — Create relationship edges between memories
9. **Entity-Update** — Extract entities and create MENTIONS_ENTITY edges

**Total Duration:** Typically 1-5 seconds for small batches

## Monitoring Pipeline Jobs

### Via Web UI

**Operations Page** shows recent jobs with:
- Job ID (first 8 chars)
- Status (Pending, Running, Completed, Failed)
- Session ID (if scoped)
- Stage progress (e.g., "7/9")
- Start time
- Duration

**Refresh** button reloads job list.

### Via API

**Get Job Status:**
```bash
curl "http://localhost:7654/reflect/status?jobId=YOUR_JOB_ID"
```

**List Recent Jobs:**
```bash
curl "http://localhost:7654/reflect/jobs?agentId=openclaw&limit=10"
```

**Response Example:**
```json
{
  "success": true,
  "job": {
    "id": "699db2ce1234567890abcdef",
    "agentId": "openclaw",
    "status": "completed",
    "createdAt": "2026-02-24T10:00:00Z",
    "startedAt": "2026-02-24T10:00:01Z",
    "completedAt": "2026-02-24T10:00:03Z",
    "stages": [
      {
        "stage": "extract",
        "status": "completed",
        "duration": 125,
        "itemsProcessed": 4,
        "itemsCreated": 2
      },
      ...
    ]
  }
}
```

## When Should You Run Reflection?

### Good Times to Trigger

✅ **After importing memories** — Process batch of newly imported data  
✅ **After active session** — Process conversation transcript  
✅ **Periodic maintenance** — Daily/weekly batch processing  
✅ **After corrections** — Re-analyze after fixing contradictions  
✅ **Graph updates needed** — Force relationship edge creation

### When NOT to Trigger

❌ **After every single memory** — Too expensive, use batching  
❌ **During heavy load** — Pipeline is CPU-intensive  
❌ **If nothing changed** — No new memories = wasted processing

### Recommended Schedule

**Option 1: Event-Driven (Recommended)**
- Trigger after every session ends
- Trigger after batch imports
- Trigger on-demand via UI

**Option 2: Periodic (Cron)**
```bash
# Every night at 2 AM
0 2 * * * curl -X POST http://localhost:7654/reflect \
  -H "Content-Type: application/json" \
  -d '{"agentId": "openclaw"}'
```

**Option 3: Hybrid**
- Event-driven for active sessions
- Periodic batch for missed memories

## Future: Automatic Triggers

**Planned Features:**

1. **Auto-trigger on N memories**
   - After 10 new memories created → auto-trigger
   - Configurable threshold per agent

2. **Session-end triggers**
   - Detect session completion → auto-trigger for that session
   - Requires session lifecycle tracking

3. **Smart scheduling**
   - Analyze workload patterns
   - Trigger during low-usage periods
   - Batch small sessions together

4. **Conditional triggers**
   - Only if contradictions detected
   - Only if new entities found
   - Only if confidence drops below threshold

## Configuration

### Environment Variables

```bash
# Reflection pipeline settings (future)
REFLECTION_AUTO_TRIGGER=false          # Enable automatic triggers
REFLECTION_BATCH_SIZE=10               # Trigger after N memories
REFLECTION_SESSION_DELAY=30            # Seconds after session ends
REFLECTION_CRON_SCHEDULE="0 2 * * *"   # Daily at 2 AM
```

### Per-Agent Settings (Future)

```json
{
  "agentId": "openclaw",
  "reflection": {
    "autoTrigger": true,
    "batchSize": 10,
    "schedule": "0 2 * * *",
    "stages": ["extract", "deduplicate", "classify", "graph-link"]
  }
}
```

## Troubleshooting

### Pipeline Stuck in "Running"

**Cause:** Process crashed or timed out  
**Solution:**
```bash
# Check job status
curl "http://localhost:7654/reflect/status?jobId=JOB_ID"

# If stuck, restart daemon
pm2 restart openclaw-memory-daemon
```

### Pipeline Failed

**Cause:** Invalid data, missing embeddings, or database error  
**Solution:**
- Check job error: `GET /reflect/status?jobId=JOB_ID`
- Look at daemon logs: `tail -100 ~/.openclaw/logs/openclaw-memory.log`
- Common issues:
  - Missing VOYAGE_API_KEY (use mock mode)
  - MongoDB connection lost
  - Invalid session transcript format

### No Output from Pipeline

**Cause:** No memories to process or extraction failed  
**Solution:**
- Ensure memories exist: `GET /memories?agentId=X`
- Check extract stage output in job details
- Provide session transcript for better extraction

## Best Practices

1. **Batch processing** — Trigger after groups of memories, not individually
2. **Monitor failures** — Check job status after triggering
3. **Session context** — Provide transcripts when available for better extraction
4. **Peak avoidance** — Run during low-usage periods if manual
5. **Error handling** — Implement retry logic for API triggers
6. **Log retention** — Keep job history for debugging

---

**Summary:**
- **Manual:** Operations page → Click "Trigger Reflection"
- **API:** `POST /reflect` with agentId
- **Programmatic:** Import and call pipeline functions
- **Future:** Automatic triggers based on thresholds/schedules

**Status:** Manual triggers only (automatic triggers planned for future release)
