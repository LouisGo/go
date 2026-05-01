import { mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

import { createCli, isDirectRun } from "../src/cli.js";

describe("CLI 入口", () => {
  it("可以生成基础帮助信息", () => {
    const program = createCli();

    expect(program.name()).toBe("louisgo");
    expect(program.description()).toContain("AI 编程 Harness");
    expect(program.helpInformation()).toContain("Usage: louisgo");
  });

  it("可以识别通过符号链接启动的 CLI 入口", async () => {
    await using tempDir = await createTempDir();
    const targetPath = resolve(dirname(fileURLToPath(import.meta.url)), "../src/cli.ts");
    const linkPath = join(tempDir.path, "louisgo");

    await symlink(targetPath, linkPath);

    expect(isDirectRun(pathToFileURL(targetPath).href, ["node", linkPath])).toBe(true);
  });
});

interface TempDir extends AsyncDisposable {
  readonly path: string;
}

async function createTempDir(): Promise<TempDir> {
  const path = await mkdtemp(join(tmpdir(), "louisgo-"));

  return {
    path,
    async [Symbol.asyncDispose]() {
      await rm(path, { force: true, recursive: true });
    },
  };
}
