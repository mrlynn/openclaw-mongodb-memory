import axios from "axios";
import chalk from "chalk";

export async function purgeCommand(
  options: { url: string; agent?: string; olderThanDays?: number }
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

    // Note: This would require a /purge endpoint on the daemon
    // For now, showing the command structure
    const response = await axios.post(`${options.url}/purge`, {
      agentId: options.agent,
      olderThan: cutoffDate.toISOString(),
    });

    console.log(chalk.green(`✓ Purged ${response.data.deleted} memories`));
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      console.error(chalk.red("✗ Purge endpoint not yet implemented on daemon"));
    } else {
      console.error(chalk.red("✗ Failed to purge memories"));
      console.error(chalk.red(`  ${String(error)}`));
    }
    process.exit(1);
  }
}
