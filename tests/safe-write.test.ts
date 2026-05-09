import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  SafeWriteError,
  safeWriteErrorCodes,
  safeWriteFile,
  safeWriteStatuses,
} from "../src/fs/safe-write.js";

describe("安全写入", () => {
  it("新文件可以写入并自动创建父目录", async () => {
    await using tempDir = await createTempDir();
    const filePath = join(tempDir.path, ".louisgo", "MISSION.md");

    const result = await safeWriteFile(filePath, "# Mission\n");

    await expect(readFile(filePath, "utf8")).resolves.toBe("# Mission\n");
    expect(result).toEqual({
      status: safeWriteStatuses.created,
      filePath,
    });
  });

  it("已存在文件不会被覆盖", async () => {
    await using tempDir = await createTempDir();
    const filePath = join(tempDir.path, "MISSION.md");

    await writeFile(filePath, "原内容", "utf8");

    const result = await safeWriteFile(filePath, "新内容");

    await expect(readFile(filePath, "utf8")).resolves.toBe("原内容");
    expect(result).toEqual({
      status: safeWriteStatuses.skipped,
      filePath,
      reason: "exists",
    });
  });

  it("写入失败返回明确错误", async () => {
    await using tempDir = await createTempDir();
    const parentFile = join(tempDir.path, "not-a-directory");
    const filePath = join(parentFile, "child.md");

    await writeFile(parentFile, "占位文件", "utf8");

    await expect(safeWriteFile(filePath, "内容")).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof SafeWriteError &&
        error.code === safeWriteErrorCodes.writeFailed &&
        error.filePath === filePath,
    );
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
