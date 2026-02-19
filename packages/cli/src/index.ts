#!/usr/bin/env node

import { Command } from "commander";
import { statusCommand } from "./commands/status";
import { statsCommand } from "./commands/stats";

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

program.parse();
