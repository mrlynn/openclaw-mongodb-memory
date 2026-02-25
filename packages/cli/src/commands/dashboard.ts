import { exec } from "child_process";
import { promisify } from "util";
import axios from "axios";
import chalk from "chalk";

const execAsync = promisify(exec);

interface DashboardOptions {
  url?: string;
  port?: string;
  open?: boolean;
}

export async function dashboardCommand(options: DashboardOptions): Promise<void> {
  const port = options.port || process.env.WEB_PORT || process.env.PORT || "3002";
  const webUrl = options.url || `http://localhost:${port}`;

  console.log(chalk.blue("🌐 OpenClaw Memory Dashboard"));
  console.log();

  // Check if web server is running
  try {
    await axios.get(webUrl, { timeout: 2000 });
    console.log(chalk.green("✓") + ` Dashboard is running at ${chalk.cyan(webUrl)}`);
  } catch (error) {
    console.log(chalk.yellow("⚠") + ` Dashboard not responding at ${chalk.cyan(webUrl)}`);
    console.log();
    console.log(chalk.dim("To start the web dashboard:"));
    console.log(chalk.dim("  cd packages/web && npm run dev"));
    console.log(chalk.dim("  OR"));
    console.log(chalk.dim("  ocmem start --web"));
    console.log();

    if (options.open !== false) {
      console.log(chalk.yellow("Opening browser anyway (server may start shortly)..."));
    } else {
      process.exit(1);
    }
  }

  // Open browser (skip if --no-open)
  if (options.open !== false) {
    try {
      await openBrowser(webUrl);
      console.log(chalk.green("✓") + " Opened in browser");
    } catch (error) {
      console.log(chalk.yellow("⚠") + " Could not open browser automatically");
      console.log(chalk.dim(`  Open manually: ${webUrl}`));
    }
  }

  console.log();
  console.log(chalk.dim("Available pages:"));
  console.log(chalk.dim(`  ${webUrl}/`).padEnd(50) + chalk.dim("Dashboard overview"));
  console.log(chalk.dim(`  ${webUrl}/memories`).padEnd(50) + chalk.dim("Memory browser"));
  console.log(chalk.dim(`  ${webUrl}/graph`).padEnd(50) + chalk.dim("Graph visualizer"));
  console.log(chalk.dim(`  ${webUrl}/conflicts`).padEnd(50) + chalk.dim("Conflict resolution"));
  console.log(chalk.dim(`  ${webUrl}/expiration`).padEnd(50) + chalk.dim("Expiration queue"));
  console.log(chalk.dim(`  ${webUrl}/operations`).padEnd(50) + chalk.dim("Operations & settings"));
  console.log();
}

async function openBrowser(url: string): Promise<void> {
  const platform = process.platform;
  let command: string;

  switch (platform) {
    case "darwin": // macOS
      command = `open "${url}"`;
      break;
    case "win32": // Windows
      command = `start "${url}"`;
      break;
    default: // Linux, etc.
      command = `xdg-open "${url}" || sensible-browser "${url}" || x-www-browser "${url}"`;
      break;
  }

  await execAsync(command);
}
