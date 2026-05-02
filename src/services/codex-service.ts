import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { findGitRoot } from "../fs/workspace.js";
import {
  createCodexAgentsBlock,
  createCodexDirectiveSkillOpenAiYaml,
  createCodexDirectiveSkillTemplate,
  createCodexSkillOpenAiYaml,
  createCodexSkillTemplate,
} from "../templates/codex.js";
import type { CodexDirectiveSkillTemplateOptions } from "../templates/codex.js";

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
  const skillsDir = join(codexHome, "skills");
  await rm(join(skillsDir, "louisgo-workflow"), { force: true, recursive: true });

  const files = await Promise.all([
    ...codexDirectiveSkills.flatMap((skill) => {
      const skillDir = join(skillsDir, skill.name);
      return [
        writeManagedFile(join(skillDir, "SKILL.md"), createCodexDirectiveSkillTemplate(skill)),
        writeManagedFile(
          join(skillDir, "agents", "openai.yaml"),
          createCodexDirectiveSkillOpenAiYaml(skill),
        ),
      ];
    }),
    writeManagedFile(join(skillsDir, "louisgo", "SKILL.md"), createCodexSkillTemplate()),
    writeManagedFile(
      join(skillsDir, "louisgo", "agents", "openai.yaml"),
      createCodexSkillOpenAiYaml(),
    ),
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

const codexDirectiveSkills: readonly CodexDirectiveSkillTemplateOptions[] = [
  {
    name: "start",
    directive: "$start",
    title: "LouisGo 启动",
    shortDescription: "LouisGo 启动：读取协议状态、项目约束、能力声明和恢复来源",
    description:
      "Use when the user enters $start in Codex. Runs the LouisGo start workflow for the current repository.",
    action:
      "- Run `louisgo status`.\n- Read `.louisgo/MISSION.md` and `.louisgo/CAPABILITIES.md`.\n- If status reports `CONFIRM_REQ`, `QUICK_SAVE`, or `HANDOFF`, read the corresponding file before advising next steps.\n- Report mode, current task, verification state, recovery source, and next action.",
  },
  {
    name: "status",
    directive: "$status",
    title: "LouisGo 状态",
    shortDescription: "LouisGo 状态：查看协议完整性、当前任务、验证状态和恢复来源",
    description:
      "Use when the user enters $status in Codex. Runs louisgo status and summarizes protocol state.",
    action:
      "- Run `louisgo status`.\n- Report protocol completeness, mode, current task, verification state, recovery source, and unresolved signals.",
  },
  {
    name: "verify",
    directive: "$verify",
    title: "LouisGo 验证",
    shortDescription: "LouisGo 验证：运行仓库验证脚本并报告新鲜度",
    description:
      "Use when the user enters $verify in Codex. Runs LouisGo verification for the current repository.",
    action:
      "- Run `louisgo verify`.\n- Relay verification status, freshness, summary, exit-code meaning, and stale reason if present.",
  },
  {
    name: "pause",
    directive: "$pause",
    title: "LouisGo 暂停",
    shortDescription: "LouisGo 暂停：写入 QUICK_SAVE.md 作为短时恢复点",
    description:
      "Use when the user enters $pause in Codex. Writes a LouisGo Quick Save checkpoint.",
    action:
      "- Run `louisgo pause`.\n- Report where `QUICK_SAVE.md` was written and remind the user that it is a short-term recovery point.",
  },
  {
    name: "resume",
    directive: "$resume",
    title: "LouisGo 恢复",
    shortDescription: "LouisGo 恢复：按 HANDOFF 或当前协议状态恢复上下文",
    description:
      "Use when the user enters $resume in Codex. Resumes from LouisGo handoff/status protocol.",
    action:
      "- Run `louisgo status`.\n- Prefer `.louisgo/HANDOFF.md` for formal recovery when present.\n- Otherwise report the current roadmap task and available recovery source.",
  },
  {
    name: "finish",
    directive: "$finish",
    title: "LouisGo 收尾",
    shortDescription: "LouisGo 收尾：生成 HANDOFF_DRAFT.md 并转存临时状态",
    description: "Use when the user enters $finish in Codex. Generates a LouisGo handoff draft.",
    action:
      "- Run `louisgo finish`.\n- Report the draft path, verification status, cleanup result, and tell the user to review/审阅 `.louisgo/HANDOFF_DRAFT.md` before `louisgo handoff promote`.",
  },
  {
    name: "handoff-promote",
    directive: "$handoff-promote",
    title: "LouisGo 提升交接",
    shortDescription: "LouisGo 交接：将 HANDOFF_DRAFT.md 提升为正式 HANDOFF.md",
    description:
      "Use when the user enters $handoff-promote in Codex. Promotes the LouisGo handoff draft to a formal handoff.",
    action:
      "- Run `louisgo handoff promote`.\n- Report `HANDOFF.md`, verification status, and recovery implication.",
  },
];

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
