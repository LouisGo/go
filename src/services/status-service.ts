import { access, readdir, readFile, stat } from "node:fs/promises";
import { basename, relative } from "node:path";
import type { ZodType } from "zod";

import { findGitRoot } from "../fs/workspace.js";
import { FrontMatterError, readFrontMatter } from "../protocol/frontmatter.js";
import { createProtocolPaths, type ProtocolPaths } from "../protocol/paths.js";
import { parseRoadmap, RoadmapParseError, type RoadmapTask } from "../protocol/roadmap.js";
import {
  capabilitiesFrontMatterSchema,
  confirmReqFrontMatterSchema,
  handoffFrontMatterSchema,
  missionFrontMatterSchema,
  quickSaveFrontMatterSchema,
  testResultsSchema,
  type LouisGoMode,
  type VerificationStatus,
} from "../protocol/schemas.js";

export const protocolIssueCodes = {
  missingPath: "MISSING_PATH",
  frontMatterInvalid: "FRONT_MATTER_INVALID",
  roadmapInvalid: "ROADMAP_INVALID",
} as const;

export type ProtocolIssueCode = (typeof protocolIssueCodes)[keyof typeof protocolIssueCodes];
export type RecoverySource = "quick_save" | "handoff" | "none";
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
  readonly currentTask: RoadmapTask | null;
  readonly recoverySource: RecoverySource;
  readonly verificationStatus: StatusVerificationState;
  readonly hasConfirmReq: boolean;
  readonly adrDrafts: readonly string[];
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
  const currentTask = await readCurrentTask(paths, issues);
  await validateOptionalFrontMatter(paths, issues);

  return {
    workspaceRoot,
    complete: issues.length === 0,
    issues,
    mode,
    currentTask,
    recoverySource: await detectRecoverySource(paths),
    verificationStatus: await readVerificationStatus(paths, issues),
    hasConfirmReq: await pathExists(paths.confirmReq),
    adrDrafts: await listAdrDrafts(paths),
  };
}

async function checkRequiredPaths(paths: ProtocolPaths, issues: ProtocolIssue[]): Promise<void> {
  const requiredPaths: readonly RequiredPath[] = [
    { filePath: paths.louisgoDir, kind: "directory" },
    { filePath: paths.scriptsDir, kind: "directory" },
    { filePath: paths.adrDir, kind: "directory" },
    { filePath: paths.adrDraftDir, kind: "directory" },
    { filePath: paths.mission, kind: "file" },
    { filePath: paths.roadmap, kind: "file" },
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
  const quickSaveStat = await statIfExists(paths.quickSave);
  const handoffStat = await statIfExists(paths.handoff);

  if (
    quickSaveStat !== null &&
    (handoffStat === null || quickSaveStat.mtimeMs > handoffStat.mtimeMs)
  ) {
    return "quick_save";
  }

  if (handoffStat !== null) {
    return "handoff";
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
  if (!(await pathExists(paths.testResults))) {
    return "missing";
  }

  try {
    const parsed = testResultsSchema.parse(JSON.parse(await readFile(paths.testResults, "utf8")));
    return parsed.status;
  } catch {
    issues.push(
      createIssue(
        paths,
        protocolIssueCodes.frontMatterInvalid,
        paths.testResults,
        "test-results.json 格式错误",
      ),
    );
    return "unchecked";
  }
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
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
