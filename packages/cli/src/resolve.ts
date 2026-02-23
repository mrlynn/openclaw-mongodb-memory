/**
 * Shared project root resolution for CLI commands.
 *
 * Strategy:
 *   1. Walk up from cwd looking for openclaw-memory monorepo
 *   2. Check ~/.ocmem/config.json for a saved projectRoot
 *   3. Return null if neither works
 *
 * `ocmem init` saves the root to ~/.ocmem/config.json so that
 * `ocmem start` can find it from any directory.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, join } from "path";
import os from "os";

const CONFIG_DIR = join(os.homedir(), ".ocmem");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

interface OcmemConfig {
  projectRoot?: string;
}

/** Read ~/.ocmem/config.json */
export function loadOcmemConfig(): OcmemConfig {
  try {
    if (existsSync(CONFIG_FILE)) {
      return JSON.parse(readFileSync(CONFIG_FILE, "utf8"));
    }
  } catch {
    // corrupted config — ignore
  }
  return {};
}

/** Write ~/.ocmem/config.json */
export function saveConfig(config: OcmemConfig): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + "\n", "utf8");
}

/** Check if a directory is the openclaw-memory monorepo or daemon package */
function isProjectRoot(dir: string): boolean {
  const pkg = resolve(dir, "package.json");
  if (!existsSync(pkg)) return false;
  try {
    const content = JSON.parse(readFileSync(pkg, "utf8"));
    return content.name === "openclaw-memory" || content.name === "@openclaw-memory/daemon";
  } catch {
    return false;
  }
}

/**
 * Find the openclaw-memory project root.
 * Returns the absolute path, or null if not found.
 */
export function findProjectRoot(): string | null {
  // 1. Walk up from cwd
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    if (isProjectRoot(dir)) return dir;
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }

  // 2. Check saved config
  const config = loadOcmemConfig();
  if (config.projectRoot && existsSync(config.projectRoot) && isProjectRoot(config.projectRoot)) {
    return config.projectRoot;
  }

  return null;
}
