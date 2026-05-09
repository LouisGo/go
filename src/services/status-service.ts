import { readdir, stat } from "node:fs/promises";
import { basename, relative } from "node:path";
import type { ZodType } from "zod";

import { findGitRoot } from "../fs/workspace.js";
import { getGitPorcelainStatus, type GitStatusEntry } from "../git/status.js";
import { isNodeError, pathExists } from "../internal/utils.js";
import { FrontMatterError, readFrontMatter } from "../protocol/frontmatter.js";
import {
  createProtocolPaths,
  type ProtocolPaths,
  verificationIgnoredRelativePaths,
} from "../protocol/paths.js";
import {
  capabilitiesFrontMatterSchema,
  confirmReqFrontMatterSchema,
  missionFrontMatterSchema,
  type LouisGoMode,
  type VerificationStatus,
} from "../protocol/schemas.js";
import {
  listTaskMetas,
  readCurrentTask as readPrivateCurrentTask,
  type TaskMeta,
} from "../store/task-store.js";
import type { PrivateStoreOptions } from "../store/private-paths.js";

export const protocolIssueCodes = {
  missingPath: "MISSING_PATH",
  frontMatterInvalid: "FRONT_MATTER_INVALID",
} as const;

export type ProtocolIssueCode = (typeof protocolIssueCodes)[keyof typeof protocolIssueCodes];
export type RecoverySource = "task" | "none";
export type StatusVerificationState = VerificationStatus;

export interface ProtocolIssue {
  readonly code: ProtocolIssueCode;
  readonly filePath: string;
  readonly relativePath: string;
  readonly message: string;
}

export interface ProtocolStatus {
  readonly workspaceRoot: string;
  readonly complete: boolean;
  readonly issues: readonly ProtocolIssue[];
  readonly mode: LouisGoMode | null;
  readonly phase: "idle";
  readonly currentTask: TaskMeta | null;
  readonly privateTasks: readonly TaskMeta[];
  readonly privateStore: {
    readonly projectKey: string | null;
    readonly path: string | null;
  };
  readonly recoverySource: RecoverySource;
  readonly verificationStatus: StatusVerificationState;
  readonly hasConfirmReq: boolean;
  readonly adrDrafts: readonly string[];
  readonly workspace: WorkspaceSummary;
}

export interface WorkspaceSummary {
  readonly clean: boolean;
  readonly changedFiles: number;
  readonly untrackedFiles: number;
  readonly samplePaths: readonly string[];
}

export interface StatusServiceOptions extends PrivateStoreOptions {}

interface RequiredPath {
  readonly filePath: string;
  readonly kind: "file" | "directory";
}

export async function checkProtocolStatus(
  options: StatusServiceOptions = {},
): Promise<ProtocolStatus> {
  const workspaceRoot = await findGitRoot(options.cwd);
  const paths = createProtocolPaths(workspaceRoot);
  const issues: ProtocolIssue[] = [];

  await checkRequiredPaths(paths, issues);

  const mode = await readMissionMode(paths, issues);
  const phase = "idle" as const;
  const privateTask = await readPrivateCurrentTask(options);
  const privateTasks = await listTaskMetas(options);
  const currentTask = privateTask?.meta ?? null;
  await validateOptionalFrontMatter(paths, issues);
  const recoverySource = privateTask === null ? "none" : "task";
  const verificationStatus = privateTask?.verification?.status ?? "missing";
  const hasConfirmReq = await pathExists(paths.confirmReq);
  const adrDrafts = await listAdrDrafts(paths);
  const workspace = await readWorkspaceSummary(workspaceRoot);

  return {
    workspaceRoot,
    complete: issues.length === 0,
    issues,
    mode,
    phase,
    currentTask,
    privateTasks,
    privateStore:
      privateTask === null
        ? { projectKey: null, path: null }
        : {
            projectKey: privateTask.projectPaths.projectKey,
            path: privateTask.projectPaths.projectDir,
          },
    recoverySource,
    verificationStatus,
    hasConfirmReq,
    adrDrafts,
    workspace,
  };
}

async function checkRequiredPaths(paths: ProtocolPaths, issues: ProtocolIssue[]): Promise<void> {
  const requiredPaths: readonly RequiredPath[] = [
    { filePath: paths.louisgoDir, kind: "directory" },
    { filePath: paths.mission, kind: "file" },
    { filePath: paths.capabilities, kind: "file" },
  ];

  for (const path of requiredPaths) {
    if (!(await pathExists(path.filePath))) {
      issues.push(
        createIssue(
          paths,
          protocolIssueCodes.missingPath,
          path.filePath,
          "Protocol path is missing",
        ),
      );
      continue;
    }

    const pathStat = await stat(path.filePath);
    const isExpectedKind = path.kind === "directory" ? pathStat.isDirectory() : pathStat.isFile();

    if (!isExpectedKind) {
      issues.push(
        createIssue(
          paths,
          protocolIssueCodes.missingPath,
          path.filePath,
          "Protocol path has the wrong type",
        ),
      );
    }
  }
}

async function readMissionMode(
  paths: ProtocolPaths,
  issues: ProtocolIssue[],
): Promise<LouisGoMode | null> {
  if (!(await pathExists(paths.mission))) {
    return null;
  }

  try {
    const document = await readFrontMatter(paths.mission, missionFrontMatterSchema);
    return document.frontMatter.defaultMode;
  } catch (error) {
    issues.push(createFrontMatterIssue(paths, paths.mission, error));
    return null;
  }
}

async function validateOptionalFrontMatter(
  paths: ProtocolPaths,
  issues: ProtocolIssue[],
): Promise<void> {
  const optionalFiles: readonly { readonly filePath: string; readonly schema: ZodType<unknown> }[] =
    [
      { filePath: paths.capabilities, schema: capabilitiesFrontMatterSchema },
      { filePath: paths.confirmReq, schema: confirmReqFrontMatterSchema },
    ] as const;

  for (const file of optionalFiles) {
    if (!(await pathExists(file.filePath))) {
      continue;
    }

    try {
      await readFrontMatter(file.filePath, file.schema);
    } catch (error) {
      issues.push(createFrontMatterIssue(paths, file.filePath, error));
    }
  }
}

async function listAdrDrafts(paths: ProtocolPaths): Promise<string[]> {
  if (!(await pathExists(paths.adrDraftDir))) {
    return [];
  }

  const entries = await readdir(paths.adrDraftDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name)
    .sort();
}

async function readWorkspaceSummary(workspaceRoot: string): Promise<WorkspaceSummary> {
  const entries = (await getGitPorcelainStatus({ cwd: workspaceRoot })).filter(
    (entry) => !isDiagnosticOnlyPath(entry.path),
  );
  const untrackedFiles = entries.filter((entry) => isUntracked(entry)).length;

  return {
    clean: entries.length === 0,
    changedFiles: entries.length,
    untrackedFiles,
    samplePaths: entries.slice(0, 5).map(formatStatusPath),
  };
}

function isDiagnosticOnlyPath(path: string): boolean {
  return verificationIgnoredRelativePaths.some(
    (ignored) => path === ignored || path.startsWith(ignored),
  );
}

function isUntracked(entry: GitStatusEntry): boolean {
  return entry.indexStatus === "?" && entry.workTreeStatus === "?";
}

function formatStatusPath(entry: GitStatusEntry): string {
  if (entry.originalPath !== undefined) {
    return `${entry.originalPath} -> ${entry.path}`;
  }

  return entry.path;
}

async function statIfExists(filePath: string): Promise<Awaited<ReturnType<typeof stat>> | null> {
  try {
    return await stat(filePath);
  } catch {
    return null;
  }
}

function createFrontMatterIssue(
  paths: ProtocolPaths,
  filePath: string,
  error: unknown,
): ProtocolIssue {
  const message =
    error instanceof FrontMatterError ? error.message : "Front Matter schema validation failed";
  return createIssue(paths, protocolIssueCodes.frontMatterInvalid, filePath, message);
}

function createIssue(
  paths: ProtocolPaths,
  code: ProtocolIssueCode,
  filePath: string,
  message: string,
): ProtocolIssue {
  return {
    code,
    filePath,
    relativePath: relative(paths.workspaceRoot, filePath) || basename(filePath),
    message,
  };
}
