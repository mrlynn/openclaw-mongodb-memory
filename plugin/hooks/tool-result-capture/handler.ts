/**
 * tool-result-capture hook
 *
 * Fires on tool:after — captures significant tool executions (edits, execs,
 * searches) and stores summaries as memories for later recall.
 */

import { getConfigFromEnv, remember } from "../../lib/daemon-client";

const TRIVIAL_EXEC_COMMANDS = new Set(["ls", "pwd", "whoami", "date", "echo"]);

interface ToolEvent {
  type: string;
  action: string;
  sessionKey: string;
  timestamp: Date;
  messages: string[];
  context: {
    toolName: string;
    parameters: Record<string, unknown>;
    result?: {
      success: boolean;
      output?: string;
      error?: string;
    };
    duration?: number;
  };
}

function shouldCapture(event: ToolEvent): boolean {
  const { toolName, parameters, result } = event.context;

  // Skip if disabled
  if (process.env.OPENCLAW_MEMORY_HOOKS_ENABLED === "false") return false;

  // Skip if no result
  if (!result) return false;

  const threshold = process.env.CAPTURE_THRESHOLD || "significant";

  // "all" mode: capture everything
  if (threshold === "all") return true;

  // Skip trivial reads
  if (toolName === "read" && threshold !== "minimal") return false;

  // Always capture failures (for learning)
  if (!result.success) return true;

  // Capture edits/writes (code changes)
  if (toolName === "edit" || toolName === "write") return true;

  // Capture web operations (research)
  if (toolName === "web_search" || toolName === "web_fetch") return true;

  // Capture memory operations (meta-learning)
  if (toolName.startsWith("memory_")) return true;

  // Capture significant exec commands
  if (toolName === "exec") {
    const command = String(parameters.command || "")
      .trim()
      .split(" ")[0];
    // Skip trivial commands
    if (TRIVIAL_EXEC_COMMANDS.has(command)) return false;
    // Capture if output is long (>500 chars)
    if (result.output && String(result.output).length > 500) return true;
  }

  // "minimal" mode: only capture if threshold passed
  return false;
}

function buildMemoryText(event: ToolEvent): string {
  const { toolName, parameters, result } = event.context;
  const timestamp = new Date().toISOString();

  let text = `[${timestamp}] ${toolName}`;

  // Add key parameters
  if (toolName === "exec") {
    text += `: ${parameters.command}`;
  } else if (toolName === "edit") {
    text += `: ${parameters.file_path || parameters.path}`;
  } else if (toolName === "write") {
    text += `: ${parameters.file_path || parameters.path}`;
  } else if (toolName === "web_search") {
    text += `: ${parameters.query}`;
  }

  // Add result summary
  if (!result) {
    text += " → no result";
  } else if (result.success) {
    if (result.output) {
      const summary = String(result.output).slice(0, 200);
      text += ` → ${summary}${result.output.length > 200 ? "..." : ""}`;
    } else {
      text += " → success";
    }
  } else {
    text += ` → ERROR: ${result.error || "unknown"}`;
  }

  return text;
}

export default async function handler(event: ToolEvent) {
  try {
    if (event.type !== "tool" || event.action !== "after") return;
    if (!shouldCapture(event)) return;

    const config = getConfigFromEnv();
    const text = buildMemoryText(event);
    const tags = ["auto-captured", "tool-execution", event.context.toolName];

    // Add failure tag if tool failed
    if (!event.context.result?.success) {
      tags.push("failure");
    }

    // Fire-and-forget
    remember(
      config.daemonUrl,
      config.agentId,
      text,
      tags,
      {
        source: "tool-result-capture",
        sessionKey: event.sessionKey,
        toolName: event.context.toolName,
        capturedAt: new Date().toISOString(),
        duration: event.context.duration,
      },
      undefined,
      { apiKey: config.apiKey, projectId: config.projectId },
    ).catch(() => {
      // Silent fail — hook must not block
    });

    event.messages.push(`[memory] Captured ${event.context.toolName} execution`);
  } catch {
    // Hook failures must never propagate
  }
}
