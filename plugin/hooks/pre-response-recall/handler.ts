/**
 * pre-response-recall hook
 *
 * Fires on message:received — analyzes incoming user messages for
 * questions about past work, decisions, or context, searches memory,
 * and injects relevant findings into the agent's working context.
 *
 * This enables automatic memory recall without requiring the agent
 * to manually call memory_search tools.
 */

import { promises as fs } from "fs";
import * as path from "path";
import * as os from "os";
import { getConfigFromEnv, recall, checkHealth } from "../../lib/daemon-client";

/** Maximum number of memories to inject per query */
const MAX_MEMORIES = 5;
/** Minimum relevance score to include a memory */
const MIN_SCORE = 0.6;
/** Timeout for recall operation in ms */
const RECALL_TIMEOUT_MS = 2000;

/** Patterns that indicate the user is asking about past context */
const PAST_CONTEXT_PATTERNS = [
  /what (did|have) (we|I|you)/i,
  /do you remember/i,
  /last time/i,
  /previously/i,
  /earlier/i,
  /before/i,
  /recent(ly)?/i,
  /status of/i,
  /progress (on|with)/i,
  /where (are|were) we/i,
  /what('s| is) the status/i,
  /remind me/i,
  /recall/i,
  /blocker/i,
  /issue/i,
];

interface MessageEvent {
  type: string;
  action: string;
  sessionKey: string;
  timestamp: Date;
  messages: string[];
  context: {
    message: string;
    from?: string;
    channelId?: string;
    conversationId?: string;
    bootstrapFiles?: string[];
    [key: string]: unknown;
  };
}

interface MemoryResult {
  id: string;
  text: string;
  score: number;
  tags: string[];
  createdAt: string;
}

/**
 * Check if message appears to be asking about past context
 */
function isPastContextQuery(message: string): boolean {
  return PAST_CONTEXT_PATTERNS.some((pattern) => pattern.test(message));
}

/**
 * Extract key terms from user message for memory search.
 * Removes common question words and focuses on content terms.
 */
function extractSearchTerms(message: string): string {
  // Remove question words and extract meaningful terms
  const cleanedMessage = message
    .replace(
      /\b(what|when|where|why|how|who|did|do|does|is|are|was|were|can|could|would|should)\b/gi,
      " ",
    )
    .replace(/[?!.,;:]/g, " ")
    .trim();

  // Take first 200 chars of cleaned message
  return cleanedMessage.slice(0, 200);
}

/**
 * Format memories into markdown for injection
 */
function formatMemories(memories: MemoryResult[]): string {
  if (memories.length === 0) return "";

  const lines: string[] = [
    "## Relevant Past Context\n",
    "_The following information was automatically recalled from memory:_\n",
  ];

  for (const mem of memories) {
    const score = Math.round(mem.score * 100);
    const date = mem.createdAt ? new Date(mem.createdAt).toLocaleDateString() : "";
    const tags = mem.tags.length > 0 ? ` [${mem.tags.slice(0, 3).join(", ")}]` : "";

    lines.push(`- **[${score}% match]** ${mem.text}${tags}${date ? ` _(${date})_` : ""}`);
  }

  return lines.join("\n") + "\n";
}

export default async function handler(event: MessageEvent) {
  try {
    // Check if hooks are disabled
    if (process.env.OPENCLAW_MEMORY_HOOKS_ENABLED === "false") return;

    // Only handle message:received
    if (event.type !== "message" || event.action !== "received") return;

    const message = event.context.message;
    if (!message || message.length < 10) return;

    // Quick check: does this look like a past-context query?
    if (!isPastContextQuery(message)) return;

    const config = getConfigFromEnv();
    const reqOpts = { apiKey: config.apiKey, projectId: config.projectId };

    // Quick health check — skip if daemon is down
    const healthy = await checkHealth(config.daemonUrl);
    if (!healthy) return;

    // Extract search terms and query memory
    const searchTerms = extractSearchTerms(message);

    const result = await Promise.race([
      recall(config.daemonUrl, config.agentId, searchTerms, MAX_MEMORIES, undefined, reqOpts),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), RECALL_TIMEOUT_MS),
      ),
    ]).catch(() => null);

    if (!result || !result.results) return;

    // Filter by score
    const relevantMemories = result.results.filter((mem) => mem.score >= MIN_SCORE);

    if (relevantMemories.length === 0) return;

    // Format as markdown
    const content = [
      "# Pre-Response Memory Recall\n",
      `**User asked:** "${message.slice(0, 100)}${message.length > 100 ? "..." : ""}"\n`,
      formatMemories(relevantMemories),
      "\n_Use this context when formulating your response._\n",
    ].join("\n");

    // Write to temp file
    const tmpDir = os.tmpdir();
    const filename = `openclaw-memory-preresponse-${Date.now()}.md`;
    const filePath = path.join(tmpDir, filename);

    await fs.writeFile(filePath, content, "utf-8");

    // Inject into bootstrap files (or context files if available)
    if (!event.context.bootstrapFiles) {
      event.context.bootstrapFiles = [];
    }
    event.context.bootstrapFiles.push(filePath);

    event.messages.push(`[memory] Auto-recalled ${relevantMemories.length} relevant memories`);
  } catch {
    // Hook failures must never propagate
  }
}
