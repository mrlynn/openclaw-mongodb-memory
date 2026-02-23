/**
 * Daemon configuration — Zod-validated env vars with rich error messages.
 *
 * Call `loadConfig()` after dotenv has loaded to get a typed DaemonConfig.
 * Every validation failure includes the exact fix instruction.
 */

import { z } from "zod";
import { startupError } from "./utils/startupError";
import { DEFAULT_PORT, DEFAULT_MONGO_URI } from "./constants";

const configSchema = z.object({
  port: z.coerce.number().int().min(1).max(65535).default(DEFAULT_PORT),
  mongoUri: z.string().min(1),
  voyageApiKey: z.string().optional(),
  voyageBaseUrl: z.string().url().optional(),
  voyageModel: z.string().optional(),
  voyageMock: z.boolean().default(false),
  memoryApiKey: z.string().optional(),
});

export type DaemonConfig = z.infer<typeof configSchema>;

export function loadConfig(): DaemonConfig {
  const raw = {
    port: process.env.MEMORY_DAEMON_PORT || DEFAULT_PORT,
    mongoUri: process.env.MONGODB_URI || DEFAULT_MONGO_URI,
    voyageApiKey: process.env.VOYAGE_API_KEY || undefined,
    voyageBaseUrl: process.env.VOYAGE_BASE_URL || undefined,
    voyageModel: process.env.VOYAGE_MODEL || undefined,
    voyageMock: process.env.VOYAGE_MOCK === "true",
    memoryApiKey: process.env.MEMORY_API_KEY || undefined,
  };

  const result = configSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    startupError({
      title: "Invalid configuration",
      description: issues.join("; "),
      fix: [
        "Copy .env.example to .env.local and fill in the required values",
        "Run: cp .env.example .env.local",
        "See README.md for configuration details",
      ],
    });
  }

  const config = result.data;

  // Require VOYAGE_API_KEY only when NOT in mock mode
  if (!config.voyageMock && !config.voyageApiKey) {
    startupError({
      title: "Missing VOYAGE_API_KEY",
      description:
        "Voyage API key is required for real embeddings. " +
        "Set VOYAGE_MOCK=true to use mock embeddings instead.",
      fix: [
        "Get a key from https://dash.voyageai.com/ and set VOYAGE_API_KEY in .env.local",
        "OR set VOYAGE_MOCK=true in .env.local for development without an API key",
      ],
    });
  }

  return config;
}
