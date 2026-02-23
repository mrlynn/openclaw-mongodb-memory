import { createInterface } from "readline";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";
import { resolve } from "path";
import chalk from "chalk";

function ask(
  rl: ReturnType<typeof createInterface>,
  question: string,
  defaultValue?: string,
): Promise<string> {
  const suffix = defaultValue ? ` [${defaultValue}]` : "";
  return new Promise((resolve) => {
    rl.question(`  ${question}${suffix}: `, (answer) => {
      resolve(answer.trim() || defaultValue || "");
    });
  });
}

function findProjectRoot(): string {
  // Walk up from cwd looking for package.json with openclaw-memory
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    const pkg = resolve(dir, "package.json");
    if (existsSync(pkg)) {
      try {
        const content = JSON.parse(readFileSync(pkg, "utf8"));
        if (content.name === "openclaw-memory" || content.name === "@openclaw-memory/daemon") {
          return dir;
        }
      } catch {
        // not valid JSON, keep looking
      }
    }
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

export async function initCommand(options: { port?: string; mock?: boolean }) {
  const root = findProjectRoot();
  const envLocal = resolve(root, ".env.local");
  const envExample = resolve(root, ".env.example");

  console.log(chalk.bold("\n  OpenClaw Memory — Init\n"));

  // Check if .env.local already exists
  if (existsSync(envLocal)) {
    console.log(chalk.yellow("  .env.local already exists."));
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const overwrite = await ask(rl, "Overwrite? (y/N)", "N");
    rl.close();
    if (overwrite.toLowerCase() !== "y") {
      console.log("  Keeping existing configuration.\n");
      return;
    }
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  console.log(chalk.dim("  Configure your environment:\n"));

  // MongoDB URI
  const mongoUri = await ask(rl, "MongoDB URI", "mongodb://localhost:27017");

  // Voyage AI
  const voyageKey = await ask(rl, "Voyage API key (blank for mock mode)");
  const useMock = !voyageKey;

  // Port
  const defaultPort = options.port || "7654";
  const port = await ask(rl, "Daemon port", defaultPort);

  // Memory file path
  const memoryFilePath = await ask(
    rl,
    "Memory file path (blank to skip)",
    "~/.openclaw/workspace/MEMORY.md",
  );

  rl.close();

  // Build .env.local content
  if (existsSync(envExample)) {
    let content = readFileSync(envExample, "utf8");
    content = content.replace(/^MONGODB_URI=.*$/m, `MONGODB_URI=${mongoUri}`);
    content = content.replace(/^VOYAGE_API_KEY=.*$/m, `VOYAGE_API_KEY=${voyageKey}`);
    content = content.replace(/^VOYAGE_MOCK=.*$/m, `VOYAGE_MOCK=${useMock}`);

    if (port !== "7654") {
      content = content.replace(/^# MEMORY_DAEMON_PORT=.*$/m, `MEMORY_DAEMON_PORT=${port}`);
    }

    content = content.replace(
      /^NEXT_PUBLIC_DAEMON_URL=.*$/m,
      `NEXT_PUBLIC_DAEMON_URL=http://localhost:${port}`,
    );

    if (memoryFilePath) {
      content = content.replace(/^# MEMORY_FILE_PATH=.*$/m, `MEMORY_FILE_PATH=${memoryFilePath}`);
    }

    writeFileSync(envLocal, content, "utf8");
  } else {
    // No .env.example — write directly
    const lines = [
      `MONGODB_URI=${mongoUri}`,
      `VOYAGE_API_KEY=${voyageKey}`,
      `VOYAGE_MOCK=${useMock}`,
      port !== "7654" ? `MEMORY_DAEMON_PORT=${port}` : `# MEMORY_DAEMON_PORT=7654`,
      `NEXT_PUBLIC_DAEMON_URL=http://localhost:${port}`,
      memoryFilePath ? `MEMORY_FILE_PATH=${memoryFilePath}` : `# MEMORY_FILE_PATH=`,
    ];
    writeFileSync(envLocal, lines.join("\n") + "\n", "utf8");
  }

  console.log(chalk.green(`\n  Wrote ${envLocal}`));

  // Validate MongoDB connection
  console.log(chalk.dim("\n  Validating MongoDB connection..."));
  try {
    execSync(
      `node -e "const{MongoClient}=require('mongodb');const c=new MongoClient('${mongoUri.replace(/'/g, "\\'")}',{serverSelectionTimeoutMS:5000});c.connect().then(()=>c.db().command({ping:1})).then(()=>{console.log('  OK');c.close()}).catch(e=>{console.error(e.message);process.exit(1)})"`,
      { stdio: "inherit", timeout: 10000 },
    );
    console.log(chalk.green("  MongoDB connected"));
  } catch {
    console.log(chalk.yellow("  MongoDB not reachable (you can start it later)"));
  }

  // Print next steps
  console.log(chalk.bold(`\n  Setup complete! Next steps:\n`));
  console.log(`  ${chalk.cyan("ocmem start")}         Start the memory daemon`);
  console.log(`  ${chalk.cyan("ocmem status")}        Check daemon health`);
  console.log(`  ${chalk.cyan("pnpm dev")}            Start daemon + web dashboard\n`);
  console.log(chalk.dim(`  Daemon:  http://localhost:${port}`));
  console.log(chalk.dim(`  Web UI:  http://localhost:3000\n`));
}
