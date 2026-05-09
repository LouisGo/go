import { execFile } from "node:child_process";
import { access, mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { finishLouisGo } from "../src/services/finish-service.js";
import { initLouisGo } from "../src/services/init-service.js";

const execFileAsync = promisify(execFile);
const initNow = () => new Date("2026-05-01T12:00:00.000Z");
const generatedNow = () => new Date("2026-05-01T12:30:00.000Z");

describe("finish service", () => {
  it("writes a private finish summary", async () => {
    await using repo = await createInitializedRepo();

    const result = await finishLouisGo({
      cwd: repo.path,
      louisgoHome: repo.louisgoHome,
      now: generatedNow,
    });

    await expect(realpath(result.workspaceRoot)).resolves.toBe(await realpath(repo.path));
    expect(result.task.meta.task_id).toBe("T001");
    expect(result.verification).toBe("missing");
    await expect(access(result.filePath)).resolves.toBeUndefined();
    await expect(readFile(result.filePath, "utf8")).resolves.toContain("# Task Finish");
  });

  it("fails when the project anchor is missing", async () => {
    await using repo = await createGitRepo();

    await expect(
      finishLouisGo({
        cwd: repo.path,
        louisgoHome: repo.louisgoHome,
        now: generatedNow,
      }),
    ).rejects.toThrow("louisgo init");
  });
});

interface TempRepo extends AsyncDisposable {
  readonly path: string;
  readonly louisgoHome: string;
}

async function createInitializedRepo(): Promise<TempRepo> {
  const repo = await createGitRepo();
  await initLouisGo({ cwd: repo.path, now: initNow });
  return repo;
}

async function createGitRepo(): Promise<TempRepo> {
  const path = await mkdtemp(join(tmpdir(), "louisgo-"));
  const louisgoHome = await mkdtemp(join(tmpdir(), "louisgo-home-"));
  await execFileAsync("git", ["init"], { cwd: path });

  return {
    path,
    louisgoHome,
    async [Symbol.asyncDispose]() {
      await rm(path, { force: true, recursive: true });
      await rm(louisgoHome, { force: true, recursive: true });
    },
  };
}
