import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { findGitRoot } from "../fs/workspace.js";
import { isNodeError, pathExists } from "../internal/utils.js";
import { createProtocolPaths, protocolRelativePaths } from "../protocol/paths.js";

const managedBlockStart = "<!-- louisgo-codex:start -->";
const managedBlockEnd = "<!-- louisgo-codex:end -->";
const projectAgentFileCandidates = ["AGENTS.md", "AGENT.md", "Agent.md", "agents.md", "agent.md"];

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

export async function clearLouisGo(options: ClearLouisGoOptions = {}): Promise<ClearLouisGoResult> {
  const workspaceRoot = await findGitRoot(options.cwd);
  const paths = createProtocolPaths(workspaceRoot);
  const dryRun = options.dryRun === true;

  const louisgoExists = await pathExists(paths.louisgoDir);
  const agentRemovals = await resolveProjectAgentRemovals(workspaceRoot);

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
        ...agentRemovals.map((removal) => ({
          relativePath: removal.relativePath,
          description: "LouisGo 管理的 Codex 指令块",
          status: removal.result.removed
            ? clearTargetStatuses.planned
            : clearTargetStatuses.unchanged,
        })),
        ...(agentRemovals.length === 0
          ? [
              {
                relativePath: "项目 agent 指令文件",
                description: "LouisGo 管理的 Codex 指令块",
                status: clearTargetStatuses.missing,
              },
            ]
          : []),
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

  if (agentRemovals.length === 0) {
    targets.push({
      relativePath: "项目 agent 指令文件",
      description: "LouisGo 管理的 Codex 指令块",
      status: clearTargetStatuses.missing,
    });
  } else {
    for (const removal of agentRemovals) {
      if (!removal.result.removed) {
        targets.push({
          relativePath: removal.relativePath,
          description: "LouisGo 管理的 Codex 指令块",
          status: clearTargetStatuses.unchanged,
        });
      } else if (removal.result.nextContent.length === 0) {
        await rm(removal.filePath, { force: true });
        targets.push({
          relativePath: removal.relativePath,
          description: "LouisGo 管理的 Codex 指令块",
          status: clearTargetStatuses.deleted,
        });
      } else {
        await writeFile(removal.filePath, removal.result.nextContent, "utf8");
        targets.push({
          relativePath: removal.relativePath,
          description: "LouisGo 管理的 Codex 指令块",
          status: clearTargetStatuses.updated,
        });
      }
    }
  }

  return {
    workspaceRoot,
    dryRun,
    targets,
  };
}

interface ProjectAgentRemoval {
  readonly filePath: string;
  readonly relativePath: string;
  readonly result: {
    readonly removed: boolean;
    readonly nextContent: string;
  };
}

async function resolveProjectAgentRemovals(workspaceRoot: string): Promise<ProjectAgentRemoval[]> {
  const removals: ProjectAgentRemoval[] = [];
  const entries = await readdir(workspaceRoot);

  for (const fileName of projectAgentFileCandidates) {
    if (!entries.includes(fileName)) {
      continue;
    }

    const filePath = join(workspaceRoot, fileName);
    const content = await readAgentsFile(filePath);

    if (content === null) {
      continue;
    }

    removals.push({
      filePath,
      relativePath: fileName,
      result: removeManagedCodexBlock(content),
    });
  }

  return removals;
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
