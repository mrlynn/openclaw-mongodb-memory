import { describe, it, expect, vi, beforeEach } from "vitest";
import { promises as fs } from "fs";

vi.mock("../../lib/daemon-client", () => ({
  getConfigFromEnv: vi.fn(() => ({
    daemonUrl: "http://test:7654",
    agentId: "test-agent",
    apiKey: undefined,
    projectId: undefined,
  })),
  checkHealth: vi.fn(() => Promise.resolve(true)),
  recall: vi.fn(() =>
    Promise.resolve({
      success: true,
      query: "",
      results: [],
      count: 0,
      method: "in_memory",
    }),
  ),
}));

import handler from "../../hooks/memory-bootstrap/handler";
import { checkHealth, recall } from "../../lib/daemon-client";

const mockCheckHealth = vi.mocked(checkHealth);
const mockRecall = vi.mocked(recall);

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    type: "agent",
    action: "bootstrap",
    sessionKey: "sess-1",
    timestamp: new Date(),
    messages: [] as string[],
    context: {
      bootstrapFiles: [] as string[],
      ...overrides,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckHealth.mockResolvedValue(true);
  delete process.env.OPENCLAW_MEMORY_HOOKS_ENABLED;
});

describe("memory-bootstrap hook", () => {
  it("fetches general and pinned memories in parallel", async () => {
    mockRecall.mockResolvedValue({
      success: true,
      query: "",
      results: [
        { id: "1", text: "User prefers dark mode", score: 0.8, tags: ["pref"], metadata: {}, createdAt: "2026-02-20T00:00:00Z" },
      ],
      count: 1,
      method: "in_memory",
    });

    const event = makeEvent();
    await handler(event);

    // Should have been called twice (general + pinned)
    expect(mockRecall).toHaveBeenCalledTimes(2);
  });

  it("deduplicates by memory ID", async () => {
    const sharedMemory = {
      id: "same-id",
      text: "Shared memory",
      score: 0.9,
      tags: ["pinned"],
      metadata: {},
      createdAt: "2026-02-20T00:00:00Z",
    };

    mockRecall.mockResolvedValue({
      success: true,
      query: "",
      results: [sharedMemory],
      count: 1,
      method: "in_memory",
    });

    const event = makeEvent();
    await handler(event);

    // Should write file with only 1 unique memory, not 2
    expect(event.context.bootstrapFiles.length).toBe(1);
    const content = await fs.readFile(event.context.bootstrapFiles[0], "utf-8");
    const occurrences = (content.match(/Shared memory/g) || []).length;
    expect(occurrences).toBe(1);
  });

  it("formats markdown with sections", async () => {
    mockRecall
      .mockResolvedValueOnce({
        success: true,
        query: "",
        results: [
          { id: "1", text: "General fact", score: 0.8, tags: ["fact"], metadata: {}, createdAt: "2026-02-20T00:00:00Z" },
        ],
        count: 1,
        method: "in_memory",
      })
      .mockResolvedValueOnce({
        success: true,
        query: "",
        results: [
          { id: "2", text: "Pinned memory", score: 0.9, tags: ["pinned"], metadata: {}, createdAt: "2026-02-19T00:00:00Z" },
        ],
        count: 1,
        method: "in_memory",
      });

    const event = makeEvent();
    await handler(event);

    const content = await fs.readFile(event.context.bootstrapFiles[0], "utf-8");
    expect(content).toContain("# Memory Context");
    expect(content).toContain("## Pinned / Important");
    expect(content).toContain("## Recent Context");
    expect(content).toContain("Pinned memory");
    expect(content).toContain("General fact");
  });

  it("skips when daemon is down", async () => {
    mockCheckHealth.mockResolvedValueOnce(false);
    const event = makeEvent();
    await handler(event);

    expect(mockRecall).not.toHaveBeenCalled();
    expect(event.context.bootstrapFiles.length).toBe(0);
  });

  it("skips when no memories found", async () => {
    // Explicitly return empty results for both queries
    mockRecall.mockResolvedValue({
      success: true,
      query: "",
      results: [],
      count: 0,
      method: "in_memory",
    });
    const event = makeEvent();
    await handler(event);

    expect(event.context.bootstrapFiles.length).toBe(0);
  });

  it("only fires on agent:bootstrap", async () => {
    const event = makeEvent();
    event.type = "message";
    event.action = "sent";
    await handler(event);
    expect(mockRecall).not.toHaveBeenCalled();
  });

  it("adds file to bootstrapFiles", async () => {
    mockRecall.mockResolvedValueOnce({
      success: true,
      query: "",
      results: [
        { id: "1", text: "test", score: 0.8, tags: [], metadata: {}, createdAt: "" },
      ],
      count: 1,
      method: "in_memory",
    });

    const event = makeEvent();
    await handler(event);

    expect(event.context.bootstrapFiles.length).toBe(1);
    expect(event.context.bootstrapFiles[0]).toContain("openclaw-memory-context");
  });

  it("incorporates workspace dir in query", async () => {
    mockRecall.mockResolvedValue({
      success: true,
      query: "",
      results: [
        { id: "1", text: "test", score: 0.8, tags: [], metadata: {}, createdAt: "" },
      ],
      count: 1,
      method: "in_memory",
    });

    const event = makeEvent({ workspaceDir: "/home/user/my-project" });
    await handler(event);

    // First call is the general query — should include project name
    const generalQuery = mockRecall.mock.calls[0][2];
    expect(generalQuery).toContain("my-project");
  });

  it("respects OPENCLAW_MEMORY_HOOKS_ENABLED=false", async () => {
    process.env.OPENCLAW_MEMORY_HOOKS_ENABLED = "false";
    const event = makeEvent();
    await handler(event);
    expect(mockRecall).not.toHaveBeenCalled();
  });

  it("never throws on recall failure", async () => {
    mockRecall.mockRejectedValue(new Error("timeout"));
    const event = makeEvent();
    // Should not throw
    await handler(event);
  });

  it("adds message on success", async () => {
    mockRecall.mockResolvedValueOnce({
      success: true,
      query: "",
      results: [
        { id: "1", text: "fact", score: 0.8, tags: [], metadata: {}, createdAt: "" },
      ],
      count: 1,
      method: "in_memory",
    });

    const event = makeEvent();
    await handler(event);

    expect(event.messages.some((m: string) => m.includes("[memory] Injected"))).toBe(true);
  });
});
