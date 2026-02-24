import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  checkHealth,
  recall,
  remember,
  forget,
  getStatus,
  listMemories,
  getConfigFromEnv,
} from "../lib/daemon-client";

// --- Mock fetch globally ---

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: () => Promise.resolve(body),
  };
}

beforeEach(() => {
  mockFetch.mockReset();
  // Clear env vars between tests
  delete process.env.OPENCLAW_MEMORY_DAEMON_URL;
  delete process.env.OPENCLAW_MEMORY_AGENT_ID;
  delete process.env.OPENCLAW_MEMORY_API_KEY;
  delete process.env.OPENCLAW_MEMORY_PROJECT_ID;
  delete process.env.MEMORY_API_KEY;
});

// --- getConfigFromEnv ---

describe("getConfigFromEnv", () => {
  it("returns defaults when no env vars set", () => {
    const config = getConfigFromEnv();
    expect(config.daemonUrl).toBe("http://localhost:7654");
    expect(config.agentId).toBe("openclaw");
    expect(config.apiKey).toBeUndefined();
    expect(config.projectId).toBeUndefined();
  });

  it("reads env vars", () => {
    process.env.OPENCLAW_MEMORY_DAEMON_URL = "http://custom:9999";
    process.env.OPENCLAW_MEMORY_AGENT_ID = "test-agent";
    process.env.OPENCLAW_MEMORY_API_KEY = "secret-key";
    process.env.OPENCLAW_MEMORY_PROJECT_ID = "proj-1";
    const config = getConfigFromEnv();
    expect(config.daemonUrl).toBe("http://custom:9999");
    expect(config.agentId).toBe("test-agent");
    expect(config.apiKey).toBe("secret-key");
    expect(config.projectId).toBe("proj-1");
  });

  it("falls back to MEMORY_API_KEY", () => {
    process.env.MEMORY_API_KEY = "fallback-key";
    const config = getConfigFromEnv();
    expect(config.apiKey).toBe("fallback-key");
  });

  it("prefers OPENCLAW_MEMORY_API_KEY over MEMORY_API_KEY", () => {
    process.env.OPENCLAW_MEMORY_API_KEY = "primary";
    process.env.MEMORY_API_KEY = "fallback";
    const config = getConfigFromEnv();
    expect(config.apiKey).toBe("primary");
  });
});

// --- checkHealth ---

describe("checkHealth", () => {
  it("returns true on 200", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ status: "ok" }));
    const result = await checkHealth("http://localhost:7654");
    expect(result).toBe(true);
  });

  it("returns false on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const result = await checkHealth("http://localhost:7654");
    expect(result).toBe(false);
  });

  it("returns false on non-200", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}, 500));
    const result = await checkHealth("http://localhost:7654");
    expect(result).toBe(false);
  });

  it("does not send API key header", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ status: "ok" }));
    await checkHealth("http://localhost:7654");
    const [, init] = mockFetch.mock.calls[0];
    expect(init?.headers).toBeUndefined();
  });
});

// --- recall ---

describe("recall", () => {
  const recallResponse = {
    success: true,
    query: "test",
    results: [{ id: "1", text: "test", score: 0.9, tags: [], metadata: {}, createdAt: "" }],
    count: 1,
    method: "in_memory",
  };

  it("sends correct URL params", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(recallResponse));
    await recall("http://localhost:7654", "agent-1", "search query", 5);

    const [url] = mockFetch.mock.calls[0];
    const parsed = new URL(url);
    expect(parsed.pathname).toBe("/recall");
    expect(parsed.searchParams.get("agentId")).toBe("agent-1");
    expect(parsed.searchParams.get("query")).toBe("search query");
    expect(parsed.searchParams.get("limit")).toBe("5");
  });

  it("includes API key header when provided", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(recallResponse));
    await recall("http://localhost:7654", "agent-1", "q", 10, undefined, {
      apiKey: "my-key",
    });

    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers["X-API-Key"]).toBe("my-key");
  });

  it("omits API key header when not provided", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(recallResponse));
    await recall("http://localhost:7654", "agent-1", "q");

    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers["X-API-Key"]).toBeUndefined();
  });

  it("includes projectId when provided", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(recallResponse));
    await recall("http://localhost:7654", "agent-1", "q", 10, undefined, {
      projectId: "proj-1",
    });

    const [url] = mockFetch.mock.calls[0];
    const parsed = new URL(url);
    expect(parsed.searchParams.get("projectId")).toBe("proj-1");
  });

  it("includes tags when provided", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(recallResponse));
    await recall("http://localhost:7654", "agent-1", "q", 10, "tag1,tag2");

    const [url] = mockFetch.mock.calls[0];
    const parsed = new URL(url);
    expect(parsed.searchParams.get("tags")).toBe("tag1,tag2");
  });

  it("throws on non-200 response", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}, 401));
    await expect(
      recall("http://localhost:7654", "agent-1", "q"),
    ).rejects.toThrow("Daemon recall failed");
  });

  it("retries on 500", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({}, 500))
      .mockResolvedValueOnce(jsonResponse(recallResponse));

    const result = await recall("http://localhost:7654", "agent-1", "q");
    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("does not retry on 400", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ error: "bad request" }, 400));
    await expect(
      recall("http://localhost:7654", "agent-1", "q"),
    ).rejects.toThrow();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

// --- remember ---

describe("remember", () => {
  const rememberResponse = {
    success: true,
    id: "abc123",
    text: "test memory",
    tags: ["tag1"],
  };

  it("sends correct POST body", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(rememberResponse));
    await remember("http://localhost:7654", "agent-1", "test memory", ["tag1"], { source: "test" }, 3600);

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toContain("/remember");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body);
    expect(body.agentId).toBe("agent-1");
    expect(body.text).toBe("test memory");
    expect(body.tags).toEqual(["tag1"]);
    expect(body.metadata).toEqual({ source: "test" });
    expect(body.ttl).toBe(3600);
  });

  it("includes projectId in body when provided", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(rememberResponse));
    await remember("http://localhost:7654", "agent-1", "test", [], {}, undefined, {
      projectId: "proj-1",
    });

    const [, init] = mockFetch.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.projectId).toBe("proj-1");
  });

  it("includes API key header", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(rememberResponse));
    await remember("http://localhost:7654", "agent-1", "test", [], {}, undefined, {
      apiKey: "key-1",
    });

    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers["X-API-Key"]).toBe("key-1");
  });

  it("omits ttl from body when undefined", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(rememberResponse));
    await remember("http://localhost:7654", "agent-1", "test");

    const [, init] = mockFetch.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.ttl).toBeUndefined();
  });
});

// --- forget ---

describe("forget", () => {
  it("sends DELETE to correct URL", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ success: true, id: "abc123", message: "deleted" }),
    );
    await forget("http://localhost:7654", "abc123");

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toContain("/forget/abc123");
    expect(init.method).toBe("DELETE");
  });

  it("includes API key header", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ success: true, id: "abc123", message: "deleted" }),
    );
    await forget("http://localhost:7654", "abc123", { apiKey: "key-1" });

    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers["X-API-Key"]).toBe("key-1");
  });
});

// --- getStatus ---

describe("getStatus", () => {
  const statusResponse = {
    daemon: "ready",
    mongodb: "connected",
    voyage: "ready",
    uptime: 3600,
    memory: { heapUsed: 50000000, heapTotal: 100000000 },
    stats: { totalMemories: 42 },
  };

  it("sends GET to /status", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(statusResponse));
    const result = await getStatus("http://localhost:7654");

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("/status");
    expect(result.daemon).toBe("ready");
    expect(result.stats.totalMemories).toBe(42);
  });

  it("includes API key header", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(statusResponse));
    await getStatus("http://localhost:7654", { apiKey: "key-1" });

    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers["X-API-Key"]).toBe("key-1");
  });
});

// --- listMemories ---

describe("listMemories", () => {
  const listResponse = {
    memories: [{ id: "1", text: "test", tags: ["a"], metadata: {}, createdAt: "" }],
    count: 1,
    hasMore: false,
  };

  it("sends correct query params", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(listResponse));
    await listMemories("http://localhost:7654", "agent-1", {
      limit: 20,
      tags: "tag1,tag2",
      sort: "asc",
    });

    const [url] = mockFetch.mock.calls[0];
    const parsed = new URL(url);
    expect(parsed.pathname).toBe("/memories");
    expect(parsed.searchParams.get("agentId")).toBe("agent-1");
    expect(parsed.searchParams.get("limit")).toBe("20");
    expect(parsed.searchParams.get("tags")).toBe("tag1,tag2");
    expect(parsed.searchParams.get("sort")).toBe("asc");
  });

  it("includes projectId when provided", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(listResponse));
    await listMemories("http://localhost:7654", "agent-1", {
      projectId: "proj-1",
    });

    const [url] = mockFetch.mock.calls[0];
    const parsed = new URL(url);
    expect(parsed.searchParams.get("projectId")).toBe("proj-1");
  });

  it("includes API key header", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(listResponse));
    await listMemories("http://localhost:7654", "agent-1", {
      apiKey: "key-1",
    });

    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers["X-API-Key"]).toBe("key-1");
  });
});

// --- Retry behavior ---

describe("retry behavior", () => {
  it("retries up to 2 times on 500", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({}, 500))
      .mockResolvedValueOnce(jsonResponse({}, 500))
      .mockResolvedValueOnce(jsonResponse({}, 500));

    // After 3 attempts (1 original + 2 retries), should return the 500 response
    await expect(
      getStatus("http://localhost:7654"),
    ).rejects.toThrow("Daemon status failed");
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("retries on network error then succeeds", async () => {
    const statusResponse = {
      daemon: "ready",
      mongodb: "connected",
      voyage: "ready",
      uptime: 100,
      memory: { heapUsed: 1, heapTotal: 2 },
      stats: { totalMemories: 0 },
    };
    mockFetch
      .mockRejectedValueOnce(new Error("ECONNRESET"))
      .mockResolvedValueOnce(jsonResponse(statusResponse));

    const result = await getStatus("http://localhost:7654");
    expect(result.daemon).toBe("ready");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
