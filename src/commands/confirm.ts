import { input, select } from "@inquirer/prompts";
import type { Command } from "commander";
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
import { createPromptOutput } from "../output/prompt.js";
import { createOutputTheme, field, headline, tip } from "../output/theme.js";

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
          stdout.write(formatConfirmSelection(selection, stdout));
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
        stdout.write(formatConfirmRequest(request, stdout));
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

        const theme = createOutputTheme(stderr);
        stderr.write(
          `${headline(theme, "✕", "Confirmation failed")}: ${formatConfirmError(error)}\n`,
        );
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
    const theme = createOutputTheme(stdout);
    return `${headline(theme, "✓", "No open confirmation request")}\n`;
  }

  stdout.write(`${formatConfirmRequest(request, stdout)}\n`);

  const answer = await select(
    {
      message: "🧭 Choose how LouisGo should continue",
      choices: [
        ...request.choices.map((choice) => ({
          name: `${choice.key}. ${choice.text}`,
          value: choice.key,
        })),
        {
          name: "Write a custom instruction",
          value: "__custom__",
          description: "Use this when none of the listed options captures your intent",
        },
      ],
      loop: false,
    },
    {
      input: stdin,
      output: createPromptOutput(stdout),
      clearPromptOnDone: false,
    },
  );

  const selectedChoice = request.choices.find((choice) => choice.key === answer);

  if (selectedChoice !== undefined) {
    return `${formatConfirmSelection({ ...request, selectedChoice }, stdout)}\n`;
  }

  const customInput = await input(
    {
      message: "✍️ Add your instruction",
      validate(value) {
        return value.trim().length > 0 ? true : "Please enter a short instruction.";
      },
    },
    {
      input: stdin,
      output: createPromptOutput(stdout),
      clearPromptOnDone: false,
    },
  );

  if (customInput.trim().length === 0) {
    throw new ConfirmServiceError({
      code: confirmServiceErrorCodes.choiceInvalid,
      message: "No option or additional input was provided",
    });
  }

  return `${formatCustomInput(request, customInput.trim(), stdout)}\n`;
}

function formatConfirmRequest(request: ConfirmRequestView | null, stdout?: Writable): string {
  const theme = createOutputTheme(stdout);
  if (request === null) {
    return `${headline(theme, "✓", "No open confirmation request")}\n`;
  }

  return [
    headline(theme, "🧭", "Confirmation request", request.frontMatter.taskId),
    field(theme, "Source", request.relativePath),
    "",
    theme.bold("Background"),
    formatBlock(request.background),
    "",
    theme.bold("Options"),
    ...request.choices.map((choice) => `- ${choice.key}. ${choice.text}`),
    "",
    theme.bold("Recommendation"),
    formatBlock(request.recommendation),
    "",
    tip(
      theme,
      `Run ${theme.command(`louisgo confirm --choice ${request.choices[0]?.key ?? "A"}`)}, or use ${theme.command("louisgo confirm --interactive")}.`,
    ),
  ].join("\n");
}

function formatConfirmSelection(selection: ConfirmChoiceSelection, stdout?: Writable): string {
  const theme = createOutputTheme(stdout);
  return [
    headline(
      theme,
      "✓",
      "Selected",
      `${selection.selectedChoice.key}. ${selection.selectedChoice.text}`,
    ),
    field(theme, "Task", selection.frontMatter.taskId),
    field(theme, "Source", selection.relativePath),
    "",
    tip(
      theme,
      "AI should continue from this selection, then clear the request or generate a new handoff.",
    ),
  ].join("\n");
}

function formatCustomInput(request: ConfirmRequestView, input: string, stdout?: Writable): string {
  const theme = createOutputTheme(stdout);
  return [
    headline(theme, "✍️", "Additional input", input),
    field(theme, "Task", request.frontMatter.taskId),
    field(theme, "Source", request.relativePath),
    "",
    tip(
      theme,
      "AI should continue from this input, then clear the request or generate a new handoff.",
    ),
  ].join("\n");
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
