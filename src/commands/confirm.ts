import type { Command } from "commander";
import { createInterface } from "node:readline/promises";
import type { Readable, Writable } from "node:stream";

import {
  ConfirmServiceError,
  confirmServiceErrorCodes,
  readConfirmRequest,
  selectConfirmChoice,
  type ConfirmChoiceSelection,
  type ConfirmRequestView,
  type ConfirmServiceOptions,
} from "../services/confirm-service.js";
import { appendRunLogEvent } from "../services/run-log-service.js";

export interface RegisterConfirmCommandOptions extends ConfirmServiceOptions {
  readonly stdin?: Readable;
  readonly stdout?: Writable;
  readonly stderr?: Writable;
  readonly setExitCode?: (exitCode: number) => void;
}

interface ConfirmCommandOptions {
  readonly choice?: string;
  readonly interactive?: boolean;
}

export function registerConfirmCommand(
  program: Command,
  options: RegisterConfirmCommandOptions = {},
): void {
  program
    .command("confirm")
    .description("显示 LouisGo 确认请求并选择选项")
    .option("--choice <A|B|C|D>", "选择确认请求中的选项")
    .option("-i, --interactive", "交互式提示用户输入选择或补充说明")
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
          await appendRunLogEvent({
            cwd: selection.workspaceRoot,
            command: "confirm",
            outcome: "success",
            note: `choice=${selection.selectedChoice.key}; task=${selection.frontMatter.taskId}`,
          });
          return;
        }

        if (commandOptions.interactive === true) {
          const request = await readConfirmRequest(options);
          stdout.write(
            await formatInteractiveConfirm(options.stdin ?? process.stdin, stdout, request),
          );
          await appendRunLogEvent({
            ...(request === null
              ? options.cwd === undefined
                ? {}
                : { cwd: options.cwd }
              : { cwd: request.workspaceRoot }),
            command: "confirm",
            outcome: request === null ? "info" : "success",
            note:
              request === null
                ? "no_request"
                : `interactive=true; task=${request.frontMatter.taskId}`,
          });
          return;
        }

        const request = await readConfirmRequest(options);
        stdout.write(formatConfirmRequest(request));
        await appendRunLogEvent({
          ...(request === null
            ? options.cwd === undefined
              ? {}
              : { cwd: options.cwd }
            : { cwd: request.workspaceRoot }),
          command: "confirm",
          outcome: request === null ? "info" : "success",
          note: request === null ? "no_request" : `view=true; task=${request.frontMatter.taskId}`,
        });
      } catch (error) {
        if (!(error instanceof ConfirmServiceError)) {
          throw error;
        }

        stderr.write(`${formatConfirmError(error)}\n`);
        await appendRunLogEvent({
          ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
          command: "confirm",
          outcome: "failure",
          note: `error=${error.code}`,
        }).catch(() => undefined);
        setExitCode(1);
      }
    });
}

async function formatInteractiveConfirm(
  stdin: Readable,
  stdout: Writable,
  request: ConfirmRequestView | null,
): Promise<string> {
  if (request === null) {
    return "当前没有未解决确认请求。\n";
  }

  stdout.write(`${formatConfirmRequest(request)}\n`);

  const answer = await askQuestion(
    stdin,
    stdout,
    `请选择 ${formatChoiceKeys(request)}，或输入补充说明：`,
  );
  const input = answer.trim();

  if (input.length === 0) {
    throw new ConfirmServiceError({
      code: confirmServiceErrorCodes.choiceInvalid,
      message: "未输入选择或补充说明",
    });
  }

  const selectedChoice = request.choices.find((choice) => choice.key === input.toUpperCase());

  if (selectedChoice !== undefined) {
    return `${formatConfirmSelection({ ...request, selectedChoice })}\n`;
  }

  return `${formatCustomInput(request, input)}\n`;
}

async function askQuestion(input: Readable, output: Writable, prompt: string): Promise<string> {
  const readline = createInterface({ input, output });

  try {
    return await readline.question(`${prompt} `);
  } finally {
    readline.close();
  }
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

function formatCustomInput(request: ConfirmRequestView, input: string): string {
  return [
    `已输入补充说明：${input}`,
    `任务：${request.frontMatter.taskId}`,
    `来源：${request.relativePath}`,
    "",
    "下一步：AI 应基于该补充说明继续执行，并在处理完成后清理确认请求或生成新的交接。",
  ].join("\n");
}

function formatChoiceKeys(request: ConfirmRequestView): string {
  const keys = request.choices.map((choice) => choice.key);

  if (keys.length === 0) {
    return "选项字母";
  }

  return keys.join("/");
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
