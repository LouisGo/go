import { createHash, type Hash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { getGitHead, getGitRoot, noGitHead, runGit, type GitCommandOptions } from "./git.js";

const algorithmVersion = "louisgo-diff-hash-v1";
const testResultsPathspec = ":!.louisgo/test-results.json";

export async function computeDiffHash(options: GitCommandOptions = {}): Promise<string> {
  const gitRoot = await getGitRoot(options);
  const gitHead = await getGitHead({ cwd: gitRoot });
  const status = await getStatus(gitRoot);
  const diff = await getDiff(gitRoot, gitHead);
  const untrackedFiles = await getUntrackedFiles(gitRoot);
  const aggregateHash = createHash("sha256");

  updateTextSection(aggregateHash, "version", algorithmVersion);
  updateTextSection(aggregateHash, "git_head", gitHead);
  updateTextSection(aggregateHash, "status", status);
  updateTextSection(aggregateHash, "diff", diff);
  updateTextSection(aggregateHash, "untracked_count", String(untrackedFiles.length));

  for (const relativePath of untrackedFiles) {
    const content = await readFile(join(gitRoot, relativePath));
    updateTextSection(aggregateHash, "untracked_path", relativePath);
    updateTextSection(aggregateHash, "untracked_sha256", sha256Hex(content));
  }

  return aggregateHash.digest("hex");
}

async function getStatus(gitRoot: string): Promise<string> {
  const result = await runGit(["status", "--porcelain=v1", "-z", "--", ".", testResultsPathspec], {
    cwd: gitRoot,
  });
  return result.stdout;
}

async function getDiff(gitRoot: string, gitHead: string): Promise<string> {
  if (gitHead !== noGitHead) {
    const result = await runGit(["diff", "--binary", "HEAD", "--", ".", testResultsPathspec], {
      cwd: gitRoot,
    });
    return result.stdout;
  }

  const [stagedDiff, workTreeDiff] = await Promise.all([
    runGit(["diff", "--binary", "--cached", "--", ".", testResultsPathspec], { cwd: gitRoot }),
    runGit(["diff", "--binary", "--", ".", testResultsPathspec], { cwd: gitRoot }),
  ]);

  return `${stagedDiff.stdout}\0${workTreeDiff.stdout}`;
}

async function getUntrackedFiles(gitRoot: string): Promise<readonly string[]> {
  const result = await runGit(
    ["ls-files", "--others", "--exclude-standard", "-z", "--", ".", testResultsPathspec],
    { cwd: gitRoot },
  );

  return result.stdout
    .split("\0")
    .filter((path) => path.length > 0)
    .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

function updateTextSection(hash: Hash, name: string, value: string): void {
  hash.update(name);
  hash.update("\0");
  hash.update(String(Buffer.byteLength(value, "utf8")));
  hash.update("\0");
  hash.update(value);
  hash.update("\0");
}

function sha256Hex(content: Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}
