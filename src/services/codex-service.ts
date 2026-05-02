import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { findGitRoot } from "../fs/workspace.js";
import {
  createCodexAgentsBlock,
  createCodexSkillOpenAiYaml,
  createCodexSkillTemplate,
} from "../templates/codex.js";

const managedBlockStart = "<!-- louisgo-codex:start -->";
const managedBlockEnd = "<!-- louisgo-codex:end -->";

export const codexSetupStatuses = {
  created: "created",
  updated: "updated",
  unchanged: "unchanged",
} as const;

export type CodexSetupStatus = (typeof codexSetupStatuses)[keyof typeof codexSetupStatuses];

export interface CodexSetupOptions {
  readonly cwd?: string;
  readonly codexHome?: string;
}

export interface CodexSetupFileResult {
  readonly filePath: string;
  readonly status: CodexSetupStatus;
}

export interface CodexSetupResult {
  readonly workspaceRoot: string;
  readonly codexHome: string;
  readonly files: readonly CodexSetupFileResult[];
  readonly nextSteps: readonly string[];
}

export async function setupCodex(options: CodexSetupOptions = {}): Promise<CodexSetupResult> {
  const workspaceRoot = await findGitRoot(options.cwd);
  const codexHome = resolve(options.codexHome ?? join(homedir(), ".codex"));
  const skillDir = join(codexHome, "skills", "louisgo-workflow");
  const files = await Promise.all([
    writeManagedFile(join(skillDir, "SKILL.md"), createCodexSkillTemplate()),
    writeManagedFile(join(skillDir, "agents", "openai.yaml"), createCodexSkillOpenAiYaml()),
    upsertAgentsFile(join(codexHome, "AGENTS.md"), createCodexAgentsBlock()),
    upsertAgentsFile(join(workspaceRoot, "AGENTS.md"), createCodexAgentsBlock()),
  ]);

  return {
    workspaceRoot,
    codexHome,
    files,
    nextSteps: [
      "新开 Codex 会话或重启 Codex 后输入 $start",
      "在当前仓库运行 louisgo status 确认协议状态",
    ],
  };
}

async function writeManagedFile(filePath: string, content: string): Promise<CodexSetupFileResult> {
  const resolvedPath = resolve(filePath);
  const normalizedContent = ensureTrailingNewline(content);
  const current = await readFileIfExists(resolvedPath);

  if (current === normalizedContent) {
    return {
      filePath: resolvedPath,
      status: codexSetupStatuses.unchanged,
    };
  }

  await mkdir(dirname(resolvedPath), { recursive: true });
  await writeFile(resolvedPath, normalizedContent, "utf8");

  return {
    filePath: resolvedPath,
    status: current === null ? codexSetupStatuses.created : codexSetupStatuses.updated,
  };
}

async function upsertAgentsFile(filePath: string, body: string): Promise<CodexSetupFileResult> {
  const resolvedPath = resolve(filePath);
  const current = await readFileIfExists(resolvedPath);
  const next = upsertManagedBlock(current ?? "", body);

  if (current === next) {
    return {
      filePath: resolvedPath,
      status: codexSetupStatuses.unchanged,
    };
  }

  await mkdir(dirname(resolvedPath), { recursive: true });
  await writeFile(resolvedPath, next, "utf8");

  return {
    filePath: resolvedPath,
    status: current === null ? codexSetupStatuses.created : codexSetupStatuses.updated,
  };
}

function upsertManagedBlock(source: string, body: string): string {
  const block = [managedBlockStart, body.trimEnd(), managedBlockEnd].join("\n");
  const pattern = new RegExp(
    `${escapeRegExp(managedBlockStart)}[\\s\\S]*?${escapeRegExp(managedBlockEnd)}`,
  );

  if (pattern.test(source)) {
    return ensureTrailingNewline(source.replace(pattern, block));
  }

  const prefix = source.trimEnd();
  return ensureTrailingNewline(prefix.length === 0 ? block : `${prefix}\n\n${block}`);
}

async function readFileIfExists(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

function ensureTrailingNewline(content: string): string {
  return content.endsWith("\n") ? content : `${content}\n`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
