import { getGitRoot, runGit, type GitCommandOptions } from "./git.js";

export interface GitStatusEntry {
  readonly indexStatus: string;
  readonly workTreeStatus: string;
  readonly path: string;
  readonly originalPath?: string;
}

export async function getGitPorcelainStatus(
  options: GitCommandOptions = {},
): Promise<readonly GitStatusEntry[]> {
  const gitRoot = await getGitRoot(options);
  const result = await runGit(["status", "--porcelain=v1", "-z"], { cwd: gitRoot });
  return parsePorcelainStatus(result.stdout);
}

export function parsePorcelainStatus(output: string): readonly GitStatusEntry[] {
  const records = output.split("\0").filter((record) => record.length > 0);
  const entries: GitStatusEntry[] = [];

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];

    if (record === undefined || record.length < 4) {
      continue;
    }

    const indexStatus = record[0] ?? " ";
    const workTreeStatus = record[1] ?? " ";
    const path = record.slice(3);

    if (indexStatus === "R" || indexStatus === "C") {
      const originalPath = records[index + 1];
      entries.push({
        indexStatus,
        workTreeStatus,
        path,
        ...(originalPath === undefined ? {} : { originalPath }),
      });
      index += 1;
      continue;
    }

    entries.push({
      indexStatus,
      workTreeStatus,
      path,
    });
  }

  return entries;
}
