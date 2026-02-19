import axios from "axios";
import chalk from "chalk";
import * as readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.toLowerCase());
    });
  });
}

export async function clearCommand(options: { url: string; agent: string; force?: boolean }) {
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
        rl.close();
        return;
      }
    }

    console.log(chalk.yellow(`⏳ Clearing all memories for agent "${options.agent}"...`));

    // Note: This would require a /clear endpoint on the daemon
    const response = await axios.delete(`${options.url}/clear`, {
      params: { agentId: options.agent },
    });

    console.log(chalk.green(`✓ Cleared ${response.data.deleted} memories`));
    rl.close();
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      console.error(chalk.red("✗ Clear endpoint not yet implemented on daemon"));
    } else {
      console.error(chalk.red("✗ Failed to clear memories"));
      console.error(chalk.red(`  ${String(error)}`));
    }
    rl.close();
    process.exit(1);
  }
}
