/**
 * Test setup - runs before all tests
 *
 * ⚠️ CRITICAL: Set MEMORY_DB_NAME FIRST before any imports
 * Constants are evaluated at import time, so env vars must be set before importing any daemon code
 */

// STEP 1: Set test database name BEFORE any imports
process.env.MEMORY_DB_NAME = "openclaw_memory_test";
process.env.VOYAGE_MOCK = "true";

// STEP 2: Load environment variables
import { config } from "dotenv";
import path from "path";
import { existsSync } from "fs";

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

// STEP 3: Verify test setup
import { beforeAll } from "vitest";

beforeAll(async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error(
      "MONGODB_URI not set. Please create .env.local with MONGODB_URI=your_connection_string",
    );
  }

  console.log("⚠️  TEST MODE: Using isolated database 'openclaw_memory_test'");
  console.log("    Production DB: openclaw_memory");
  console.log("    Test DB: " + process.env.MEMORY_DB_NAME);
});
