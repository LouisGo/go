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
    .description("Show a LouisGo confirmation request and select an option")
    .option("--choice <A|B|C|D>", "Select an option from the confirmation request")
    .option("-i, --interactive", "Prompt for an option or additional input")
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
          }).catch(() => undefined);
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
          }).catch(() => undefined);
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
        }).catch(() => undefined);
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
    return "There is no open confirmation request.\n";
  }

  stdout.write(`${formatConfirmRequest(request)}\n`);

  const answer = await askQuestion(
    stdin,
    stdout,
    `Select ${formatChoiceKeys(request)}, or enter additional instructions:`,
  );
  const input = answer.trim();

  if (input.length === 0) {
    throw new ConfirmServiceError({
      code: confirmServiceErrorCodes.choiceInvalid,
      message: "No option or additional input was provided",
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
    return "There is no open confirmation request.\n";
  }

  return [
    `Confirmation request: ${request.frontMatter.taskId}`,
    `Source: ${request.relativePath}`,
    "",
    "Background:",
    formatBlock(request.background),
    "",
    "Options:",
    ...request.choices.map((choice) => `- ${choice.key}. ${choice.text}`),
    "",
    "Recommendation:",
    formatBlock(request.recommendation),
    "",
    `Next: run louisgo confirm --choice ${request.choices[0]?.key ?? "A"}, or reply with an option letter.`,
  ].join("\n");
}

function formatConfirmSelection(selection: ConfirmChoiceSelection): string {
  return [
    `Selected: ${selection.selectedChoice.key}. ${selection.selectedChoice.text}`,
    `Task: ${selection.frontMatter.taskId}`,
    `Source: ${selection.relativePath}`,
    "",
    "Next: the AI should continue from this selection and clear the request or generate a new handoff after handling it.",
  ].join("\n");
}

function formatCustomInput(request: ConfirmRequestView, input: string): string {
  return [
    `Additional input: ${input}`,
    `Task: ${request.frontMatter.taskId}`,
    `Source: ${request.relativePath}`,
    "",
    "Next: the AI should continue from this input and clear the request or generate a new handoff after handling it.",
  ].join("\n");
}

function formatChoiceKeys(request: ConfirmRequestView): string {
  const keys = request.choices.map((choice) => choice.key);

  if (keys.length === 0) {
    return "an option letter";
  }

  return keys.join("/");
}

function formatConfirmError(error: ConfirmServiceError): string {
  switch (error.code) {
    case confirmServiceErrorCodes.requestMissing:
      return "There is no open confirmation request.";
    case confirmServiceErrorCodes.choiceInvalid:
      return `${error.message}. Run louisgo confirm to view available options.`;
  }
}

function formatBlock(source: string): string {
  const trimmed = source.trim();

  if (trimmed.length === 0) {
    return "(empty)";
  }

  return trimmed;
}
