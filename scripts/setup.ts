#!/usr/bin/env tsx
/**
 * Interactive setup script for openclaw-memory.
 *
 * Usage:  pnpm setup
 * What it does:
 *   1. Checks prerequisites (Node 18+, pnpm 8+)
 *   2. Runs pnpm install
 *   3. Generates .env.local interactively (if missing)
 *   4. Runs pnpm build
 *   5. Validates database connection
 *   6. Smoke-tests the daemon (/health endpoint)
 *   7. Prints a summary
 */

import { createInterface } from "readline";
import { execSync, spawn, ChildProcess } from "child_process";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(__dirname, "..");
const ENV_LOCAL = resolve(ROOT, ".env.local");
const ENV_EXAMPLE = resolve(ROOT, ".env.example");

// ── Helpers ──────────────────────────────────────────────────

function run(cmd: string, label: string): void {
  console.log(`\n  ${label}...`);
  try {
    execSync(cmd, { cwd: ROOT, stdio: "inherit" });
  } catch {
    console.error(`  FAILED: ${cmd}`);
    process.exit(1);
  }
}

function getVersion(cmd: string): string | null {
  try {
    return execSync(cmd, { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

function semverMajor(version: string): number {
  const match = version.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

async function ask(question: string, defaultValue?: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const suffix = defaultValue ? ` [${defaultValue}]` : "";
  return new Promise((resolve) => {
    rl.question(`  ${question}${suffix}: `, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue || "");
    });
  });
}

async function waitForHealth(port: number, timeoutMs = 8000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://localhost:${port}/health`);
      if (res.ok) return true;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

// ── Steps ────────────────────────────────────────────────────

function checkPrerequisites(): void {
  console.log("\n  1/6  Checking prerequisites");

  const nodeV = getVersion("node --version");
  if (!nodeV || semverMajor(nodeV.replace("v", "")) < 18) {
    console.error(`  Node.js 18+ required (found: ${nodeV || "none"})`);
    process.exit(1);
  }
  console.log(`       Node.js ${nodeV}`);

  const pnpmV = getVersion("pnpm --version");
  if (!pnpmV || semverMajor(pnpmV) < 8) {
    console.error(`  pnpm 8+ required (found: ${pnpmV || "none"})`);
    console.error("  Install: npm install -g pnpm");
    process.exit(1);
  }
  console.log(`       pnpm ${pnpmV}`);
}

function installDeps(): void {
  console.log("\n  2/6  Installing dependencies");
  run("pnpm install", "pnpm install");
}

async function generateEnv(): Promise<void> {
  console.log("\n  3/6  Environment configuration");

  if (existsSync(ENV_LOCAL)) {
    console.log(`       .env.local already exists — skipping`);
    return;
  }

  console.log("       No .env.local found. Let's create one.\n");

  const mongoUri = await ask("MongoDB URI", "mongodb://localhost:27017");
  const voyageKey = await ask("Voyage API key (leave blank for mock mode)");
  const useMock = !voyageKey;
  const port = await ask("Daemon port", "7654");
  const memoryFilePath = await ask(
    "Memory file path (leave blank to skip)",
    "~/.openclaw/workspace/MEMORY.md",
  );

  // Read the example as a template, then fill in values
  let content = readFileSync(ENV_EXAMPLE, "utf8");
  content = content.replace(/^MONGODB_URI=.*$/m, `MONGODB_URI=${mongoUri}`);
  content = content.replace(/^VOYAGE_API_KEY=.*$/m, `VOYAGE_API_KEY=${voyageKey}`);
  content = content.replace(/^VOYAGE_MOCK=.*$/m, `VOYAGE_MOCK=${useMock}`);

  if (port !== "7654") {
    content = content.replace(/^# MEMORY_DAEMON_PORT=.*$/m, `MEMORY_DAEMON_PORT=${port}`);
  }

  // Auto-derive web dashboard URL from port
  content = content.replace(
    /^NEXT_PUBLIC_DAEMON_URL=.*$/m,
    `NEXT_PUBLIC_DAEMON_URL=http://localhost:${port}`,
  );

  // Set memory file path if provided
  if (memoryFilePath) {
    content = content.replace(/^# MEMORY_FILE_PATH=.*$/m, `MEMORY_FILE_PATH=${memoryFilePath}`);
  }

  writeFileSync(ENV_LOCAL, content, "utf8");
  console.log(`\n       Wrote ${ENV_LOCAL}`);
}

function buildAll(): void {
  console.log("\n  4/6  Building all packages");
  run("pnpm build", "pnpm build");
}

async function validateDatabase(): Promise<void> {
  console.log("\n  5/6  Validating database connection");

  // Read MONGODB_URI from .env.local
  let mongoUri = "mongodb://localhost:27017";
  if (existsSync(ENV_LOCAL)) {
    const envContent = readFileSync(ENV_LOCAL, "utf8");
    const match = envContent.match(/^MONGODB_URI=(.+)$/m);
    if (match) mongoUri = match[1].trim();
  }

  try {
    // Use a quick Node script to test the connection
    execSync(
      `node -e "
        const { MongoClient } = require('mongodb');
        const c = new MongoClient('${mongoUri}', { serverSelectionTimeoutMS: 5000 });
        c.connect().then(() => c.db().command({ ping: 1 })).then(() => { console.log('  OK'); c.close(); }).catch(e => { console.error('  FAIL:', e.message); process.exit(1); });
      "`,
      { cwd: ROOT, stdio: "inherit" },
    );
    console.log("       MongoDB connection validated");
  } catch {
    console.log("       MongoDB not reachable (you can start it later)");
  }
}

async function smokeTest(): Promise<void> {
  console.log("\n  6/6  Smoke test (daemon /health)");

  // Read port from .env.local
  let port = 7654;
  if (existsSync(ENV_LOCAL)) {
    const envContent = readFileSync(ENV_LOCAL, "utf8");
    const match = envContent.match(/^MEMORY_DAEMON_PORT=(\d+)$/m);
    if (match) port = parseInt(match[1], 10);
  }

  // Start daemon in background
  let daemon: ChildProcess | null = null;
  try {
    daemon = spawn("pnpm", ["dev:daemon"], {
      cwd: ROOT,
      stdio: "pipe",
      detached: false,
    });

    const healthy = await waitForHealth(port);
    if (healthy) {
      console.log(`       Daemon responded OK on port ${port}`);
    } else {
      console.log(`       Daemon did not respond in time (port ${port})`);
      console.log("       This may be OK if MongoDB isn't running yet.");
    }
  } catch {
    console.log("       Could not start daemon for smoke test");
  } finally {
    if (daemon && !daemon.killed) {
      daemon.kill("SIGTERM");
    }
  }
}

function printSummary(): void {
  let port = 7654;
  if (existsSync(ENV_LOCAL)) {
    const envContent = readFileSync(ENV_LOCAL, "utf8");
    const match = envContent.match(/^MEMORY_DAEMON_PORT=(\d+)$/m);
    if (match) port = parseInt(match[1], 10);
  }

  console.log(`
  ────────────────────────────────────────────
  Setup complete!

  Start developing:
    pnpm dev           → daemon + web (concurrent)
    pnpm dev:daemon    → daemon only (port ${port})
    pnpm dev:web       → web dashboard (port 3000)

  Other commands:
    pnpm build         → build all packages
    pnpm test          → run all tests
    pnpm typecheck     → type-check all packages

  Daemon:  http://localhost:${port}
  Web UI:  http://localhost:3000
  ────────────────────────────────────────────
`);
}

// ── Main ─────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("\n  OpenClaw Memory — Setup\n");

  checkPrerequisites();
  installDeps();
  await generateEnv();
  buildAll();
  await validateDatabase();
  await smokeTest();
  printSummary();
}

main().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
