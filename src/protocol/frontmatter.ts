import matter from "gray-matter";
import type { GrayMatterFile } from "gray-matter";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";

export const frontMatterErrorCodes = {
  missingFrontMatter: "MISSING_FRONT_MATTER",
  malformedFrontMatter: "MALFORMED_FRONT_MATTER",
  schemaInvalid: "SCHEMA_INVALID",
} as const;

export type FrontMatterErrorCode =
  (typeof frontMatterErrorCodes)[keyof typeof frontMatterErrorCodes];

export interface FrontMatterIssue {
  readonly field: string;
  readonly message: string;
}

export class FrontMatterError extends Error {
  readonly code: FrontMatterErrorCode;
  readonly filePath: string;
  readonly issues?: readonly FrontMatterIssue[];

  constructor(params: {
    readonly code: FrontMatterErrorCode;
    readonly filePath: string;
    readonly message: string;
    readonly issues?: readonly FrontMatterIssue[];
  }) {
    super(params.message);
    this.name = "FrontMatterError";
    this.code = params.code;
    this.filePath = params.filePath;

    if (params.issues !== undefined) {
      this.issues = params.issues;
    }
  }
}

export interface MarkdownDocument<TFrontMatter> {
  readonly frontMatter: TFrontMatter;
  readonly body: string;
}

export async function readFrontMatter<TFrontMatter>(
  filePath: string,
  schema: z.ZodType<TFrontMatter>,
): Promise<MarkdownDocument<TFrontMatter>> {
  const resolvedPath = resolve(filePath);
  const source = await readFile(resolvedPath, "utf8");

  if (!hasOpeningFrontMatterFence(source)) {
    throw new FrontMatterError({
      code: frontMatterErrorCodes.missingFrontMatter,
      filePath: resolvedPath,
      message: `缺少 Front Matter：${resolvedPath}`,
    });
  }

  if (!hasClosingFrontMatterFence(source)) {
    throw new FrontMatterError({
      code: frontMatterErrorCodes.malformedFrontMatter,
      filePath: resolvedPath,
      message: `Front Matter 缺少结束分隔符：${resolvedPath}`,
    });
  }

  const parsed = parseMatter(source, resolvedPath);
  const result = schema.safeParse(parsed.data);

  if (!result.success) {
    throw new FrontMatterError({
      code: frontMatterErrorCodes.schemaInvalid,
      filePath: resolvedPath,
      message: `Front Matter schema 校验失败：${resolvedPath}`,
      issues: result.error.issues.map((issue) => ({
        field: issue.path.length === 0 ? "<root>" : issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  return {
    frontMatter: result.data,
    body: parsed.content,
  };
}

export async function writeFrontMatter(
  filePath: string,
  frontMatter: Record<string, unknown>,
  body: string,
  schema: z.ZodType<unknown>,
): Promise<void> {
  const resolvedPath = resolve(filePath);
  const result = schema.safeParse(frontMatter);

  if (!result.success) {
    throw new FrontMatterError({
      code: frontMatterErrorCodes.schemaInvalid,
      filePath: resolvedPath,
      message: `Front Matter schema 校验失败：${resolvedPath}`,
      issues: result.error.issues.map((issue) => ({
        field: issue.path.length === 0 ? "<root>" : issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  const source = matter.stringify(body, frontMatter);
  await writeFile(resolvedPath, source, "utf8");
}

function parseMatter(source: string, filePath: string): GrayMatterFile<string> {
  try {
    return matter(source);
  } catch (error) {
    throw new FrontMatterError({
      code: frontMatterErrorCodes.malformedFrontMatter,
      filePath,
      message: `Front Matter 解析失败：${filePath}`,
      issues: [
        {
          field: "<frontmatter>",
          message: error instanceof Error ? error.message : String(error),
        },
      ],
    });
  }
}

function hasOpeningFrontMatterFence(source: string): boolean {
  const [firstLine] = source.trimStart().split(/\r?\n/, 1);
  return firstLine === "---";
}

function hasClosingFrontMatterFence(source: string): boolean {
  const lines = source.trimStart().split(/\r?\n/);
  return lines.slice(1).some((line) => line.trim() === "---");
}
