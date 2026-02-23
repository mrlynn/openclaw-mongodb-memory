import axios from "axios";
import chalk from "chalk";
import { getHeaders } from "../utils";

export async function debugCommand(options: { url: string; apiKey?: string; agent?: string }) {
  try {
    console.log(chalk.cyan("\n📋 Memory Daemon Debug Info\n"));

    const statusResponse = await axios.get(`${options.url}/status`, {
      headers: getHeaders(options.apiKey),
    });

    console.log(chalk.bold("Status:"));
    console.log(`  Daemon: ${statusResponse.data.daemon}`);
    console.log(`  MongoDB: ${statusResponse.data.mongodb}`);
    console.log(`  Voyage: ${statusResponse.data.voyage}`);
    console.log(`  Uptime: ${Math.floor(statusResponse.data.uptime)}s`);
    console.log(`  Heap: ${statusResponse.data.memory.heapUsed}MB / ${statusResponse.data.memory.heapTotal}MB`);
    console.log(`  Total memories: ${statusResponse.data.stats.totalMemories}`);

    if (options.agent) {
      console.log(chalk.bold(`\nAgent "${options.agent}":`));
      try {
        const exportResponse = await axios.get(`${options.url}/export`, {
          params: { agentId: options.agent },
          headers: getHeaders(options.apiKey),
        });
        console.log(`  Memories: ${exportResponse.data.count}`);
      } catch {
        console.log(`  (Could not retrieve agent stats)`);
      }
    }

    console.log();
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      console.error(chalk.red("✗ Unauthorized — provide --api-key or set MEMORY_API_KEY"));
    } else {
      console.error(chalk.red("✗ Failed to get debug info"));
      console.error(chalk.red(`  ${String(error)}`));
    }
    process.exit(1);
  }
}
