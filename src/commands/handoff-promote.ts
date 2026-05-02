import type { Command } from "commander";
import type { Writable } from "node:stream";

import {
  HandoffServiceError,
  handoffServiceErrorCodes,
  promoteHandoff,
  type HandoffServiceOptions,
  type PromoteHandoffResult,
} from "../services/handoff-service.js";

export interface RegisterHandoffPromoteCommandOptions extends HandoffServiceOptions {
  readonly stdout?: Writable;
  readonly stderr?: Writable;
  readonly setExitCode?: (exitCode: number) => void;
}

export function registerHandoffPromoteCommand(
  program: Command,
  options: RegisterHandoffPromoteCommandOptions = {},
): void {
  const handoff = program.command("handoff").description("管理 LouisGo 正式交接");

  handoff
    .command("promote")
    .description("将 HANDOFF_DRAFT.md 提升为 HANDOFF.md")
    .allowExcessArguments(false)
    .action(async () => {
      const stdout = options.stdout ?? process.stdout;
      const stderr = options.stderr ?? process.stderr;
      const setExitCode =
        options.setExitCode ??
        ((exitCode: number) => {
          process.exitCode = exitCode;
        });

      try {
        const result = await promoteHandoff(options);
        stdout.write(formatPromoteReport(result));
        setExitCode(0);
      } catch (error) {
        if (!(error instanceof HandoffServiceError)) {
          throw error;
        }

        stderr.write(`交接提升失败：${formatHandoffError(error)}\n`);
        setExitCode(1);
      }
    });
}

function formatPromoteReport(result: PromoteHandoffResult): string {
  return (
    [
      `LouisGo 正式交接已生成：${result.filePath}`,
      `来源草稿：${result.draftPath}`,
      `当前任务：${result.frontMatter.taskId}`,
      `验证状态：${result.frontMatter.verification}`,
      `写入状态：${result.status === "created" ? "新建" : "更新"}`,
      "下一步：运行 louisgo status 查看恢复状态",
    ].join("\n") + "\n"
  );
}

function formatHandoffError(error: HandoffServiceError): string {
  switch (error.code) {
    case handoffServiceErrorCodes.draftMissing:
      return "HANDOFF_DRAFT.md 不存在，请先运行 louisgo finish";
    case handoffServiceErrorCodes.draftInvalid:
      return "HANDOFF_DRAFT.md Front Matter 非法，请修复后重试";
  }
}
