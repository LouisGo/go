import type { Command } from "commander";
import type { Writable } from "node:stream";

import {
  verifyLouisGo,
  type VerificationFreshnessState,
  type VerifyServiceOptions,
  type VerifyServiceResult,
} from "../services/verify-service.js";
import { VerifyRunnerError, verifyRunnerErrorCodes } from "../verify/runner.js";
import type { StaleReason } from "../verify/freshness.js";

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
    .description("运行 LouisGo 项目验证脚本")
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
        stdout.write(formatVerifyReport(result));
        setExitCode(result.processExitCode);
      } catch (error) {
        if (!(error instanceof VerifyRunnerError)) {
          throw error;
        }

        stderr.write(formatVerifyError(error));
        setExitCode(1);
      }
    });
}

function formatVerifyReport(result: VerifyServiceResult): string {
  const lines = [
    `验证脚本：${result.script.relativePath}`,
    `脚本退出码：${result.scriptExitCode}`,
    `验证状态：${result.verificationStatus}`,
    `新鲜度：${formatFreshness(result.freshness)}`,
    `摘要：${result.summary}`,
  ];

  if (result.staleReason !== null) {
    lines.push(`过期原因：${formatStaleReason(result.staleReason)}`);
  }

  if (result.processExitCode === 0) {
    lines.push("结果：验证通过且结果新鲜");
  } else {
    lines.push("结果：验证未通过或结果不可作为当前代码事实");
  }

  return `${lines.join("\n")}\n`;
}

function formatVerifyError(error: VerifyRunnerError): string {
  return `验证失败：${formatVerifyRunnerError(error)}\n`;
}

function formatVerifyRunnerError(error: VerifyRunnerError): string {
  switch (error.code) {
    case verifyRunnerErrorCodes.scriptMissing:
      return "验证脚本缺失，请先运行 louisgo init 或补齐 .louisgo/scripts/verify.sh / verify.ps1";
    case verifyRunnerErrorCodes.resultMissing:
      return "验证脚本未生成 .louisgo/test-results.json";
    case verifyRunnerErrorCodes.resultInvalid:
      return "验证脚本生成了非法 test-results.json";
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
      return "Git HEAD 不匹配";
    case "diff_hash_mismatch":
      return "diff_hash 不匹配";
  }
}
