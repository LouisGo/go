import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { confirmReqWriteStatuses, createConfirmReq } from "../src/protocol/confirm-req.js";
import { readFrontMatter } from "../src/protocol/frontmatter.js";
import { confirmReqFrontMatterSchema } from "../src/protocol/schemas.js";

const execFileAsync = promisify(execFile);
const now = () => new Date("2026-05-01T12:00:00.000Z");

describe("CONFIRM_REQ 协议读写", () => {
  it("生成合法 Confirm Request", async () => {
    await using repo = await createGitRepo();

    const result = await createConfirmReq({
      cwd: repo.path,
      mode: "assist",
      taskId: "T017",
      now,
    });

    expect(result.status).toBe(confirmReqWriteStatuses.created);
    expect(result.frontMatter).toEqual({
      schema: "louisgo-confirm-req-v1",
      mode: "assist",
      taskId: "T017",
      status: "open",
      createdAt: "2026-05-01T12:00:00.000Z",
    });
    await expect(readFrontMatter(result.filePath, confirmReqFrontMatterSchema)).resolves.toEqual(
      expect.objectContaining({
        frontMatter: result.frontMatter,
      }),
    );
  });

  it("已存在未解决 Confirm Request 时返回明确状态且不覆盖文件", async () => {
    await using repo = await createGitRepo();
    const first = await createConfirmReq({
      cwd: repo.path,
      mode: "assist",
      taskId: "T017",
      now,
    });
    const firstContent = await readFile(first.filePath, "utf8");

    const second = await createConfirmReq({
      cwd: repo.path,
      mode: "auto",
      taskId: "T018",
      now: () => new Date("2026-05-01T12:05:00.000Z"),
    });

    expect(second.status).toBe(confirmReqWriteStatuses.openExists);
    expect(second.frontMatter).toEqual(first.frontMatter);
    await expect(readFile(first.filePath, "utf8")).resolves.toBe(firstContent);
  });
});

interface TempRepo extends AsyncDisposable {
  readonly path: string;
}

async function createGitRepo(): Promise<TempRepo> {
  const path = await mkdtemp(join(tmpdir(), "louisgo-"));
  await execFileAsync("git", ["init"], { cwd: path });

  return {
    path,
    async [Symbol.asyncDispose]() {
      await rm(path, { force: true, recursive: true });
    },
  };
}
