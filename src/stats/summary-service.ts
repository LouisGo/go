import type { Writable } from "node:stream";

import { findGitRoot } from "../fs/workspace.js";
import { createOutputTheme, field, headline } from "../output/theme.js";
import {
  statsSourceSchema,
  type ContextSectionStats,
  type StatsEvent,
  type StatsSource,
  type TokenUsage,
} from "./events.js";
import { readStatsEvents } from "./store.js";

export interface StatsSummaryOptions {
  readonly cwd?: string;
  readonly days?: number;
  readonly source?: StatsSource;
  readonly now?: () => Date;
}

export interface SectionWeight {
  readonly source: string;
  readonly title: string;
  readonly layer: ContextSectionStats["layer"];
  readonly stability: ContextSectionStats["stability"];
  readonly tokens: number;
}

export interface StatsSummary {
  readonly workspaceRoot: string;
  readonly days: number | null;
  readonly source: StatsSource | null;
  readonly eventCount: number;
  readonly actualUsage: TokenUsage;
  readonly estimatedUsage: TokenUsage;
  readonly simulatedSavings: {
    readonly avoidedContextTokens: number;
    readonly cacheEligiblePrefixTokens: number;
  };
  readonly cachedInputRatio: number | null;
  readonly sectionWeights: readonly SectionWeight[];
  readonly cacheStability: {
    readonly latestCompiledContextTokens: number;
    readonly latestCacheEligiblePrefixTokens: number;
    readonly ratio: number | null;
    readonly hints: readonly string[];
  };
}

export async function summarizeStats(options: StatsSummaryOptions = {}): Promise<StatsSummary> {
  const workspaceRoot = await findGitRoot(options.cwd);
  const now = options.now?.() ?? new Date();
  const cutoff =
    options.days === undefined ? null : new Date(now.getTime() - options.days * 86_400_000);
  const source = options.source === undefined ? null : statsSourceSchema.parse(options.source);
  const events = (await readStatsEvents({ cwd: workspaceRoot })).filter((event) => {
    if (source !== null && event.source !== source) {
      return false;
    }

    return cutoff === null || new Date(event.timestamp) >= cutoff;
  });

  const actualUsage = sumUsage(events.filter((event) => event.confidence === "actual"));
  const estimatedUsage = sumUsage(events.filter((event) => event.confidence === "estimated"));
  const simulatedSavings = events.reduce(
    (acc, event) => ({
      avoidedContextTokens: acc.avoidedContextTokens + (event.savings?.avoided_context_tokens ?? 0),
      cacheEligiblePrefixTokens:
        acc.cacheEligiblePrefixTokens + (event.savings?.cache_eligible_prefix_tokens ?? 0),
    }),
    { avoidedContextTokens: 0, cacheEligiblePrefixTokens: 0 },
  );
  const sectionWeights = aggregateSectionWeights(events);
  const latestContextEvent = [...events].reverse().find((event) => event.context !== undefined);
  const latestCompiled = latestContextEvent?.context?.compiled_context_tokens ?? 0;
  const latestCacheEligible = latestContextEvent?.context?.cache_eligible_prefix_tokens ?? 0;
  const cacheRatio =
    actualUsage.input_tokens === undefined || actualUsage.input_tokens === 0
      ? null
      : (actualUsage.cached_input_tokens ?? 0) / actualUsage.input_tokens;
  const stabilityRatio = latestCompiled === 0 ? null : latestCacheEligible / latestCompiled;

  return {
    workspaceRoot,
    days: options.days ?? null,
    source,
    eventCount: events.length,
    actualUsage,
    estimatedUsage,
    simulatedSavings,
    cachedInputRatio: cacheRatio,
    sectionWeights,
    cacheStability: {
      latestCompiledContextTokens: latestCompiled,
      latestCacheEligiblePrefixTokens: latestCacheEligible,
      ratio: stabilityRatio,
      hints: createCacheHints({ events, sectionWeights, stabilityRatio }),
    },
  };
}

export function formatStatsSummary(summary: StatsSummary, stdout?: Writable): string {
  const theme = createOutputTheme(stdout);
  const lines: string[] = [];
  const window = summary.days === null ? "all time" : `last ${summary.days} days`;
  const source = summary.source === null ? "all sources" : summary.source;

  lines.push(headline(theme, "📊", "LouisGo Stats", `${window} / ${source}`));
  lines.push("");
  lines.push(field(theme, "Events", String(summary.eventCount)));
  lines.push("");
  lines.push(theme.bold("Actual Codex usage"));
  lines.push(formatUsage(summary.actualUsage));
  lines.push(field(theme, "Cached input ratio", formatRatio(summary.cachedInputRatio)));
  lines.push("");
  lines.push(theme.bold("Estimated LouisGo context"));
  lines.push(formatUsage(summary.estimatedUsage));
  lines.push(
    field(
      theme,
      "Simulated avoided context",
      `${summary.simulatedSavings.avoidedContextTokens} tokens`,
    ),
  );
  lines.push(
    field(
      theme,
      "Cache-eligible stable prefix",
      `${summary.cacheStability.latestCacheEligiblePrefixTokens} / ${summary.cacheStability.latestCompiledContextTokens} tokens`,
    ),
  );
  lines.push("");
  lines.push(theme.bold("Top context weight"));

  if (summary.sectionWeights.length === 0) {
    lines.push("- no context section stats yet");
  } else {
    for (const item of summary.sectionWeights.slice(0, 8)) {
      lines.push(`- ${item.source}: ${item.tokens} tokens (${item.layer}/${item.stability})`);
    }
  }

  lines.push("");
  lines.push(theme.bold("Hints"));

  if (summary.cacheStability.hints.length === 0) {
    lines.push("- no obvious stats issue detected");
  } else {
    for (const hint of summary.cacheStability.hints) {
      lines.push(`- ${hint}`);
    }
  }

  lines.push("");
  lines.push(field(theme, "Workspace", summary.workspaceRoot));

  return `${lines.join("\n")}\n`;
}

function sumUsage(events: readonly StatsEvent[]): TokenUsage {
  return events.reduce<TokenUsage>(
    (acc, event) => ({
      input_tokens: (acc.input_tokens ?? 0) + (event.usage?.input_tokens ?? 0),
      cached_input_tokens: (acc.cached_input_tokens ?? 0) + (event.usage?.cached_input_tokens ?? 0),
      output_tokens: (acc.output_tokens ?? 0) + (event.usage?.output_tokens ?? 0),
      reasoning_output_tokens:
        (acc.reasoning_output_tokens ?? 0) + (event.usage?.reasoning_output_tokens ?? 0),
      total_tokens: (acc.total_tokens ?? 0) + (event.usage?.total_tokens ?? 0),
    }),
    {
      input_tokens: 0,
      cached_input_tokens: 0,
      output_tokens: 0,
      reasoning_output_tokens: 0,
      total_tokens: 0,
    },
  );
}

function aggregateSectionWeights(events: readonly StatsEvent[]): readonly SectionWeight[] {
  const bySource = new Map<string, SectionWeight>();

  for (const event of events) {
    for (const section of event.context?.sections ?? []) {
      const existing = bySource.get(section.source);
      bySource.set(section.source, {
        source: section.source,
        title: section.title,
        layer: section.layer,
        stability: section.stability,
        tokens: (existing?.tokens ?? 0) + section.tokens,
      });
    }
  }

  return [...bySource.values()].sort((left, right) => right.tokens - left.tokens);
}

function createCacheHints(params: {
  readonly events: readonly StatsEvent[];
  readonly sectionWeights: readonly SectionWeight[];
  readonly stabilityRatio: number | null;
}): readonly string[] {
  const hints: string[] = [];

  if (params.events.length === 0) {
    hints.push("Run `louisgo context` or `louisgo stats import codex` to collect stats.");
    return hints;
  }

  if (params.stabilityRatio !== null && params.stabilityRatio < 0.5) {
    hints.push(
      "Stable prefix is under 50% of the latest context package; keep dynamic state later.",
    );
  }

  const totalSectionTokens = params.sectionWeights.reduce((sum, item) => sum + item.tokens, 0);
  const topSection = params.sectionWeights[0];

  if (
    topSection !== undefined &&
    totalSectionTokens > 0 &&
    topSection.tokens / totalSectionTokens > 0.35
  ) {
    hints.push(
      `${topSection.source} dominates context weight; consider splitting or compacting it.`,
    );
  }

  return hints;
}

function formatUsage(usage: TokenUsage): string {
  return [
    `- input: ${usage.input_tokens ?? 0}`,
    `- cached input: ${usage.cached_input_tokens ?? 0}`,
    `- output: ${usage.output_tokens ?? 0}`,
    `- reasoning output: ${usage.reasoning_output_tokens ?? 0}`,
    `- total: ${usage.total_tokens ?? 0}`,
  ].join("\n");
}

function formatRatio(value: number | null): string {
  if (value === null) {
    return "n/a";
  }

  return `${Math.round(value * 10_000) / 100}%`;
}
