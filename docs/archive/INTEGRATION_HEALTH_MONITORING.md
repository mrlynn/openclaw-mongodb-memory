# Memory System Health Monitoring & OpenClaw Integration

This guide explains how to integrate the memory system health monitoring into OpenClaw and verify the integration is working correctly.

---

## Architecture Overview

```
OpenClaw Process (main)
    ├─ Auto-spawn Memory Daemon (port 7751)
    ├─ Agent Context (includes MemoryClient)
    └─ Health Monitoring (web dashboard)
          ↓
    Health API (/health/detailed)
          ↓
    Memory Daemon
    ├─ MongoDB Connection
    ├─ Voyage API (mock or real)
    └─ Memory Operations (remember/recall/forget)
```

---

## Step 1: Daemon Auto-Spawn in OpenClaw

When OpenClaw starts, it should automatically spawn the memory daemon.

### In OpenClaw Startup Code

```typescript
// openclaw.ts or main.ts

import { spawn, ChildProcess } from "child_process";
import path from "path";

class MemoryDaemonManager {
  private daemon: ChildProcess | null = null;

  async start(): Promise<void> {
    const daemonPath = path.join(
      __dirname,
      "../node_modules/@openclaw-memory/daemon/dist/server.js",
    );
    const daemonPort = process.env.MEMORY_DAEMON_PORT || "7751";

    this.daemon = spawn("node", [daemonPath], {
      env: {
        ...process.env,
        MEMORY_DAEMON_PORT: daemonPort,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    this.daemon.stdout?.on("data", (data) => {
      console.log(`[Memory Daemon] ${data}`);
    });

    this.daemon.stderr?.on("data", (data) => {
      console.error(`[Memory Daemon] ${data}`);
    });

    // Wait for daemon to be ready (check health endpoint)
    await this.waitForDaemon(daemonPort);
    console.log("✓ Memory daemon started and ready");
  }

  private async waitForDaemon(port: string, maxRetries = 30): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(`http://localhost:${port}/health`);
        if (response.ok) {
          return; // Daemon is ready
        }
      } catch {
        // Wait and retry
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error("Memory daemon failed to start after 3 seconds");
  }

  async stop(): Promise<void> {
    if (this.daemon) {
      this.daemon.kill();
      this.daemon = null;
    }
  }
}

// In main startup
const memoryDaemon = new MemoryDaemonManager();
await memoryDaemon.start();

// Graceful shutdown
process.on("exit", () => memoryDaemon.stop());
process.on("SIGINT", () => memoryDaemon.stop());
process.on("SIGTERM", () => memoryDaemon.stop());
```

### Configuration (openclaw.yaml)

```yaml
memory:
  enabled: true
  daemon:
    autoStart: true
    port: 7751
    logLevel: info
  mongodb:
    uri: ${MONGODB_URI}
  voyage:
    apiKey: ${VOYAGE_API_KEY}
    mockMode: ${VOYAGE_MOCK:-true}
    endpoint: ${VOYAGE_BASE_URL}
```

---

## Step 2: Integrate MemoryClient into Agent Context

When agents are initialized, make the MemoryClient available in their context.

### In Agent Initialization Code

```typescript
// agent-context.ts

import { MemoryClient } from "@openclaw-memory/client";

export interface AgentContext {
  sessionKey: string;
  memory: MemoryClient;
  // ... other context
}

export function initializeAgentContext(sessionKey: string): AgentContext {
  const daemonUrl = process.env.MEMORY_DAEMON_URL || "http://localhost:7751";

  const memory = new MemoryClient({
    daemonUrl,
    agentId: sessionKey,
    projectId: process.env.OPENCLAW_PROJECT_ID || "openclaw-main",
  });

  return {
    sessionKey,
    memory,
    // ... other context initialization
  };
}
```

### Using Memory in Agent Handlers

```typescript
// agent-handler.ts

import { AgentContext } from "./agent-context";

export async function handleUserMessage(message: string, context: AgentContext): Promise<string> {
  // 1. Recall relevant memories
  const memories = await context.memory.recall(message, {
    limit: 3,
    tags: ["context"],
  });

  // 2. Build context string
  const contextStr = memories
    .map((m) => `- ${m.text} (confidence: ${m.score.toFixed(2)})`)
    .join("\n");

  // 3. Process message with context
  const response = await llm.generate({
    systemPrompt: `You have this relevant context:\n${contextStr}`,
    userMessage: message,
  });

  // 4. Store important facts
  if (response.shouldRemember) {
    await context.memory.remember(response.importantFact, {
      tags: ["conversation", "important"],
      ttl: 604800, // 7 days
    });
  }

  return response.text;
}
```

---

## Step 3: Health Dashboard Integration

The web dashboard includes comprehensive health monitoring.

### Add Health Endpoint to Web App

```typescript
// pages/api/system/health.ts (or equivalent in your routing)

import { fetchHealth, fetchOpenClawIntegrationStatus } from "@/lib/health-api";

export async function getSystemHealth() {
  const [health, integration] = await Promise.all([
    fetchHealth(),
    fetchOpenClawIntegrationStatus(),
  ]);

  return {
    memory: health,
    integration,
  };
}
```

### Display Health Dashboard

```typescript
// pages/admin/health.tsx

import { HealthDashboard } from "@/components/health/HealthDashboard";

export default function HealthPage() {
  return <HealthDashboard />;
}
```

### Health Status Page Example

The dashboard will show:

✅ **Daemon Status**

- Uptime
- Response time
- Node version
- Process information

✅ **Memory Usage**

- Heap usage (%)
- Memory warnings if >90%

✅ **MongoDB Connection**

- Connection status
- Response time
- Total memories stored
- Error details (if any)

✅ **Voyage Embeddings**

- Mock vs real mode
- API endpoint
- Configuration status

✅ **OpenClaw Integration**

- Daemon accessibility
- Memory storage functionality
- Config integration
- Agent context availability

---

## Step 4: Verification Checklist

### Before Integration

- [ ] Memory daemon builds without errors
- [ ] MongoDB URI is set and accessible
- [ ] Voyage API key is configured
- [ ] Daemon starts and listens on configured port

### During Integration

- [ ] OpenClaw spawns daemon on startup
- [ ] Daemon is accessible via HTTP
- [ ] Agent context initializes MemoryClient
- [ ] Health dashboard loads and shows "healthy" status

### After Integration

- [ ] Test agent can store memories
- [ ] Test agent can recall memories
- [ ] OpenClaw integration status shows "integrated"
- [ ] Web dashboard health page shows all green

---

## Step 5: Health Monitoring Dashboard

Navigate to the health dashboard to verify everything is working:

```
http://localhost:3000/admin/health
```

You'll see:

### Overall Status Card

- **Green (healthy):** All systems operational
- **Yellow (degraded):** Some functionality reduced
- **Red (unhealthy):** Critical issues

### Detailed Checks

| Check              | Expected | What It Means                      |
| ------------------ | -------- | ---------------------------------- |
| Daemon Accessible  | ✓        | HTTP endpoint responding           |
| Memory Storage     | ✓        | Can store and recall memories      |
| In OpenClaw Config | ✓        | Daemon configured in openclaw.yaml |
| Agent Context      | ✓        | Memory client available to agents  |

---

## Troubleshooting Integration Issues

### Daemon Won't Start

```
Error: listen EADDRINUSE: address already in use :::7751
```

**Solution:**

```bash
# Kill any existing daemon
pkill -f "memory.*daemon"

# Use different port
MEMORY_DAEMON_PORT=7752 pnpm dev
```

### MongoDB Connection Fails

**Dashboard shows:** ✗ MongoDB Connection

**Cause:** MongoDB URI is incorrect or MongoDB is down

**Solution:**

1. Verify `MONGODB_URI` environment variable
2. Test connection directly: `mongosh "$MONGODB_URI"`
3. Check MongoDB Atlas is accessible from this network

### Voyage API Returns 403

**Dashboard shows:** ✗ Voyage Embeddings

**Cause:** API key doesn't have access to model

**Solution:**

1. Use `VOYAGE_MOCK=true` for development
2. Get free Voyage.com key for production: https://voyageai.com
3. Or enable models in MongoDB Atlas console

### Agent Can't Access Memory

**Dashboard shows:** ✗ Agent Context

**Cause:** Memory client not initialized in agent context

**Solution:**

```typescript
// In agent initialization
const context = initializeAgentContext(sessionKey);
// Make sure MemoryClient is created:
console.assert(context.memory, "Memory client not initialized");
```

---

## Performance Tuning

### Memory Daemon Performance

Monitor these metrics in the health dashboard:

- **Heap Usage:** Should stay <80%
  - If >90%, consider increasing Node heap size
  - Or archiving old memories

- **Response Time:** Should be <100ms
  - If >500ms, check MongoDB network latency
  - Consider adding more indexes

- **Database Query Time:** Should be <50ms
  - If slow, check for missing indexes (auto-created on startup)
  - Scale to Atlas Vector Search if >100K memories

### Integration Performance

- **Agent Context Init:** <100ms
  - If slow, check MemoryClient initialization
  - Connection pooling is automatic

- **Recall Time:** <200ms per query
  - Mock embeddings: <50ms
  - Real Voyage: 100-200ms
  - MongoDB search: <50ms

---

## Monitoring & Alerting

### Health Check Endpoint

```bash
curl http://localhost:7751/health/detailed
```

Response includes all metrics needed for monitoring.

### Example Prometheus Integration

```yaml
- job_name: "memory-daemon"
  static_configs:
    - targets: ["localhost:7751"]
  metrics_path: "/health/detailed"
```

### Alert Rules

```yaml
- alert: MemoryDaemonUnhealthy
  expr: memory_daemon_status != "healthy"
  for: 1m
  action: notify_ops

- alert: HeapUsageHigh
  expr: memory_daemon_heap_used_percent > 90
  for: 5m
  action: notify_ops
```

---

## Implementation Timeline

**Recommended 3-day integration:**

**Day 1: Setup**

- [ ] Configure environment variables
- [ ] Add daemon auto-spawn code
- [ ] Verify daemon starts & health endpoint works

**Day 2: Agent Integration**

- [ ] Initialize MemoryClient in agent context
- [ ] Test storing memories in agent
- [ ] Test recalling memories in agent

**Day 3: Dashboard & Verification**

- [ ] Add health dashboard to web app
- [ ] Verify all green on health page
- [ ] Run integration checklist
- [ ] Document for users

---

## Documentation for End Users

Once integrated, provide users with:

1. **Getting Started Guide**
   - How to access memory in their agents
   - Example code for remember/recall
   - Common patterns

2. **Health Dashboard**
   - What the status colors mean
   - How to read the metrics
   - Troubleshooting tips

3. **Cost Tracking**
   - Real vs mock embeddings
   - Cost per 1M tokens
   - Monthly estimates

4. **Best Practices**
   - Tag organization
   - TTL management
   - Query patterns

---

## Conclusion

Once integrated:

- ✅ Memory system is monitored in real-time
- ✅ Health status is visible to operators
- ✅ Integration issues are immediately apparent
- ✅ Agents have full access to semantic memory
- ✅ OpenClaw can auto-recover from failures

**Next: Run the verification checklist and go live.**
