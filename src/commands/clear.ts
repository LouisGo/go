import type { Command } from "commander";
import type { Writable } from "node:stream";

import {
  clearConfirmationPhrase,
  clearLouisGo,
  ClearServiceError,
  type ClearLouisGoOptions,
  type ClearLouisGoResult,
} from "../services/clear-service.js";

export interface RegisterClearCommandOptions extends ClearLouisGoOptions {
  readonly stdout?: Writable;
  readonly stderr?: Writable;
  readonly setExitCode?: (exitCode: number) => void;
}

interface ClearCommandOptions {
  readonly confirm?: string;
  readonly dryRun?: boolean;
}

export function registerClearCommand(
  program: Command,
  options: RegisterClearCommandOptions = {},
): void {
  program
    .command("clear")
    .description("清空当前项目的 LouisGo 协议文件和本地缓存")
    .option("--dry-run", "只预览会清理的目标，不实际删除")
    .option("--confirm <phrase>", `明确确认执行清理；必须完全等于 "${clearConfirmationPhrase}"`)
    .action(async (commandOptions: ClearCommandOptions) => {
      const stdout = options.stdout ?? process.stdout;
      const stderr = options.stderr ?? process.stderr;
      const setExitCode =
        options.setExitCode ??
        ((exitCode: number) => {
          process.exitCode = exitCode;
        });

      writeRiskWarning(stdout);

      try {
        const result = await clearLouisGo({
          ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
          ...(commandOptions.confirm === undefined ? {} : { confirm: commandOptions.confirm }),
          ...(commandOptions.dryRun === undefined ? {} : { dryRun: commandOptions.dryRun }),
        });
        writeClearResult(stdout, result);
        setExitCode(0);
      } catch (error) {
        if (!(error instanceof ClearServiceError)) {
          throw error;
        }

        stderr.write(`${error.message}\n`);
        stderr.write(
          `未执行。若确认风险，请运行：louisgo clear --confirm "${clearConfirmationPhrase}"\n`,
        );
        setExitCode(1);
      }
    });
}

function writeRiskWarning(stdout: Writable): void {
  stdout.write("危险操作：即将清理当前 Git 项目的 LouisGo 数据。\n");
  stdout.write("- 会删除 .louisgo/，包括项目记忆、交接、验证结果、诊断日志、stats 和本地缓存。\n");
  stdout.write("- 会移除 AGENTS.md 中 LouisGo 管理的 Codex 指令块。\n");
  stdout.write("- 不会删除业务源码，也不会清理全局 Codex 配置或全局 skills。\n");
}

function writeClearResult(stdout: Writable, result: ClearLouisGoResult): void {
  stdout.write(
    result.dryRun
      ? `清理预览：${result.workspaceRoot}\n`
      : `LouisGo 项目数据已清理：${result.workspaceRoot}\n`,
  );

  for (const target of result.targets) {
    stdout.write(`- ${target.status} ${target.relativePath}：${target.description}\n`);
  }

  if (result.dryRun) {
    stdout.write(`未执行删除。若确认风险，请运行：louisgo clear --confirm "DELETE LOUISGO"\n`);
  }
}
