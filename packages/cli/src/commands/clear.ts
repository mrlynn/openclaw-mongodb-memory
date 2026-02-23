import axios from "axios";
import chalk from "chalk";
import * as readline from "readline";
import { getHeaders } from "../utils";

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase());
    });
  });
}

export async function clearCommand(
  options: { url: string; apiKey?: string; agent: string; force?: boolean }
) {
  try {
    if (!options.agent) {
      console.error(chalk.red("✗ --agent is required"));
      process.exit(1);
    }

    if (!options.force) {
      console.log(
        chalk.yellow(
          `⚠️  This will delete ALL memories for agent "${options.agent}". This cannot be undone.`
        )
      );
      const answer = await prompt("Are you sure? (type 'yes' to confirm): ");

      if (answer !== "yes") {
        console.log(chalk.gray("Cancelled."));
        return;
      }
    }

    console.log(chalk.yellow(`⏳ Clearing all memories for agent "${options.agent}"...`));

    const response = await axios.delete(`${options.url}/clear`, {
      params: { agentId: options.agent },
      headers: getHeaders(options.apiKey),
    });

    console.log(chalk.green(`✓ Cleared ${response.data.deleted} memories`));
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      console.error(chalk.red("✗ Unauthorized — provide --api-key or set MEMORY_API_KEY"));
    } else {
      console.error(chalk.red("✗ Failed to clear memories"));
      console.error(chalk.red(`  ${String(error)}`));
    }
    process.exit(1);
  }
}
