import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import { safeWriteFile, type SafeWriteResult } from "../fs/safe-write.js";
import { findGitRoot } from "../fs/workspace.js";
import { createProtocolPaths } from "../protocol/paths.js";
import { createBlockerTemplate } from "../templates/blocker.js";
import { createCapabilitiesTemplate } from "../templates/capabilities.js";
import { createMemoryTemplate } from "../templates/memory.js";
import { createMissionTemplate } from "../templates/mission.js";
import { createRoadmapTemplate } from "../templates/roadmap.js";
import { createLouisGoGitignoreTemplate, createRunLogTemplate } from "../templates/run-log.js";
import {
  createCavemanSkill,
  createGrillSkill,
} from "../templates/skills.js";
import { createStateTemplate } from "../templates/state.js";
import { createVerifyPs1Template } from "../templates/verify-ps1.js";
import { createVerifyShTemplate } from "../templates/verify-sh.js";

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
  const directories = [
    paths.louisgoDir,
    paths.scriptsDir,
    paths.adrDir,
    paths.adrDraftDir,
    paths.memoryDir,
    paths.sessionsDir,
    paths.skillsDir,
  ];

  for (const directory of directories) {
    await mkdir(directory, { recursive: true });
  }

  const files = await writeInitialFiles([
    {
      filePath: paths.mission,
      content: createMissionTemplate({ updatedAt: timestamp }),
    },
    {
      filePath: paths.roadmap,
      content: createRoadmapTemplate(),
    },
    {
      filePath: paths.state,
      content: createStateTemplate({ updatedAt: timestamp }),
    },
    {
      filePath: paths.memory,
      content: createMemoryTemplate({ updatedAt: timestamp }),
    },
    {
      filePath: paths.blocker,
      content: createBlockerTemplate(),
    },
    {
      filePath: paths.gitignore,
      content: createLouisGoGitignoreTemplate(),
    },
    {
      filePath: paths.runLog,
      content: createRunLogTemplate({ updatedAt: timestamp }),
    },
    {
      filePath: paths.capabilities,
      content: createCapabilitiesTemplate({ updatedAt: timestamp }),
    },
    {
      filePath: paths.verifySh,
      content: createVerifyShTemplate(),
      mode: 0o755,
    },
    {
      filePath: paths.verifyPs1,
      content: createVerifyPs1Template(),
    },
    {
      filePath: join(paths.skillsDir, "grill.md"),
      content: createGrillSkill(),
    },
    {
      filePath: join(paths.skillsDir, "caveman.md"),
      content: createCavemanSkill(),
    },
  ]);

  return {
    workspaceRoot,
    directories,
    files,
    nextSteps: ["新会话会自动读取 LouisGo 上下文", "需要深度重建时输入 $start"],
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
