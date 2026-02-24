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

import handler from "../../hooks/session-to-memory/handler";
import { remember } from "../../lib/daemon-client";

const mockRemember = vi.mocked(remember);

function makeEvent(session: Record<string, unknown> = {}) {
  return {
    type: "command",
    action: "new",
    sessionKey: "sess-1",
    timestamp: new Date(),
    messages: [] as string[],
    context: {
      sessionEntry: {
        id: "s-1",
        turns: [
          { role: "user", content: "How do I configure MongoDB?" },
          {
            role: "assistant",
            content: "You can configure MongoDB by editing the connection string.\n\nThe recommended approach is to use Atlas for production.",
          },
          { role: "user", content: "Thanks, what about indexing?" },
          {
            role: "assistant",
            content: "For indexing, create compound indexes.\n\nUse explain() to verify query plans.",
          },
        ],
        startedAt: "2026-02-20T10:00:00Z",
        endedAt: "2026-02-20T10:30:00Z",
        ...session,
      },
      sessionId: "s-1",
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.OPENCLAW_MEMORY_HOOKS_ENABLED;
});

describe("session-to-memory hook", () => {
  it("builds summary from turns and stores it", async () => {
    const event = makeEvent();
    await handler(event);

    expect(mockRemember).toHaveBeenCalledTimes(1);
    const storedText = mockRemember.mock.calls[0][2];
    expect(storedText).toContain("Session summary (4 turns)");
    expect(storedText).toContain("User: How do I configure MongoDB?");
    expect(storedText).toContain("Started: 2026-02-20T10:00:00Z");
  });

  it("uses existing session.summary when available", async () => {
    const event = makeEvent({
      summary: "This session was about MongoDB configuration and indexing strategies.",
    });
    await handler(event);

    expect(mockRemember).toHaveBeenCalledTimes(1);
    const storedText = mockRemember.mock.calls[0][2];
    expect(storedText).toBe(
      "This session was about MongoDB configuration and indexing strategies.",
    );
  });

  it("skips sessions with fewer than 2 turns", async () => {
    const event = makeEvent({
      turns: [{ role: "user", content: "Hello" }],
    });
    await handler(event);
    expect(mockRemember).not.toHaveBeenCalled();
  });

  it("stores with correct tags", async () => {
    const event = makeEvent();
    await handler(event);

    const tags = mockRemember.mock.calls[0][3];
    expect(tags).toEqual(["session-summary", "auto"]);
  });

  it("stores with session metadata", async () => {
    const event = makeEvent();
    await handler(event);

    const metadata = mockRemember.mock.calls[0][4] as Record<string, unknown>;
    expect(metadata.source).toBe("session-to-memory");
    expect(metadata.sessionId).toBe("s-1");
    expect(metadata.turnCount).toBe(4);
  });

  it("only fires on command:new", async () => {
    const event = makeEvent();
    event.type = "message";
    event.action = "sent";
    await handler(event);
    expect(mockRemember).not.toHaveBeenCalled();
  });

  it("skips when no session entry", async () => {
    const event = {
      type: "command",
      action: "new",
      sessionKey: "sess-1",
      timestamp: new Date(),
      messages: [] as string[],
      context: { sessionId: "s-1" },
    };
    await handler(event as any);
    expect(mockRemember).not.toHaveBeenCalled();
  });

  it("never throws on remember failure", async () => {
    mockRemember.mockRejectedValueOnce(new Error("storage error"));
    const event = makeEvent();
    // Should not throw
    await handler(event);
  });

  it("respects OPENCLAW_MEMORY_HOOKS_ENABLED=false", async () => {
    process.env.OPENCLAW_MEMORY_HOOKS_ENABLED = "false";
    const event = makeEvent();
    await handler(event);
    expect(mockRemember).not.toHaveBeenCalled();
  });

  it("adds message on success", async () => {
    const event = makeEvent();
    await handler(event);
    expect(event.messages).toContain(
      "[memory] Previous session summary saved to memory",
    );
  });

  it("respects MAX_SUMMARY_LENGTH", async () => {
    const longSummary = "A".repeat(3000);
    const event = makeEvent({ summary: longSummary });
    await handler(event);

    const storedText = mockRemember.mock.calls[0][2];
    expect(storedText.length).toBeLessThanOrEqual(2000);
  });
});
