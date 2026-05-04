import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import { findGitRoot } from "../fs/workspace.js";
import { pathExists } from "../internal/utils.js";
import { readFrontMatter, writeFrontMatter } from "./frontmatter.js";
import { createProtocolPaths } from "./paths.js";
import {
  confirmReqFrontMatterSchema,
  missingTaskId,
  type ConfirmReqFrontMatter,
  type LouisGoMode,
} from "./schemas.js";

export const confirmReqWriteStatuses = {
  created: "created",
  openExists: "open_exists",
} as const;

export type ConfirmReqWriteStatus =
  (typeof confirmReqWriteStatuses)[keyof typeof confirmReqWriteStatuses];

export interface CreateConfirmReqOptions {
  readonly cwd?: string;
  readonly mode: LouisGoMode;
  readonly taskId?: string | null;
  readonly now?: () => Date;
}

export interface ConfirmReqFrontMatterInput {
  readonly mode: LouisGoMode;
  readonly taskId?: string | null;
  readonly createdAt: string;
}

export interface ConfirmReqFrontMatterJson {
  readonly schema: "louisgo-confirm-req-v1";
  readonly mode: LouisGoMode;
  readonly task_id: string;
  readonly status: "open";
  readonly created_at: string;
}

export interface ConfirmReqCreated {
  readonly status: typeof confirmReqWriteStatuses.created;
  readonly workspaceRoot: string;
  readonly filePath: string;
  readonly frontMatter: ConfirmReqFrontMatter;
  readonly body: string;
}

export interface ConfirmReqOpenExists {
  readonly status: typeof confirmReqWriteStatuses.openExists;
  readonly workspaceRoot: string;
  readonly filePath: string;
  readonly frontMatter: ConfirmReqFrontMatter;
}

export type CreateConfirmReqResult = ConfirmReqCreated | ConfirmReqOpenExists;

export async function createConfirmReq(
  options: CreateConfirmReqOptions,
): Promise<CreateConfirmReqResult> {
  const workspaceRoot = await findGitRoot(options.cwd);
  const paths = createProtocolPaths(workspaceRoot);

  if (await pathExists(paths.confirmReq)) {
    const document = await readFrontMatter(paths.confirmReq, confirmReqFrontMatterSchema);

    return {
      status: confirmReqWriteStatuses.openExists,
      workspaceRoot,
      filePath: paths.confirmReq,
      frontMatter: document.frontMatter,
    };
  }

  const createdAt = (options.now?.() ?? new Date()).toISOString();
  const frontMatter = serializeConfirmReqFrontMatter({
    mode: options.mode,
    taskId: options.taskId ?? null,
    createdAt,
  });
  const body = createConfirmReqBody(options.taskId);

  await mkdir(dirname(paths.confirmReq), { recursive: true });
  await writeFrontMatter(paths.confirmReq, { ...frontMatter }, body, confirmReqFrontMatterSchema);

  return {
    status: confirmReqWriteStatuses.created,
    workspaceRoot,
    filePath: paths.confirmReq,
    frontMatter: confirmReqFrontMatterSchema.parse(frontMatter),
    body,
  };
}

export function serializeConfirmReqFrontMatter(
  input: ConfirmReqFrontMatterInput,
): ConfirmReqFrontMatterJson {
  return {
    schema: "louisgo-confirm-req-v1",
    mode: input.mode,
    task_id: normalizeTaskReference(input.taskId),
    status: "open",
    created_at: input.createdAt,
  };
}

export function createConfirmReqBody(taskId?: string | null): string {
  const taskLine =
    taskId === undefined || taskId === null
      ? `当前 ROADMAP 没有可用任务，task_id 使用 ${missingTaskId} 占位。`
      : `当前任务：${taskId}`;

  return `# Confirm Request

${taskLine}

## 背景

## 选项

- A. 选项说明
- B. 选项说明
- C. 选项说明
- D. 我重新说明需求

## 建议
`;
}

function normalizeTaskReference(taskId?: string | null): string {
  return taskId === undefined || taskId === null || taskId.length === 0 ? missingTaskId : taskId;
}

