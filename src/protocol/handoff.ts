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
}

export interface HandoffFrontMatterJson {
  readonly schema: "louisgo-handoff-v1";
  readonly mode: LouisGoMode;
  readonly task_id: string;
  readonly git_head: string;
  readonly diff_hash: string;
  readonly verification: VerificationStatus;
  readonly generated_at: string;
}

export interface HandoffDraftBodyInput {
  readonly taskId?: string | null;
  readonly verification: VerificationStatus;
  readonly gitDiffSummary: string;
  readonly blockerSummary: string;
  readonly confirmReqSummary: string;
  readonly adrDrafts: readonly string[];
}

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
  };
}

export function createHandoffDraftBody(input: HandoffDraftBodyInput): string {
  const taskLine =
    input.taskId === undefined || input.taskId === null
      ? `当前 ROADMAP 没有可用任务，task_id 使用 ${missingTaskId} 占位。`
      : `当前任务：${input.taskId}`;
  const adrDraftSummary =
    input.adrDrafts.length === 0
      ? "无 ADR 草稿。"
      : input.adrDrafts.map((draft) => `- ${draft}`).join("\n");

  return `# Handoff Draft

${taskLine}

## 本次完成

- 待补充。

## Git diff 摘要

${input.gitDiffSummary}

## 验证状态

当前验证状态：${input.verification}

## 遗留问题

### Blocker

${input.blockerSummary}

### 未解决确认请求

${input.confirmReqSummary}

### ADR 草稿

${adrDraftSummary}

## 下一步

- 待补充。
`;
}

function normalizeTaskReference(taskId?: string | null): string {
  return taskId === undefined || taskId === null || taskId.length === 0 ? missingTaskId : taskId;
}
