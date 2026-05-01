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

    try {
      await execFileAsync(process.execPath, [vitestCli, "run", "--config", failingConfig], {
        cwd: repoRoot,
        env: {
          ...process.env,
          CI: "1",
        },
        timeout: 15_000,
      });
      expect.unreachable("失败 fixture 不应通过");
    } catch (error) {
      expect(error).toMatchObject({
        code: 1,
      });

      const output = getProcessOutput(error);
      expect(output).toContain("失败用例 fixture");
      expect(output).toContain("用于验证 Vitest 能发现失败");
      expect(output).toContain("expected");
      expect(output).toContain("actual");
    }
  });
});

function getProcessOutput(error: unknown): string {
  if (typeof error !== "object" || error === null) {
    return "";
  }

  const output = error as { stdout?: unknown; stderr?: unknown };
  return `${typeof output.stdout === "string" ? output.stdout : ""}\n${
    typeof output.stderr === "string" ? output.stderr : ""
  }`;
}
