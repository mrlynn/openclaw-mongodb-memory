import axios from "axios";
import chalk from "chalk";
import * as fs from "fs";

export async function exportCommand(
  options: { url: string; agent: string; output?: string }
) {
  try {
    if (!options.agent) {
      console.error(chalk.red("✗ --agent is required"));
      process.exit(1);
    }

    console.log(chalk.yellow(`⏳ Exporting memories for agent "${options.agent}"...`));

    // Note: This would require an /export endpoint on the daemon
    // For now, showing the command structure
    const response = await axios.get(`${options.url}/export`, {
      params: { agentId: options.agent },
    });

    const outputPath = options.output || `export-${options.agent}-${Date.now()}.json`;
    fs.writeFileSync(outputPath, JSON.stringify(response.data, null, 2));

    console.log(chalk.green(`✓ Exported to ${outputPath}`));
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      console.error(chalk.red("✗ Export endpoint not yet implemented on daemon"));
    } else {
      console.error(chalk.red("✗ Failed to export memories"));
      console.error(chalk.red(`  ${String(error)}`));
    }
    process.exit(1);
  }
}
