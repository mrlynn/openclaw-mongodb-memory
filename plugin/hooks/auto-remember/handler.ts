/**
 * auto-remember hook
 *
 * Fires on message:sent — scans outbound agent messages for facts,
 * decisions, and preferences using heuristic regex patterns and
 * stores them as memories in MongoDB.
 */

import { getConfigFromEnv, remember } from "../../lib/daemon-client";

// --- Pattern Definitions ---

interface MemoryPattern {
  name: string;
  regex: RegExp;
  tags: string[];
  /** Named capture group to use as the memory text; otherwise full match */
  extractGroup?: string;
}

const PATTERNS: MemoryPattern[] = [
  {
    name: "explicit-remember",
    regex:
      /(?:I'll remember|I will remember|noted|recording)[:\s]+(?<text>.+)/gi,
    tags: ["auto-extracted", "noted"],
    extractGroup: "text",
  },
  {
    name: "preference",
    regex:
      /(?:preference|I prefer|you prefer|user prefers)[:\s]+(?<text>.+)/gi,
    tags: ["auto-extracted", "preference"],
    extractGroup: "text",
  },
  {
    name: "decision",
    regex:
      /(?:decision|we decided|decided to|the decision is)[:\s]+(?<text>.+)/gi,
    tags: ["auto-extracted", "decision"],
    extractGroup: "text",
  },
  {
    name: "save-request",
    regex:
      /(?:remember that|save this|don't forget|keep in mind)[:\s]+(?<text>.+)/gi,
    tags: ["auto-extracted", "user-requested"],
    extractGroup: "text",
  },
  {
    name: "key-value",
    // Match structured facts like "Preferred editor: VS Code" but not code or log lines.
    // Requires: uppercase start, colon separator, no code/log keywords.
    regex:
      /^(?!(?:const|let|var|import|export|function|class|return|if|else|for|while|switch|case|INFO|WARN|ERROR|DEBUG|TRACE)\b)(?<key>[A-Z][A-Za-z ]{2,30}):[ ]*(?<value>.{10,200})$/gm,
    tags: ["auto-extracted", "fact"],
  },
];

/** Minimum length for extracted text to be worth storing */
const MIN_TEXT_LENGTH = 10;
/** Maximum number of facts to extract from a single message */
const MAX_EXTRACTIONS = 5;

// --- Extraction Logic ---

function extractFacts(
  content: string,
): Array<{ text: string; tags: string[] }> {
  const facts: Array<{ text: string; tags: string[] }> = [];
  const seen = new Set<string>();

  for (const pattern of PATTERNS) {
    if (facts.length >= MAX_EXTRACTIONS) break;

    // Create a fresh regex instance for each execution
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    let match: RegExpExecArray | null;

    while (
      (match = regex.exec(content)) !== null &&
      facts.length < MAX_EXTRACTIONS
    ) {
      let text: string;

      if (
        pattern.name === "key-value" &&
        match.groups?.key &&
        match.groups?.value
      ) {
        text = `${match.groups.key.trim()}: ${match.groups.value.trim()}`;
      } else if (
        pattern.extractGroup &&
        match.groups?.[pattern.extractGroup]
      ) {
        text = match.groups[pattern.extractGroup].trim();
      } else {
        text = match[0].trim();
      }

      // Dedupe and length check
      const normalized = text.toLowerCase();
      if (text.length >= MIN_TEXT_LENGTH && !seen.has(normalized)) {
        seen.add(normalized);
        facts.push({ text, tags: [...pattern.tags] });
      }
    }
  }

  return facts;
}

// --- Hook Handler ---

export default async function handler(event: {
  type: string;
  action: string;
  sessionKey: string;
  timestamp: Date;
  messages: string[];
  context: {
    to: string;
    content: string;
    success: boolean;
    error?: string;
    channelId?: string;
    conversationId?: string;
    messageId?: string;
  };
}) {
  try {
    // Check if hooks are disabled
    if (process.env.OPENCLAW_MEMORY_HOOKS_ENABLED === "false") return;

    // Only process successful outbound messages
    if (event.type !== "message" || event.action !== "sent") return;
    if (!event.context.success || !event.context.content) return;

    const content = event.context.content;

    // Skip very short messages
    if (content.length < 50) return;

    const facts = extractFacts(content);
    if (facts.length === 0) return;

    const config = getConfigFromEnv();

    // Fire-and-forget: store each fact without blocking
    for (const fact of facts) {
      remember(
        config.daemonUrl,
        config.agentId,
        fact.text,
        fact.tags,
        {
          source: "auto-remember",
          sessionKey: event.sessionKey,
          messageId: event.context.messageId,
          extractedAt: new Date().toISOString(),
        },
        undefined,
        { apiKey: config.apiKey, projectId: config.projectId },
      ).catch(() => {
        // Silently ignore storage failures — hook must not block
      });
    }

    event.messages.push(
      `[memory] Auto-extracted ${facts.length} fact(s) from response`,
    );
  } catch {
    // Hook failures must never propagate
  }
}
