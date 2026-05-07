import { access, readFile } from "node:fs/promises";

import { isNodeError } from "../internal/utils.js";
import { createProtocolPaths, protocolRelativePaths } from "../protocol/paths.js";
import { countTextTokens, truncateToTokens } from "../stats/token-counter.js";
import type {
  ContextSectionStats,
  ContextStats,
  StatsLayer,
  StatsStability,
} from "../stats/events.js";
import {
  checkProtocolStatus,
  type ProtocolIssue,
  type StatusServiceOptions,
} from "./status-service.js";

export const contextServiceErrorCodes = {
  protocolIncomplete: "PROTOCOL_INCOMPLETE",
} as const;

export type ContextServiceErrorCode =
  (typeof contextServiceErrorCodes)[keyof typeof contextServiceErrorCodes];

export interface ContextServiceOptions extends StatusServiceOptions {
  readonly budgetTokens?: number;
  readonly goal?: string;
  readonly capsule?: boolean;
}

export interface GenerateContextResult {
  readonly workspaceRoot: string;
  readonly content: string;
  readonly budgetTokens: number;
  readonly estimatedTokens: number;
  readonly sources: readonly string[];
  readonly report: readonly ContextBudgetItem[];
  readonly truncated: boolean;
  readonly stats: ContextStats;
}

export interface ContextBudgetItem {
  readonly source: string;
  readonly title: string;
  readonly layer: StatsLayer;
  readonly stability: StatsStability;
  readonly estimatedTokens: number;
  readonly included: boolean;
  readonly truncated: boolean;
}

export class ContextServiceError extends Error {
  readonly code: ContextServiceErrorCode;
  readonly issues: readonly ProtocolIssue[];

  constructor(params: {
    readonly code: ContextServiceErrorCode;
    readonly message: string;
    readonly issues: readonly ProtocolIssue[];
  }) {
    super(params.message);
    this.name = "ContextServiceError";
    this.code = params.code;
    this.issues = params.issues;
  }
}

interface ContextSection {
  readonly title: string;
  readonly source: string;
  readonly content: string;
  readonly layer: StatsLayer;
  readonly stability: StatsStability;
  readonly required: boolean;
  readonly preserveHeadings?: readonly string[];
}

const defaultBudgetTokens = 6_000;
const minBudgetTokens = 1_000;
const maxBudgetTokens = 32_000;

export async function generateContext(
  options: ContextServiceOptions = {},
): Promise<GenerateContextResult> {
  const status = await checkProtocolStatus({
    ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
  });

  if (!status.complete || status.mode === null) {
    throw new ContextServiceError({
      code: contextServiceErrorCodes.protocolIncomplete,
      message: "LouisGo protocol incomplete \u2014 run louisgo init or fix protocol files.",
      issues: status.issues,
    });
  }

  const budgetTokens = normalizeBudget(options.budgetTokens);
  const paths = createProtocolPaths(status.workspaceRoot);
  const protocolSections = await createSections(status.workspaceRoot);
  const sections = isColdStartContext(status, protocolSections)
    ? [createColdStartSection()]
    : protocolSections;
  const hasContext = sections.some((s) => s.source === protocolRelativePaths.context);
  const header = createHeader({
    capsule: options.capsule === true,
    mode: status.mode,
    phase: status.phase,
    currentTask: status.currentTask?.id ?? "none",
    currentTaskCompletionSignal: status.currentTask?.completionSignal ?? null,
    verificationStatus: status.verificationStatus,
    recoverySource: status.recoverySource,
    workspaceSummary: formatWorkspaceSummary(status.workspace),
    budgetTokens,
    hasContext,
    ...(options.goal === undefined ? {} : { goal: options.goal }),
  });
  const compiled = compileSections({
    header,
    sections,
    budgetTokens,
  });
  const footer = createFooter(paths.workspaceRoot, compiled.truncated, compiled.report);
  const content = `${compiled.content}\n${footer}`;
  const estimatedTokens = countTextTokens(content);
  const stats = createContextStats({
    budgetTokens,
    compiledContextTokens: countTextTokens(compiled.content),
    fullProtocolBaselineTokens: compiled.fullProtocolBaselineTokens,
    avoidedContextTokens: compiled.avoidedContextTokens,
    cacheEligiblePrefixTokens: compiled.cacheEligiblePrefixTokens,
    truncated: compiled.truncated,
    report: compiled.report,
  });

  return {
    workspaceRoot: status.workspaceRoot,
    content,
    budgetTokens,
    estimatedTokens,
    sources: compiled.sources,
    report: compiled.report,
    truncated: compiled.truncated,
    stats,
  };
}

async function createSections(workspaceRoot: string): Promise<ContextSection[]> {
  const paths = createProtocolPaths(workspaceRoot);
  const sections: ContextSection[] = [];
  const confirmReq = await readIfExists(paths.confirmReq);
  const handoff = await readIfExists(paths.handoff);
  const state = await readIfExists(paths.state);
  const memory = await readIfExists(paths.memory);
  const context = await readIfExists(paths.context);

  sections.push(
    {
      title: "L1 Project Contract: MISSION.md",
      source: protocolRelativePaths.mission,
      content: await readFile(paths.mission, "utf8"),
      layer: "L1",
      stability: "stable",
      required: true,
    },
    {
      title: "L1 Project Contract: CAPABILITIES.md",
      source: protocolRelativePaths.capabilities,
      content: await readFile(paths.capabilities, "utf8"),
      layer: "L1",
      stability: "stable",
      required: true,
    },
  );

  if (memory !== null) {
    sections.push({
      title: "L2 Stable Memory Index: MEMORY.md",
      source: protocolRelativePaths.memory,
      content: memory,
      layer: "L2",
      stability: "stable",
      required: true,
    });
  }

  if (context !== null) {
    sections.push({
      title: "L2 Domain Glossary: CONTEXT.md",
      source: protocolRelativePaths.context,
      content: context,
      layer: "L2",
      stability: "stable",
      required: false,
    });
  }

  if (handoff !== null) {
    sections.push({
      title: "L3 Formal Recovery: HANDOFF.md",
      source: protocolRelativePaths.handoff,
      content: handoff,
      layer: "L3",
      stability: "dynamic",
      required: false,
      preserveHeadings: [
        "\u4ea4\u63a5\u6458\u8981",
        "\u6062\u590d\u5efa\u8bae",
        "\u5efa\u8bae\u4e0b\u4e00\u6b65",
        "\u9a8c\u8bc1",
        "\u5f85\u5904\u7406\u4e8b\u9879",
      ],
    });
  }

  if (confirmReq !== null) {
    sections.push({
      title: "L4 Urgent Signal: CONFIRM_REQ.md",
      source: protocolRelativePaths.confirmReq,
      content: confirmReq,
      layer: "L4",
      stability: "dynamic",
      required: true,
    });
  }

  if (state !== null) {
    sections.push({
      title: "L4 Active State: STATE.md",
      source: protocolRelativePaths.state,
      content: state,
      layer: "L4",
      stability: "dynamic",
      required: true,
    });
  }

  return sections;
}

function isColdStartContext(
  status: Awaited<ReturnType<typeof checkProtocolStatus>>,
  sections: readonly ContextSection[],
): boolean {
  if (
    status.hasConfirmReq ||
    status.recoverySource !== "state" ||
    status.currentTask !== null ||
    status.verificationStatus !== "missing"
  ) {
    return false;
  }

  const sources = new Set(sections.map((section) => section.source));
  if (
    sources.has(protocolRelativePaths.handoff) ||
    sources.has(protocolRelativePaths.confirmReq) ||
    sources.has(protocolRelativePaths.context) ||
    sources.has(protocolRelativePaths.memory)
  ) {
    return false;
  }

  const mission = sections.find((section) => section.source === protocolRelativePaths.mission);
  const state = sections.find((section) => section.source === protocolRelativePaths.state);

  return (
    mission?.content.includes("Describe the project goal in 1-3 durable bullets.") === true &&
    state?.content.includes("focus: fill this with the current concrete development goal") === true
  );
}

function createColdStartSection(): ContextSection {
  return {
    title: "Cold Start: No Project Memory Yet",
    source: "cold-start",
    content: [
      "# Cold Start",
      "",
      "LouisGo is initialized, but no durable project memory or handoff exists yet.",
      "",
      "- Treat the user's current prompt and repository source as the task source.",
      "- Existing project instructions, local skills, docs, source code, Git state, and verification commands remain authoritative.",
      "- Do not expand LouisGo template files into prompt context until the project fills MISSION, MEMORY, CONTEXT, HANDOFF, or CONFIRM_REQ with real content.",
      "- After meaningful work, run verification when appropriate and use `$finish` to create the first useful handoff.",
    ].join("\n"),
    layer: "runtime",
    stability: "stable",
    required: true,
  };
}

function createHeader(params: {
  readonly capsule: boolean;
  readonly goal?: string;
  readonly mode: string;
  readonly phase: string;
  readonly currentTask: string;
  readonly currentTaskCompletionSignal: string | null;
  readonly verificationStatus: string;
  readonly recoverySource: string;
  readonly workspaceSummary: string;
  readonly budgetTokens: number;
  readonly hasContext?: boolean;
}): string {
  const title = params.capsule ? "LouisGo Subagent Context Capsule" : "LouisGo Context Package";
  const goal = params.goal?.trim();

  return [
    `# ${title}`,
    "",
    "## Prompt Assembly Contract",
    "",
    "- The user's current prompt is always the final task source; context below supplements but never overrides user intent.",
    "- If cached context conflicts with source code, Git state, or verification results, trust source code, Git, and verification.",
    "- Do not read `sessions/` or `memory/` details unless this session explicitly requires them.",
    "- After code or protocol changes, run `louisgo verify` before reporting completion, or explain why not.",
    "",
    "## Runtime Summary",
    "",
    `- Mode: ${params.mode}`,
    `- Phase: ${formatWorkPhase(params.phase)}`,
    `- Current task: ${params.currentTask}`,
    `- Verification: ${params.verificationStatus}`,
    `- Recovery: ${formatRecoverySource(params.recoverySource)}`,
    `- Workspace: ${params.workspaceSummary}`,
    `- Context budget: ~${params.budgetTokens} tokens`,
    ...(goal === undefined || goal.length === 0 ? [] : [`- Goal: ${goal}`]),
    "",
    "## Operating Loop",
    "",
    "- Determine the real task from the user's current prompt \u2014 do not treat historical context as the task itself.",
    "- Before making changes, verify against source code, Git state, and verification facts. Memory only provides direction.",
    "- Write only reusable facts to `STATE.md` or `MEMORY.md`; do not record chat logs.",
    "- When a phase is complete, run verification and use `$finish` to generate a formal `HANDOFF.md`.",
    ...(params.phase === "execute"
      ? [
          "",
          "## Stop Check",
          "",
          ...(params.currentTaskCompletionSignal !== null
            ? [
                `- Current task ${params.currentTask} completion signal: ${params.currentTaskCompletionSignal}`,
                "- Before stopping, confirm the completion signal is met. If unsure, keep pushing.",
              ]
            : [
                "- Before stopping, confirm the current task goal is achieved. Document evidence in STATE.md Evidence section.",
              ]),
        ]
      : []),
    ...(params.phase === "explore"
      ? [
          "",
          "## Explore Reminders",
          "",
          "- Understand existing code and data before proposing changes.",
          "- Record findings in STATE.md Evidence section: claim | basis | implication.",
          "- Do not perform large-scale refactoring during exploration \u2014 focus on gathering facts and confirming direction.",
        ]
      : []),
    ...(params.hasContext === true
      ? [
          "- Domain terms are defined in CONTEXT.md \u2014 use the project's own vocabulary, do not introduce synonyms.",
        ]
      : []),
    "",
    "## Source Layers",
    "",
    "Assembly order keeps stable prefixes first: L1 project contract -> L2 stable memory -> L3 formal recovery -> L4 active state.",
  ].join("\n");
}

function compileSections(params: {
  readonly header: string;
  readonly sections: readonly ContextSection[];
  readonly budgetTokens: number;
}): {
  readonly content: string;
  readonly sources: readonly string[];
  readonly report: readonly ContextBudgetItem[];
  readonly truncated: boolean;
  readonly fullProtocolBaselineTokens: number;
  readonly avoidedContextTokens: number;
  readonly cacheEligiblePrefixTokens: number;
} {
  const pieces = [params.header];
  const sources: string[] = [];
  const report: ContextBudgetItem[] = [
    {
      source: "runtime",
      title: "Prompt Assembly Contract",
      layer: "runtime",
      stability: "stable",
      estimatedTokens: countTextTokens(params.header),
      included: true,
      truncated: false,
    },
  ];
  let usedTokens = countTextTokens(params.header);
  let fullProtocolBaselineTokens = usedTokens;
  let cacheEligiblePrefixTokens = usedTokens;
  let stablePrefixOpen = true;
  let truncated = false;

  for (const section of params.sections) {
    const prefix = [
      "",
      `## ${section.title}`,
      "",
      `Source: \`${section.source}\``,
      "",
      "~~~markdown\n",
    ].join("\n");
    const suffix = "\n~~~";
    const normalized = section.content.trim();
    const prefixTokens = countTextTokens(prefix);
    const suffixTokens = countTextTokens(suffix);
    const normalizedTokens = countTextTokens(normalized);
    const available = params.budgetTokens - usedTokens - prefixTokens - suffixTokens;

    fullProtocolBaselineTokens += prefixTokens + normalizedTokens + suffixTokens;

    if (available <= 0) {
      if (section.required) {
        const omittedContent = [
          "",
          `## ${section.title}`,
          "",
          `Source: \`${section.source}\``,
          "",
          "Content not expanded due to budget exhaustion. Read the file directly as needed.",
        ].join("\n");
        pieces.push(omittedContent);
        sources.push(section.source);
        const omittedTokens = countTextTokens(omittedContent);
        usedTokens += omittedTokens;
        report.push({
          source: section.source,
          title: section.title,
          layer: section.layer,
          stability: section.stability,
          estimatedTokens: 0,
          included: false,
          truncated: true,
        });
      }
      truncated = true;
      stablePrefixOpen = stablePrefixOpen && section.stability === "stable";
      continue;
    }

    const prepared = prepareSectionContent(section, available);
    const preparedTokens = countTextTokens(prepared);
    const nextContent =
      preparedTokens > available
        ? truncateSectionContent(prepared, available, section.source)
        : prepared;
    const nextTokens = countTextTokens(nextContent);

    pieces.push(prefix + nextContent + suffix);
    sources.push(section.source);
    usedTokens += prefixTokens + nextTokens + suffixTokens;
    const sectionTruncated = nextContent !== normalized;
    report.push({
      source: section.source,
      title: section.title,
      layer: section.layer,
      stability: section.stability,
      estimatedTokens: nextTokens,
      included: true,
      truncated: sectionTruncated,
    });
    truncated = truncated || sectionTruncated;

    if (stablePrefixOpen && section.stability === "stable") {
      cacheEligiblePrefixTokens += prefixTokens + nextTokens + suffixTokens;
    } else {
      stablePrefixOpen = false;
    }
  }

  const compiledContent = pieces.join("\n");
  const compiledTokens = countTextTokens(compiledContent);

  return {
    content: compiledContent,
    sources,
    report,
    truncated,
    fullProtocolBaselineTokens,
    avoidedContextTokens: Math.max(0, fullProtocolBaselineTokens - compiledTokens),
    cacheEligiblePrefixTokens,
  };
}

function createFooter(
  workspaceRoot: string,
  truncated: boolean,
  report: readonly ContextBudgetItem[],
): string {
  const lines: string[] = [
    "## Context Budget Report",
    "",
    "| Source | Tokens | Status |",
    "| --- | ---: | --- |",
  ];

  for (const item of report) {
    lines.push(`| \`${item.source}\` | ${item.estimatedTokens} | ${formatBudgetStatus(item)} |`);
  }

  lines.push("");
  lines.push("## Next Use");
  lines.push("");
  lines.push("- Place the user's current prompt after this context and execute.");
  lines.push(
    "- Only read relevant source code, `memory/*.md`, or `sessions/*.md` when the task requires it.",
  );
  lines.push(
    "- After substantive changes, update `STATE.md`; when a phase is complete, run `$finish`.",
  );

  if (truncated) {
    lines.push("- Note: this context was trimmed to budget \u2014 read source files as needed.");
  }

  lines.push("");
  lines.push(
    "> Token counts are local `o200k_base` tokenizer estimates; Codex usage imports remain the source of truth for actual tokens.",
  );
  lines.push("");
  lines.push(`Workspace: \`${workspaceRoot}\``);

  return lines.join("\n");
}

function prepareSectionContent(section: ContextSection, availableTokens: number): string {
  const normalized = section.content.trim();

  if (countTextTokens(normalized) <= availableTokens || section.preserveHeadings === undefined) {
    return normalized;
  }

  const preserved = preserveHeadingSections(normalized, section.preserveHeadings);

  if (preserved.length === 0) {
    return normalized;
  }

  return `${preserved}\n\n[semantic-truncated: ${section.source}]`;
}

function truncateSectionContent(content: string, availableTokens: number, source: string): string {
  const marker = `\n\n[truncated: ${source}]`;
  const markerTokens = countTextTokens(marker);
  const maxContentTokens = Math.max(0, availableTokens - markerTokens);
  const truncated = truncateToTokens(content, maxContentTokens);

  return `${truncated.text.trimEnd()}${marker}`;
}

function createContextStats(params: {
  readonly budgetTokens: number;
  readonly compiledContextTokens: number;
  readonly fullProtocolBaselineTokens: number;
  readonly avoidedContextTokens: number;
  readonly cacheEligiblePrefixTokens: number;
  readonly truncated: boolean;
  readonly report: readonly ContextBudgetItem[];
}): ContextStats {
  const sections: ContextSectionStats[] = params.report.map((item) => ({
    source: item.source,
    title: item.title,
    layer: item.layer,
    stability: item.stability,
    tokens: item.estimatedTokens,
    included: item.included,
    truncated: item.truncated,
  }));

  return {
    budget_tokens: params.budgetTokens,
    compiled_context_tokens: params.compiledContextTokens,
    full_protocol_baseline_tokens: params.fullProtocolBaselineTokens,
    avoided_context_tokens: params.avoidedContextTokens,
    cache_eligible_prefix_tokens: params.cacheEligiblePrefixTokens,
    truncated: params.truncated,
    sections,
  };
}

function preserveHeadingSections(content: string, headings: readonly string[]): string {
  const lines = content.split(/\r?\n/);
  const keep: string[] = [];
  let keeping = false;

  for (const line of lines) {
    const heading = line.match(/^#{1,3}\s+(.+?)\s*$/)?.[1]?.trim();

    if (line.trim() === "---" || frontMatterLinePattern.test(line)) {
      keep.push(line);
      continue;
    }

    if (heading !== undefined) {
      keeping = headings.some((candidate) => heading.includes(candidate));
    }

    if (keeping) {
      keep.push(line);
    }
  }

  return keep.join("\n").trim();
}

const frontMatterLinePattern =
  /^(schema|mode|phase|task_id|git_head|diff_hash|verification|generated_at|confirmed_at):/;

function formatBudgetStatus(item: ContextBudgetItem): string {
  if (!item.included) {
    return "omitted";
  }

  return item.truncated ? "truncated" : "included";
}

function normalizeBudget(value?: number): number {
  if (value === undefined || Number.isNaN(value)) {
    return defaultBudgetTokens;
  }

  return Math.min(maxBudgetTokens, Math.max(minBudgetTokens, Math.floor(value)));
}

async function readIfExists(filePath: string): Promise<string | null> {
  try {
    await access(filePath);
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

function formatRecoverySource(source: string): string {
  switch (source) {
    case "handoff":
      return "HANDOFF";
    case "state":
      return "STATE";
    case "quick_save":
      return "QUICK_SAVE";
    case "none":
      return "none";
    default:
      return source;
  }
}

function formatWorkPhase(phase: string): string {
  switch (phase) {
    case "explore":
      return "explore";
    case "execute":
      return "execute";
    case "idle":
      return "idle";
    default:
      return phase;
  }
}

function formatWorkspaceSummary(workspace: {
  readonly clean: boolean;
  readonly changedFiles: number;
  readonly untrackedFiles: number;
  readonly samplePaths: readonly string[];
}): string {
  if (workspace.clean) {
    return "clean";
  }

  const untracked = workspace.untrackedFiles > 0 ? `, ${workspace.untrackedFiles} untracked` : "";
  const samples =
    workspace.samplePaths.length > 0 ? `; e.g. ${workspace.samplePaths.join(", ")}` : "";

  return `${workspace.changedFiles} changed${untracked}${samples}`;
}
