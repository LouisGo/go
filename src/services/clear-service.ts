import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { findGitRoot } from "../fs/workspace.js";
import { isNodeError, pathExists } from "../internal/utils.js";
import { createProtocolPaths, protocolRelativePaths } from "../protocol/paths.js";

const managedBlockStart = "<!-- louisgo-codex:start -->";
const managedBlockEnd = "<!-- louisgo-codex:end -->";

export const clearConfirmationPhrase = "DELETE LOUISGO";

export const clearTargetStatuses = {
  deleted: "deleted",
  missing: "missing",
  updated: "updated",
  unchanged: "unchanged",
  planned: "planned",
} as const;

export type ClearTargetStatus = (typeof clearTargetStatuses)[keyof typeof clearTargetStatuses];

export interface ClearLouisGoOptions {
  readonly cwd?: string;
  readonly confirm?: string;
  readonly dryRun?: boolean;
}

export interface ClearTargetResult {
  readonly relativePath: string;
  readonly description: string;
  readonly status: ClearTargetStatus;
}

export interface ClearLouisGoResult {
  readonly workspaceRoot: string;
  readonly dryRun: boolean;
  readonly targets: readonly ClearTargetResult[];
}

export class ClearServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClearServiceError";
  }
}

export async function clearLouisGo(options: ClearLouisGoOptions = {}): Promise<ClearLouisGoResult> {
  const workspaceRoot = await findGitRoot(options.cwd);
  const paths = createProtocolPaths(workspaceRoot);
  const agentsPath = join(workspaceRoot, "AGENTS.md");
  const dryRun = options.dryRun === true;

  if (!dryRun && options.confirm !== clearConfirmationPhrase) {
    throw new ClearServiceError(
      `未确认清理。请传入 --confirm "${clearConfirmationPhrase}" 后再执行。`,
    );
  }

  const louisgoExists = await pathExists(paths.louisgoDir);
  const agents = await readAgentsFile(agentsPath);
  const agentsRemoval = agents === null ? null : removeManagedCodexBlock(agents);

  if (dryRun) {
    return {
      workspaceRoot,
      dryRun,
      targets: [
        {
          relativePath: protocolRelativePaths.louisgoDir,
          description: "LouisGo 协议、记忆、交接、验证结果、诊断日志、stats 和缓存目录",
          status: louisgoExists ? clearTargetStatuses.planned : clearTargetStatuses.missing,
        },
        {
          relativePath: "AGENTS.md",
          description: "LouisGo 管理的 Codex 指令块",
          status:
            agentsRemoval === null
              ? clearTargetStatuses.missing
              : agentsRemoval.removed
                ? clearTargetStatuses.planned
                : clearTargetStatuses.unchanged,
        },
      ],
    };
  }

  const targets: ClearTargetResult[] = [];

  if (louisgoExists) {
    await rm(paths.louisgoDir, { force: true, recursive: true });
    targets.push({
      relativePath: protocolRelativePaths.louisgoDir,
      description: "LouisGo 协议、记忆、交接、验证结果、诊断日志、stats 和缓存目录",
      status: clearTargetStatuses.deleted,
    });
  } else {
    targets.push({
      relativePath: protocolRelativePaths.louisgoDir,
      description: "LouisGo 协议、记忆、交接、验证结果、诊断日志、stats 和缓存目录",
      status: clearTargetStatuses.missing,
    });
  }

  if (agentsRemoval === null) {
    targets.push({
      relativePath: "AGENTS.md",
      description: "LouisGo 管理的 Codex 指令块",
      status: clearTargetStatuses.missing,
    });
  } else if (!agentsRemoval.removed) {
    targets.push({
      relativePath: "AGENTS.md",
      description: "LouisGo 管理的 Codex 指令块",
      status: clearTargetStatuses.unchanged,
    });
  } else if (agentsRemoval.nextContent.length === 0) {
    await rm(agentsPath, { force: true });
    targets.push({
      relativePath: "AGENTS.md",
      description: "LouisGo 管理的 Codex 指令块",
      status: clearTargetStatuses.deleted,
    });
  } else {
    await writeFile(agentsPath, agentsRemoval.nextContent, "utf8");
    targets.push({
      relativePath: "AGENTS.md",
      description: "LouisGo 管理的 Codex 指令块",
      status: clearTargetStatuses.updated,
    });
  }

  return {
    workspaceRoot,
    dryRun,
    targets,
  };
}

async function readAgentsFile(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

function removeManagedCodexBlock(source: string): {
  readonly removed: boolean;
  readonly nextContent: string;
} {
  const pattern = new RegExp(
    `${escapeRegExp(managedBlockStart)}[\\s\\S]*?${escapeRegExp(managedBlockEnd)}`,
  );

  if (!pattern.test(source)) {
    return {
      removed: false,
      nextContent: source,
    };
  }

  const withoutBlock = source.replace(pattern, "").replace(/[ \t]+\n/g, "\n");
  const normalized = withoutBlock.replace(/\n{3,}/g, "\n\n").trim();

  return {
    removed: true,
    nextContent: normalized.length === 0 ? "" : `${normalized}\n`,
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
