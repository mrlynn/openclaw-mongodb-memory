/**
 * OpenClaw Memory Plugin
 *
 * MongoDB-backed long-term memory for OpenClaw agents.
 *
 * Install:
 *   openclaw plugins install openclaw-memory
 *
 * Configure in ~/.openclaw/openclaw.json:
 *   plugins.entries["openclaw-memory"].enabled = true
 *   plugins.entries["openclaw-memory"].config.daemonUrl = "http://localhost:7654"
 *
 * Requires the openclaw-memory daemon running separately.
 * See: https://github.com/mrlynn/openclaw-mongodb-memory
 *
 * Tools:
 *   1. memory_search  — Semantic search across stored memories
 *   2. memory_remember — Explicitly store a memory
 *   3. memory_forget   — Delete a memory by ID
 *   4. memory_list     — Browse memories by tag/recency
 *   5. memory_status   — Check memory system health and stats
 *
 * Gateway RPC:
 *   memory.status, memory.remember, memory.recall, memory.forget
 *
 * Hooks:
 *   auto-remember, session-to-memory, memory-bootstrap, memory-enriched-tools
 */

import { spawn, ChildProcess } from "child_process";
import { promises as fs } from "fs";
import { createWriteStream, accessSync } from "fs";
import * as path from "path";

import {
  recall,
  remember,
  forget,
  getStatus,
  checkHealth,
  listMemories,
  type RequestOptions,
} from "./lib/daemon-client";

// --- Plugin API Types ---

interface PluginLogger {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
}

interface ToolRegistration {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute(id: string, params: Record<string, unknown>): Promise<{ content: Array<{ type: string; text: string }> }>;
}

interface PluginAPI {
  config?: {
    plugins?: {
      entries?: Record<string, { enabled?: boolean; config?: Record<string, unknown> }>;
    };
    agents?: { defaults?: { workspace?: string } };
  };
  log?: PluginLogger;
  registerTool(tool: ToolRegistration): void;
  gateway?: {
    registerRpcMethod(name: string, handler: (params: Record<string, unknown>) => Promise<unknown>): void;
  };
}

// --- Plugin Config ---

interface PluginConfig {
  daemonUrl: string;
  agentId: string;
  apiKey?: string;
  projectId?: string;
  defaultTtl: number;
  maxResults: number;
  minScore: number;
  autoStartDaemon: boolean;
  hooksEnabled: boolean;
}

// --- Daemon Directory Resolution ---

/**
 * Resolve daemon directory for optional auto-start.
 * Priority:
 *   1. OPENCLAW_MEMORY_DAEMON_DIR env var (explicit override)
 *   2. Monorepo sibling: ../packages/daemon (when running from source checkout)
 *   3. undefined -> auto-start is disabled, plugin acts as pure HTTP client
 */
function resolveDaemonDir(): string | undefined {
  if (process.env.OPENCLAW_MEMORY_DAEMON_DIR) {
    return process.env.OPENCLAW_MEMORY_DAEMON_DIR;
  }
  const monorepoPath = path.resolve(__dirname, "..", "packages", "daemon");
  try {
    accessSync(path.join(monorepoPath, "dist", "server.js"));
    return monorepoPath;
  } catch {
    return undefined;
  }
}

const DAEMON_DIR = resolveDaemonDir();
const LOG_FILE = "/tmp/openclaw-memory-daemon.log";

let daemonProcess: ChildProcess | null = null;

// --- Daemon Lifecycle ---

async function startDaemonProcess(daemonUrl: string, logger?: PluginLogger): Promise<boolean> {
  const running = await checkHealth(daemonUrl);
  if (running) {
    logger?.info(`[openclaw-memory] Daemon already running at ${daemonUrl}`);
    return true;
  }

  if (!DAEMON_DIR) {
    logger?.warn(
      `[openclaw-memory] Daemon not running at ${daemonUrl} and no daemon directory found.`,
    );
    logger?.warn(
      `[openclaw-memory] Start the daemon manually: npx @openclaw-memory/daemon`,
    );
    logger?.warn(
      `[openclaw-memory] Or set OPENCLAW_MEMORY_DAEMON_DIR to enable auto-start.`,
    );
    return false;
  }

  try {
    await fs.access(DAEMON_DIR);
  } catch {
    logger?.error(`[openclaw-memory] Daemon directory not found: ${DAEMON_DIR}`);
    throw new Error(`Daemon directory not found: ${DAEMON_DIR}`);
  }

  logger?.info(`[openclaw-memory] Starting daemon from ${DAEMON_DIR}...`);

  const logStream = createWriteStream(LOG_FILE, { flags: "a" });
  daemonProcess = spawn("node", ["dist/server.js"], {
    cwd: DAEMON_DIR,
    stdio: ["ignore", logStream, logStream],
    detached: true,
  });

  daemonProcess.on("error", (err) => {
    logger?.error(`[openclaw-memory] Failed to spawn daemon: ${err.message}`);
  });

  // Wait for daemon to be healthy (30s timeout)
  for (let i = 0; i < 60; i++) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const healthy = await checkHealth(daemonUrl);
    if (healthy) {
      logger?.info(`[openclaw-memory] Daemon ready at ${daemonUrl}`);
      return true;
    }
  }

  throw new Error("Daemon failed to start after 30s. Check logs: " + LOG_FILE);
}

// --- Request Options Helper ---

function reqOpts(config: PluginConfig): RequestOptions {
  return {
    apiKey: config.apiKey,
    projectId: config.projectId,
  };
}

// --- Plugin Entry ---

export default function createPlugin(api: PluginAPI) {
  const pluginConfig =
    (api.config?.plugins?.entries?.["openclaw-memory"]?.config as Record<string, unknown>) || {};

  const config: PluginConfig = {
    daemonUrl: (pluginConfig.daemonUrl as string) || "http://localhost:7654",
    agentId: (pluginConfig.agentId as string) || "openclaw",
    apiKey: (pluginConfig.apiKey as string) || undefined,
    projectId: (pluginConfig.projectId as string) || undefined,
    defaultTtl: (pluginConfig.defaultTtl as number) || 2592000,
    maxResults: (pluginConfig.maxResults as number) || 6,
    minScore: (pluginConfig.minScore as number) || 0.5,
    autoStartDaemon: pluginConfig.autoStartDaemon !== false,
    hooksEnabled: pluginConfig.hooksEnabled !== false,
  };

  // Bridge plugin config to env vars so hooks pick it up
  process.env.OPENCLAW_MEMORY_DAEMON_URL = config.daemonUrl;
  process.env.OPENCLAW_MEMORY_AGENT_ID = config.agentId;
  if (config.apiKey) process.env.OPENCLAW_MEMORY_API_KEY = config.apiKey;
  if (config.projectId) process.env.OPENCLAW_MEMORY_PROJECT_ID = config.projectId;
  if (!config.hooksEnabled) process.env.OPENCLAW_MEMORY_HOOKS_ENABLED = "false";

  // Auto-start daemon if enabled and daemon directory is available
  if (config.autoStartDaemon) {
    startDaemonProcess(config.daemonUrl, api.log).catch((err) => {
      api.log?.error(`[openclaw-memory] Daemon auto-start failed: ${err.message}`);
    });
  }

  // --- Tool: memory_search ---

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
    async execute(_id: string, params: Record<string, unknown>) {
      const query = params.query as string;
      const maxResults = (params.maxResults as number) || config.maxResults;
      try {
        const result = await recall(
          config.daemonUrl,
          config.agentId,
          query,
          maxResults,
          undefined,
          reqOpts(config),
        );

        if (!result.success || result.count === 0) {
          return {
            content: [{ type: "text", text: "No relevant memories found." }],
          };
        }

        const filtered = result.results.filter(
          (r) => r.score >= config.minScore,
        );

        if (filtered.length === 0) {
          return {
            content: [{ type: "text", text: "No memories above minimum relevance score." }],
          };
        }

        const resultText = filtered
          .map(
            (r) =>
              `[ID: ${r.id}] [Score: ${r.score.toFixed(3)}] ${r.text}\nTags: ${r.tags.join(", ") || "none"}`,
          )
          .join("\n\n");

        return {
          content: [
            {
              type: "text",
              text: `Found ${filtered.length} memories:\n\n${resultText}`,
            },
          ],
        };
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text",
              text: `Memory daemon unavailable: ${msg}. Check if daemon is running at ${config.daemonUrl}`,
            },
          ],
        };
      }
    },
  });

  // --- Tool: memory_remember ---

  api.registerTool({
    name: "memory_remember",
    description:
      "Store a fact, decision, preference, or important context in long-term memory. " +
      "Use this when you learn something worth remembering across sessions.",
    parameters: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "The memory text to store (fact, decision, preference, etc.)",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Tags for categorization (e.g., ['preference', 'ui'])",
        },
        ttl: {
          type: "number",
          description: "Time-to-live in seconds. Omit for default (30 days).",
        },
      },
      required: ["text"],
    },
    async execute(_id: string, params: Record<string, unknown>) {
      const text = params.text as string;
      const tags = (params.tags as string[]) || [];
      const ttl = (params.ttl as number) || config.defaultTtl;
      try {
        const result = await remember(
          config.daemonUrl,
          config.agentId,
          text,
          tags,
          { source: "memory_remember_tool" },
          ttl,
          reqOpts(config),
        );
        return {
          content: [
            {
              type: "text",
              text: `Memory stored (ID: ${result.id}).\nText: ${result.text}\nTags: ${(result.tags || []).join(", ") || "none"}`,
            },
          ],
        };
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Failed to store memory: ${msg}` }],
        };
      }
    },
  });

  // --- Tool: memory_forget ---

  api.registerTool({
    name: "memory_forget",
    description:
      "Delete a specific memory by ID. Use memory_search first to find the memory ID.",
    parameters: {
      type: "object",
      properties: {
        memoryId: {
          type: "string",
          description: "The memory ID to delete (from memory_search results)",
        },
      },
      required: ["memoryId"],
    },
    async execute(_id: string, params: Record<string, unknown>) {
      const memoryId = params.memoryId as string;
      try {
        await forget(config.daemonUrl, memoryId, reqOpts(config));
        return {
          content: [{ type: "text", text: `Memory ${memoryId} deleted.` }],
        };
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Failed to delete memory: ${msg}` }],
        };
      }
    },
  });

  // --- Tool: memory_list ---

  api.registerTool({
    name: "memory_list",
    description:
      "Browse stored memories by recency or tag. Use for reviewing what has been remembered.",
    parameters: {
      type: "object",
      properties: {
        tags: {
          type: "string",
          description: "Comma-separated tags to filter by",
        },
        limit: {
          type: "number",
          description: "Max memories to return (default: 10)",
        },
        sort: {
          type: "string",
          enum: ["desc", "asc"],
          description: "Sort order by creation date (default: desc)",
        },
      },
    },
    async execute(_id: string, params: Record<string, unknown>) {
      const tags = params.tags as string | undefined;
      const limit = (params.limit as number) || 10;
      const sort = (params.sort as "desc" | "asc") || "desc";
      try {
        const result = await listMemories(config.daemonUrl, config.agentId, {
          limit,
          tags,
          sort,
          ...reqOpts(config),
        });
        if (result.memories.length === 0) {
          return {
            content: [{ type: "text", text: "No memories found." }],
          };
        }
        const text = result.memories
          .map(
            (m) =>
              `[ID: ${m.id}] ${m.text}\nTags: ${(m.tags || []).join(", ") || "none"} | Created: ${new Date(m.createdAt).toLocaleDateString()}`,
          )
          .join("\n\n");
        return {
          content: [
            {
              type: "text",
              text: `${result.memories.length} memories${result.hasMore ? " (more available)" : ""}:\n\n${text}`,
            },
          ],
        };
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Failed to list memories: ${msg}` }],
        };
      }
    },
  });

  // --- Tool: memory_status ---

  api.registerTool({
    name: "memory_status",
    description:
      "Check memory system status: daemon health, MongoDB connection, total memories stored.",
    parameters: {
      type: "object",
      properties: {},
    },
    async execute() {
      try {
        const status = await getStatus(config.daemonUrl, reqOpts(config));
        return {
          content: [
            {
              type: "text",
              text: [
                `Daemon: ${status.daemon}`,
                `MongoDB: ${status.mongodb}`,
                `Voyage AI: ${status.voyage}`,
                `Total memories: ${status.stats?.totalMemories ?? "unknown"}`,
                `Uptime: ${Math.round(status.uptime / 60)} minutes`,
              ].join("\n"),
            },
          ],
        };
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
          content: [
            { type: "text", text: `Memory daemon unreachable: ${msg}` },
          ],
        };
      }
    },
  });

  // --- Gateway RPC Methods ---

  if (api.gateway?.registerRpcMethod) {
    api.gateway.registerRpcMethod("memory.status", async () => {
      return await getStatus(config.daemonUrl, reqOpts(config));
    });

    api.gateway.registerRpcMethod(
      "memory.remember",
      async ({ text, tags, metadata, ttl }: Record<string, unknown>) => {
        return await remember(
          config.daemonUrl,
          config.agentId,
          text as string,
          (tags as string[]) || [],
          (metadata as Record<string, unknown>) || {},
          ttl as number | undefined,
          reqOpts(config),
        );
      },
    );

    api.gateway.registerRpcMethod(
      "memory.recall",
      async ({ query, limit }: Record<string, unknown>) => {
        return await recall(
          config.daemonUrl,
          config.agentId,
          query as string,
          (limit as number) || config.maxResults,
          undefined,
          reqOpts(config),
        );
      },
    );

    api.gateway.registerRpcMethod(
      "memory.forget",
      async ({ memoryId }: Record<string, unknown>) => {
        return await forget(
          config.daemonUrl,
          memoryId as string,
          reqOpts(config),
        );
      },
    );
  }

  // --- Logging ---

  api.log?.info("[openclaw-memory] Plugin loaded");
  api.log?.info(`[openclaw-memory] Daemon: ${config.daemonUrl}`);
  api.log?.info(`[openclaw-memory] Agent ID: ${config.agentId}`);
  api.log?.info(
    "[openclaw-memory] Tools: memory_search, memory_remember, memory_forget, memory_list, memory_status",
  );
  api.log?.info(
    "[openclaw-memory] Gateway RPC: memory.status, memory.remember, memory.recall, memory.forget",
  );
  api.log?.info(
    `[openclaw-memory] Hooks: ${config.hooksEnabled ? "enabled" : "disabled"}`,
  );
  api.log?.info(
    `[openclaw-memory] Auto-start: ${config.autoStartDaemon} (daemon dir: ${DAEMON_DIR || "not found"})`,
  );

  // --- Graceful Shutdown ---

  const cleanup = () => {
    if (daemonProcess && !daemonProcess.killed) {
      daemonProcess.kill("SIGTERM");
      daemonProcess = null;
    }
  };

  process.on("beforeExit", cleanup);
  process.on("SIGTERM", cleanup);
  process.on("SIGINT", cleanup);

  const removeListeners = () => {
    process.removeListener("beforeExit", cleanup);
    process.removeListener("SIGTERM", cleanup);
    process.removeListener("SIGINT", cleanup);
  };

  // --- Export API for other plugins ---

  return {
    api: {
      recall: (query: string, limit?: number) =>
        recall(
          config.daemonUrl,
          config.agentId,
          query,
          limit || config.maxResults,
          undefined,
          reqOpts(config),
        ),
      remember: (text: string, tags?: string[], ttl?: number) =>
        remember(
          config.daemonUrl,
          config.agentId,
          text,
          tags,
          {},
          ttl,
          reqOpts(config),
        ),
      forget: (memoryId: string) =>
        forget(config.daemonUrl, memoryId, reqOpts(config)),
      getStatus: () => getStatus(config.daemonUrl, reqOpts(config)),
      listMemories: (opts?: { limit?: number; tags?: string; sort?: "desc" | "asc" }) =>
        listMemories(config.daemonUrl, config.agentId, {
          ...opts,
          ...reqOpts(config),
        }),
    },
    cleanup: () => {
      cleanup();
      removeListeners();
    },
  };
}
