/**
 * OpenClaw Memory Plugin (Unified)
 *
 * Integrates openclaw-memory daemon with OpenClaw:
 * 1. Agent tools: memory_search, memory_get
 * 2. Daemon auto-start on gateway launch
 * 3. Gateway RPC methods: status, remember, recall, forget
 * 4. Optional fact extraction middleware hooks
 */

import { spawn, ChildProcess } from "child_process";
import { promises as fs } from "fs";
import { createWriteStream } from "fs";
import * as path from "path";
import * as http from "http";

// Resolve daemon directory: env override → relative to plugin location
const DAEMON_DIR =
  process.env.OPENCLAW_MEMORY_DAEMON_DIR || path.resolve(__dirname, "..", "packages", "daemon");
const LOG_FILE = "/tmp/openclaw-memory-daemon.log";

let daemonProcess: ChildProcess | null = null;

// --- Daemon Lifecycle ---

function checkDaemonHealth(daemonUrl: string): Promise<boolean> {
  return new Promise((resolve) => {
    http
      .get(`${daemonUrl}/health`, { timeout: 2000 }, (res) => {
        resolve(res.statusCode === 200);
      })
      .on("error", () => resolve(false));
  });
}

async function startDaemonProcess(daemonUrl: string, logger: any): Promise<boolean> {
  const running = await checkDaemonHealth(daemonUrl);
  if (running) {
    if (logger?.info) logger.info(`Daemon already running at ${daemonUrl}`);
    return true;
  }

  try {
    await fs.access(DAEMON_DIR);
  } catch {
    if (logger?.error) logger.error(`Daemon directory not found: ${DAEMON_DIR}`);
    throw new Error(`Daemon directory not found: ${DAEMON_DIR}`);
  }

  if (logger?.info) logger.info(`Starting daemon from ${DAEMON_DIR}...`);

  const logStream = createWriteStream(LOG_FILE, { flags: "a" });
  daemonProcess = spawn("node", ["dist/server.js"], {
    cwd: DAEMON_DIR,
    stdio: ["ignore", logStream, logStream],
    detached: true,
  });

  daemonProcess.on("error", (err) => {
    if (logger?.error) logger.error(`Failed to spawn daemon: ${err.message}`);
  });

  // Wait for daemon to be healthy
  for (let i = 0; i < 60; i++) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const healthy = await checkDaemonHealth(daemonUrl);
    if (healthy) {
      if (logger?.info) logger.info(`Daemon ready at ${daemonUrl}`);
      return true;
    }
  }

  throw new Error("Daemon failed to start after 30s");
}

// --- HTTP Helpers ---

async function recall(daemonUrl: string, agentId: string, query: string, limit: number) {
  const url = new URL("/recall", daemonUrl);
  url.searchParams.set("agentId", agentId);
  url.searchParams.set("query", query);
  url.searchParams.set("limit", String(limit));

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Daemon recall failed: ${response.statusText}`);
  }

  return await response.json();
}

async function remember(
  daemonUrl: string,
  agentId: string,
  text: string,
  tags: string[] = [],
  ttl?: number,
) {
  const url = new URL("/remember", daemonUrl);

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agentId,
      text,
      tags,
      ttl,
    }),
  });

  if (!response.ok) {
    throw new Error(`Daemon remember failed: ${response.statusText}`);
  }

  return await response.json();
}

async function forget(daemonUrl: string, memoryId: string) {
  const url = new URL(`/forget/${memoryId}`, daemonUrl);
  const response = await fetch(url.toString(), { method: "DELETE" });

  if (!response.ok) {
    throw new Error(`Daemon forget failed: ${response.statusText}`);
  }

  return await response.json();
}

async function getStatus(daemonUrl: string) {
  const url = new URL("/status", daemonUrl);
  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`Daemon status failed: ${response.statusText}`);
  }

  return await response.json();
}

// --- Plugin Entry ---

export default function createPlugin(api: any) {
  const config = {
    daemonUrl:
      api.config.plugins?.entries?.["openclaw-memory"]?.config?.daemonUrl ||
      "http://localhost:7654",
    agentId: api.config.plugins?.entries?.["openclaw-memory"]?.config?.agentId || "openclaw",
    defaultTtl: api.config.plugins?.entries?.["openclaw-memory"]?.config?.defaultTtl || 2592000,
    maxResults: api.config.plugins?.entries?.["openclaw-memory"]?.config?.maxResults || 6,
    minScore: api.config.plugins?.entries?.["openclaw-memory"]?.config?.minScore || 0.5,
    autoStartDaemon:
      api.config.plugins?.entries?.["openclaw-memory"]?.config?.autoStartDaemon !== false,
    middlewareEnabled:
      api.config.plugins?.entries?.["openclaw-memory"]?.config?.middlewareEnabled === true,
  };

  // Auto-start daemon if enabled
  if (config.autoStartDaemon) {
    startDaemonProcess(config.daemonUrl, api.log).catch((err) => {
      if (api.log?.error) {
        api.log.error(`[openclaw-memory] Daemon auto-start failed: ${err.message}`);
      }
    });
  }

  // Register memory_search tool
  api.registerTool({
    name: "memory_search",
    description:
      "Semantically search long-term memory stored in MongoDB. Use this to recall prior decisions, preferences, context, or facts.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query (semantic, not keyword-based)",
        },
        maxResults: {
          type: "number",
          description: "Maximum number of results to return (default: 6)",
        },
      },
      required: ["query"],
    },
    async execute(_id: string, params: { query: string; maxResults?: number }) {
      try {
        const result = await recall(
          config.daemonUrl,
          config.agentId,
          params.query,
          params.maxResults || config.maxResults,
        );

        if (!result.success || result.count === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No relevant memories found.",
              },
            ],
          };
        }

        // Filter by minimum score
        const filtered = result.results.filter((r: any) => r.score >= config.minScore);

        const resultText = filtered
          .map((r: any) => `[Score: ${r.score.toFixed(3)}] ${r.text}\nTags: ${r.tags.join(", ")}\n`)
          .join("\n");

        return {
          content: [
            {
              type: "text",
              text: `Found ${filtered.length} memories:\n\n${resultText}`,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Memory daemon unavailable: ${error.message}. Check if daemon is running at ${config.daemonUrl}`,
            },
          ],
        };
      }
    },
  });

  // Register memory_get tool (for file compatibility)
  api.registerTool({
    name: "memory_get",
    description:
      "Read a specific memory file from the workspace. Use memory_search for semantic recall; use this for targeted file reads.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Memory file path (e.g., MEMORY.md or memory/2026-02-22.md)",
        },
        from: {
          type: "number",
          description: "Starting line number (1-indexed)",
        },
        lines: {
          type: "number",
          description: "Number of lines to read",
        },
      },
      required: ["path"],
    },
    async execute(_id: string, params: { path: string; from?: number; lines?: number }) {
      try {
        const workspace =
          api.config.agents?.defaults?.workspace || process.env.HOME + "/.openclaw/workspace";
        const fullPath = path.resolve(workspace, params.path);

        // Security: ensure path is within workspace
        if (!fullPath.startsWith(workspace)) {
          return {
            content: [
              {
                type: "text",
                text: "Error: Path traversal blocked",
              },
            ],
          };
        }

        let content = await fs.readFile(fullPath, "utf-8");

        // Handle line range if specified
        if (params.from || params.lines) {
          const lines = content.split("\n");
          const start = (params.from || 1) - 1;
          const end = params.lines ? start + params.lines : lines.length;
          content = lines.slice(start, end).join("\n");
        }

        return {
          content: [
            {
              type: "text",
              text: content,
            },
          ],
        };
      } catch (error: any) {
        if (error.code === "ENOENT") {
          return {
            content: [
              {
                type: "text",
                text: `File ${params.path} does not exist yet (empty memory)`,
              },
            ],
          };
        }
        return {
          content: [
            {
              type: "text",
              text: `Error reading file: ${error.message}`,
            },
          ],
        };
      }
    },
  });

  // Register Gateway RPC methods
  if (api.gateway?.registerRpcMethod) {
    api.gateway.registerRpcMethod("memory.status", async () => {
      return await getStatus(config.daemonUrl);
    });

    api.gateway.registerRpcMethod("memory.remember", async ({ text, tags, ttl }: any) => {
      return await remember(config.daemonUrl, config.agentId, text, tags, ttl);
    });

    api.gateway.registerRpcMethod("memory.recall", async ({ query, limit }: any) => {
      return await recall(config.daemonUrl, config.agentId, query, limit || config.maxResults);
    });

    api.gateway.registerRpcMethod("memory.forget", async ({ memoryId }: any) => {
      return await forget(config.daemonUrl, memoryId);
    });
  }

  // TODO: Register /memory-status command
  // Command registration API needs clarification
  // For now, use Gateway RPC: await api.gateway.call('memory.status')

  // Optional: fact extraction middleware hook
  if (config.middlewareEnabled && api.hooks?.onMessage) {
    api.hooks.onMessage(async (message: any) => {
      // TODO: Implement automatic fact extraction from agent messages
      // For now, this is a placeholder for future middleware integration
    });
  }

  if (api.log?.info) {
    api.log.info("[openclaw-memory] Plugin loaded");
    api.log.info(`[openclaw-memory] Daemon: ${config.daemonUrl}`);
    api.log.info(`[openclaw-memory] Agent ID: ${config.agentId}`);
    api.log.info("[openclaw-memory] Tools: memory_search, memory_get");
    api.log.info("[openclaw-memory] Gateway RPC: status, remember, recall, forget");
    api.log.info(`[openclaw-memory] Auto-start: ${config.autoStartDaemon}`);
  }

  // Export helper functions for other plugins
  return {
    api: {
      recall: (query: string, limit?: number) =>
        recall(config.daemonUrl, config.agentId, query, limit || config.maxResults),
      remember: (text: string, tags?: string[], ttl?: number) =>
        remember(config.daemonUrl, config.agentId, text, tags, ttl),
      forget: (memoryId: string) => forget(config.daemonUrl, memoryId),
      getStatus: () => getStatus(config.daemonUrl),
    },
  };
}
