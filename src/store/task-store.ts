import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { getGitHead, runGit } from "../git/git.js";
import { isNodeError, pathExists } from "../internal/utils.js";
import type { TestResults, VerificationStatus } from "../protocol/schemas.js";
import { getCurrentGitSnapshot } from "../verify/freshness.js";
import {
  ensurePrivateProjectDirectories,
  ensurePrivateTaskDirectories,
  resolvePrivateProjectPaths,
  resolvePrivateTaskPaths,
  resolveProjectIdentity,
  type PrivateProjectPaths,
  type PrivateStoreOptions,
  type PrivateTaskPaths,
} from "./private-paths.js";

export type TaskStatus = "active" | "finished";
export type ResumeReadinessStatus = "ready" | "blocked";

export interface TaskMeta {
  readonly schema: "louisgo-task-meta-v1";
  readonly task_id: string;
  readonly objective: string;
  readonly status: TaskStatus;
  readonly repo_identity: string;
  readonly workspace_root: string;
  readonly branch: string;
  readonly base_head: string;
  readonly current_head: string;
  readonly diff_hash: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface ActiveTaskIndex {
  readonly schema: "louisgo-active-task-v1";
  readonly task_id: string;
  readonly updated_at: string;
}

export interface TaskStateInput {
  readonly objective?: string;
  readonly scope?: string;
  readonly constraints?: string;
  readonly plan?: string;
  readonly progress?: string;
  readonly decisions?: string;
  readonly changedFilesIntent?: string;
  readonly blockers?: string;
  readonly nextActions?: string;
}

export interface TaskSnapshot {
  readonly projectPaths: PrivateProjectPaths;
  readonly taskPaths: PrivateTaskPaths;
  readonly meta: TaskMeta;
  readonly state: string;
  readonly latestCheckpoint: string | null;
  readonly resume: string | null;
  readonly verification: TestResults | null;
}

export interface EnsureActiveTaskOptions extends PrivateStoreOptions {
  readonly taskId?: string;
  readonly objective?: string;
  readonly now?: () => Date;
}

export interface PauseTaskOptions extends EnsureActiveTaskOptions {
  readonly message?: string;
}

export interface ResumeReadiness {
  readonly status: ResumeReadinessStatus;
  readonly mismatches: readonly string[];
}

export async function ensureActiveTask(
  options: EnsureActiveTaskOptions = {},
): Promise<TaskSnapshot> {
  const projectPaths = await resolvePrivateProjectPaths(options);
  await ensurePrivateProjectDirectories(projectPaths);
  const taskId =
    options.taskId ?? (await readActiveTaskId(projectPaths)) ?? (await nextTaskId(projectPaths));
  const taskPaths = resolvePrivateTaskPaths(projectPaths, taskId);

  if (await pathExists(taskPaths.meta)) {
    await writeActiveTask(projectPaths, taskId, options.now);
    return await readTaskSnapshot(projectPaths, taskPaths);
  }

  const identity = await resolveProjectIdentity(options);
  const snapshot = await getCurrentGitSnapshot({ cwd: identity.workspaceRoot });
  const branch = await getCurrentBranch(identity.workspaceRoot);
  const timestamp = (options.now?.() ?? new Date()).toISOString();
  const objective = options.objective?.trim() || "Continue the active coding task";
  const meta: TaskMeta = {
    schema: "louisgo-task-meta-v1",
    task_id: taskId,
    objective,
    status: "active",
    repo_identity: identity.source,
    workspace_root: identity.workspaceRoot,
    branch,
    base_head: snapshot.gitHead,
    current_head: snapshot.gitHead,
    diff_hash: snapshot.diffHash,
    created_at: timestamp,
    updated_at: timestamp,
  };

  await ensurePrivateTaskDirectories(taskPaths);
  await writeJson(taskPaths.meta, meta);
  await writeFile(taskPaths.state, createTaskStateDocument(meta, {}), "utf8");
  await writeActiveTask(projectPaths, taskId, options.now);
  await writeProjectMeta(projectPaths, identity.source);

  return await readTaskSnapshot(projectPaths, taskPaths);
}

export async function pauseTask(options: PauseTaskOptions = {}): Promise<TaskSnapshot> {
  const snapshot = await ensureActiveTask(options);
  const current = await getCurrentGitSnapshot({ cwd: snapshot.projectPaths.workspaceRoot });
  const timestamp = (options.now?.() ?? new Date()).toISOString();
  const nextMeta: TaskMeta = {
    ...snapshot.meta,
    current_head: current.gitHead,
    diff_hash: current.diffHash,
    updated_at: timestamp,
  };
  const checkpoint = createCheckpointDocument({
    meta: nextMeta,
    ...(options.message === undefined ? {} : { message: options.message }),
    timestamp,
  });
  const resume = createResumeDocument({
    meta: nextMeta,
    checkpoint,
    readiness: await checkResumeReadiness(snapshot, nextMeta),
  });

  await writeJson(snapshot.taskPaths.meta, nextMeta);
  await writeFile(snapshot.taskPaths.latestCheckpoint, checkpoint, "utf8");
  await writeFile(snapshot.taskPaths.resume, resume, "utf8");

  return await readTaskSnapshot(snapshot.projectPaths, snapshot.taskPaths);
}

export async function finishTask(options: EnsureActiveTaskOptions = {}): Promise<TaskSnapshot> {
  const snapshot = await pauseTask(options);
  const timestamp = (options.now?.() ?? new Date()).toISOString();
  const meta = {
    ...snapshot.meta,
    status: "finished" as const,
    updated_at: timestamp,
  };
  const finish = `# Task Finish

- task: ${meta.task_id}
- objective: ${meta.objective}
- verification: ${snapshot.verification?.status ?? "missing"}
- git_head: ${meta.current_head}
- diff_hash: ${meta.diff_hash}
- finished_at: ${timestamp}

## Summary

${snapshot.latestCheckpoint ?? "No checkpoint content recorded."}
`;

  await writeJson(snapshot.taskPaths.meta, meta);
  await writeFile(snapshot.taskPaths.finish, finish, "utf8");

  return await readTaskSnapshot(snapshot.projectPaths, snapshot.taskPaths);
}

export async function readCurrentTask(
  options: PrivateStoreOptions & { readonly taskId?: string } = {},
): Promise<TaskSnapshot | null> {
  const projectPaths = await resolvePrivateProjectPaths(options);
  const taskId = options.taskId ?? (await readActiveTaskId(projectPaths));

  if (taskId === null) {
    return null;
  }

  const taskPaths = resolvePrivateTaskPaths(projectPaths, taskId);

  if (!(await pathExists(taskPaths.meta))) {
    return null;
  }

  return await readTaskSnapshot(projectPaths, taskPaths);
}

export async function listTaskMetas(
  options: PrivateStoreOptions = {},
): Promise<readonly TaskMeta[]> {
  const projectPaths = await resolvePrivateProjectPaths(options);

  try {
    const entries = await readdir(projectPaths.tasksDir, { withFileTypes: true });
    const metas = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map(async (entry) =>
          readJson<TaskMeta>(resolvePrivateTaskPaths(projectPaths, entry.name).meta),
        ),
    );
    return metas.sort((left, right) => right.updated_at.localeCompare(left.updated_at));
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

export async function writeTaskVerification(
  options: PrivateStoreOptions & { readonly taskId?: string; readonly testResults: TestResults },
): Promise<TaskSnapshot> {
  const snapshot = await ensureActiveTask(options);
  await writeJson(snapshot.taskPaths.verification, options.testResults);
  return await readTaskSnapshot(snapshot.projectPaths, snapshot.taskPaths);
}

export async function checkResumeReadiness(
  snapshot: TaskSnapshot,
  meta: TaskMeta = snapshot.meta,
): Promise<ResumeReadiness> {
  const mismatches: string[] = [];
  const identity = await resolveProjectIdentity({ cwd: snapshot.projectPaths.workspaceRoot });
  const branch = await getCurrentBranch(snapshot.projectPaths.workspaceRoot);
  const gitHead = await getGitHead({ cwd: snapshot.projectPaths.workspaceRoot });
  const current = await getCurrentGitSnapshot({ cwd: snapshot.projectPaths.workspaceRoot });

  if (identity.source !== meta.repo_identity) {
    mismatches.push(
      `repo identity mismatch: expected ${meta.repo_identity}, got ${identity.source}`,
    );
  }

  if (branch !== meta.branch) {
    mismatches.push(`branch mismatch: expected ${meta.branch}, got ${branch}`);
  }

  if (gitHead !== meta.current_head) {
    mismatches.push(`Git HEAD mismatch: expected ${meta.current_head}, got ${gitHead}`);
  }

  if (current.diffHash !== meta.diff_hash) {
    mismatches.push(`diff_hash mismatch: expected ${meta.diff_hash}, got ${current.diffHash}`);
  }

  return {
    status: mismatches.length === 0 ? "ready" : "blocked",
    mismatches,
  };
}

export function createResumePackage(snapshot: TaskSnapshot, readiness: ResumeReadiness): string {
  const verification = snapshot.verification?.status ?? "missing";
  const blocked =
    readiness.status === "blocked"
      ? `\n## Blocked Resume\n\n${readiness.mismatches.map((item) => `- ${item}`).join("\n")}\n`
      : "";

  return `# LouisGo Resume Package

## Task

- id: ${snapshot.meta.task_id}
- objective: ${snapshot.meta.objective}
- branch: ${snapshot.meta.branch}
- git_head: ${snapshot.meta.current_head}
- diff_hash: ${snapshot.meta.diff_hash}
- verification: ${verification}
- state: private task store

## What To Do First

Resume from the latest checkpoint. Verify repository state before editing, then follow the current user request.

## What To Avoid

- Do not publish private task state into team Git unless the user explicitly asks.

## Latest Checkpoint

${snapshot.latestCheckpoint ?? "No checkpoint has been recorded yet."}
${blocked}`;
}

async function readTaskSnapshot(
  projectPaths: PrivateProjectPaths,
  taskPaths: PrivateTaskPaths,
): Promise<TaskSnapshot> {
  return {
    projectPaths,
    taskPaths,
    meta: await readJson<TaskMeta>(taskPaths.meta),
    state: await readFileIfExists(taskPaths.state),
    latestCheckpoint: await readNullable(taskPaths.latestCheckpoint),
    resume: await readNullable(taskPaths.resume),
    verification: await readJsonIfExists<TestResults>(taskPaths.verification),
  };
}

async function readActiveTaskId(paths: PrivateProjectPaths): Promise<string | null> {
  const index = await readJsonIfExists<ActiveTaskIndex>(paths.activeTask);
  return index?.task_id ?? null;
}

async function writeActiveTask(
  paths: PrivateProjectPaths,
  taskId: string,
  now?: () => Date,
): Promise<void> {
  await writeJson(paths.activeTask, {
    schema: "louisgo-active-task-v1",
    task_id: taskId,
    updated_at: (now?.() ?? new Date()).toISOString(),
  } satisfies ActiveTaskIndex);
}

async function writeProjectMeta(paths: PrivateProjectPaths, repoIdentity: string): Promise<void> {
  await writeJson(paths.projectMeta, {
    schema: "louisgo-project-meta-v1",
    project_key: paths.projectKey,
    repo_identity: repoIdentity,
    workspace_root: paths.workspaceRoot,
  });
}

async function nextTaskId(paths: PrivateProjectPaths): Promise<string> {
  const metas = await listTaskMetas({ cwd: paths.workspaceRoot, louisgoHome: paths.louisgoHome });
  const max = metas.reduce((value, meta) => {
    const match = /^T(\d+)$/.exec(meta.task_id);
    return match === null ? value : Math.max(value, Number.parseInt(match[1]!, 10));
  }, 0);

  return `T${String(max + 1).padStart(3, "0")}`;
}

async function getCurrentBranch(workspaceRoot: string): Promise<string> {
  const result = await runGit(["branch", "--show-current"], {
    cwd: workspaceRoot,
    allowFailure: true,
  });

  return result.stdout.trim() || "detached";
}

function createTaskStateDocument(meta: TaskMeta, input: TaskStateInput): string {
  return `# Task State

- task: ${meta.task_id}
- objective: ${meta.objective}
- status: ${meta.status}

## Scope

${input.scope ?? "Record task scope during pause."}

## Constraints

${input.constraints ?? "Keep private task state out of team Git by default."}

## Plan

${input.plan ?? "Follow the current user request and update checkpoints at task boundaries."}

## Progress

${input.progress ?? "No progress recorded yet."}

## Decisions

${input.decisions ?? "No decisions recorded yet."}

## Changed Files Intent

${input.changedFilesIntent ?? "No changed-file intent recorded yet."}

## Blockers

${input.blockers ?? "No blockers recorded."}

## Next Actions

${input.nextActions ?? "Run louisgo pause after meaningful work, then louisgo resume in a new session."}
`;
}

function createCheckpointDocument(input: {
  readonly meta: TaskMeta;
  readonly message?: string;
  readonly timestamp: string;
}): string {
  return `# Checkpoint

- task: ${input.meta.task_id}
- objective: ${input.meta.objective}
- saved_at: ${input.timestamp}
- git_head: ${input.meta.current_head}
- diff_hash: ${input.meta.diff_hash}

## What Changed

${input.message?.trim() || "No explicit checkpoint message was provided."}

## Decisions

No explicit decisions were recorded by the CLI. Preserve decisions from the current conversation if the user provides them.

## Verification

Verification is recorded separately in the task store when \`louisgo verify\` runs.

## Next Concrete Action

Run \`louisgo resume\` in the next session and follow the current user request.
`;
}

function createResumeDocument(input: {
  readonly meta: TaskMeta;
  readonly checkpoint: string;
  readonly readiness: ResumeReadiness;
}): string {
  const blocked =
    input.readiness.status === "blocked"
      ? `\n## Resume Blockers\n\n${input.readiness.mismatches.map((item) => `- ${item}`).join("\n")}\n`
      : "";

  return `# Resume Prompt

Continue LouisGo task ${input.meta.task_id}: ${input.meta.objective}.

First, verify the repository state. Do not use legacy project singleton files as the primary recovery source.

${input.checkpoint}
${blocked}`;
}

async function readNullable(filePath: string): Promise<string | null> {
  const content = await readFileIfExists(filePath);
  return content.length === 0 ? null : content;
}

async function readFileIfExists(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return "";
    }

    throw error;
  }
}

async function readJsonIfExists<T>(filePath: string): Promise<T | null> {
  try {
    return await readJson<T>(filePath);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

async function readJson<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
