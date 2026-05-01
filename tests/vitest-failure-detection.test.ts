import { execFile } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

describe("Vitest 配置", () => {
  it("可以发现失败用例", async () => {
    const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
    const vitestCli = resolve(repoRoot, "node_modules/vitest/vitest.mjs");
    const failingConfig = resolve(repoRoot, "tests/fixtures/vitest-failing.config.ts");

    await expect(
      execFileAsync(process.execPath, [vitestCli, "run", "--config", failingConfig], {
        cwd: repoRoot,
        env: {
          ...process.env,
          CI: "1",
        },
        timeout: 15_000,
      }),
    ).rejects.toMatchObject({
      code: 1,
    });
  });
});
