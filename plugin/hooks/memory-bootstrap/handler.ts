/**
 * memory-bootstrap hook
 *
 * Fires on agent:bootstrap — queries the memory daemon for relevant
 * context and injects a formatted markdown file into bootstrapFiles
 * so the agent starts every session with relevant background knowledge.
 */

import { promises as fs } from "fs";
import * as path from "path";
import * as os from "os";
import { getConfigFromEnv, recall, checkHealth } from "../../lib/daemon-client";

/** Number of general-context memories to fetch */
const GENERAL_LIMIT = 5;
/** Number of pinned/important memories to fetch */
const PINNED_LIMIT = 3;
/** Minimum score to include a memory (lower than plugin default — bootstrap should be inclusive) */
const MIN_SCORE = 0.3;

interface MemoryResult {
  id: string;
  text: string;
  score: number;
  tags: string[];
  createdAt: string;
}

interface BootstrapEvent {
  type: string;
  action: string;
  sessionKey: string;
  timestamp: Date;
  messages: string[];
  context: {
    bootstrapFiles: string[];
    workspaceDir?: string;
    [key: string]: unknown;
  };
}

/**
 * Build a bootstrap query that incorporates workspace context if available.
 */
function buildBootstrapQuery(event: BootstrapEvent): string {
  const parts: string[] = [];

  if (event.context.workspaceDir) {
    const projectName = path.basename(event.context.workspaceDir);
    parts.push(`project "${projectName}" conventions and decisions`);
  }

  parts.push("user preferences, recent decisions, important context");

  return parts.join(", ");
}

function formatMemories(
  memories: MemoryResult[],
  sectionTitle: string,
): string {
  if (memories.length === 0) return "";

  const lines: string[] = [`## ${sectionTitle}\n`];

  for (const mem of memories) {
    const tagStr = mem.tags.length > 0 ? ` [${mem.tags.join(", ")}]` : "";
    const date = mem.createdAt
      ? new Date(mem.createdAt).toLocaleDateString()
      : "";
    lines.push(`- ${mem.text}${tagStr}${date ? ` (${date})` : ""}`);
  }

  return lines.join("\n") + "\n";
}

export default async function handler(event: BootstrapEvent) {
  try {
    // Check if hooks are disabled
    if (process.env.OPENCLAW_MEMORY_HOOKS_ENABLED === "false") return;

    // Only handle agent:bootstrap
    if (event.type !== "agent" || event.action !== "bootstrap") return;

    const config = getConfigFromEnv();
    const reqOpts = { apiKey: config.apiKey, projectId: config.projectId };

    // Quick health check — skip if daemon is down to avoid slow bootstrap
    const healthy = await checkHealth(config.daemonUrl);
    if (!healthy) return;

    const generalQuery = buildBootstrapQuery(event);

    // Two parallel queries: general context + pinned memories
    const [generalResult, pinnedResult] = await Promise.all([
      recall(
        config.daemonUrl,
        config.agentId,
        generalQuery,
        GENERAL_LIMIT,
        undefined,
        reqOpts,
      ).catch(() => null),
      recall(
        config.daemonUrl,
        config.agentId,
        "important pinned information",
        PINNED_LIMIT,
        "pinned,important",
        reqOpts,
      ).catch(() => null),
    ]);

    const generalMemories = (generalResult?.results || []).filter(
      (r: MemoryResult) => r.score >= MIN_SCORE,
    );
    const pinnedMemories = (pinnedResult?.results || []).filter(
      (r: MemoryResult) => r.score >= MIN_SCORE,
    );

    // Deduplicate by memory ID
    const seenIds = new Set<string>();
    const pinned: MemoryResult[] = [];
    const general: MemoryResult[] = [];

    for (const mem of pinnedMemories) {
      if (!seenIds.has(mem.id)) {
        seenIds.add(mem.id);
        pinned.push(mem);
      }
    }
    for (const mem of generalMemories) {
      if (!seenIds.has(mem.id)) {
        seenIds.add(mem.id);
        general.push(mem);
      }
    }

    const totalCount = pinned.length + general.length;
    if (totalCount === 0) return;

    // Build markdown content
    const sections: string[] = [
      "# Memory Context\n",
      "The following information was recalled from long-term memory.\n",
    ];

    if (pinned.length > 0) {
      sections.push(formatMemories(pinned, "Pinned / Important"));
    }
    if (general.length > 0) {
      sections.push(formatMemories(general, "Recent Context"));
    }

    const content = sections.join("\n");

    // Write to temp file
    const tmpDir = os.tmpdir();
    const filename = `openclaw-memory-context-${Date.now()}.md`;
    const filePath = path.join(tmpDir, filename);

    await fs.writeFile(filePath, content, "utf-8");

    // Inject into bootstrap files
    event.context.bootstrapFiles.push(filePath);

    event.messages.push(
      `[memory] Injected ${totalCount} memories into agent context`,
    );
  } catch {
    // Hook failures must never propagate
  }
}
