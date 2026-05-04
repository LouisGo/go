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
import { appendRunLogEvent } from "../services/run-log-service.js";

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
        await appendRunLogEvent({
          cwd: result.workspaceRoot,
          command: "finish",
          outcome: "success",
          note: `task=${result.frontMatter.taskId}; verification=${result.verification}; confirm_cleanup=${result.confirmReqCleanup}; quick_save_cleanup=${result.quickSaveCleanup}`,
        });
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
        await appendRunLogEvent({
          ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
          command: "finish",
          outcome: "failure",
          note: "protocol_incomplete",
        }).catch(() => undefined);
        setExitCode(1);
      }
    });
}

function formatFinishReport(result: FinishServiceResult): string {
  return (
    [
      `LouisGo 正式交接已更新：${result.filePath}`,
      `当前任务：${result.frontMatter.taskId}`,
      `验证状态：${result.verification}`,
      `Confirm Request：${formatCleanup(result.confirmReqCleanup)}`,
      `Quick Save：${formatCleanup(result.quickSaveCleanup)}`,
      `STATE.md：已更新（${result.statePath}）`,
      "下一步：新会话会优先读取 HANDOFF.md；继续修改后请重新运行 louisgo verify",
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
