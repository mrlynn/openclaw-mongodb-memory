import axios from "axios";
import chalk from "chalk";

export async function statsCommand(options: { url: string }) {
  try {
    // TODO: Implement stats endpoint
    console.log(chalk.yellow("Stats command not yet implemented"));
  } catch (error) {
    console.error(chalk.red("✗ Failed to fetch stats"));
    console.error(chalk.red(`  ${String(error)}`));
    process.exit(1);
  }
}
