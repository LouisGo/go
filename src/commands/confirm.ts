import type { Command } from "commander";
import type { Writable } from "node:stream";

import {
  ConfirmServiceError,
  confirmServiceErrorCodes,
  readConfirmRequest,
  selectConfirmChoice,
  type ConfirmChoiceSelection,
  type ConfirmRequestView,
  type ConfirmServiceOptions,
} from "../services/confirm-service.js";

export interface RegisterConfirmCommandOptions extends ConfirmServiceOptions {
  readonly stdout?: Writable;
  readonly stderr?: Writable;
  readonly setExitCode?: (exitCode: number) => void;
}

interface ConfirmCommandOptions {
  readonly choice?: string;
}

export function registerConfirmCommand(
  program: Command,
  options: RegisterConfirmCommandOptions = {},
): void {
  program
    .command("confirm")
    .description("显示 LouisGo 确认请求并选择选项")
    .option("--choice <A|B|C|D>", "选择确认请求中的选项")
    .action(async (commandOptions: ConfirmCommandOptions) => {
      const stdout = options.stdout ?? process.stdout;
      const stderr = options.stderr ?? process.stderr;
      const setExitCode =
        options.setExitCode ??
        ((exitCode: number) => {
          process.exitCode = exitCode;
        });

      try {
        if (commandOptions.choice !== undefined) {
          const selection = await selectConfirmChoice({
            ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
            choice: commandOptions.choice,
          });
          stdout.write(formatConfirmSelection(selection));
          return;
        }

        const request = await readConfirmRequest(options);
        stdout.write(formatConfirmRequest(request));
      } catch (error) {
        if (!(error instanceof ConfirmServiceError)) {
          throw error;
        }

        stderr.write(`${formatConfirmError(error)}\n`);
        setExitCode(1);
      }
    });
}

function formatConfirmRequest(request: ConfirmRequestView | null): string {
  if (request === null) {
    return "当前没有未解决确认请求。\n";
  }

  return [
    `确认请求：${request.frontMatter.taskId}`,
    `来源：${request.relativePath}`,
    "",
    "背景：",
    formatBlock(request.background),
    "",
    "选项：",
    ...request.choices.map((choice) => `- ${choice.key}. ${choice.text}`),
    "",
    "建议：",
    formatBlock(request.recommendation),
    "",
    `下一步：运行 louisgo confirm --choice ${request.choices[0]?.key ?? "A"}，或直接回复选项字母。`,
  ].join("\n");
}

function formatConfirmSelection(selection: ConfirmChoiceSelection): string {
  return [
    `已选择：${selection.selectedChoice.key}. ${selection.selectedChoice.text}`,
    `任务：${selection.frontMatter.taskId}`,
    `来源：${selection.relativePath}`,
    "",
    "下一步：AI 应基于该选择继续执行，并在处理完成后清理确认请求或生成新的交接。",
  ].join("\n");
}

function formatConfirmError(error: ConfirmServiceError): string {
  switch (error.code) {
    case confirmServiceErrorCodes.requestMissing:
      return "当前没有未解决确认请求。";
    case confirmServiceErrorCodes.choiceInvalid:
      return `${error.message}。请运行 louisgo confirm 查看可选项。`;
  }
}

function formatBlock(source: string): string {
  const trimmed = source.trim();

  if (trimmed.length === 0) {
    return "（空）";
  }

  return trimmed;
}
