/**
 * Test setup - runs before all tests
 */

import { beforeAll } from "vitest";
import { config } from "dotenv";
import path from "path";
import { existsSync } from "fs";

// Load .env.local from multiple locations (package-level takes precedence)
const packageEnvPath = path.resolve(__dirname, "../../.env.local");
const rootEnvPath = path.resolve(__dirname, "../../../../.env.local");

if (existsSync(packageEnvPath)) {
  config({ path: packageEnvPath });
  console.log("Loaded environment from packages/daemon/.env.local");
} else if (existsSync(rootEnvPath)) {
  config({ path: rootEnvPath });
  console.log("Loaded environment from root .env.local");
} else {
  console.warn("No .env.local found. Using system environment variables.");
}

beforeAll(async () => {
  // Use existing MongoDB connection (from .env.local)
  // Tests will use a test database to avoid polluting production data
  if (!process.env.MONGODB_URI) {
    throw new Error(
      "MONGODB_URI not set. Please create .env.local with MONGODB_URI=your_connection_string",
    );
  }

  // Force mock embeddings for tests (fast, deterministic, no API costs)
  process.env.VOYAGE_MOCK = "true";

  console.log("Test setup complete. Using mock embeddings and existing MongoDB connection.");
});
