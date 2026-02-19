import axios from "axios";
import chalk from "chalk";

export async function debugCommand(options: { url: string; agent?: string }) {
  try {
    console.log(chalk.cyan("\n📋 Memory Daemon Debug Info\n"));

    // Status
    const statusResponse = await axios.get(`${options.url}/status`);
    console.log(chalk.bold("Status:"));
    console.log(`  Daemon: ${statusResponse.data.daemon}`);
    console.log(`  MongoDB: ${statusResponse.data.mongodb}`);
    console.log(`  Voyage: ${statusResponse.data.voyage}`);
    console.log(`  Uptime: ${Math.floor(statusResponse.data.uptime)}s`);
    console.log(`  Heap: ${statusResponse.data.memory.heapUsed}MB / ${statusResponse.data.memory.heapTotal}MB`);
    console.log(`  Total memories: ${statusResponse.data.stats.totalMemories}`);

    if (options.agent) {
      console.log(chalk.bold("\nAgent-specific stats:"));
      console.log(`  Agent ID: ${options.agent}`);
      // Note: Would need /debug/:agentId endpoint for agent-specific stats
      console.log(`  (Detailed agent stats endpoint not yet implemented)`);
    }

    console.log();
  } catch (error) {
    console.error(chalk.red("✗ Failed to get debug info"));
    console.error(chalk.red(`  ${String(error)}`));
    process.exit(1);
  }
}
