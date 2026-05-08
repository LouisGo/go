import type { Command } from "commander";
import type { Writable } from "node:stream";

import {
  verifyLouisGo,
  type VerificationFreshnessState,
  type VerifyServiceOptions,
  type VerifyServiceResult,
} from "../services/verify-service.js";
import { appendRunLogEvent } from "../services/run-log-service.js";
import { VerifyRunnerError, verifyRunnerErrorCodes } from "../verify/runner.js";
import type { StaleReason } from "../verify/freshness.js";
import { createOutputTheme, field, headline, statusToken, tip } from "../output/theme.js";

export interface RegisterVerifyCommandOptions extends VerifyServiceOptions {
  readonly stdout?: Writable;
  readonly stderr?: Writable;
  readonly setExitCode?: (exitCode: number) => void;
}

export function registerVerifyCommand(
  program: Command,
  options: RegisterVerifyCommandOptions = {},
): void {
  program
    .command("verify")
    .description("🧪 Run project verification and freshness checks")
    .action(async () => {
      const stdout = options.stdout ?? process.stdout;
      const stderr = options.stderr ?? process.stderr;
      const setExitCode =
        options.setExitCode ??
        ((exitCode: number) => {
          process.exitCode = exitCode;
        });

      try {
        const result = await verifyLouisGo(options);
        stdout.write(formatVerifyReport(result, stdout));
        await appendRunLogEvent({
          cwd: result.workspaceRoot,
          command: "verify",
          outcome: result.processExitCode === 0 ? "success" : "failure",
          note: `status=${result.verificationStatus}; freshness=${result.freshness}; exit=${result.processExitCode}`,
        }).catch(() => undefined);
        setExitCode(result.processExitCode);
      } catch (error) {
        if (!(error instanceof VerifyRunnerError)) {
          throw error;
        }

        stderr.write(formatVerifyError(error, stderr));
        await appendRunLogEvent({
          ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
          command: "verify",
          outcome: "failure",
          note: `runner_error=${error.code}`,
        }).catch(() => undefined);
        setExitCode(1);
      }
    });
}

function formatVerifyReport(result: VerifyServiceResult, stdout?: Writable): string {
  const theme = createOutputTheme(stdout);
  const success = result.processExitCode === 0;
  const lines = [
    headline(
      theme,
      success ? "✅" : "⚠️",
      success ? "Verification passed" : "Verification needs attention",
    ),
    field(theme, "Verification entry", theme.path(result.script.relativePath)),
    field(theme, "Entry exit code", statusToken(theme, String(result.scriptExitCode))),
    field(theme, "Verification status", statusToken(theme, result.verificationStatus)),
    field(theme, "Freshness", statusToken(theme, formatFreshness(result.freshness))),
    field(theme, "Summary", result.summary),
  ];

  if (result.staleReason !== null) {
    lines.push(field(theme, "Stale reason", formatStaleReason(result.staleReason)));
  }

  if (result.processExitCode === 0) {
    lines.push(tip(theme, "Result: verification passed and is fresh."));
  } else {
    lines.push(
      tip(theme, "Result: verification did not pass or cannot represent the current code state."),
    );
  }

  return `${lines.join("\n")}\n`;
}

function formatVerifyError(error: VerifyRunnerError, stderr?: Writable): string {
  const theme = createOutputTheme(stderr);
  return `${headline(theme, "✕", "Verification failed")}: ${formatVerifyRunnerError(error)}\n`;
}

function formatVerifyRunnerError(error: VerifyRunnerError): string {
  switch (error.code) {
    case verifyRunnerErrorCodes.scriptMissing:
      return "verification script is missing";
    case verifyRunnerErrorCodes.resultMissing:
      return "verification script did not generate .louisgo/test-results.json";
    case verifyRunnerErrorCodes.resultInvalid:
      return "verification script generated an invalid test-results.json";
    case verifyRunnerErrorCodes.executionFailed:
      return error.message;
  }
}

function formatFreshness(freshness: VerificationFreshnessState): string {
  switch (freshness) {
    case "fresh":
      return "fresh";
    case "stale":
      return "stale";
  }
}

function formatStaleReason(reason: StaleReason): string {
  switch (reason) {
    case "git_head_mismatch":
      return "Git HEAD mismatch";
    case "diff_hash_mismatch":
      return "diff_hash mismatch";
  }
}
