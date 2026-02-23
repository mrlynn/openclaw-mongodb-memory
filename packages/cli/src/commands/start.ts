import { spawn, execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import chalk from "chalk";
import axios from "axios";

function findProjectRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    const pkg = resolve(dir, "package.json");
    if (existsSync(pkg)) {
      try {
        const content = JSON.parse(readFileSync(pkg, "utf8"));
        if (content.name === "openclaw-memory" || content.name === "@openclaw-memory/daemon") {
          return dir;
        }
      } catch {
        // keep looking
      }
    }
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

function readEnvPort(root: string): number {
  const envLocal = resolve(root, ".env.local");
  const envFile = resolve(root, ".env");
  for (const file of [envLocal, envFile]) {
    if (existsSync(file)) {
      const content = readFileSync(file, "utf8");
      const match = content.match(/^MEMORY_DAEMON_PORT=(\d+)$/m);
      if (match) return parseInt(match[1], 10);
    }
  }
  return 7654;
}

async function waitForHealth(url: string, timeoutMs = 10000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await axios.get(`${url}/health`, { timeout: 2000 });
      if (res.status === 200) return true;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

export async function startCommand(options: {
  port?: string;
  foreground?: boolean;
  web?: boolean;
}) {
  const root = findProjectRoot();
  const envLocal = resolve(root, ".env.local");

  if (!existsSync(envLocal)) {
    console.log(chalk.yellow("\n  No .env.local found. Run `ocmem init` first.\n"));
    process.exit(1);
  }

  const port = options.port ? parseInt(options.port, 10) : readEnvPort(root);
  const url = `http://localhost:${port}`;

  // Check if already running
  try {
    const res = await axios.get(`${url}/health`, { timeout: 2000 });
    if (res.status === 200) {
      console.log(chalk.green(`\n  Daemon is already running on port ${port}\n`));
      return;
    }
  } catch {
    // Not running — good, we'll start it
  }

  console.log(chalk.bold("\n  OpenClaw Memory — Starting daemon\n"));

  if (options.web) {
    // Start both daemon + web via pnpm dev
    console.log(chalk.dim(`  Starting daemon (port ${port}) + web dashboard (port 3000)...\n`));
    const child = spawn("pnpm", ["dev"], {
      cwd: root,
      stdio: "inherit",
      env: { ...process.env },
    });
    child.on("error", (err) => {
      console.error(chalk.red(`  Failed to start: ${err.message}`));
      process.exit(1);
    });
    // In foreground mode (with --web), just let it run
    return;
  }

  if (options.foreground) {
    // Start daemon in foreground
    console.log(chalk.dim(`  Starting daemon on port ${port} (foreground)...\n`));

    const daemonDir = resolve(root, "packages/daemon");
    const child = spawn("pnpm", ["dev"], {
      cwd: existsSync(daemonDir) ? daemonDir : root,
      stdio: "inherit",
      env: { ...process.env },
    });

    child.on("error", (err) => {
      console.error(chalk.red(`  Failed to start: ${err.message}`));
      process.exit(1);
    });
    return;
  }

  // Default: start daemon in background
  console.log(chalk.dim(`  Starting daemon on port ${port}...`));

  const daemonDir = resolve(root, "packages/daemon");
  const cwd = existsSync(daemonDir) ? daemonDir : root;

  // Try node dist/server.js first (faster), fall back to pnpm dev
  const serverJs = resolve(daemonDir, "dist/server.js");
  let cmd: string;
  let args: string[];

  if (existsSync(serverJs)) {
    cmd = "node";
    args = [serverJs];
  } else {
    cmd = "pnpm";
    args = ["dev"];
  }

  // Load .env.local into the child's environment
  const childEnv = { ...process.env };
  if (existsSync(envLocal)) {
    const content = readFileSync(envLocal, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx);
        const val = trimmed.slice(eqIdx + 1);
        childEnv[key] = val;
      }
    }
  }

  const child = spawn(cmd, args, {
    cwd,
    stdio: "ignore",
    detached: true,
    env: childEnv,
  });

  child.unref();

  // Wait for health check
  const healthy = await waitForHealth(url);

  if (healthy) {
    console.log(chalk.green(`  Daemon running on ${url} (PID: ${child.pid})`));
    console.log(chalk.dim(`\n  Check status:  ocmem status`));
    console.log(chalk.dim(`  Stop daemon:   kill ${child.pid}\n`));
  } else {
    console.log(
      chalk.yellow(`  Daemon started (PID: ${child.pid}) but /health not responding yet.`),
    );
    console.log(chalk.dim(`  It may still be connecting to MongoDB. Check: ocmem status\n`));
  }
}
