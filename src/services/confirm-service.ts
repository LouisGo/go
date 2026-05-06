import { findGitRoot } from "../fs/workspace.js";
import { pathExists } from "../internal/utils.js";
import { readFrontMatter } from "../protocol/frontmatter.js";
import { createProtocolPaths, protocolRelativePaths } from "../protocol/paths.js";
import { confirmReqFrontMatterSchema, type ConfirmReqFrontMatter } from "../protocol/schemas.js";

export const confirmServiceErrorCodes = {
  requestMissing: "CONFIRM_REQ_MISSING",
  choiceInvalid: "CONFIRM_CHOICE_INVALID",
} as const;

export type ConfirmServiceErrorCode =
  (typeof confirmServiceErrorCodes)[keyof typeof confirmServiceErrorCodes];

export interface ConfirmServiceOptions {
  readonly cwd?: string;
}

export interface ConfirmChoice {
  readonly key: string;
  readonly text: string;
}

export interface ConfirmRequestView {
  readonly workspaceRoot: string;
  readonly filePath: string;
  readonly relativePath: string;
  readonly frontMatter: ConfirmReqFrontMatter;
  readonly title: string;
  readonly background: string;
  readonly choices: readonly ConfirmChoice[];
  readonly recommendation: string;
  readonly body: string;
}

export interface ConfirmChoiceSelection extends ConfirmRequestView {
  readonly selectedChoice: ConfirmChoice;
}

export class ConfirmServiceError extends Error {
  readonly code: ConfirmServiceErrorCode;

  constructor(params: { readonly code: ConfirmServiceErrorCode; readonly message: string }) {
    super(params.message);
    this.name = "ConfirmServiceError";
    this.code = params.code;
  }
}

export async function readConfirmRequest(
  options: ConfirmServiceOptions = {},
): Promise<ConfirmRequestView | null> {
  const workspaceRoot = await findGitRoot(options.cwd);
  const paths = createProtocolPaths(workspaceRoot);

  if (!(await pathExists(paths.confirmReq))) {
    return null;
  }

  const document = await readFrontMatter(paths.confirmReq, confirmReqFrontMatterSchema);
  const sections = parseMarkdownSections(document.body);

  return {
    workspaceRoot,
    filePath: paths.confirmReq,
    relativePath: protocolRelativePaths.confirmReq,
    frontMatter: document.frontMatter,
    title: parseTitle(document.body) ?? "Confirm Request",
    background: sections.get("背景")?.trim() ?? "",
    choices: parseChoices(sections.get("选项") ?? ""),
    recommendation: sections.get("建议")?.trim() ?? "",
    body: document.body,
  };
}

export async function selectConfirmChoice(params: {
  readonly cwd?: string;
  readonly choice: string;
}): Promise<ConfirmChoiceSelection> {
  const request = await readConfirmRequest(params);

  if (request === null) {
    throw new ConfirmServiceError({
      code: confirmServiceErrorCodes.requestMissing,
      message: "当前没有未解决确认请求。",
    });
  }

  const normalizedChoice = params.choice.trim().toUpperCase();
  const selectedChoice = request.choices.find((choice) => choice.key === normalizedChoice);

  if (selectedChoice === undefined) {
    throw new ConfirmServiceError({
      code: confirmServiceErrorCodes.choiceInvalid,
      message: `无效选择：${params.choice}`,
    });
  }

  return {
    ...request,
    selectedChoice,
  };
}

function parseTitle(body: string): string | null {
  for (const line of body.split(/\r?\n/)) {
    const match = /^#\s+(.+)$/.exec(line.trim());

    if (match !== null) {
      return match[1]!.trim();
    }
  }

  return null;
}

function parseMarkdownSections(body: string): Map<string, string> {
  const sections = new Map<string, string>();
  let currentTitle: string | null = null;
  let currentLines: string[] = [];

  for (const line of body.split(/\r?\n/)) {
    const heading = /^##\s+(.+)$/.exec(line.trim());

    if (heading !== null) {
      if (currentTitle !== null) {
        sections.set(currentTitle, currentLines.join("\n"));
      }

      currentTitle = heading[1]!.trim();
      currentLines = [];
      continue;
    }

    if (currentTitle !== null) {
      currentLines.push(line);
    }
  }

  if (currentTitle !== null) {
    sections.set(currentTitle, currentLines.join("\n"));
  }

  return sections;
}

function parseChoices(source: string): ConfirmChoice[] {
  return source
    .split(/\r?\n/)
    .map((line) => /^-\s+([A-Z])\.\s+(.+)$/.exec(line.trim()))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => ({
      key: match[1]!.toUpperCase(),
      text: match[2]!.trim(),
    }));
}
