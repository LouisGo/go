import type { Command } from "commander";
import type { Writable } from "node:stream";

import {
  finishCleanupStatuses,
  finishLouisGo,
  FinishServiceError,
  finishServiceErrorCodes,
  type FinishCleanupStatus,
  type FinishServiceOptions,
  type FinishServiceResult,
} from "../services/finish-service.js";

export interface RegisterFinishCommandOptions extends FinishServiceOptions {
  readonly stdout?: Writable;
  readonly stderr?: Writable;
  readonly setExitCode?: (exitCode: number) => void;
}

export function registerFinishCommand(
  program: Command,
  options: RegisterFinishCommandOptions = {},
): void {
  program
    .command("finish")
    .description("生成 LouisGo 交接草稿")
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
        const result = await finishLouisGo(options);
        stdout.write(formatFinishReport(result));
        setExitCode(0);
      } catch (error) {
        if (
          !(error instanceof FinishServiceError) ||
          error.code !== finishServiceErrorCodes.protocolIncomplete
        ) {
          throw error;
        }

        stderr.write("收尾失败：LouisGo 协议不完整，请先运行 louisgo init。\n");
        if (error.issues.length > 0) {
          stderr.write("需要处理的问题：\n");
          for (const issue of error.issues) {
            stderr.write(`- ${issue.relativePath}：${issue.message}\n`);
          }
        }
        setExitCode(1);
      }
    });
}

function formatFinishReport(result: FinishServiceResult): string {
  return (
    [
      `LouisGo 交接草稿已生成：${result.filePath}`,
      `当前任务：${result.frontMatter.taskId}`,
      `验证状态：${result.verification}`,
      `Confirm Request：${formatCleanup(result.confirmReqCleanup)}`,
      `Quick Save：${formatCleanup(result.quickSaveCleanup)}`,
      "HANDOFF.md：未写入",
      "下一步：review HANDOFF_DRAFT.md 并执行 louisgo handoff promote",
    ].join("\n") + "\n"
  );
}

function formatCleanup(status: FinishCleanupStatus): string {
  switch (status) {
    case finishCleanupStatuses.cleaned:
      return "已转存并清理";
    case finishCleanupStatuses.absent:
      return "无";
  }
}
