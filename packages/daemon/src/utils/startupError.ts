/**
 * Pretty-printed boxed error messages for startup failures.
 * No external deps — just console.error with box-drawing chars.
 */

interface StartupErrorOptions {
  title: string;
  description: string;
  fix: string[];
}

export function startupError({ title, description, fix }: StartupErrorOptions): never {
  const lines = [
    "",
    `  ${title}`,
    "",
    `  ${description}`,
    "",
    "  How to fix:",
    ...fix.map((step, i) => `    ${i + 1}. ${step}`),
    "",
  ];

  const maxLen = Math.max(...lines.map((l) => l.length));
  const top = "┌" + "─".repeat(maxLen + 2) + "┐";
  const bottom = "└" + "─".repeat(maxLen + 2) + "┘";
  const padded = lines.map((l) => "│ " + l.padEnd(maxLen) + " │");

  console.error("");
  console.error(top);
  for (const line of padded) console.error(line);
  console.error(bottom);
  console.error("");

  process.exit(1);
}
