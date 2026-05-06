import { readdir, readFile, stat } from "node:fs/promises";
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
import { parseRoadmap, RoadmapParseError, type RoadmapTask } from "../protocol/roadmap.js";
import {
  capabilitiesFrontMatterSchema,
  confirmReqFrontMatterSchema,
  handoffFrontMatterSchema,
  memoryFrontMatterSchema,
  missionFrontMatterSchema,
  quickSaveFrontMatterSchema,
  stateFrontMatterSchema,
  type LouisGoMode,
  type VerificationStatus,
  type WorkPhase,
} from "../protocol/schemas.js";
import { TestResultsError, testResultsErrorCodes } from "../protocol/test-results.js";
import { checkVerificationFreshness } from "../verify/freshness.js";

export const protocolIssueCodes = {
  missingPath: "MISSING_PATH",
  frontMatterInvalid: "FRONT_MATTER_INVALID",
  roadmapInvalid: "ROADMAP_INVALID",
  testResultsInvalid: "TEST_RESULTS_INVALID",
} as const;

export type ProtocolIssueCode = (typeof protocolIssueCodes)[keyof typeof protocolIssueCodes];
export type RecoverySource = "handoff" | "state" | "quick_save" | "none";
export type StatusVerificationState = VerificationStatus | "unchecked";

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
  readonly phase: WorkPhase;
  readonly currentTask: RoadmapTask | null;
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

export interface StatusServiceOptions {
  readonly cwd?: string;
}

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
  const phase = await readWorkPhase(paths, issues);
  const currentTask = await readCurrentTask(paths, issues);
  await validateOptionalFrontMatter(paths, issues);
  const recoverySource = await detectRecoverySource(paths);
  const verificationStatus = await readVerificationStatus(paths, issues);
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
    { filePath: paths.scriptsDir, kind: "directory" },
    { filePath: paths.adrDir, kind: "directory" },
    { filePath: paths.adrDraftDir, kind: "directory" },
    { filePath: paths.memoryDir, kind: "directory" },
    { filePath: paths.sessionsDir, kind: "directory" },
    { filePath: paths.mission, kind: "file" },
    { filePath: paths.roadmap, kind: "file" },
    { filePath: paths.state, kind: "file" },
    { filePath: paths.memory, kind: "file" },
    { filePath: paths.blocker, kind: "file" },
    { filePath: paths.capabilities, kind: "file" },
    { filePath: paths.verifySh, kind: "file" },
    { filePath: paths.verifyPs1, kind: "file" },
  ];

  for (const path of requiredPaths) {
    if (!(await pathExists(path.filePath))) {
      issues.push(
        createIssue(paths, protocolIssueCodes.missingPath, path.filePath, "协议路径缺失"),
      );
      continue;
    }

    const pathStat = await stat(path.filePath);
    const isExpectedKind = path.kind === "directory" ? pathStat.isDirectory() : pathStat.isFile();

    if (!isExpectedKind) {
      issues.push(
        createIssue(paths, protocolIssueCodes.missingPath, path.filePath, "协议路径类型不正确"),
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

async function readWorkPhase(paths: ProtocolPaths, issues: ProtocolIssue[]): Promise<WorkPhase> {
  if (!(await pathExists(paths.state))) {
    return "idle";
  }

  try {
    const document = await readFrontMatter(paths.state, stateFrontMatterSchema);
    return document.frontMatter.phase ?? "idle";
  } catch (error) {
    issues.push(createFrontMatterIssue(paths, paths.state, error));
    return "idle";
  }
}

async function readCurrentTask(
  paths: ProtocolPaths,
  issues: ProtocolIssue[],
): Promise<RoadmapTask | null> {
  if (!(await pathExists(paths.roadmap))) {
    return null;
  }

  try {
    const roadmap = parseRoadmap(await readFile(paths.roadmap, "utf8"));
    return roadmap.firstIncompleteTask;
  } catch (error) {
    const message =
      error instanceof RoadmapParseError
        ? error.issues.map((issue) => issue.message).join("；")
        : "ROADMAP.md 解析失败";
    issues.push(createIssue(paths, protocolIssueCodes.roadmapInvalid, paths.roadmap, message));
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
      { filePath: paths.quickSave, schema: quickSaveFrontMatterSchema },
      { filePath: paths.handoff, schema: handoffFrontMatterSchema },
      { filePath: paths.confirmReq, schema: confirmReqFrontMatterSchema },
      { filePath: paths.state, schema: stateFrontMatterSchema },
      { filePath: paths.memory, schema: memoryFrontMatterSchema },
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

async function detectRecoverySource(paths: ProtocolPaths): Promise<RecoverySource> {
  if ((await statIfExists(paths.handoff)) !== null) {
    return "handoff";
  }

  if ((await statIfExists(paths.state)) !== null) {
    return "state";
  }

  if ((await statIfExists(paths.quickSave)) !== null) {
    return "quick_save";
  }

  return "none";
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

async function readVerificationStatus(
  paths: ProtocolPaths,
  issues: ProtocolIssue[],
): Promise<StatusVerificationState> {
  try {
    const freshness = await checkVerificationFreshness({
      cwd: paths.workspaceRoot,
      testResultsPath: paths.testResults,
    });
    return freshness.status;
  } catch (error) {
    if (!(error instanceof TestResultsError) || error.code !== testResultsErrorCodes.invalid) {
      throw error;
    }

    issues.push(
      createIssue(
        paths,
        protocolIssueCodes.testResultsInvalid,
        paths.testResults,
        "test-results.json 格式错误",
      ),
    );
    return "unchecked";
  }
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
    error instanceof FrontMatterError ? error.message : "Front Matter schema 校验失败";
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
