/**
 * session-to-memory hook
 *
 * Fires on command:new — summarizes the ending session and stores it
 * as a searchable memory in MongoDB with Voyage AI embeddings.
 */

import { getConfigFromEnv, remember } from "../../lib/daemon-client";

interface SessionEntry {
  id?: string;
  key?: string;
  turns?: Array<{
    role: string;
    content: string;
    timestamp?: string;
  }>;
  messages?: Array<{
    role: string;
    content: string;
  }>;
  summary?: string;
  startedAt?: string;
  endedAt?: string;
}

/** Maximum characters of summary text to store */
const MAX_SUMMARY_LENGTH = 2000;
/** Minimum number of turns to bother summarizing */
const MIN_TURNS = 2;

function buildSummary(session: SessionEntry): string | null {
  // If the session already has a summary, use it directly
  if (session.summary && session.summary.length > 20) {
    return session.summary.slice(0, MAX_SUMMARY_LENGTH);
  }

  // Otherwise, build from conversation turns
  const turns = session.turns || session.messages || [];
  if (turns.length < MIN_TURNS) return null;

  const lines: string[] = [];
  lines.push(`Session summary (${turns.length} turns):`);

  if (session.startedAt) {
    lines.push(`Started: ${session.startedAt}`);
  }

  // Extract key user messages and assistant conclusions
  for (const turn of turns) {
    const content = turn.content?.trim();
    if (!content) continue;

    if (turn.role === "user") {
      // First line of user messages as topic indicators
      const firstLine = content.split("\n")[0].slice(0, 200);
      lines.push(`- User: ${firstLine}`);
    } else if (turn.role === "assistant") {
      // Last paragraph of assistant responses as conclusions
      const lastParagraph = content.split("\n\n").pop()?.trim();
      if (lastParagraph && lastParagraph.length > 20) {
        lines.push(`- Assistant: ${lastParagraph.slice(0, 200)}`);
      }
    }
  }

  const summary = lines.join("\n");
  if (summary.length < 50) return null;

  return summary.slice(0, MAX_SUMMARY_LENGTH);
}

export default async function handler(event: {
  type: string;
  action: string;
  sessionKey: string;
  timestamp: Date;
  messages: string[];
  context: {
    sessionEntry?: SessionEntry;
    sessionId?: string;
    workspaceDir?: string;
    cfg?: unknown;
  };
}) {
  try {
    // Check if hooks are disabled
    if (process.env.OPENCLAW_MEMORY_HOOKS_ENABLED === "false") return;

    // Only handle command:new
    if (event.type !== "command" || event.action !== "new") return;

    const session = event.context.sessionEntry;
    if (!session) return;

    const summary = buildSummary(session);
    if (!summary) return;

    const config = getConfigFromEnv();

    await remember(
      config.daemonUrl,
      config.agentId,
      summary,
      ["session-summary", "auto"],
      {
        source: "session-to-memory",
        sessionId: event.context.sessionId || session.id,
        sessionKey: event.sessionKey,
        turnCount: (session.turns || session.messages || []).length,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
      },
      undefined,
      { apiKey: config.apiKey, projectId: config.projectId },
    );

    event.messages.push("[memory] Previous session summary saved to memory");
  } catch {
    // Hook failures must never propagate
  }
}
