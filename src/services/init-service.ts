import { mkdir } from "node:fs/promises";

import { safeWriteFile, type SafeWriteResult } from "../fs/safe-write.js";
import { findGitRoot } from "../fs/workspace.js";
import { createProtocolPaths } from "../protocol/paths.js";
import { createCapabilitiesTemplate } from "../templates/capabilities.js";
import { createMissionTemplate } from "../templates/mission.js";
import { createLouisGoGitignoreTemplate } from "../templates/run-log.js";

export interface InitServiceOptions {
  readonly cwd?: string;
  readonly now?: () => Date;
}

export interface InitFileResult {
  readonly filePath: string;
  readonly status: SafeWriteResult["status"];
}

export interface InitServiceResult {
  readonly workspaceRoot: string;
  readonly directories: readonly string[];
  readonly files: readonly InitFileResult[];
  readonly nextSteps: readonly string[];
}

interface InitialFileTemplate {
  readonly filePath: string;
  readonly content: string;
  readonly mode?: number;
}

export async function initLouisGo(options: InitServiceOptions = {}): Promise<InitServiceResult> {
  const workspaceRoot = await findGitRoot(options.cwd);
  const paths = createProtocolPaths(workspaceRoot);
  const timestamp = (options.now?.() ?? new Date()).toISOString();
  const directories = [paths.louisgoDir];

  for (const directory of directories) {
    await mkdir(directory, { recursive: true });
  }

  const files = await writeInitialFiles([
    {
      filePath: paths.mission,
      content: createMissionTemplate({ updatedAt: timestamp }),
    },
    {
      filePath: paths.gitignore,
      content: createLouisGoGitignoreTemplate(),
    },
    {
      filePath: paths.capabilities,
      content: createCapabilitiesTemplate({ updatedAt: timestamp }),
    },
  ]);

  return {
    workspaceRoot,
    directories,
    files,
    nextSteps: [
      "Private task state will be stored outside team Git",
      "Use louisgo pause and louisgo resume for task continuity",
    ],
  };
}

async function writeInitialFiles(files: readonly InitialFileTemplate[]): Promise<InitFileResult[]> {
  const results: InitFileResult[] = [];

  for (const file of files) {
    const result = await safeWriteFile(file.filePath, file.content, {
      ...(file.mode === undefined ? {} : { mode: file.mode }),
    });
    results.push({
      filePath: result.filePath,
      status: result.status,
    });
  }

  return results;
}
