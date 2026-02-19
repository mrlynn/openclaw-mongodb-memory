#!/usr/bin/env node

import { Command } from "commander";
import { statusCommand } from "./commands/status";
import { statsCommand } from "./commands/stats";
import { debugCommand } from "./commands/debug";
import { purgeCommand } from "./commands/purge";
import { exportCommand } from "./commands/export";
import { clearCommand } from "./commands/clear";

const program = new Command();

program
  .name("ocmem")
  .description("OpenClaw Memory daemon management CLI")
  .version("0.1.0");

program
  .command("status")
  .description("Check daemon status")
  .option("--url <url>", "Daemon URL", "http://localhost:7654")
  .action(statusCommand);

program
  .command("stats")
  .description("Show memory statistics")
  .option("--url <url>", "Daemon URL", "http://localhost:7654")
  .action(statsCommand);

program
  .command("debug")
  .description("Show detailed debug information")
  .option("--url <url>", "Daemon URL", "http://localhost:7654")
  .option("--agent <id>", "Agent ID for agent-specific stats")
  .action(debugCommand);

program
  .command("purge")
  .description("Delete old memories (requires --agent and --older-than-days)")
  .option("--url <url>", "Daemon URL", "http://localhost:7654")
  .option("--agent <id>", "Agent ID (required)")
  .option("--older-than-days <days>", "Delete memories older than N days", "7")
  .action((options) => purgeCommand({
    ...options,
    olderThanDays: parseInt(options.olderThanDays, 10),
  }));

program
  .command("export")
  .description("Export memories to JSON file")
  .option("--url <url>", "Daemon URL", "http://localhost:7654")
  .option("--agent <id>", "Agent ID (required)")
  .option("--output <path>", "Output file path")
  .action(exportCommand);

program
  .command("clear")
  .description("Delete all memories for an agent (DANGEROUS)")
  .option("--url <url>", "Daemon URL", "http://localhost:7654")
  .option("--agent <id>", "Agent ID (required)")
  .option("--force", "Skip confirmation prompt")
  .action(clearCommand);

program.parse();
