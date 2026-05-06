import type { Command } from "commander";
import type { Writable } from "node:stream";

import { importCodexStats } from "../stats/codex-importer.js";
import { statsSourceSchema, type StatsSource } from "../stats/events.js";
import {
  formatStatsSummary,
  summarizeStats,
  type StatsSummaryOptions,
} from "../stats/summary-service.js";

export interface RegisterStatsCommandOptions extends StatsSummaryOptions {
  readonly codexHome?: string;
  readonly stdout?: Writable;
  readonly stderr?: Writable;
  readonly setExitCode?: (exitCode: number) => void;
}

interface StatsCommandOptions {
  readonly days?: number;
  readonly json?: boolean;
  readonly source?: StatsSource;
}

interface StatsImportCodexCommandOptions {
  readonly days?: number;
  readonly codexHome?: string;
  readonly dryRun?: boolean;
}

export function registerStatsCommand(
  program: Command,
  options: RegisterStatsCommandOptions = {},
): void {
  const statsCommand = program
    .command("stats")
    .description("输出 LouisGo token 和 context 观测统计")
    .option("--days <days>", "只统计最近 N 天", parseDays)
    .option("--json", "输出 JSON")
    .option("--source <source>", "只统计 context 或 codex 来源", parseSource)
    .action(async (commandOptions: StatsCommandOptions) => {
      const stdout = options.stdout ?? process.stdout;
      const summary = await summarizeStats({
        ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
        ...(commandOptions.days === undefined ? {} : { days: commandOptions.days }),
        ...(commandOptions.source === undefined ? {} : { source: commandOptions.source }),
        ...(options.now === undefined ? {} : { now: options.now }),
      });

      if (commandOptions.json === true) {
        stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
      } else {
        stdout.write(formatStatsSummary(summary));
      }
    });

  const importCommand = statsCommand.command("import").description("导入外部工具 usage 统计");

  importCommand
    .command("codex")
    .description("显式导入 Codex session JSONL 的 token usage")
    .option("--days <days>", "只扫描最近 N 天内修改过的 Codex JSONL", parseDays)
    .option("--codex-home <path>", "Codex home 路径，默认 $CODEX_HOME 或 ~/.codex")
    .option("--dry-run", "只报告可导入事件，不写入 .louisgo/stats")
    .action(async (commandOptions: StatsImportCodexCommandOptions) => {
      const stdout = options.stdout ?? process.stdout;
      const codexHome = resolveCodexHome(options, commandOptions);
      const result = await importCodexStats({
        ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
        ...(codexHome === undefined ? {} : { codexHome }),
        ...(commandOptions.days === undefined ? {} : { days: commandOptions.days }),
        ...(commandOptions.dryRun === undefined ? {} : { dryRun: commandOptions.dryRun }),
        ...(options.now === undefined ? {} : { now: options.now }),
      });

      stdout.write(formatCodexImportResult(result));
    });
}

function resolveCodexHome(
  options: RegisterStatsCommandOptions,
  commandOptions: StatsImportCodexCommandOptions,
): string | undefined {
  return commandOptions.codexHome ?? options.codexHome ?? process.env.CODEX_HOME;
}

function formatCodexImportResult(result: Awaited<ReturnType<typeof importCodexStats>>): string {
  return [
    result.dryRun ? "Codex stats dry run" : "Codex stats import complete",
    `Codex home: ${result.codexHome}`,
    `Scanned files: ${result.scannedFiles}`,
    `Skipped files: ${result.skippedFiles}`,
    `Matched usage events: ${result.matchedEvents}`,
    `Imported events: ${result.importedEvents}`,
    `Duplicate events: ${result.duplicateEvents}`,
    `Workspace: ${result.workspaceRoot}`,
    "",
  ].join("\n");
}

function parseDays(value: string): number {
  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error(`无效天数：${value}`);
  }

  return parsed;
}

function parseSource(value: string): StatsSource {
  return statsSourceSchema.parse(value);
}
