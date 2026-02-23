import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./src/__tests__/setup.ts"],
    testTimeout: 30000, // 30s for MongoDB startup
    hookTimeout: 30000,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "json", "html"],
      exclude: ["node_modules/**", "dist/**", "**/*.test.ts", "**/*.spec.ts", "src/__tests__/**"],
      thresholds: {
        branches: 70,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
});
