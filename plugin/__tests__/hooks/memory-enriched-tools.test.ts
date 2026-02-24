import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../lib/daemon-client", () => ({
  getConfigFromEnv: vi.fn(() => ({
    daemonUrl: "http://test:7654",
    agentId: "test-agent",
    apiKey: undefined,
    projectId: undefined,
  })),
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

import handler from "../../hooks/memory-enriched-tools/handler";
import { recall } from "../../lib/daemon-client";

const mockRecall = vi.mocked(recall);

function makePayload(
  toolName: string,
  text: string,
): {
  toolName: string;
  toolCallId: string;
  result: { content: Array<{ type: string; text?: string }> };
} {
  return {
    toolName,
    toolCallId: "call-1",
    result: {
      content: [{ type: "text", text }],
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.OPENCLAW_MEMORY_HOOKS_ENABLED;
});

describe("memory-enriched-tools hook", () => {
  it("enriches qualifying tool results", async () => {
    mockRecall.mockResolvedValueOnce({
      success: true,
      query: "",
      results: [
        { id: "1", text: "Related memory", score: 0.8, tags: ["context"], metadata: {}, createdAt: "" },
      ],
      count: 1,
      method: "in_memory",
    });

    const longText = "This is a long file content about authentication and user management. ".repeat(5);
    const payload = makePayload("Read", longText);
    const result = await handler(payload);

    expect(result).toBeDefined();
    expect(result!.result.content[0].text).toContain("Related memories:");
    expect(result!.result.content[0].text).toContain("Related memory");
  });

  it("ignores non-enrichable tools", async () => {
    const payload = makePayload("NotATool", "A".repeat(200));
    const result = await handler(payload);
    expect(result).toBeUndefined();
    expect(mockRecall).not.toHaveBeenCalled();
  });

  it("enriches all supported tool names", async () => {
    const supportedTools = ["Read", "Grep", "Glob", "Bash", "read_file", "search_files", "list_files"];

    for (const toolName of supportedTools) {
      vi.clearAllMocks();
      mockRecall.mockResolvedValueOnce({
        success: true,
        query: "",
        results: [
          { id: "1", text: "memory", score: 0.8, tags: [], metadata: {}, createdAt: "" },
        ],
        count: 1,
        method: "in_memory",
      });

      const payload = makePayload(toolName, "A".repeat(200));
      const result = await handler(payload);
      expect(result).toBeDefined();
    }
  });

  it("ignores short results (< 100 chars)", async () => {
    const payload = makePayload("Read", "short text");
    const result = await handler(payload);
    expect(result).toBeUndefined();
    expect(mockRecall).not.toHaveBeenCalled();
  });

  it("returns undefined when no relevant memories found", async () => {
    const payload = makePayload("Read", "A".repeat(200));
    const result = await handler(payload);
    expect(result).toBeUndefined();
  });

  it("filters memories below minimum score", async () => {
    mockRecall.mockResolvedValueOnce({
      success: true,
      query: "",
      results: [
        { id: "1", text: "Low score", score: 0.3, tags: [], metadata: {}, createdAt: "" },
      ],
      count: 1,
      method: "in_memory",
    });

    const payload = makePayload("Read", "A".repeat(200));
    const result = await handler(payload);
    expect(result).toBeUndefined();
  });

  it("deep clones payload (no mutation)", async () => {
    mockRecall.mockResolvedValueOnce({
      success: true,
      query: "",
      results: [
        { id: "1", text: "memory", score: 0.8, tags: [], metadata: {}, createdAt: "" },
      ],
      count: 1,
      method: "in_memory",
    });

    const originalText = "A".repeat(200);
    const payload = makePayload("Read", originalText);
    const result = await handler(payload);

    // Original should be unchanged
    expect(payload.result.content[0].text).toBe(originalText);
    // Modified should have enrichment
    expect(result!.result.content[0].text).toContain("Related memories:");
  });

  it("returns undefined on recall error", async () => {
    mockRecall.mockRejectedValueOnce(new Error("timeout"));
    const payload = makePayload("Read", "A".repeat(200));
    const result = await handler(payload);
    expect(result).toBeUndefined();
  });

  it("respects OPENCLAW_MEMORY_HOOKS_ENABLED=false", async () => {
    process.env.OPENCLAW_MEMORY_HOOKS_ENABLED = "false";
    const payload = makePayload("Read", "A".repeat(200));
    const result = await handler(payload);
    expect(result).toBeUndefined();
    expect(mockRecall).not.toHaveBeenCalled();
  });

  it("filters noisy content from query extraction", async () => {
    mockRecall.mockResolvedValueOnce({
      success: true,
      query: "",
      results: [
        { id: "1", text: "memory", score: 0.8, tags: [], metadata: {}, createdAt: "" },
      ],
      count: 1,
      method: "in_memory",
    });

    // Content with line numbers and decorative lines mixed with real content
    const noisyContent = [
      "1: import foo from bar",
      "2: const x = 1",
      "─────────────────",
      "This is a meaningful sentence about the authentication system.",
      "The user management module handles login and registration flows.",
      "Sessions are stored in Redis with a 24-hour TTL for performance.",
      "================",
      "3: export default x",
    ].join("\n");

    const payload = makePayload("Read", noisyContent);
    await handler(payload);

    if (mockRecall.mock.calls.length > 0) {
      const query = mockRecall.mock.calls[0][2];
      // Should not contain line numbers or decorative lines
      expect(query).not.toMatch(/^1:/);
      expect(query).not.toContain("─────");
    }
  });
});
