import axios from "axios";
import chalk from "chalk";

export async function statusCommand(options: { url: string }) {
  try {
    const response = await axios.get(`${options.url}/status`);
    
    console.log(chalk.green.bold("\n✓ Memory Daemon Status\n"));
    console.log(`  Daemon:   ${chalk.green(response.data.daemon)}`);
    console.log(`  MongoDB:  ${chalk.green(response.data.mongodb)}`);
    console.log(`  Voyage:   ${chalk.green(response.data.voyage)}`);
    console.log(`  Uptime:   ${Math.floor(response.data.uptime)}s`);
    console.log();
  } catch (error) {
    console.error(chalk.red("✗ Failed to connect to daemon"));
    console.error(chalk.red(`  ${String(error)}`));
    process.exit(1);
  }
}
