/**
 * memory-enriched-tools hook
 *
 * Fires on tool_result_persist — a synchronous transform that augments
 * tool results with relevant memory context before they are persisted
 * to the session transcript.
 *
 * Different handler contract than event hooks: receives payload, returns
 * modified payload or undefined (no change).
 */

import { getConfigFromEnv, recall } from "../../lib/daemon-client";

// --- Configuration ---

/** Tool names that trigger memory enrichment */
const ENRICHABLE_TOOLS = new Set([
  "Read",
  "Grep",
  "Glob",
  "Bash",
  "read_file",
  "search_files",
  "list_files",
]);

/** Minimum result text length to bother enriching */
const MIN_RESULT_LENGTH = 100;
/** Maximum number of related memories to append */
const MAX_MEMORIES = 3;
/** Minimum score for a memory to be considered related */
const MIN_SCORE = 0.5;
/** Maximum length of result text to use as recall query */
const MAX_QUERY_LENGTH = 500;
/** Timeout for the recall call in ms */
const RECALL_TIMEOUT_MS = 3000;

// --- Types ---

interface ToolResultPayload {
  toolName: string;
  toolCallId: string;
  result: {
    content: Array<{ type: string; text?: string }>;
  };
  [key: string]: unknown;
}

// --- Helpers ---

/**
 * Extract a meaningful search query from tool result text.
 * Filters out line-numbered output, box-drawing, and decorative lines
 * to get semantically useful content.
 */
function extractQuery(payload: ToolResultPayload): string | null {
  for (const block of payload.result.content) {
    if (
      block.type !== "text" ||
      !block.text ||
      block.text.length < MIN_RESULT_LENGTH
    )
      continue;

    const text = block.text;

    // Extract meaningful lines, filtering noise
    const meaningfulLines = text
      .split("\n")
      .filter((line) => {
        const trimmed = line.trim();
        return (
          trimmed.length > 10 &&
          !/^\d+[:\-|]/.test(trimmed) && // skip line-numbered output
          !/^[─═━┌┐└┘├┤┬┴┼\-=*#+>]+$/.test(trimmed) && // skip decorative lines
          !/^\s*[{}[\]();,]+\s*$/.test(trimmed) // skip brace-only lines
        );
      })
      .slice(0, 5) // First 5 meaningful lines
      .join(" ");

    if (meaningfulLines.length >= 20) {
      return meaningfulLines.slice(0, MAX_QUERY_LENGTH);
    }
  }
  return null;
}

/**
 * Race a promise against a timeout.
 */
function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

// --- Hook Handler ---

/**
 * Synchronous transform hook for tool_result_persist.
 * Returns modified payload, or undefined to leave it unchanged.
 */
export default async function handler(
  payload: ToolResultPayload,
): Promise<ToolResultPayload | undefined> {
  try {
    // Check if hooks are disabled
    if (process.env.OPENCLAW_MEMORY_HOOKS_ENABLED === "false")
      return undefined;

    // Check if this tool qualifies for enrichment
    if (!ENRICHABLE_TOOLS.has(payload.toolName)) return undefined;

    const query = extractQuery(payload);
    if (!query) return undefined;

    const config = getConfigFromEnv();

    // Recall with timeout to keep things fast
    const result = await withTimeout(
      recall(config.daemonUrl, config.agentId, query, MAX_MEMORIES, undefined, {
        apiKey: config.apiKey,
        projectId: config.projectId,
      }),
      RECALL_TIMEOUT_MS,
    );

    if (!result?.success || result.count === 0) return undefined;

    const relevant = result.results.filter(
      (r: { score: number }) => r.score >= MIN_SCORE,
    );
    if (relevant.length === 0) return undefined;

    // Build the enrichment text
    const lines = ["\n\n---\n**Related memories:**"];
    for (const mem of relevant) {
      const tagStr =
        mem.tags?.length > 0 ? ` [${mem.tags.join(", ")}]` : "";
      lines.push(`- ${mem.text}${tagStr}`);
    }
    const enrichment = lines.join("\n");

    // Deep clone to avoid mutating original payload
    const modified = structuredClone(payload);

    // Append to the last text content block
    for (let i = modified.result.content.length - 1; i >= 0; i--) {
      if (
        modified.result.content[i].type === "text" &&
        modified.result.content[i].text
      ) {
        modified.result.content[i].text += enrichment;
        return modified;
      }
    }

    return undefined;
  } catch {
    // On any error, return undefined (no modification)
    return undefined;
  }
}
