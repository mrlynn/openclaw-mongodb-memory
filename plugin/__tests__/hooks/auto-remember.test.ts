import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../lib/daemon-client", () => ({
  getConfigFromEnv: vi.fn(() => ({
    daemonUrl: "http://test:7654",
    agentId: "test-agent",
    apiKey: undefined,
    projectId: undefined,
  })),
  remember: vi.fn(() => Promise.resolve({ success: true, id: "1", text: "", tags: [] })),
}));

import handler from "../../hooks/auto-remember/handler";
import { remember } from "../../lib/daemon-client";

const mockRemember = vi.mocked(remember);

function makeEvent(content: string, overrides: Record<string, unknown> = {}) {
  return {
    type: "message",
    action: "sent",
    sessionKey: "sess-1",
    timestamp: new Date(),
    messages: [] as string[],
    context: {
      to: "user",
      content,
      success: true,
      messageId: "msg-1",
      ...overrides,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.OPENCLAW_MEMORY_HOOKS_ENABLED;
});

describe("auto-remember hook", () => {
  it("extracts 'I'll remember' pattern", async () => {
    const event = makeEvent("Some context about settings. I'll remember: The default theme is set to dark mode.");
    await handler(event);
    expect(mockRemember).toHaveBeenCalledTimes(1);
    expect(mockRemember.mock.calls[0][2]).toContain("The default theme is set to dark mode");
  });

  it("extracts 'preference' pattern", async () => {
    const event = makeEvent("Based on the discussion, user prefers: TypeScript over JavaScript for new projects.");
    await handler(event);
    expect(mockRemember).toHaveBeenCalledTimes(1);
    expect(mockRemember.mock.calls[0][2]).toContain("TypeScript over JavaScript");
  });

  it("extracts 'we decided' pattern", async () => {
    const event = makeEvent("After review, we decided to: use MongoDB Atlas for the production database deployment.");
    await handler(event);
    expect(mockRemember).toHaveBeenCalledTimes(1);
    expect(mockRemember.mock.calls[0][2]).toContain("use MongoDB Atlas");
  });

  it("extracts 'remember that' pattern", async () => {
    const event = makeEvent("OK noted. Remember that: the API rate limit is 100 requests per minute for free tier.");
    await handler(event);
    expect(mockRemember).toHaveBeenCalledTimes(1);
    expect(mockRemember.mock.calls[0][2]).toContain("the API rate limit is 100");
  });

  it("does NOT extract code lines like 'const x = hello'", async () => {
    const event = makeEvent(
      "Here's the code:\nconst x = \"hello world this is a test line\"\nlet y = someFunction(arg1, arg2)",
    );
    await handler(event);
    expect(mockRemember).not.toHaveBeenCalled();
  });

  it("does NOT extract log lines like 'INFO: started'", async () => {
    const event = makeEvent(
      "The server output:\nINFO: Server started successfully on port 7654\nDEBUG: Connected to database cluster",
    );
    await handler(event);
    expect(mockRemember).not.toHaveBeenCalled();
  });

  it("respects MAX_EXTRACTIONS limit (5)", async () => {
    const patterns = [
      "I'll remember: fact one is here now",
      "I'll remember: fact two is here now",
      "I'll remember: fact three is here now",
      "I'll remember: fact four is here now",
      "I'll remember: fact five is here now",
      "I'll remember: fact six is here now",
    ];
    const event = makeEvent(patterns.join("\n"));
    await handler(event);
    expect(mockRemember).toHaveBeenCalledTimes(5);
  });

  it("deduplicates identical text", async () => {
    const event = makeEvent(
      "I'll remember: same fact here for testing\nI'll remember: same fact here for testing",
    );
    await handler(event);
    expect(mockRemember).toHaveBeenCalledTimes(1);
  });

  it("skips messages under 50 chars", async () => {
    const event = makeEvent("I'll remember: short");
    await handler(event);
    expect(mockRemember).not.toHaveBeenCalled();
  });

  it("skips non-message:sent events", async () => {
    const event = makeEvent("I'll remember: something important for later reference.");
    event.type = "command";
    event.action = "new";
    await handler(event);
    expect(mockRemember).not.toHaveBeenCalled();
  });

  it("skips failed messages", async () => {
    const event = makeEvent("I'll remember: something important for later reference.", {
      success: false,
    });
    await handler(event);
    expect(mockRemember).not.toHaveBeenCalled();
  });

  it("never throws (fire-and-forget)", async () => {
    mockRemember.mockRejectedValueOnce(new Error("storage failure"));
    const event = makeEvent("I'll remember: user prefers vim over emacs for editing code.");
    // Should not throw
    await handler(event);
    expect(event.messages.length).toBe(1);
  });

  it("respects OPENCLAW_MEMORY_HOOKS_ENABLED=false", async () => {
    process.env.OPENCLAW_MEMORY_HOOKS_ENABLED = "false";
    const event = makeEvent("I'll remember: something important for the project.");
    await handler(event);
    expect(mockRemember).not.toHaveBeenCalled();
  });

  it("adds message about extracted facts", async () => {
    const event = makeEvent("Based on review, we decided to: use pnpm as the package manager for consistency.");
    await handler(event);
    expect(event.messages).toContain(
      "[memory] Auto-extracted 1 fact(s) from response",
    );
  });
});
