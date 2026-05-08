import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import { writeFrontMatter } from "./frontmatter.js";
import { createProtocolPaths } from "./paths.js";
import {
  handoffFrontMatterSchema,
  missingTaskId,
  type HandoffFrontMatter,
  type LouisGoMode,
  type VerificationStatus,
} from "./schemas.js";

export interface HandoffFrontMatterInput {
  readonly mode: LouisGoMode;
  readonly taskId?: string | null;
  readonly gitHead: string;
  readonly diffHash: string;
  readonly verification: VerificationStatus;
  readonly generatedAt: string;
  readonly confirmedAt?: string;
}

export interface HandoffFrontMatterJson {
  readonly schema: "louisgo-handoff-v1";
  readonly mode: LouisGoMode;
  readonly task_id: string;
  readonly git_head: string;
  readonly diff_hash: string;
  readonly verification: VerificationStatus;
  readonly generated_at: string;
  readonly confirmed_at?: string;
}

export interface HandoffDraftBodyInput {
  readonly taskId?: string | null;
  readonly phase?: string;
  readonly verification: VerificationStatus;
  readonly gitDiffSummary: string;
  readonly blockerSummary: string;
  readonly confirmReqSummary: string;
  readonly quickSaveSummary: string;
  readonly adrDrafts: readonly string[];
}

export type HandoffBodyInput = HandoffDraftBodyInput;

export interface WriteHandoffDraftOptions {
  readonly workspaceRoot: string;
  readonly frontMatter: HandoffFrontMatterInput;
  readonly body: HandoffDraftBodyInput;
}

export interface WriteHandoffDraftResult {
  readonly filePath: string;
  readonly frontMatter: HandoffFrontMatter;
  readonly body: string;
}

export interface WriteHandoffOptions {
  readonly workspaceRoot: string;
  readonly frontMatter: HandoffFrontMatterInput;
  readonly body: string;
}

export interface WriteHandoffResult {
  readonly filePath: string;
  readonly frontMatter: HandoffFrontMatter;
  readonly body: string;
}

export async function writeHandoffDraft(
  options: WriteHandoffDraftOptions,
): Promise<WriteHandoffDraftResult> {
  const paths = createProtocolPaths(options.workspaceRoot);
  const frontMatter = serializeHandoffFrontMatter(options.frontMatter);
  const body = createHandoffDraftBody(options.body);

  await mkdir(dirname(paths.handoffDraft), { recursive: true });
  await writeFrontMatter(paths.handoffDraft, { ...frontMatter }, body, handoffFrontMatterSchema);

  return {
    filePath: paths.handoffDraft,
    frontMatter: handoffFrontMatterSchema.parse(frontMatter),
    body,
  };
}

export async function writeHandoff(options: WriteHandoffOptions): Promise<WriteHandoffResult> {
  const paths = createProtocolPaths(options.workspaceRoot);
  const frontMatter = serializeHandoffFrontMatter(options.frontMatter);

  await mkdir(dirname(paths.handoff), { recursive: true });
  await writeFrontMatter(paths.handoff, { ...frontMatter }, options.body, handoffFrontMatterSchema);

  return {
    filePath: paths.handoff,
    frontMatter: handoffFrontMatterSchema.parse(frontMatter),
    body: options.body,
  };
}

export function serializeHandoffFrontMatter(
  input: HandoffFrontMatterInput,
): HandoffFrontMatterJson {
  return {
    schema: "louisgo-handoff-v1",
    mode: input.mode,
    task_id: normalizeTaskReference(input.taskId),
    git_head: input.gitHead,
    diff_hash: input.diffHash,
    verification: input.verification,
    generated_at: input.generatedAt,
    ...(input.confirmedAt === undefined ? {} : { confirmed_at: input.confirmedAt }),
  };
}

export function createHandoffDraftBody(input: HandoffDraftBodyInput): string {
  return createHandoffDocumentBody("Handoff Draft", input);
}

export function createHandoffBody(input: HandoffBodyInput): string {
  return createHandoffDocumentBody("Handoff", input);
}

function createHandoffDocumentBody(
  title: "Handoff" | "Handoff Draft",
  input: HandoffBodyInput,
): string {
  const taskLine =
    input.taskId === undefined || input.taskId === null
      ? `当前 ROADMAP 没有可用任务，task_id 使用 ${missingTaskId} 占位。`
      : `当前任务：${input.taskId}`;
  const phaseLine = input.phase !== undefined ? `- 工作阶段：${input.phase}` : null;
  const adrDraftSummary =
    input.adrDrafts.length === 0
      ? "无 ADR 草稿。"
      : input.adrDrafts.map((draft) => `- ${draft}`).join("\n");

  return `# ${title}

## 交接摘要

- ${taskLine}
${phaseLine !== null ? `${phaseLine}\n` : ""}- 验证状态：${input.verification}
- 接手判断：${formatVerificationHandoffGuidance(input.verification)}

## 恢复建议

- 若存在未解决确认请求，先处理确认请求。
- 若存在 ADR 草稿，先确认是否继续推进该决策。
- 若继续修改代码，完成后运行 \`louisgo verify\`。

## 当前工作区

${input.gitDiffSummary}

## 验证

- 状态：${input.verification}
- 处理建议：${formatVerificationNextAction(input.verification)}

## 待处理事项

### Blocker

${input.blockerSummary}

### 未解决确认请求

${input.confirmReqSummary}

### ADR 草稿

${adrDraftSummary}

## 恢复上下文

### Quick Save

${input.quickSaveSummary}
`;
}

function normalizeTaskReference(taskId?: string | null): string {
  return taskId === undefined || taskId === null || taskId.length === 0 ? missingTaskId : taskId;
}

function formatVerificationHandoffGuidance(status: VerificationStatus): string {
  switch (status) {
    case "passed":
      return "验证通过且对应当前工作区，可以基于当前 diff 继续交接。";
    case "failed":
      return "验证失败，接手者应先查看失败原因并修复。";
    case "error":
      return "验证流程出错，接手者应先修复验证入口或运行环境。";
    case "skipped":
      return "验证被跳过，不能当作质量门禁。";
    case "missing":
      return "没有可用验证结果，接手前应先运行验证。";
    case "stale":
      return "验证结果已过期，不能代表当前工作区。";
  }
}

function formatVerificationNextAction(status: VerificationStatus): string {
  switch (status) {
    case "passed":
      return "后续如有任何代码或协议文件变更，需要重新运行 `louisgo verify`。";
    case "failed":
      return "先修复失败项，再运行 `louisgo verify`，不要把 failed 当作已完成状态。";
    case "error":
      return "先修复验证入口、依赖或执行环境，再重新运行 `louisgo verify`。";
    case "skipped":
      return "按项目情况配置真实验证命令，或显式维护项目验证脚本后重新验证。";
    case "missing":
      return "运行 `louisgo verify` 生成当前工作区的验证结果。";
    case "stale":
      return "运行 `louisgo verify` 刷新验证结果，确认是否仍可交接。";
  }
}
