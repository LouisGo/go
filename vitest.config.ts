import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    clearMocks: true,
    environment: "node",
    exclude: ["tests/fixtures/**", "dist/**", "node_modules/**"],
    globals: false,
    include: ["tests/**/*.test.ts"],
    testTimeout: 15_000,
  },
});
