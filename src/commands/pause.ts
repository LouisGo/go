import type { Command } from "commander";
import type { Writable } from "node:stream";

import {
  pauseLouisGo,
  PauseServiceError,
  pauseServiceErrorCodes,
  type PauseServiceOptions,
  type PauseServiceResult,
} from "../services/pause-service.js";

export interface RegisterPauseCommandOptions extends PauseServiceOptions {
  readonly stdout?: Writable;
  readonly stderr?: Writable;
  readonly setExitCode?: (exitCode: number) => void;
}

export function registerPauseCommand(
  program: Command,
  options: RegisterPauseCommandOptions = {},
): void {
  program
    .command("pause")
    .description("写入 LouisGo 快速暂停状态")
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
        const result = await pauseLouisGo(options);
        stdout.write(formatPauseReport(result));
        setExitCode(0);
      } catch (error) {
        if (
          !(error instanceof PauseServiceError) ||
          error.code !== pauseServiceErrorCodes.protocolIncomplete
        ) {
          throw error;
        }

        stderr.write("暂停失败：LouisGo 协议不完整，请先运行 louisgo init。\n");
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

function formatPauseReport(result: PauseServiceResult): string {
  const action = result.status === "created" ? "创建" : "更新";

  return (
    [
      `LouisGo 暂停状态已${action}：${result.filePath}`,
      `当前任务：${result.frontMatter.taskId}`,
      `Git HEAD：${result.frontMatter.gitHead}`,
      `diff_hash：${result.frontMatter.diffHash}`,
      "下一步：恢复时运行 louisgo status 查看协议状态",
    ].join("\n") + "\n"
  );
}
