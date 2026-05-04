import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { verificationIgnoredRelativePaths } from "../protocol/paths.js";
import { getGitHead, getGitRoot, noGitHead, runGit, type GitCommandOptions } from "./git.js";

const verificationIgnoredPathspecs = [
  ...verificationIgnoredRelativePaths.map((p) => `:!${p}`),
] as const;

export async function computeDiffHash(options: GitCommandOptions = {}): Promise<string> {
  const gitRoot = await getGitRoot(options);
  const gitHead = await getGitHead({ cwd: gitRoot });
  const status = await getStatus(gitRoot);
  const diff = await getDiff(gitRoot, gitHead);
  const untrackedFiles = await getUntrackedFiles(gitRoot);
  const aggregateHash = createHash("sha256");

  aggregateHash.update("git_head\0");
  aggregateHash.update(gitHead);
  aggregateHash.update("\0status\0");
  aggregateHash.update(status);
  aggregateHash.update("\0diff\0");
  aggregateHash.update(diff);
  aggregateHash.update("\0untracked\0");

  for (const relativePath of untrackedFiles) {
    const content = await readFile(join(gitRoot, relativePath));
    aggregateHash.update("path\0");
    aggregateHash.update(relativePath);
    aggregateHash.update("\0hash\0");
    aggregateHash.update(sha256Hex(content));
    aggregateHash.update("\0");
  }

  return aggregateHash.digest("hex");
}

async function getStatus(gitRoot: string): Promise<string> {
  const result = await runGit(
    ["status", "--porcelain=v1", "-z", "--", ".", ...verificationIgnoredPathspecs],
    {
      cwd: gitRoot,
    },
  );
  return result.stdout;
}

async function getDiff(gitRoot: string, gitHead: string): Promise<string> {
  if (gitHead !== noGitHead) {
    const result = await runGit(
      ["diff", "--binary", "HEAD", "--", ".", ...verificationIgnoredPathspecs],
      {
        cwd: gitRoot,
      },
    );
    return result.stdout;
  }

  const [stagedDiff, workTreeDiff] = await Promise.all([
    runGit(["diff", "--binary", "--cached", "--", ".", ...verificationIgnoredPathspecs], {
      cwd: gitRoot,
    }),
    runGit(["diff", "--binary", "--", ".", ...verificationIgnoredPathspecs], { cwd: gitRoot }),
  ]);

  return `${stagedDiff.stdout}\0${workTreeDiff.stdout}`;
}

async function getUntrackedFiles(gitRoot: string): Promise<readonly string[]> {
  const result = await runGit(
    [
      "ls-files",
      "--others",
      "--exclude-standard",
      "-z",
      "--",
      ".",
      ...verificationIgnoredPathspecs,
    ],
    { cwd: gitRoot },
  );

  return result.stdout
    .split("\0")
    .filter((path) => path.length > 0)
    .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

function sha256Hex(content: Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}
