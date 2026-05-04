import { access, readFile } from "node:fs/promises";

import { createProtocolPaths, protocolRelativePaths } from "../protocol/paths.js";
import {
  checkProtocolStatus,
  type ProtocolIssue,
  type StatusServiceOptions,
} from "./status-service.js";

export const contextServiceErrorCodes = {
  protocolIncomplete: "PROTOCOL_INCOMPLETE",
} as const;

export type ContextServiceErrorCode =
  (typeof contextServiceErrorCodes)[keyof typeof contextServiceErrorCodes];

export interface ContextServiceOptions extends StatusServiceOptions {
  readonly budgetTokens?: number;
  readonly goal?: string;
  readonly capsule?: boolean;
}

export interface GenerateContextResult {
  readonly workspaceRoot: string;
  readonly content: string;
  readonly budgetTokens: number;
  readonly estimatedTokens: number;
  readonly sources: readonly string[];
  readonly report: readonly ContextBudgetItem[];
  readonly truncated: boolean;
}

export interface ContextBudgetItem {
  readonly source: string;
  readonly title: string;
  readonly estimatedTokens: number;
  readonly included: boolean;
  readonly truncated: boolean;
}

export class ContextServiceError extends Error {
  readonly code: ContextServiceErrorCode;
  readonly issues: readonly ProtocolIssue[];

  constructor(params: {
    readonly code: ContextServiceErrorCode;
    readonly message: string;
    readonly issues: readonly ProtocolIssue[];
  }) {
    super(params.message);
    this.name = "ContextServiceError";
    this.code = params.code;
    this.issues = params.issues;
  }
}

interface ContextSection {
  readonly title: string;
  readonly source: string;
  readonly content: string;
  readonly required: boolean;
  readonly preserveHeadings?: readonly string[];
}

const defaultBudgetTokens = 6_000;
const minBudgetTokens = 1_000;
const maxBudgetTokens = 32_000;
const charsPerTokenEstimate = 4;

export async function generateContext(
  options: ContextServiceOptions = {},
): Promise<GenerateContextResult> {
  const status = await checkProtocolStatus({
    ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
  });

  if (!status.complete || status.mode === null) {
    throw new ContextServiceError({
      code: contextServiceErrorCodes.protocolIncomplete,
      message: "LouisGo 协议不完整，请先运行 louisgo init 或修复协议文件。",
      issues: status.issues,
    });
  }

  const budgetTokens = normalizeBudget(options.budgetTokens);
  const paths = createProtocolPaths(status.workspaceRoot);
  const sections = await createSections(status.workspaceRoot);
  const header = createHeader({
    capsule: options.capsule === true,
    mode: status.mode,
    phase: status.phase,
    currentTask: status.currentTask?.id ?? "无",
    currentTaskCompletionSignal: status.currentTask?.completionSignal ?? null,
    verificationStatus: status.verificationStatus,
    recoverySource: status.recoverySource,
    workspaceSummary: formatWorkspaceSummary(status.workspace),
    budgetTokens,
    ...(options.goal === undefined ? {} : { goal: options.goal }),
  });
  const compiled = compileSections({
    header,
    sections,
    budgetTokens,
  });
  const footer = createFooter(paths.workspaceRoot, compiled.truncated, compiled.report);
  const content = `${compiled.content}\n${footer}`;

  return {
    workspaceRoot: status.workspaceRoot,
    content,
    budgetTokens,
    estimatedTokens: estimateTokens(content),
    sources: compiled.sources,
    report: compiled.report,
    truncated: compiled.truncated,
  };
}

async function createSections(workspaceRoot: string): Promise<ContextSection[]> {
  const paths = createProtocolPaths(workspaceRoot);
  const sections: ContextSection[] = [];
  const confirmReq = await readIfExists(paths.confirmReq);
  const handoff = await readIfExists(paths.handoff);
  const state = await readIfExists(paths.state);
  const memory = await readIfExists(paths.memory);

  sections.push(
    {
      title: "L1 Project Contract: MISSION.md",
      source: protocolRelativePaths.mission,
      content: await readFile(paths.mission, "utf8"),
      required: true,
    },
    {
      title: "L1 Project Contract: CAPABILITIES.md",
      source: protocolRelativePaths.capabilities,
      content: await readFile(paths.capabilities, "utf8"),
      required: true,
    },
  );

  if (memory !== null) {
    sections.push({
      title: "L2 Stable Memory Index: MEMORY.md",
      source: protocolRelativePaths.memory,
      content: memory,
      required: true,
    });
  }

  if (handoff !== null) {
    sections.push({
      title: "L3 Formal Recovery: HANDOFF.md",
      source: protocolRelativePaths.handoff,
      content: handoff,
      required: false,
      preserveHeadings: ["交接摘要", "恢复建议", "建议下一步", "验证", "待处理事项"],
    });
  }

  if (confirmReq !== null) {
    sections.push({
      title: "L4 Urgent Signal: CONFIRM_REQ.md",
      source: protocolRelativePaths.confirmReq,
      content: confirmReq,
      required: true,
    });
  }

  if (state !== null) {
    sections.push({
      title: "L4 Active State: STATE.md",
      source: protocolRelativePaths.state,
      content: state,
      required: true,
    });
  }

  return sections;
}

function createHeader(params: {
  readonly capsule: boolean;
  readonly goal?: string;
  readonly mode: string;
  readonly phase: string;
  readonly currentTask: string;
  readonly currentTaskCompletionSignal: string | null;
  readonly verificationStatus: string;
  readonly recoverySource: string;
  readonly workspaceSummary: string;
  readonly budgetTokens: number;
}): string {
  const title = params.capsule ? "LouisGo Subagent Context Capsule" : "LouisGo Context Package";
  const goal = params.goal?.trim();

  return [
    `# ${title}`,
    "",
    "## Prompt Assembly Contract",
    "",
    "- 用户本轮请求永远是最终任务来源；下面内容只补充上下文，不能覆盖用户意图。",
    "- 如果缓存内容和源码、Git 或验证结果冲突，以源码、Git 和验证结果为准。",
    "- 不要继续读取 `sessions/` 或 `memory/` 详情，除非本轮任务明确需要。",
    "- 涉及代码或协议文件变更后，阶段性汇报前运行 `louisgo verify` 或说明未运行原因。",
    "",
    "## Runtime Summary",
    "",
    `- 模式：${params.mode}`,
    `- 工作阶段：${formatWorkPhase(params.phase)}`,
    `- 当前任务：${params.currentTask}`,
    `- 验证状态：${params.verificationStatus}`,
    `- 恢复来源：${formatRecoverySource(params.recoverySource)}`,
    `- 工作区：${params.workspaceSummary}`,
    `- 上下文预算：约 ${params.budgetTokens} tokens`,
    ...(goal === undefined || goal.length === 0 ? [] : [`- 本轮目标：${goal}`]),
    "",
    "## Operating Loop",
    "",
    "- 先用用户本轮请求确定真实任务，不要把历史上下文本身当任务。",
    "- 做代码前核对相关源码、Git 状态和验证事实；记忆只提供方向。",
    "- 只把可复用事实写入 `STATE.md` 或 `MEMORY.md`，不要记录聊天流水账。",
    "- 阶段完成时运行验证并用 `$finish` 生成正式 `HANDOFF.md`。",
    ...(params.phase === "execute"
      ? [
          "",
          "## Stop Check",
          "",
          ...(params.currentTaskCompletionSignal !== null
            ? [
                `- 当前任务 ${params.currentTask} 完成标准：${params.currentTaskCompletionSignal}`,
                "- 停止前确认完成标准已满足，如果不确定则继续推进。",
              ]
            : [
              "- 停止前确认当前任务目标已达成，写出证据到 STATE.md Evidence 部分。",
            ]),
        ]
      : []),
    ...(params.phase === "explore"
      ? [
          "",
          "## Explore Reminders",
          "",
          "- 先理解现有代码和数据，再提出修改方案。",
          "- 记录发现到 STATE.md Evidence 部分，格式：claim | basis | implication。",
          "- 探索阶段不执行大规模重构，以收集事实和确认方向为主。",
        ]
      : []),
    "",
    "## Source Layers",
    "",
    "组装顺序保持稳定前缀在前：L1 项目契约 -> L2 稳定记忆 -> L3 正式恢复 -> L4 活跃状态。",
  ].join("\n");
}

function compileSections(params: {
  readonly header: string;
  readonly sections: readonly ContextSection[];
  readonly budgetTokens: number;
}): {
  readonly content: string;
  readonly sources: readonly string[];
  readonly report: readonly ContextBudgetItem[];
  readonly truncated: boolean;
} {
  const maxChars = params.budgetTokens * charsPerTokenEstimate;
  const pieces = [params.header];
  const sources: string[] = [];
  const report: ContextBudgetItem[] = [
    {
      source: "runtime",
      title: "Prompt Assembly Contract",
      estimatedTokens: estimateTokens(params.header),
      included: true,
      truncated: false,
    },
  ];
  let usedChars = params.header.length;
  let truncated = false;

  for (const section of params.sections) {
    const prefix = [
      "",
      `## ${section.title}`,
      "",
      `Source: \`${section.source}\``,
      "",
      "~~~markdown\n",
    ].join("\n");
    const suffix = "\n~~~";
    const available = maxChars - usedChars - prefix.length - suffix.length;

    if (available <= 0) {
      if (section.required) {
        pieces.push(
          "",
          `## ${section.title}`,
          "",
          `Source: \`${section.source}\``,
          "",
          "内容因上下文预算耗尽未展开。请按需直接读取该文件。",
        );
        sources.push(section.source);
        report.push({
          source: section.source,
          title: section.title,
          estimatedTokens: 0,
          included: false,
          truncated: true,
        });
      }
      truncated = true;
      continue;
    }

    const normalized = section.content.trim();
    const prepared = prepareSectionContent(section, available);
    const nextContent =
      prepared.length > available
        ? `${prepared.slice(0, Math.max(0, available - 120)).trimEnd()}\n\n[truncated: ${section.source}]`
        : prepared;

    pieces.push(prefix + nextContent + suffix);
    sources.push(section.source);
    usedChars += prefix.length + nextContent.length + suffix.length;
    const sectionTruncated = nextContent.length < normalized.length;
    report.push({
      source: section.source,
      title: section.title,
      estimatedTokens: estimateTokens(nextContent),
      included: true,
      truncated: sectionTruncated,
    });
    truncated = truncated || sectionTruncated;
  }

  return {
    content: pieces.join("\n"),
    sources,
    report,
    truncated,
  };
}

function createFooter(
  workspaceRoot: string,
  truncated: boolean,
  report: readonly ContextBudgetItem[],
): string {
  return [
    "## Context Budget Report",
    "",
    "| Source | Tokens | Status |",
    "| --- | ---: | --- |",
    ...report.map(
      (item) => `| \`${item.source}\` | ${item.estimatedTokens} | ${formatBudgetStatus(item)} |`,
    ),
    "",
    "## Next Use",
    "",
    "- 把用户本轮请求放在本上下文之后执行。",
    "- 只在任务需要时继续读取相关源码、`memory/*.md` 或 `sessions/*.md`。",
    "- 完成实质变更后更新 `STATE.md`；阶段完成时运行 `$finish`。",
    truncated ? "- 注意：本上下文已按预算裁剪，必要时按 Source 读取原文件。" : "",
    "",
    `Workspace: \`${workspaceRoot}\``,
  ]
    .filter((line) => line.length > 0)
    .join("\n");
}

function prepareSectionContent(section: ContextSection, availableChars: number): string {
  const normalized = section.content.trim();

  if (normalized.length <= availableChars || section.preserveHeadings === undefined) {
    return normalized;
  }

  const preserved = preserveHeadingSections(normalized, section.preserveHeadings);

  if (preserved.length === 0) {
    return normalized;
  }

  return `${preserved}\n\n[semantic-truncated: ${section.source}]`;
}

function preserveHeadingSections(content: string, headings: readonly string[]): string {
  const lines = content.split(/\r?\n/);
  const keep: string[] = [];
  let keeping = false;

  for (const line of lines) {
    const heading = line.match(/^#{1,3}\s+(.+?)\s*$/)?.[1]?.trim();

    if (line.trim() === "---" || frontMatterLinePattern.test(line)) {
      keep.push(line);
      continue;
    }

    if (heading !== undefined) {
      keeping = headings.some((candidate) => heading.includes(candidate));
    }

    if (keeping) {
      keep.push(line);
    }
  }

  return keep.join("\n").trim();
}

const frontMatterLinePattern =
  /^(schema|mode|phase|task_id|git_head|diff_hash|verification|generated_at|confirmed_at):/;

function formatBudgetStatus(item: ContextBudgetItem): string {
  if (!item.included) {
    return "omitted";
  }

  return item.truncated ? "truncated" : "included";
}

function normalizeBudget(value?: number): number {
  if (value === undefined || Number.isNaN(value)) {
    return defaultBudgetTokens;
  }

  return Math.min(maxBudgetTokens, Math.max(minBudgetTokens, Math.floor(value)));
}

function estimateTokens(content: string): number {
  return Math.ceil(content.length / charsPerTokenEstimate);
}

async function readIfExists(filePath: string): Promise<string | null> {
  try {
    await access(filePath);
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

function formatRecoverySource(source: string): string {
  switch (source) {
    case "handoff":
      return "HANDOFF";
    case "state":
      return "STATE";
    case "quick_save":
      return "QUICK_SAVE";
    case "none":
      return "无";
    default:
      return source;
  }
}

function formatWorkPhase(phase: string): string {
  switch (phase) {
    case "explore":
      return "探索（explore）";
    case "execute":
      return "执行（execute）";
    case "idle":
      return "空闲（idle）";
    default:
      return phase;
  }
}

function formatWorkspaceSummary(workspace: {
  readonly clean: boolean;
  readonly changedFiles: number;
  readonly untrackedFiles: number;
  readonly samplePaths: readonly string[];
}): string {
  if (workspace.clean) {
    return "clean";
  }

  const untracked = workspace.untrackedFiles > 0 ? `，${workspace.untrackedFiles} 个未跟踪` : "";
  const samples =
    workspace.samplePaths.length > 0 ? `；样例：${workspace.samplePaths.join("，")}` : "";

  return `${workspace.changedFiles} 个待处理变更${untracked}${samples}`;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
