import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import { findGitRoot } from "../fs/workspace.js";
import { getCurrentGitSnapshot } from "../verify/freshness.js";
import { writeFrontMatter } from "./frontmatter.js";
import { createProtocolPaths } from "./paths.js";
import {
  missingTaskId,
  quickSaveFrontMatterSchema,
  type LouisGoMode,
  type QuickSaveFrontMatter,
} from "./schemas.js";

export interface WriteQuickSaveOptions {
  readonly cwd?: string;
  readonly mode: LouisGoMode;
  readonly taskId?: string | null;
  readonly now?: () => Date;
}

export interface QuickSaveFrontMatterInput {
  readonly mode: LouisGoMode;
  readonly taskId?: string | null;
  readonly gitHead: string;
  readonly diffHash: string;
  readonly savedAt: string;
}

export interface QuickSaveFrontMatterJson {
  readonly schema: "louisgo-quick-save-v1";
  readonly mode: LouisGoMode;
  readonly task_id: string;
  readonly git_head: string;
  readonly diff_hash: string;
  readonly saved_at: string;
}

export interface WriteQuickSaveResult {
  readonly workspaceRoot: string;
  readonly filePath: string;
  readonly frontMatter: QuickSaveFrontMatter;
  readonly body: string;
}

export async function writeQuickSave(
  options: WriteQuickSaveOptions,
): Promise<WriteQuickSaveResult> {
  const workspaceRoot = await findGitRoot(options.cwd);
  const paths = createProtocolPaths(workspaceRoot);
  const snapshot = await getCurrentGitSnapshot({ cwd: workspaceRoot });
  const savedAt = (options.now?.() ?? new Date()).toISOString();
  const frontMatter = serializeQuickSaveFrontMatter({
    mode: options.mode,
    taskId: options.taskId ?? null,
    gitHead: snapshot.gitHead,
    diffHash: snapshot.diffHash,
    savedAt,
  });
  const body = createQuickSaveBody(options.taskId);

  await mkdir(dirname(paths.quickSave), { recursive: true });
  await writeFrontMatter(paths.quickSave, { ...frontMatter }, body, quickSaveFrontMatterSchema);

  return {
    workspaceRoot,
    filePath: paths.quickSave,
    frontMatter: quickSaveFrontMatterSchema.parse(frontMatter),
    body,
  };
}

export function serializeQuickSaveFrontMatter(
  input: QuickSaveFrontMatterInput,
): QuickSaveFrontMatterJson {
  return {
    schema: "louisgo-quick-save-v1",
    mode: input.mode,
    task_id: normalizeTaskReference(input.taskId),
    git_head: input.gitHead,
    diff_hash: input.diffHash,
    saved_at: input.savedAt,
  };
}

export function createQuickSaveBody(taskId?: string | null): string {
  const taskLine =
    taskId === undefined || taskId === null
      ? `The current ROADMAP has no available task; task_id uses ${missingTaskId} as a placeholder.`
      : `Current task: ${taskId}`;

  return `# Quick Save

${taskLine}

## Current Progress

## Next Step

## Open Issues
`;
}

function normalizeTaskReference(taskId?: string | null): string {
  return taskId === undefined || taskId === null || taskId.length === 0 ? missingTaskId : taskId;
}
