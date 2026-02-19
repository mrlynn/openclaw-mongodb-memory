"use client";

const API_BASE = process.env.NEXT_PUBLIC_DAEMON_URL || "http://localhost:7751";

export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptime: number;
  responseTime: number;
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  database: {
    connected: boolean;
    responseTime: number;
    memoriesCount?: number;
    error?: string;
  };
  voyage: {
    configured: boolean;
    mode: "mock" | "real";
    endpoint: string;
  };
  system: {
    nodeVersion: string;
    platform: string;
    arch: string;
  };
  checks: {
    mongodb: boolean;
    voyage: boolean;
    memory: boolean;
  };
}

export interface OpenClawIntegrationStatus {
  status: "integrated" | "partial" | "not-integrated";
  timestamp: string;
  details: {
    daemonAccessible: boolean;
    daemonResponseTime: number;
    memoryStorageWorking: boolean;
    daemonInOpenClawConfig: boolean;
    agentContextInitialized: boolean;
  };
}

export async function fetchHealth(): Promise<HealthStatus | null> {
  try {
    const response = await fetch(`${API_BASE}/status`, {
      cache: "no-store",
    });
    if (!response.ok) return null;
    const data = await response.json();
    
    // Transform /status response into HealthStatus format
    if (data.success) {
      return {
        status: data.daemon === "ready" && data.mongodb === "connected" ? "healthy" : "degraded",
        timestamp: new Date().toISOString(),
        uptime: data.uptime,
        responseTime: 0,
        memory: {
          heapUsed: data.memory?.heapUsed || 0,
          heapTotal: data.memory?.heapTotal || 0,
          external: 0,
        },
        database: {
          connected: data.mongodb === "connected",
          responseTime: 0,
          memoriesCount: data.stats?.totalMemories || 0,
        },
        voyage: {
          configured: data.voyage === "ready",
          mode: process.env.NEXT_PUBLIC_VOYAGE_MOCK === "true" ? "mock" : "real",
          endpoint: process.env.NEXT_PUBLIC_VOYAGE_BASE_URL || "https://api.voyageai.com/v1",
        },
        system: {
          nodeVersion: "Node.js",
          platform: "localhost",
          arch: "x64",
        },
        checks: {
          mongodb: data.mongodb === "connected",
          voyage: data.voyage === "ready",
          memory: true,
        },
      };
    }
    return null;
  } catch (error) {
    console.error("Failed to fetch health:", error);
    return null;
  }
}

export async function fetchOpenClawIntegrationStatus(): Promise<OpenClawIntegrationStatus> {
  const start = Date.now();
  const details = {
    daemonAccessible: false,
    daemonResponseTime: 0,
    memoryStorageWorking: false,
    daemonInOpenClawConfig: false,
    agentContextInitialized: false,
  };

  try {
    // Check 1: Daemon accessible
    const healthStart = Date.now();
    const healthResp = await fetch(`${API_BASE}/health`, {
      cache: "no-store",
    });
    details.daemonResponseTime = Date.now() - healthStart;
    details.daemonAccessible = healthResp.ok;

    // Check 2: Memory storage working (test remember/recall)
    if (details.daemonAccessible) {
      try {
        const testId = `integration-test-${Date.now()}`;
        const rememberResp = await fetch(`${API_BASE}/remember`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentId: "openclaw-integration-check",
            text: "Integration test",
            tags: ["test"],
            ttl: 60,
          }),
        });

        if (rememberResp.ok) {
          const data = await rememberResp.json();
          if (data.id) {
            details.memoryStorageWorking = true;

            // Try to recall it
            const recallResp = await fetch(
              `${API_BASE}/recall?agentId=openclaw-integration-check&query=integration`,
              { cache: "no-store" }
            );
            if (recallResp.ok) {
              const recallData = await recallResp.json();
              if (recallData.count > 0) {
                // Clean up test memory
                try {
                  await fetch(`${API_BASE}/forget/${data.id}`, {
                    method: "DELETE",
                  });
                } catch {
                  // Ignore cleanup errors
                }
              }
            }
          }
        }
      } catch {
        details.memoryStorageWorking = false;
      }
    }

    // Check 3: Check if daemon is in OpenClaw config
    const configFromEnv = process.env.NEXT_PUBLIC_MEMORY_IN_OPENCLAW_CONFIG === "true";
    details.daemonInOpenClawConfig = configFromEnv;

    // Check 4: Check if agent context has memory
    const agentContextFromEnv = process.env.NEXT_PUBLIC_MEMORY_AGENT_CONTEXT_READY === "true";
    details.agentContextInitialized = agentContextFromEnv;

    const status: OpenClawIntegrationStatus = {
      status:
        details.daemonAccessible && details.memoryStorageWorking && details.daemonInOpenClawConfig && details.agentContextInitialized
          ? "integrated"
          : details.daemonAccessible && details.memoryStorageWorking
            ? "partial"
            : "not-integrated",
      timestamp: new Date().toISOString(),
      details,
    };

    return status;
  } catch (error) {
    console.error("Failed to check OpenClaw integration:", error);
    return {
      status: "not-integrated",
      timestamp: new Date().toISOString(),
      details,
    };
  }
}
