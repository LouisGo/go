import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { findGitRoot } from "../fs/workspace.js";
import { isNodeError } from "../internal/utils.js";
import {
  createCodexAgentsBlock,
  createCodexDirectiveSkillOpenAiYaml,
  createCodexDirectiveSkillTemplate,
  createCodexSkillOpenAiYaml,
  createCodexSkillTemplate,
} from "../templates/codex.js";
import type { CodexDirectiveSkillTemplateOptions } from "../templates/codex.js";

const managedBlockStart = "<!-- louisgo-codex:start -->";
const managedBlockEnd = "<!-- louisgo-codex:end -->";
const projectAgentFileCandidates = ["AGENTS.md", "AGENT.md", "Agent.md", "agents.md", "agent.md"];

export const codexSetupStatuses = {
  created: "created",
  updated: "updated",
  unchanged: "unchanged",
} as const;

export type CodexSetupStatus = (typeof codexSetupStatuses)[keyof typeof codexSetupStatuses];

export interface CodexSetupOptions {
  readonly cwd?: string;
  readonly codexHome?: string;
  readonly env?: NodeJS.ProcessEnv;
}

export interface CodexSetupFileResult {
  readonly filePath: string;
  readonly status: CodexSetupStatus;
}

export interface CodexSetupResult {
  readonly workspaceRoot: string;
  readonly codexHome: string;
  readonly files: readonly CodexSetupFileResult[];
  readonly nextSteps: readonly string[];
}

export async function setupCodex(options: CodexSetupOptions = {}): Promise<CodexSetupResult> {
  const workspaceRoot = await findGitRoot(options.cwd);
  const codexHome = resolve(
    options.codexHome ?? (options.env ?? process.env).CODEX_HOME ?? join(homedir(), ".codex"),
  );
  const skillsDir = join(codexHome, "skills");
  await rm(join(skillsDir, "louisgo-workflow"), { force: true, recursive: true });

  const files = await Promise.all([
    ...codexDirectiveSkills.flatMap((skill) => {
      const skillDir = join(skillsDir, skill.name);
      return [
        writeManagedFile(join(skillDir, "SKILL.md"), createCodexDirectiveSkillTemplate(skill)),
        writeManagedFile(
          join(skillDir, "agents", "openai.yaml"),
          createCodexDirectiveSkillOpenAiYaml(skill),
        ),
      ];
    }),
    writeManagedFile(join(skillsDir, "louisgo", "SKILL.md"), createCodexSkillTemplate()),
    writeManagedFile(
      join(skillsDir, "louisgo", "agents", "openai.yaml"),
      createCodexSkillOpenAiYaml(),
    ),
    upsertAgentsFile(join(codexHome, "AGENTS.md"), createCodexAgentsBlock()),
    upsertProjectAgentsFile(workspaceRoot, createCodexAgentsBlock()),
  ]);

  return {
    workspaceRoot,
    codexHome,
    files,
    nextSteps: [
      "New sessions will read LouisGo context automatically",
      "Use $start for deep recovery",
    ],
  };
}

const codexDirectiveSkills: readonly CodexDirectiveSkillTemplateOptions[] = [
  {
    name: "init",
    directive: "$init",
    title: "LouisGo Init",
    chineseTitle: "Init",
    shortDescription: "LouisGo init: create the protocol directory and install Codex integration",
    description:
      "Initializes LouisGo protocol files and Codex integration for the current repository. Use when the user enters $init in Codex.",
    action:
      "- Run `louisgo init`.\n- Report that `.louisgo/` protocol files were created or skipped safely.\n- Report Codex integration status and the next action.",
  },
  {
    name: "start",
    directive: "$start",
    title: "LouisGo Start",
    chineseTitle: "Start",
    shortDescription: "LouisGo start: generate a layered context package",
    description:
      "Runs the LouisGo start workflow to restore context for the current repository. Use when the user enters $start in Codex.",
    action:
      "- Run `louisgo context`.\n- Use the generated context package as the recovered context.\n- If the package reports `CONFIRM_REQ.md`, run `louisgo confirm` and present the choices before continuing.\n- Report mode, current task, verification state, recovery source, restored context, and first next action.",
  },
  {
    name: "status",
    directive: "$status",
    title: "LouisGo Status",
    chineseTitle: "Status",
    shortDescription:
      "LouisGo status: inspect protocol completeness, current task, verification, and recovery source",
    description:
      "Runs louisgo status and summarizes protocol state. Use when the user enters $status in Codex.",
    action:
      "- Run `louisgo status`.\n- Report protocol completeness, mode, current task, verification state, recovery source, and unresolved signals.",
  },
  {
    name: "context",
    directive: "$context",
    title: "LouisGo Context",
    chineseTitle: "Context",
    shortDescription: "LouisGo context: generate a layered prompt context package",
    description:
      "Generates a LouisGo prompt context package for the current repository. Use when the user enters $context in Codex.",
    action:
      "- Run `louisgo context`.\n- Report the context budget, source layers, verification state, and truncation warning if present.\n- Use the context package as the basis for the next task, without letting cached context override the user's latest request.",
  },
  {
    name: "verify",
    directive: "$verify",
    title: "LouisGo Verify",
    chineseTitle: "Verify",
    shortDescription: "LouisGo verify: run repository verification and report freshness",
    description:
      "Runs LouisGo verification for the current repository. Use when the user enters $verify in Codex.",
    action:
      "- Run `louisgo verify`.\n- Relay verification status, freshness, summary, exit-code meaning, and stale reason if present.",
  },
  {
    name: "pause",
    directive: "$pause",
    title: "LouisGo Pause",
    chineseTitle: "Pause",
    shortDescription: "LouisGo pause: legacy flow that writes QUICK_SAVE.md",
    description:
      "Writes a LouisGo Quick Save checkpoint. Use when the user enters $pause in Codex.",
    action:
      "- Run `louisgo pause`.\n- Report where `QUICK_SAVE.md` was written and remind the user that it is a short-term recovery point.",
  },
  {
    name: "resume",
    directive: "$resume",
    title: "LouisGo Resume",
    chineseTitle: "Resume",
    shortDescription: "LouisGo resume: legacy flow that prefers HANDOFF and STATE",
    description:
      "Resumes from LouisGo handoff/status protocol. Use when the user enters $resume in Codex.",
    action:
      "- Run `louisgo context`.\n- Prefer `HANDOFF.md` content in the context package for formal recovery when present.\n- Otherwise use `STATE.md` and report the current roadmap task and available recovery source.",
  },
  {
    name: "finish",
    directive: "$finish",
    title: "LouisGo Finish",
    chineseTitle: "Finish",
    shortDescription: "LouisGo finish: update formal HANDOFF.md and current state",
    description: "Generates a LouisGo handoff snapshot. Use when the user enters $finish in Codex.",
    action:
      "- Run `louisgo finish`.\n- Report the `HANDOFF.md` path, verification status, cleanup result, and first next action for the next session.",
  },
  {
    name: "handoff-promote",
    directive: "$handoff-promote",
    title: "LouisGo Handoff Promote",
    chineseTitle: "Promote Handoff",
    shortDescription: "LouisGo handoff: legacy flow that promotes HANDOFF_DRAFT.md to HANDOFF.md",
    description:
      "Promotes the LouisGo handoff draft to a formal handoff. Use when the user enters $handoff-promote in Codex.",
    action:
      "- Run `louisgo handoff promote`.\n- Report `HANDOFF.md`, verification status, and recovery implication.",
  },
];

async function writeManagedFile(filePath: string, content: string): Promise<CodexSetupFileResult> {
  const resolvedPath = resolve(filePath);
  const normalizedContent = ensureTrailingNewline(content);
  const current = await readFileIfExists(resolvedPath);

  if (current === normalizedContent) {
    return {
      filePath: resolvedPath,
      status: codexSetupStatuses.unchanged,
    };
  }

  await mkdir(dirname(resolvedPath), { recursive: true });
  await writeFile(resolvedPath, normalizedContent, "utf8");

  return {
    filePath: resolvedPath,
    status: current === null ? codexSetupStatuses.created : codexSetupStatuses.updated,
  };
}

async function upsertAgentsFile(filePath: string, body: string): Promise<CodexSetupFileResult> {
  const resolvedPath = resolve(filePath);
  const current = await readFileIfExists(resolvedPath);
  const next = upsertManagedBlock(current ?? "", body);

  if (current === next) {
    return {
      filePath: resolvedPath,
      status: codexSetupStatuses.unchanged,
    };
  }

  await mkdir(dirname(resolvedPath), { recursive: true });
  await writeFile(resolvedPath, next, "utf8");

  return {
    filePath: resolvedPath,
    status: current === null ? codexSetupStatuses.created : codexSetupStatuses.updated,
  };
}

async function upsertProjectAgentsFile(
  workspaceRoot: string,
  body: string,
): Promise<CodexSetupFileResult> {
  const filePath = await resolveProjectAgentsFile(workspaceRoot);

  return await upsertAgentsFile(filePath, body);
}

async function resolveProjectAgentsFile(workspaceRoot: string): Promise<string> {
  const entries = await readdir(workspaceRoot);

  for (const fileName of projectAgentFileCandidates) {
    if (entries.includes(fileName)) {
      return join(workspaceRoot, fileName);
    }
  }

  return join(workspaceRoot, "AGENTS.md");
}

function upsertManagedBlock(source: string, body: string): string {
  const block = [managedBlockStart, body.trimEnd(), managedBlockEnd].join("\n");
  const pattern = new RegExp(
    `${escapeRegExp(managedBlockStart)}[\\s\\S]*?${escapeRegExp(managedBlockEnd)}`,
  );

  if (pattern.test(source)) {
    return ensureTrailingNewline(source.replace(pattern, block));
  }

  const prefix = source.trimEnd();
  return ensureTrailingNewline(prefix.length === 0 ? block : `${prefix}\n\n${block}`);
}

async function readFileIfExists(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

function ensureTrailingNewline(content: string): string {
  return content.endsWith("\n") ? content : `${content}\n`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
