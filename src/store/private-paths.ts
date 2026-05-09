import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

import { findGitRoot } from "../fs/workspace.js";
import { runGit } from "../git/git.js";

export interface PrivateStoreOptions {
  readonly cwd?: string;
  readonly louisgoHome?: string;
  readonly env?: NodeJS.ProcessEnv;
}

export interface ProjectIdentity {
  readonly workspaceRoot: string;
  readonly projectKey: string;
  readonly source: string;
}

export interface PrivateProjectPaths {
  readonly louisgoHome: string;
  readonly workspaceRoot: string;
  readonly projectKey: string;
  readonly projectDir: string;
  readonly projectMeta: string;
  readonly activeTask: string;
  readonly tasksDir: string;
  readonly statsDir: string;
  readonly statsEvents: string;
  readonly statsImports: string;
  readonly runLog: string;
}

export interface PrivateTaskPaths extends PrivateProjectPaths {
  readonly taskId: string;
  readonly taskDir: string;
  readonly meta: string;
  readonly state: string;
  readonly checkpointsDir: string;
  readonly latestCheckpoint: string;
  readonly resume: string;
  readonly verification: string;
  readonly finish: string;
}

export async function resolvePrivateProjectPaths(
  options: PrivateStoreOptions = {},
): Promise<PrivateProjectPaths> {
  const identity = await resolveProjectIdentity(options);
  const louisgoHome = resolve(
    options.louisgoHome ??
      options.env?.LOUISGO_HOME ??
      process.env.LOUISGO_HOME ??
      join(homedir(), ".louisgo"),
  );
  const projectDir = join(louisgoHome, "projects", identity.projectKey);

  return {
    louisgoHome,
    workspaceRoot: identity.workspaceRoot,
    projectKey: identity.projectKey,
    projectDir,
    projectMeta: join(projectDir, "project.json"),
    activeTask: join(projectDir, "active-task.json"),
    tasksDir: join(projectDir, "tasks"),
    statsDir: join(projectDir, "stats"),
    statsEvents: join(projectDir, "stats", "events.jsonl"),
    statsImports: join(projectDir, "stats", "imports.json"),
    runLog: join(projectDir, "RUNLOG.md"),
  };
}

export function resolvePrivateTaskPaths(
  projectPaths: PrivateProjectPaths,
  taskId: string,
): PrivateTaskPaths {
  const taskDir = join(projectPaths.tasksDir, taskId);

  return {
    ...projectPaths,
    taskId,
    taskDir,
    meta: join(taskDir, "meta.json"),
    state: join(taskDir, "state.md"),
    checkpointsDir: join(taskDir, "checkpoints"),
    latestCheckpoint: join(taskDir, "checkpoints", "latest.md"),
    resume: join(taskDir, "resume.md"),
    verification: join(taskDir, "verification.json"),
    finish: join(taskDir, "finish.md"),
  };
}

export async function ensurePrivateProjectDirectories(paths: PrivateProjectPaths): Promise<void> {
  await mkdir(paths.tasksDir, { recursive: true });
}

export async function ensurePrivateTaskDirectories(paths: PrivateTaskPaths): Promise<void> {
  await mkdir(paths.checkpointsDir, { recursive: true });
}

export async function resolveProjectIdentity(
  options: PrivateStoreOptions = {},
): Promise<ProjectIdentity> {
  const workspaceRoot = await findGitRoot(options.cwd);
  const remote = await runGit(["config", "--get", "remote.origin.url"], {
    cwd: workspaceRoot,
    allowFailure: true,
  });
  const topLevel = await runGit(["rev-parse", "--show-toplevel"], {
    cwd: workspaceRoot,
    allowFailure: true,
  });
  const source =
    remote.exitCode === 0 && remote.stdout.trim().length > 0
      ? `git:${remote.stdout.trim()}`
      : `path:${topLevel.stdout.trim() || workspaceRoot}`;
  const projectKey = createHash("sha256").update(source).digest("hex").slice(0, 24);

  return {
    workspaceRoot,
    projectKey,
    source,
  };
}
