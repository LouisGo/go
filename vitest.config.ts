import { defineConfig } from "vitest/config";
import { join } from "node:path";
import { tmpdir } from "node:os";

export default defineConfig({
  test: {
    clearMocks: true,
    env: {
      LOUISGO_HOME: join(tmpdir(), "louisgo-vitest-home"),
    },
    environment: "node",
    exclude: ["tests/fixtures/**", "dist/**", "node_modules/**"],
    fileParallelism: false,
    globals: false,
    include: ["tests/**/*.test.ts"],
    testTimeout: 15_000,
  },
});
