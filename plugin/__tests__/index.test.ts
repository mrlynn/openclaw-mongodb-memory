import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the daemon-client module before importing the plugin
vi.mock("../lib/daemon-client", () => ({
  recall: vi.fn(),
  remember: vi.fn(),
  forget: vi.fn(),
  getStatus: vi.fn(),
  checkHealth: vi.fn(),
  listMemories: vi.fn(),
}));

import createPluginOriginal from "../index";
import {
  recall,
  remember,
  forget,
  getStatus,
  checkHealth,
  listMemories,
} from "../lib/daemon-client";

const mockRecall = vi.mocked(recall);
const mockRemember = vi.mocked(remember);
const mockForget = vi.mocked(forget);
const mockGetStatus = vi.mocked(getStatus);
const mockCheckHealth = vi.mocked(checkHealth);
const mockListMemories = vi.mocked(listMemories);

// --- Helpers ---

function createMockApi(configOverrides: Record<string, unknown> = {}) {
  const tools: Record<string, { name: string; parameters: unknown; execute: Function }> = {};
  const rpcMethods: Record<string, Function> = {};

  return {
    api: {
      config: {
        plugins: {
          entries: {
            "openclaw-memory": {
              enabled: true,
              config: {
                daemonUrl: "http://test:7654",
                agentId: "test-agent",
                ...configOverrides,
              },
            },
          },
        },
      },
      log: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
      registerTool: vi.fn((tool: any) => {
        tools[tool.name] = tool;
      }),
      gateway: {
        registerRpcMethod: vi.fn((name: string, handler: Function) => {
          rpcMethods[name] = handler;
        }),
      },
    },
    tools,
    rpcMethods,
  };
}

let pluginCleanups: Array<() => void> = [];

/** Wrapper that tracks cleanup functions to avoid MaxListeners warnings */
function createPlugin(api: any) {
  const result = createPluginOriginal(api);
  if (result?.cleanup) pluginCleanups.push(result.cleanup);
  return result;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckHealth.mockResolvedValue(true); // Prevent auto-start from blocking
  // Clean env vars
  delete process.env.OPENCLAW_MEMORY_DAEMON_URL;
  delete process.env.OPENCLAW_MEMORY_AGENT_ID;
  delete process.env.OPENCLAW_MEMORY_API_KEY;
  delete process.env.OPENCLAW_MEMORY_PROJECT_ID;
  delete process.env.OPENCLAW_MEMORY_HOOKS_ENABLED;
});

afterEach(() => {
  // Remove process listeners added by each createPlugin call
  for (const fn of pluginCleanups) fn();
  pluginCleanups = [];
});

// --- Plugin Registration ---

describe("createPlugin registration", () => {
  it("registers all 5 tools", () => {
    const { api, tools } = createMockApi();
    createPlugin(api as any);
    expect(Object.keys(tools)).toEqual([
      "memory_search",
      "memory_remember",
      "memory_forget",
      "memory_list",
      "memory_status",
    ]);
  });

  it("registers 4 gateway RPC methods", () => {
    const { api, rpcMethods } = createMockApi();
    createPlugin(api as any);
    expect(Object.keys(rpcMethods)).toEqual([
      "memory.status",
      "memory.remember",
      "memory.recall",
      "memory.forget",
    ]);
  });

  it("skips RPC when gateway is undefined", () => {
    const { api } = createMockApi();
    delete (api as any).gateway;
    const result = createPlugin(api as any);
    // Should not throw
    expect(result.api).toBeDefined();
  });

  it("returns cleanup function", () => {
    const { api } = createMockApi();
    const result = createPlugin(api as any);
    expect(typeof result.cleanup).toBe("function");
  });

  it("returns exported API helpers", () => {
    const { api } = createMockApi();
    const result = createPlugin(api as any);
    expect(typeof result.api.recall).toBe("function");
    expect(typeof result.api.remember).toBe("function");
    expect(typeof result.api.forget).toBe("function");
    expect(typeof result.api.getStatus).toBe("function");
    expect(typeof result.api.listMemories).toBe("function");
  });
});

// --- Config Defaults ---

describe("config defaults", () => {
  it("uses defaults when no config provided", () => {
    const api = {
      config: {},
      log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      registerTool: vi.fn(),
    };
    // Should not throw with empty config
    createPlugin(api as any);
  });
});

// --- Config Bridge to Env Vars ---

describe("config bridge to env vars", () => {
  it("sets env vars from plugin config", () => {
    const { api } = createMockApi({
      apiKey: "secret",
      projectId: "proj-1",
    });
    createPlugin(api as any);

    expect(process.env.OPENCLAW_MEMORY_DAEMON_URL).toBe("http://test:7654");
    expect(process.env.OPENCLAW_MEMORY_AGENT_ID).toBe("test-agent");
    expect(process.env.OPENCLAW_MEMORY_API_KEY).toBe("secret");
    expect(process.env.OPENCLAW_MEMORY_PROJECT_ID).toBe("proj-1");
  });

  it("sets HOOKS_ENABLED=false when hooksEnabled is false", () => {
    const { api } = createMockApi({ hooksEnabled: false });
    createPlugin(api as any);
    expect(process.env.OPENCLAW_MEMORY_HOOKS_ENABLED).toBe("false");
  });

  it("does not set HOOKS_ENABLED when hooksEnabled is true/default", () => {
    const { api } = createMockApi();
    createPlugin(api as any);
    expect(process.env.OPENCLAW_MEMORY_HOOKS_ENABLED).toBeUndefined();
  });
});

// --- memory_search Tool ---

describe("memory_search tool", () => {
  it("returns results with IDs", async () => {
    const { api, tools } = createMockApi();
    createPlugin(api as any);

    mockRecall.mockResolvedValueOnce({
      success: true,
      query: "test",
      results: [
        { id: "mem-1", text: "User likes dark mode", score: 0.91, tags: ["pref"], metadata: {}, createdAt: "" },
        { id: "mem-2", text: "API limit is 100", score: 0.85, tags: ["fact"], metadata: {}, createdAt: "" },
      ],
      count: 2,
      method: "in_memory",
    });

    const result = await tools.memory_search.execute("", { query: "preferences" });
    expect(result.content[0].text).toContain("[ID: mem-1]");
    expect(result.content[0].text).toContain("[ID: mem-2]");
    expect(result.content[0].text).toContain("[Score: 0.910]");
    expect(result.content[0].text).toContain("Found 2 memories");
  });

  it("filters by minScore", async () => {
    const { api, tools } = createMockApi({ minScore: 0.8 });
    createPlugin(api as any);

    mockRecall.mockResolvedValueOnce({
      success: true,
      query: "test",
      results: [
        { id: "1", text: "high", score: 0.9, tags: [], metadata: {}, createdAt: "" },
        { id: "2", text: "low", score: 0.5, tags: [], metadata: {}, createdAt: "" },
      ],
      count: 2,
      method: "in_memory",
    });

    const result = await tools.memory_search.execute("", { query: "test" });
    expect(result.content[0].text).toContain("Found 1 memories");
    expect(result.content[0].text).toContain("high");
    expect(result.content[0].text).not.toContain("low");
  });

  it("returns graceful message when no results", async () => {
    const { api, tools } = createMockApi();
    createPlugin(api as any);

    mockRecall.mockResolvedValueOnce({
      success: true,
      query: "test",
      results: [],
      count: 0,
      method: "in_memory",
    });

    const result = await tools.memory_search.execute("", { query: "nothing" });
    expect(result.content[0].text).toContain("No relevant memories found");
  });

  it("returns graceful error when daemon unreachable", async () => {
    const { api, tools } = createMockApi();
    createPlugin(api as any);

    mockRecall.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const result = await tools.memory_search.execute("", { query: "test" });
    expect(result.content[0].text).toContain("Memory daemon unavailable");
    expect(result.content[0].text).toContain("ECONNREFUSED");
  });
});

// --- memory_remember Tool ---

describe("memory_remember tool", () => {
  it("stores memory with tags and returns ID", async () => {
    const { api, tools } = createMockApi();
    createPlugin(api as any);

    mockRemember.mockResolvedValueOnce({
      success: true,
      id: "new-1",
      text: "User prefers dark mode",
      tags: ["preference"],
    });

    const result = await tools.memory_remember.execute("", {
      text: "User prefers dark mode",
      tags: ["preference"],
    });

    expect(result.content[0].text).toContain("Memory stored (ID: new-1)");
    expect(result.content[0].text).toContain("User prefers dark mode");
  });

  it("handles error gracefully", async () => {
    const { api, tools } = createMockApi();
    createPlugin(api as any);

    mockRemember.mockRejectedValueOnce(new Error("connection lost"));

    const result = await tools.memory_remember.execute("", { text: "test" });
    expect(result.content[0].text).toContain("Failed to store memory");
  });
});

// --- memory_forget Tool ---

describe("memory_forget tool", () => {
  it("deletes memory by ID", async () => {
    const { api, tools } = createMockApi();
    createPlugin(api as any);

    mockForget.mockResolvedValueOnce({
      success: true,
      id: "del-1",
      message: "deleted",
    });

    const result = await tools.memory_forget.execute("", { memoryId: "del-1" });
    expect(result.content[0].text).toContain("Memory del-1 deleted");
  });

  it("handles error gracefully", async () => {
    const { api, tools } = createMockApi();
    createPlugin(api as any);

    mockForget.mockRejectedValueOnce(new Error("not found"));

    const result = await tools.memory_forget.execute("", { memoryId: "bad-id" });
    expect(result.content[0].text).toContain("Failed to delete memory");
  });
});

// --- memory_list Tool ---

describe("memory_list tool", () => {
  it("lists memories with IDs", async () => {
    const { api, tools } = createMockApi();
    createPlugin(api as any);

    mockListMemories.mockResolvedValueOnce({
      memories: [
        { id: "m1", text: "memory one", tags: ["tag1"], metadata: {}, createdAt: "2026-01-01T00:00:00Z" },
      ],
      count: 1,
      hasMore: false,
    });

    const result = await tools.memory_list.execute("", {});
    expect(result.content[0].text).toContain("[ID: m1]");
    expect(result.content[0].text).toContain("memory one");
    expect(result.content[0].text).toContain("1 memories");
  });

  it("shows 'more available' indicator", async () => {
    const { api, tools } = createMockApi();
    createPlugin(api as any);

    mockListMemories.mockResolvedValueOnce({
      memories: [{ id: "m1", text: "test", tags: [], metadata: {}, createdAt: "" }],
      count: 1,
      hasMore: true,
    });

    const result = await tools.memory_list.execute("", {});
    expect(result.content[0].text).toContain("(more available)");
  });

  it("returns empty message when no memories", async () => {
    const { api, tools } = createMockApi();
    createPlugin(api as any);

    mockListMemories.mockResolvedValueOnce({
      memories: [],
      count: 0,
      hasMore: false,
    });

    const result = await tools.memory_list.execute("", {});
    expect(result.content[0].text).toContain("No memories found");
  });
});

// --- memory_status Tool ---

describe("memory_status tool", () => {
  it("returns formatted status", async () => {
    const { api, tools } = createMockApi();
    createPlugin(api as any);

    mockGetStatus.mockResolvedValueOnce({
      daemon: "ready",
      mongodb: "connected",
      voyage: "ready",
      uptime: 3600,
      memory: { heapUsed: 50000000, heapTotal: 100000000 },
      stats: { totalMemories: 42 },
    });

    const result = await tools.memory_status.execute("", {});
    expect(result.content[0].text).toContain("Daemon: ready");
    expect(result.content[0].text).toContain("MongoDB: connected");
    expect(result.content[0].text).toContain("Total memories: 42");
    expect(result.content[0].text).toContain("Uptime: 60 minutes");
  });

  it("handles daemon unreachable", async () => {
    const { api, tools } = createMockApi();
    createPlugin(api as any);

    mockGetStatus.mockRejectedValueOnce(new Error("timeout"));

    const result = await tools.memory_status.execute("", {});
    expect(result.content[0].text).toContain("Memory daemon unreachable");
  });
});

// --- Gateway RPC ---

describe("gateway RPC methods", () => {
  it("memory.remember passes metadata through", async () => {
    const { api, rpcMethods } = createMockApi();
    createPlugin(api as any);

    mockRemember.mockResolvedValueOnce({
      success: true,
      id: "rpc-1",
      text: "test",
      tags: [],
    });

    await rpcMethods["memory.remember"]({
      text: "test",
      tags: ["t"],
      metadata: { source: "rpc" },
      ttl: 999,
    });

    expect(mockRemember).toHaveBeenCalledWith(
      "http://test:7654",
      "test-agent",
      "test",
      ["t"],
      { source: "rpc" },
      999,
      expect.objectContaining({}),
    );
  });

  it("memory.recall uses config maxResults as default", async () => {
    const { api, rpcMethods } = createMockApi({ maxResults: 3 });
    createPlugin(api as any);

    mockRecall.mockResolvedValueOnce({
      success: true,
      query: "test",
      results: [],
      count: 0,
      method: "in_memory",
    });

    await rpcMethods["memory.recall"]({ query: "test" });

    expect(mockRecall).toHaveBeenCalledWith(
      "http://test:7654",
      "test-agent",
      "test",
      3,
      undefined,
      expect.objectContaining({}),
    );
  });
});
