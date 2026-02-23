/**
 * Tests for config validation (config.ts)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("loadConfig", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset env before each test
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should load valid config with all defaults", async () => {
    process.env.MONGODB_URI = "mongodb://localhost:27017";
    process.env.VOYAGE_MOCK = "true";
    delete process.env.VOYAGE_API_KEY;
    delete process.env.MEMORY_DAEMON_PORT; // Use default

    const { loadConfig } = await import("../config");
    const config = loadConfig();

    expect(config.mongoUri).toBe("mongodb://localhost:27017");
    expect(config.port).toBe(7654); // Default port when not set
    expect(config.voyageMock).toBe(true);
  });

  it("should accept custom port", async () => {
    process.env.MONGODB_URI = "mongodb://localhost:27017";
    process.env.MEMORY_DAEMON_PORT = "8080";
    process.env.VOYAGE_MOCK = "true";

    const { loadConfig } = await import("../config");
    const config = loadConfig();

    expect(config.port).toBe(8080);
  });

  it("should accept Voyage API key with mock off", async () => {
    process.env.MONGODB_URI = "mongodb://localhost:27017";
    process.env.VOYAGE_API_KEY = "pa-test-key-123";
    process.env.VOYAGE_MOCK = "false";

    const { loadConfig } = await import("../config");
    const config = loadConfig();

    expect(config.voyageApiKey).toBe("pa-test-key-123");
    expect(config.voyageMock).toBe(false);
  });

  it("should exit when VOYAGE_API_KEY missing and mock off", async () => {
    process.env.MONGODB_URI = "mongodb://localhost:27017";
    delete process.env.VOYAGE_API_KEY;
    process.env.VOYAGE_MOCK = "false";

    // Mock process.exit to prevent actual exit
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    const { loadConfig } = await import("../config");
    expect(() => loadConfig()).toThrow("process.exit called");
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
  });

  it("should NOT exit when VOYAGE_API_KEY missing but mock is on", async () => {
    process.env.MONGODB_URI = "mongodb://localhost:27017";
    delete process.env.VOYAGE_API_KEY;
    process.env.VOYAGE_MOCK = "true";

    const { loadConfig } = await import("../config");
    const config = loadConfig();

    expect(config.voyageMock).toBe(true);
    expect(config.voyageApiKey).toBeUndefined();
  });

  it("should include memoryApiKey when set", async () => {
    process.env.MONGODB_URI = "mongodb://localhost:27017";
    process.env.VOYAGE_MOCK = "true";
    process.env.MEMORY_API_KEY = "my-secret-key";

    const { loadConfig } = await import("../config");
    const config = loadConfig();

    expect(config.memoryApiKey).toBe("my-secret-key");
  });
});
