import axios from "axios";
import chalk from "chalk";
import * as fs from "fs";
import { getHeaders } from "../utils";

export async function exportCommand(
  options: { url: string; apiKey?: string; agent: string; output?: string }
) {
  try {
    if (!options.agent) {
      console.error(chalk.red("✗ --agent is required"));
      process.exit(1);
    }

    console.log(chalk.yellow(`⏳ Exporting memories for agent "${options.agent}"...`));

    const response = await axios.get(`${options.url}/export`, {
      params: { agentId: options.agent },
      headers: getHeaders(options.apiKey),
    });

    const outputPath = options.output || `export-${options.agent}-${Date.now()}.json`;
    fs.writeFileSync(outputPath, JSON.stringify(response.data, null, 2));

    console.log(chalk.green(`✓ Exported ${response.data.count} memories to ${outputPath}`));
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      console.error(chalk.red("✗ Unauthorized — provide --api-key or set MEMORY_API_KEY"));
    } else {
      console.error(chalk.red("✗ Failed to export memories"));
      console.error(chalk.red(`  ${String(error)}`));
    }
    process.exit(1);
  }
}
