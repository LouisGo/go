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
  const handoff = program.command("handoff").description("Manage LouisGo formal handoffs");

  handoff
    .command("promote")
    .description("Promote HANDOFF_DRAFT.md to HANDOFF.md")
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

        stderr.write(`Handoff promotion failed: ${formatHandoffError(error)}\n`);
        setExitCode(1);
      }
    });
}

function formatPromoteReport(result: PromoteHandoffResult): string {
  return (
    [
      `LouisGo formal handoff generated: ${result.filePath}`,
      `Source draft: ${result.draftPath}`,
      `Current task: ${result.frontMatter.taskId}`,
      `Verification status: ${result.frontMatter.verification}`,
      `Write status: ${result.status === "created" ? "created" : "updated"}`,
      "Next: run louisgo status to inspect recovery state.",
    ].join("\n") + "\n"
  );
}

function formatHandoffError(error: HandoffServiceError): string {
  switch (error.code) {
    case handoffServiceErrorCodes.draftMissing:
      return "HANDOFF_DRAFT.md does not exist. Run louisgo finish first.";
    case handoffServiceErrorCodes.draftInvalid:
      return "HANDOFF_DRAFT.md has invalid front matter. Fix it and retry.";
  }
}
