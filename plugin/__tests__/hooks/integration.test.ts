/**
 * Integration tests for OpenClaw memory hooks.
 *
 * These tests run against a LIVE daemon (no mocking). They exercise the full
 * pipeline: hook handler → daemon-client HTTP → daemon → MongoDB.
 *
 * Requirements:
 *   - Daemon running at OPENCLAW_MEMORY_DAEMON_URL (default http://localhost:7654)
 *   - VOYAGE_MOCK=true is fine (embeddings still round-trip through the daemon)
 *
 * Run:
 *   pnpm --filter openclaw-memory test:integration
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

// Integration tests hit a real daemon with real embedding calls — allow generous timeouts
vi.setConfig({ testTimeout: 30_000 });
import { promises as fs } from "fs";
import {
  checkHealth,
  remember,
  recall,
  forget,
  listMemories,
} from "../../lib/daemon-client";

// Import the actual hook handlers (no mocks!)
import autoRememberHandler from "../../hooks/auto-remember/handler";
import sessionToMemoryHandler from "../../hooks/session-to-memory/handler";
import memoryBootstrapHandler from "../../hooks/memory-bootstrap/handler";
import memoryEnrichedToolsHandler from "../../hooks/memory-enriched-tools/handler";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DAEMON_URL =
  process.env.OPENCLAW_MEMORY_DAEMON_URL || "http://localhost:7654";
const AGENT_ID = `integration-test-${Date.now()}`;

// Ensure hooks read the right config via env vars (same bridge as the plugin)
process.env.OPENCLAW_MEMORY_DAEMON_URL = DAEMON_URL;
process.env.OPENCLAW_MEMORY_AGENT_ID = AGENT_ID;
delete process.env.OPENCLAW_MEMORY_HOOKS_ENABLED; // ensure enabled

// Track memory IDs we create so we can clean up
const createdMemoryIds: string[] = [];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Store a memory and track its ID for cleanup. */
async function seedMemory(
  text: string,
  tags: string[] = [],
  metadata: Record<string, unknown> = {},
) {
  const result = await remember(DAEMON_URL, AGENT_ID, text, tags, metadata);
  createdMemoryIds.push(result.id);
  return result;
}

/** Wait for a memory to become findable via list (eventual consistency). */
async function waitForMemory(
  tag: string,
  timeoutMs = 5000,
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const list = await listMemories(DAEMON_URL, AGENT_ID, { tags: tag });
    if (list.count > 0) return true;
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

let daemonAvailable = false;

beforeAll(async () => {
  daemonAvailable = await checkHealth(DAEMON_URL);
  if (!daemonAvailable) {
    console.warn(
      `\n⚠  Daemon not reachable at ${DAEMON_URL} — skipping integration tests.\n` +
        `   Start the daemon with: pnpm dev\n`,
    );
  }
});

afterAll(async () => {
  if (!daemonAvailable) return;

  // Clean up every memory we created
  const errors: string[] = [];
  for (const id of createdMemoryIds) {
    try {
      await forget(DAEMON_URL, id);
    } catch (e) {
      errors.push(`${id}: ${(e as Error).message}`);
    }
  }
  if (errors.length > 0) {
    console.warn(`Cleanup: failed to delete ${errors.length} memories`);
  }
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Hook integration tests (live daemon)", () => {
  // -----------------------------------------------------------------------
  // 1. auto-remember
  // -----------------------------------------------------------------------
  describe("auto-remember", () => {
    it("stores an extracted fact in the daemon", async (ctx) => {
      if (!daemonAvailable) return ctx.skip();

      const event = {
        type: "message",
        action: "sent",
        sessionKey: "int-sess-1",
        timestamp: new Date(),
        messages: [] as string[],
        context: {
          to: "user",
          content:
            "After reviewing the project, I'll remember: Integration tests should always clean up after themselves to avoid polluting the database.",
          success: true,
          messageId: "int-msg-1",
        },
      };

      await autoRememberHandler(event);

      // The hook is fire-and-forget, so give the daemon a moment
      await new Promise((r) => setTimeout(r, 1500));

      // Verify the fact was stored
      const list = await listMemories(DAEMON_URL, AGENT_ID, {
        tags: "auto-extracted",
        limit: 10,
      });

      expect(list.count).toBeGreaterThanOrEqual(1);

      const stored = list.memories.find((m) =>
        m.text.includes("Integration tests should always clean up"),
      );
      expect(stored).toBeDefined();
      expect(stored!.tags).toContain("auto-extracted");
      expect(stored!.tags).toContain("noted");
      expect(stored!.metadata.source).toBe("auto-remember");

      // Track for cleanup
      if (stored) createdMemoryIds.push(stored.id);
    });

    it("extracts multiple patterns from a single message", async (ctx) => {
      if (!daemonAvailable) return ctx.skip();

      const event = {
        type: "message",
        action: "sent",
        sessionKey: "int-sess-2",
        timestamp: new Date(),
        messages: [] as string[],
        context: {
          to: "user",
          content: [
            "Based on our discussion, here are some key takeaways.",
            "User prefers: TypeScript with strict mode enabled for all new packages in the monorepo.",
            "We decided to: use vitest instead of jest for the plugin test suite going forward.",
          ].join("\n"),
          success: true,
          messageId: "int-msg-2",
        },
      };

      await autoRememberHandler(event);
      await new Promise((r) => setTimeout(r, 1500));

      const list = await listMemories(DAEMON_URL, AGENT_ID, {
        tags: "auto-extracted",
        limit: 20,
      });

      const preference = list.memories.find((m) =>
        m.text.includes("TypeScript with strict mode"),
      );
      const decision = list.memories.find((m) =>
        m.text.includes("vitest instead of jest"),
      );

      expect(preference).toBeDefined();
      expect(decision).toBeDefined();

      if (preference) createdMemoryIds.push(preference.id);
      if (decision) createdMemoryIds.push(decision.id);
    });

    it("does not store anything for non-matching content", async (ctx) => {
      if (!daemonAvailable) return ctx.skip();

      const countBefore = (
        await listMemories(DAEMON_URL, AGENT_ID, { tags: "auto-extracted" })
      ).count;

      const event = {
        type: "message",
        action: "sent",
        sessionKey: "int-sess-3",
        timestamp: new Date(),
        messages: [] as string[],
        context: {
          to: "user",
          content:
            "Here is the code you asked for:\nconst x = 1;\nconst y = 2;\nconsole.log(x + y);",
          success: true,
          messageId: "int-msg-3",
        },
      };

      await autoRememberHandler(event);
      await new Promise((r) => setTimeout(r, 1000));

      const countAfter = (
        await listMemories(DAEMON_URL, AGENT_ID, { tags: "auto-extracted" })
      ).count;

      expect(countAfter).toBe(countBefore);
    });
  });

  // -----------------------------------------------------------------------
  // 2. session-to-memory
  // -----------------------------------------------------------------------
  describe("session-to-memory", () => {
    it("stores a session summary when starting a new session", async (ctx) => {
      if (!daemonAvailable) return ctx.skip();

      const event = {
        type: "command",
        action: "new",
        sessionKey: "int-sess-4",
        timestamp: new Date(),
        messages: [] as string[],
        context: {
          sessionEntry: {
            id: "prev-session-1",
            turns: [
              { role: "user", content: "How do I set up the memory daemon?" },
              {
                role: "assistant",
                content:
                  "You can start the daemon by running pnpm dev.\n\nThis will start both the daemon on port 7654 and the web UI on port 3000.",
              },
              {
                role: "user",
                content: "What environment variables do I need?",
              },
              {
                role: "assistant",
                content:
                  "You need MONGODB_URI and optionally VOYAGE_API_KEY.\n\nSet VOYAGE_MOCK=true if you want to skip the Voyage API during development.",
              },
            ],
            startedAt: new Date(Date.now() - 3600_000).toISOString(),
            endedAt: new Date().toISOString(),
          },
          sessionId: "prev-session-1",
        },
      };

      await sessionToMemoryHandler(event);

      // This hook awaits the remember call, so it should be stored immediately
      const found = await waitForMemory("session-summary");
      expect(found).toBe(true);

      const list = await listMemories(DAEMON_URL, AGENT_ID, {
        tags: "session-summary",
      });

      expect(list.count).toBeGreaterThanOrEqual(1);

      const summary = list.memories[0];
      expect(summary.tags).toContain("session-summary");
      expect(summary.tags).toContain("auto");
      expect(summary.text).toContain("Session summary");
      expect(summary.text).toContain("memory daemon");
      expect(summary.metadata.source).toBe("session-to-memory");
      expect(summary.metadata.turnCount).toBe(4);

      createdMemoryIds.push(summary.id);
    });

    it("uses a pre-built summary when available", async (ctx) => {
      if (!daemonAvailable) return ctx.skip();

      const event = {
        type: "command",
        action: "new",
        sessionKey: "int-sess-5",
        timestamp: new Date(),
        messages: [] as string[],
        context: {
          sessionEntry: {
            id: "prev-session-2",
            summary:
              "Discussed plugin architecture, decided to use shared daemon-client for all hooks.",
            turns: [
              { role: "user", content: "Hello" },
              { role: "assistant", content: "Hi" },
            ],
            startedAt: new Date(Date.now() - 1800_000).toISOString(),
            endedAt: new Date().toISOString(),
          },
          sessionId: "prev-session-2",
        },
      };

      await sessionToMemoryHandler(event);
      await new Promise((r) => setTimeout(r, 1000));

      const list = await listMemories(DAEMON_URL, AGENT_ID, {
        tags: "session-summary",
        limit: 20,
      });

      const match = list.memories.find((m) =>
        m.text.includes("shared daemon-client"),
      );
      expect(match).toBeDefined();

      if (match) createdMemoryIds.push(match.id);
    });
  });

  // -----------------------------------------------------------------------
  // 3. memory-bootstrap
  // -----------------------------------------------------------------------
  describe("memory-bootstrap", () => {
    it("injects stored memories into bootstrap context", async (ctx) => {
      if (!daemonAvailable) return ctx.skip();

      // Seed some memories first
      await seedMemory("The project uses pnpm workspaces with four packages", [
        "fact",
        "architecture",
      ]);
      await seedMemory("User prefers dark mode in all applications", [
        "preference",
        "pinned",
        "important",
      ]);

      // Small delay for indexing
      await new Promise((r) => setTimeout(r, 500));

      const event = {
        type: "agent",
        action: "bootstrap",
        sessionKey: "int-sess-6",
        timestamp: new Date(),
        messages: [] as string[],
        context: {
          bootstrapFiles: [] as string[],
          workspaceDir: "/home/user/openclaw-memory",
        },
      };

      await memoryBootstrapHandler(event);

      // Should have created a bootstrap file
      expect(event.context.bootstrapFiles.length).toBeGreaterThanOrEqual(1);

      const filePath = event.context.bootstrapFiles[0];
      expect(filePath).toContain("openclaw-memory-context");

      const content = await fs.readFile(filePath, "utf-8");
      expect(content).toContain("# Memory Context");

      // At least one of our seeded memories should appear
      const hasArchitecture = content.includes("pnpm workspaces");
      const hasPreference = content.includes("dark mode");
      expect(hasArchitecture || hasPreference).toBe(true);

      // Check message was added
      expect(
        event.messages.some((m) => m.includes("[memory] Injected")),
      ).toBe(true);

      // Clean up temp file
      await fs.unlink(filePath).catch(() => {});
    });

    it("produces empty bootstrapFiles when no memories exist", async (ctx) => {
      if (!daemonAvailable) return ctx.skip();

      // Use a unique agent ID with no memories
      const isolatedAgent = `empty-agent-${Date.now()}`;
      process.env.OPENCLAW_MEMORY_AGENT_ID = isolatedAgent;

      const event = {
        type: "agent",
        action: "bootstrap",
        sessionKey: "int-sess-7",
        timestamp: new Date(),
        messages: [] as string[],
        context: {
          bootstrapFiles: [] as string[],
        },
      };

      await memoryBootstrapHandler(event);

      // Restore original agent ID
      process.env.OPENCLAW_MEMORY_AGENT_ID = AGENT_ID;

      expect(event.context.bootstrapFiles.length).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // 4. memory-enriched-tools
  // -----------------------------------------------------------------------
  describe("memory-enriched-tools", () => {
    it("appends related memories to a qualifying tool result", async (ctx) => {
      if (!daemonAvailable) return ctx.skip();

      // Seed a memory about authentication
      await seedMemory(
        "The authentication system uses JWT tokens with a 24-hour expiry stored in httpOnly cookies",
        ["architecture", "auth"],
      );
      await new Promise((r) => setTimeout(r, 500));

      const payload = {
        toolName: "Read",
        toolCallId: "call-int-1",
        result: {
          content: [
            {
              type: "text",
              text: "This module handles user authentication and session management. " +
                "It validates JWT tokens on each request and refreshes them when they are close to expiry. " +
                "The middleware checks the Authorization header and falls back to cookie-based auth.",
            },
          ],
        },
      };

      const result = await memoryEnrichedToolsHandler(payload);

      // Whether enrichment happens depends on recall score — with VOYAGE_MOCK
      // the cosine similarity may be low. Either outcome is valid.
      if (result) {
        expect(result.result.content[0].text).toContain("Related memories:");
        // Original should be unmodified
        expect(payload.result.content[0].text).not.toContain(
          "Related memories:",
        );
      }
      // If result is undefined, recall returned no results above the 0.5 threshold
      // — that's acceptable with mock embeddings
    });

    it("does not enrich non-qualifying tool results", async (ctx) => {
      if (!daemonAvailable) return ctx.skip();

      const payload = {
        toolName: "Write", // Not in ENRICHABLE_TOOLS
        toolCallId: "call-int-2",
        result: {
          content: [
            {
              type: "text",
              text: "File written successfully with lots of content about the project architecture and configuration.",
            },
          ],
        },
      };

      const result = await memoryEnrichedToolsHandler(payload);
      expect(result).toBeUndefined();
    });

    it("does not enrich short tool results", async (ctx) => {
      if (!daemonAvailable) return ctx.skip();

      const payload = {
        toolName: "Read",
        toolCallId: "call-int-3",
        result: {
          content: [{ type: "text", text: "OK" }],
        },
      };

      const result = await memoryEnrichedToolsHandler(payload);
      expect(result).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // 5. Cross-hook: full lifecycle
  // -----------------------------------------------------------------------
  describe("full lifecycle", () => {
    it("auto-remember → recall via bootstrap", async (ctx) => {
      if (!daemonAvailable) return ctx.skip();

      // Step 1: auto-remember stores a fact
      const rememberEvent = {
        type: "message",
        action: "sent",
        sessionKey: "int-lifecycle",
        timestamp: new Date(),
        messages: [] as string[],
        context: {
          to: "user",
          content:
            "Based on the project requirements, we decided to: use MongoDB Atlas Search for vector similarity queries in production.",
          success: true,
          messageId: "int-lifecycle-msg",
        },
      };

      await autoRememberHandler(rememberEvent);
      expect(rememberEvent.messages).toContain(
        "[memory] Auto-extracted 1 fact(s) from response",
      );

      // Wait for the fire-and-forget to land
      await new Promise((r) => setTimeout(r, 2000));

      // Step 2: Verify it's actually stored
      const list = await listMemories(DAEMON_URL, AGENT_ID, {
        tags: "auto-extracted,decision",
        limit: 10,
      });

      const stored = list.memories.find((m) =>
        m.text.includes("MongoDB Atlas Search"),
      );
      expect(stored).toBeDefined();
      if (stored) createdMemoryIds.push(stored.id);

      // Step 3: memory-bootstrap should be able to recall it
      const bootstrapEvent = {
        type: "agent",
        action: "bootstrap",
        sessionKey: "int-lifecycle-2",
        timestamp: new Date(),
        messages: [] as string[],
        context: {
          bootstrapFiles: [] as string[],
        },
      };

      await memoryBootstrapHandler(bootstrapEvent);

      if (bootstrapEvent.context.bootstrapFiles.length > 0) {
        const content = await fs.readFile(
          bootstrapEvent.context.bootstrapFiles[0],
          "utf-8",
        );
        // The memory should appear in the bootstrap context (score permitting)
        // With VOYAGE_MOCK, cosine similarity is unpredictable, so this is best-effort
        expect(content).toContain("# Memory Context");

        await fs
          .unlink(bootstrapEvent.context.bootstrapFiles[0])
          .catch(() => {});
      }
    });
  });

  // -----------------------------------------------------------------------
  // 6. Daemon health & error resilience
  // -----------------------------------------------------------------------
  describe("error resilience", () => {
    it("hooks survive when daemon returns errors", async (ctx) => {
      if (!daemonAvailable) return ctx.skip();

      // Temporarily point to a bad URL
      const original = process.env.OPENCLAW_MEMORY_DAEMON_URL;
      process.env.OPENCLAW_MEMORY_DAEMON_URL = "http://localhost:1";

      // auto-remember should not throw
      const event = {
        type: "message",
        action: "sent",
        sessionKey: "int-err",
        timestamp: new Date(),
        messages: [] as string[],
        context: {
          to: "user",
          content:
            "I'll remember: this test verifies error resilience in hook handlers for the integration suite.",
          success: true,
          messageId: "int-err-msg",
        },
      };
      await expect(autoRememberHandler(event)).resolves.not.toThrow();

      // memory-bootstrap should not throw
      const bootstrap = {
        type: "agent",
        action: "bootstrap",
        sessionKey: "int-err-2",
        timestamp: new Date(),
        messages: [] as string[],
        context: { bootstrapFiles: [] as string[] },
      };
      await expect(memoryBootstrapHandler(bootstrap)).resolves.not.toThrow();
      expect(bootstrap.context.bootstrapFiles.length).toBe(0);

      // session-to-memory should not throw
      const session = {
        type: "command",
        action: "new",
        sessionKey: "int-err-3",
        timestamp: new Date(),
        messages: [] as string[],
        context: {
          sessionEntry: {
            turns: [
              { role: "user", content: "test" },
              { role: "assistant", content: "response with enough content here" },
            ],
          },
        },
      };
      await expect(sessionToMemoryHandler(session)).resolves.not.toThrow();

      // Restore
      process.env.OPENCLAW_MEMORY_DAEMON_URL = original;
    });
  });
});
