import axios from "axios";
import chalk from "chalk";
import { getHeaders } from "../utils";

interface SearchResult {
  id: string;
  text: string;
  score: number;
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
}

export async function searchCommand(options: {
  url: string;
  apiKey?: string;
  agent: string;
  query: string;
  limit?: string;
  tags?: string;
  json?: boolean;
}) {
  try {
    if (!options.agent) {
      console.error(chalk.red("✗ --agent is required"));
      process.exit(1);
    }

    if (!options.query) {
      console.error(chalk.red("✗ A search query is required"));
      console.error(chalk.gray('  Usage: ocmem search "your query" --agent <id>'));
      process.exit(1);
    }

    const limit = options.limit ? parseInt(options.limit, 10) : 10;

    const response = await axios.get(`${options.url}/recall`, {
      params: {
        agentId: options.agent,
        query: options.query,
        limit,
        tags: options.tags,
      },
      headers: getHeaders(options.apiKey),
    });

    const results: SearchResult[] = response.data.results;
    const method: string = response.data.method;

    // JSON output mode — raw data to stdout for piping
    if (options.json) {
      console.log(JSON.stringify(response.data, null, 2));
      return;
    }

    // Human-friendly output
    if (results.length === 0) {
      console.log(chalk.yellow(`\n🔍 No memories found for "${options.query}"\n`));
      console.log(chalk.gray("  Try a broader query or check that the agent has stored memories."));
      console.log(chalk.gray(`  Hint: ocmem debug --agent ${options.agent}\n`));
      return;
    }

    console.log(
      chalk.cyan(
        `\n🔍 ${results.length} result${results.length === 1 ? "" : "s"} for "${options.query}"` +
          chalk.gray(` (${method}, agent: ${options.agent})`) +
          "\n",
      ),
    );

    for (const [i, r] of results.entries()) {
      const score = r.score >= 0.8 ? chalk.green(r.score.toFixed(3)) : r.score >= 0.5 ? chalk.yellow(r.score.toFixed(3)) : chalk.gray(r.score.toFixed(3));
      const text =
        r.text.length > 120 ? r.text.slice(0, 117) + "..." : r.text;
      const tags =
        r.tags.length > 0 ? chalk.blue(`[${r.tags.join(", ")}]`) : "";
      const date = new Date(r.createdAt).toLocaleDateString();

      console.log(
        `  ${chalk.bold(`${i + 1}.`)} ${score} ${text}`,
      );
      if (tags) {
        console.log(`     ${tags}  ${chalk.gray(date)}  ${chalk.gray(r.id)}`);
      } else {
        console.log(`     ${chalk.gray(date)}  ${chalk.gray(r.id)}`);
      }
      console.log();
    }
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      console.error(
        chalk.red("✗ Unauthorized — provide --api-key or set MEMORY_API_KEY"),
      );
    } else {
      console.error(chalk.red("✗ Failed to search memories"));
      console.error(chalk.red(`  ${String(error)}`));
    }
    process.exit(1);
  }
}
