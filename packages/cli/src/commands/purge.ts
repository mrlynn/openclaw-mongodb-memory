import axios from "axios";
import chalk from "chalk";
import { getHeaders } from "../utils";

export async function purgeCommand(
  options: { url: string; apiKey?: string; agent?: string; olderThanDays?: number }
) {
  try {
    if (!options.agent) {
      console.error(chalk.red("✗ --agent is required"));
      process.exit(1);
    }

    const days = options.olderThanDays || 7;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    console.log(chalk.yellow(`⏳ Purging memories for agent "${options.agent}" older than ${days} days...`));

    const response = await axios.post(`${options.url}/purge`, {
      agentId: options.agent,
      olderThan: cutoffDate.toISOString(),
    }, {
      headers: getHeaders(options.apiKey),
    });

    console.log(chalk.green(`✓ Purged ${response.data.deleted} memories`));
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      console.error(chalk.red("✗ Unauthorized — provide --api-key or set MEMORY_API_KEY"));
    } else {
      console.error(chalk.red("✗ Failed to purge memories"));
      console.error(chalk.red(`  ${String(error)}`));
    }
    process.exit(1);
  }
}
