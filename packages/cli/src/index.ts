#!/usr/bin/env node

import { Command } from "commander";
import { initCommand } from "./commands/init";
import { startCommand } from "./commands/start";
import { statusCommand } from "./commands/status";
import { debugCommand } from "./commands/debug";
import { purgeCommand } from "./commands/purge";
import { exportCommand } from "./commands/export";
import { clearCommand } from "./commands/clear";
import pkg from "../package.json";

const DEFAULT_URL = process.env.MEMORY_DAEMON_URL || "http://localhost:7654";

const program = new Command();

program.name("ocmem").description("OpenClaw Memory daemon management CLI").version(pkg.version);

program
  .command("init")
  .description("Initialize OpenClaw Memory configuration")
  .option("--port <port>", "Daemon port (default: 7654)")
  .option("--mock", "Use mock embeddings (no Voyage API key needed)")
  .action(initCommand);

program
  .command("start")
  .description("Start the memory daemon")
  .option("--port <port>", "Override daemon port")
  .option("--foreground", "Run in foreground (don't detach)")
  .option("--web", "Also start the web dashboard")
  .action(startCommand);

program
  .command("status")
  .description("Check daemon status")
  .option("--url <url>", "Daemon URL", DEFAULT_URL)
  .option("--api-key <key>", "API key for daemon auth", process.env.MEMORY_API_KEY)
  .action(statusCommand);

program
  .command("debug")
  .description("Show detailed debug information")
  .option("--url <url>", "Daemon URL", DEFAULT_URL)
  .option("--api-key <key>", "API key for daemon auth", process.env.MEMORY_API_KEY)
  .option("--agent <id>", "Agent ID for agent-specific stats")
  .action(debugCommand);

program
  .command("purge")
  .description("Delete old memories (requires --agent and --older-than-days)")
  .option("--url <url>", "Daemon URL", DEFAULT_URL)
  .option("--api-key <key>", "API key for daemon auth", process.env.MEMORY_API_KEY)
  .option("--agent <id>", "Agent ID (required)")
  .option("--older-than-days <days>", "Delete memories older than N days", "7")
  .action((options) =>
    purgeCommand({
      ...options,
      olderThanDays: parseInt(options.olderThanDays, 10),
    }),
  );

program
  .command("export")
  .description("Export memories to JSON file")
  .option("--url <url>", "Daemon URL", DEFAULT_URL)
  .option("--api-key <key>", "API key for daemon auth", process.env.MEMORY_API_KEY)
  .option("--agent <id>", "Agent ID (required)")
  .option("--output <path>", "Output file path")
  .action(exportCommand);

program
  .command("clear")
  .description("Delete all memories for an agent (DANGEROUS)")
  .option("--url <url>", "Daemon URL", DEFAULT_URL)
  .option("--api-key <key>", "API key for daemon auth", process.env.MEMORY_API_KEY)
  .option("--agent <id>", "Agent ID (required)")
  .option("--force", "Skip confirmation prompt")
  .action(clearCommand);

program.parse();
