import { spawn } from "child_process";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import chalk from "chalk";
import axios from "axios";
import { findProjectRoot, readEnvPort } from "../resolve";

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

  if (!root) {
    console.log(chalk.red("\n  Could not find openclaw-memory project."));
    console.log(chalk.dim("  Run `ocmem init` from the project directory first, or:"));
    console.log(chalk.dim("    git clone https://github.com/mrlynn/openclaw-mongodb-memory.git"));
    console.log(chalk.dim("    cd openclaw-mongodb-memory && pnpm install && pnpm build"));
    console.log(chalk.dim("    ocmem init\n"));
    process.exit(1);
  }

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
    // Check if @openclaw-memory/web package exists
    const webDir = resolve(root, "packages/web");
    const webPackageJson = resolve(webDir, "package.json");

    if (!existsSync(webPackageJson)) {
      console.log(chalk.yellow("⚠ Web dashboard package not found"));
      console.log(chalk.dim("  The @openclaw-memory/web package is not installed."));
      console.log(chalk.dim("  Starting daemon only...\n"));
      // Fall through to start daemon normally
    } else {
      // Start both daemon + web
      console.log(chalk.dim(`  Starting daemon (port ${port}) + web dashboard (port 3002)...\n`));

      // Start daemon first
      const daemonDir = resolve(root, "packages/daemon");
      const daemonChild = spawn("pnpm", ["dev"], {
        cwd: existsSync(daemonDir) ? daemonDir : root,
        stdio: "pipe",
        env: { ...process.env },
      });

      daemonChild.stdout?.on("data", (data) => {
        process.stdout.write(chalk.dim("[daemon] ") + data.toString());
      });
      daemonChild.stderr?.on("data", (data) => {
        process.stderr.write(chalk.yellow("[daemon] ") + data.toString());
      });

      // Wait a bit for daemon to start
      await new Promise((r) => setTimeout(r, 2000));

      // Check daemon health
      const daemonHealthy = await waitForHealth(url, 5000);
      if (!daemonHealthy) {
        console.log(chalk.yellow("⚠ Daemon slow to start, continuing anyway..."));
      }

      // Start web dashboard
      const webChild = spawn("pnpm", ["dev"], {
        cwd: webDir,
        stdio: "pipe",
        env: { ...process.env, PORT: "3002" },
      });

      webChild.stdout?.on("data", (data) => {
        process.stdout.write(chalk.dim("[web] ") + data.toString());
      });
      webChild.stderr?.on("data", (data) => {
        process.stderr.write(chalk.cyan("[web] ") + data.toString());
      });

      console.log(chalk.green("\n✓ Daemon and web dashboard starting..."));
      console.log(chalk.dim(`  Daemon:    ${url}`));
      console.log(chalk.dim(`  Dashboard: http://localhost:3002`));
      console.log(chalk.dim(`\n  Press Ctrl+C to stop both services\n`));

      // Keep running in foreground
      process.on("SIGINT", () => {
        console.log(chalk.dim("\n\nStopping services..."));
        daemonChild.kill();
        webChild.kill();
        process.exit(0);
      });

      return;
    }
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
