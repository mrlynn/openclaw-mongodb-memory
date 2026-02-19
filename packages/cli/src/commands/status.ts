import axios from "axios";
import chalk from "chalk";
import { getHeaders } from "../utils";

export async function statusCommand(options: { url: string; apiKey?: string }) {
  try {
    const response = await axios.get(`${options.url}/status`, {
      headers: getHeaders(options.apiKey),
    });

    console.log(chalk.green.bold("\n✓ Memory Daemon Status\n"));
    console.log(`  Daemon:   ${chalk.green(response.data.daemon)}`);
    console.log(`  MongoDB:  ${response.data.mongodb === "connected" ? chalk.green(response.data.mongodb) : chalk.red(response.data.mongodb)}`);
    console.log(`  Voyage:   ${response.data.voyage === "ready" ? chalk.green(response.data.voyage) : chalk.red(response.data.voyage)}`);
    console.log(`  Uptime:   ${Math.floor(response.data.uptime)}s`);
    console.log(`  Memories: ${response.data.stats.totalMemories}`);
    console.log();
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      console.error(chalk.red("✗ Unauthorized — provide --api-key or set MEMORY_API_KEY"));
    } else {
      console.error(chalk.red("✗ Failed to connect to daemon"));
      console.error(chalk.red(`  ${String(error)}`));
    }
    process.exit(1);
  }
}
