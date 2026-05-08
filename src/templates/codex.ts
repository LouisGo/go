export function createCodexSkillTemplate(): string {
  return `---
name: louisgo-workflow
description: "Restores project context from .louisgo/ protocol files and maps LouisGo dollar directives to CLI commands. Use when the user enters $init, $start, $status, $context, $verify, $finish, or when working inside a repository that contains .louisgo/."
---

# LouisGo Workflow

When a repository contains \`.louisgo/\`, treat LouisGo files as the project memory and recovery protocol.

For ordinary coding work in an enabled repo, refresh recovery context at task boundaries:

1. Run \`louisgo context\` on the first repository task in a new session, or before the first file edit after the branch, goal, or \`.louisgo/\` state changes.
2. If you already ran \`louisgo context\` for the same task and workspace state, keep using that context; use \`louisgo status\` for a lightweight freshness check.
3. If the context package or status reports \`.louisgo/CONFIRM_REQ.md\`, run \`louisgo confirm\` and present the choices before continuing.
4. If \`louisgo context\` is unavailable, fall back to reading \`.louisgo/CONFIRM_REQ.md\`, \`.louisgo/HANDOFF.md\`, \`.louisgo/STATE.md\`, and \`.louisgo/MEMORY.md\`.
5. Topic files under \`.louisgo/memory/\` only when relevant.
6. If the user asks to debug whether LouisGo helped, run \`louisgo log --tail 30\` and summarize \`.louisgo/RUNLOG.md\`.

## Local Skills

LouisGo local skills use a manifest-plus-lazy-load pattern:

- Discovery index: \`.louisgo/skills/manifest.json\`.
- Fallback discovery when the manifest is absent: scan \`.louisgo/skills/*.md\` and \`.louisgo/skills/*/SKILL.md\` front matter.
- Treat each skill's \`name\`, \`description\`, and aliases as trigger metadata.
- Do not read full skill files during ordinary recovery. When the user invokes a matching skill by name, alias, or trigger phrase, read only that skill file and apply it.
- Codex is the active adapter. Claude support is reserved for a future generated \`CLAUDE.md\` or plugin manifest adapter.

When the user's message starts with one of the LouisGo dollar directives below, treat it as an explicit workflow command, not ordinary prose.

## Command Selection

Use the best available LouisGo command runner:

1. When working inside the \`louisgo\` source repository and \`./dist/cli.js\` exists, use \`node ./dist/cli.js <subcommand>\` so self-bootstrap runs the current local build.
2. Otherwise use \`louisgo <subcommand>\` when the global command is available.
3. If \`louisgo\` is not on PATH, use \`npx --yes louisgo@latest <subcommand>\`.

## Directive Mapping

| Directive | Required action |
| --- | --- |
| \`$init\` | Run \`louisgo init\`; report that protocol files and Codex integration were installed. |
| \`$start\` | Run \`louisgo context\`; use the generated context package to report the restored context and first next action. |
| \`$status\` | Run \`louisgo status\` and report mode, current task, verification state, recovery source, and unresolved protocol signals. |
| \`$context\` | Run \`louisgo context\` and relay the context budget, source layers, and any truncation warning. |
| \`$verify\` | Run \`louisgo verify\` and relay verification status, freshness, summary, and exit-code meaning. |
| \`$pause\` | Legacy command: run \`louisgo pause\`; report where \`QUICK_SAVE.md\` was written. |
| \`$resume\` | Legacy alias for deep recovery: run \`louisgo context\`; prefer \`HANDOFF.md\` content, then \`STATE.md\`. |
| \`$finish\` | Run \`louisgo finish\`; report the resulting \`.louisgo/HANDOFF.md\`, verification status, cleanup result, and next action. |
| \`$handoff-promote\` | Legacy command: run \`louisgo handoff promote\`; report the resulting \`HANDOFF.md\` status. |

## Rules

- Always run the mapped \`louisgo\` command before answering a directive.
- Command selection may replace \`louisgo <subcommand>\` with \`node ./dist/cli.js <subcommand>\` for the local \`louisgo\` source repository, or with \`npx --yes louisgo@latest <subcommand>\` when no global command is available.
- If \`.louisgo/\` is missing or incomplete, report the issue and suggest \`louisgo init\`.
- \`HANDOFF.md\` is the formal recovery snapshot. \`STATE.md\` and \`MEMORY.md\` are supporting daily memory.
- Do not mark work complete from narrative alone; use verification results, user confirmation, or protocol files.
- Keep user-facing explanations concise and in English by default, unless the user asks for another language.
`;
}

export interface CodexDirectiveSkillTemplateOptions {
  readonly name: string;
  readonly directive: string;
  readonly title: string;
  readonly chineseTitle?: string;
  readonly shortDescription: string;
  readonly description: string;
  readonly action: string;
}

export function createCodexDirectiveSkillTemplate(
  options: CodexDirectiveSkillTemplateOptions,
): string {
  return `---
name: ${options.name}
description: ${options.description}
---

# ${options.title}${options.chineseTitle !== undefined ? ` (${options.chineseTitle})` : ""}

When the user invokes \`${options.directive}\`, treat it as an explicit LouisGo workflow command.

Required action:

${options.action}

Command selection:

- When working inside the \`louisgo\` source repository and \`./dist/cli.js\` exists, use \`node ./dist/cli.js <subcommand>\`.
- Otherwise use \`louisgo <subcommand>\` when the global command is available.
- If \`louisgo\` is not on PATH, use \`npx --yes louisgo@latest <subcommand>\`.

Rules:

- Always run the mapped \`louisgo\` command before answering.
- If \`.louisgo/\` is missing or incomplete, report the issue and suggest \`louisgo init\`.
- Keep the response concise and in English by default, unless the user asks for another language.
`;
}

export function createCodexDirectiveSkillOpenAiYaml(
  options: CodexDirectiveSkillTemplateOptions,
): string {
  return `interface:
  display_name: "${options.directive}"
  short_description: "${options.shortDescription}"
  default_prompt: "${options.directive}"
`;
}

export function createCodexSkillOpenAiYaml(): string {
  return `interface:
  display_name: "LouisGo Workflow"
  short_description: "LouisGo workflow: read .louisgo memory and route $start/$finish"
  default_prompt: "In repositories with LouisGo enabled, read .louisgo/HANDOFF.md, STATE.md, and MEMORY.md to recover project context."
`;
}

export function createCodexAgentsBlock(): string {
  return `## LouisGo

When this repository contains \`.louisgo/\`, use LouisGo as a project-local recovery protocol.

- Existing project instructions in this file remain authoritative.
- On the first repository task in a new session, or before the first file edit after the branch, goal, or \`.louisgo/\` state changes, run \`louisgo context\`.
- If \`louisgo context\` already ran for the same task and workspace state, keep using that context; use \`louisgo status\` for a lightweight freshness check.
- If context or status reports \`.louisgo/CONFIRM_REQ.md\`, run \`louisgo confirm\` and present the choices before continuing.
- Local skill discovery uses \`.louisgo/skills/manifest.json\`. If it is absent, scan \`.louisgo/skills/*.md\` and \`.louisgo/skills/*/SKILL.md\` front matter. Do not read full skill files by default; when the user invokes a matching skill by name, alias, or trigger phrase, read only that skill file and apply it.
- Codex is the active local-skill adapter; Claude support is reserved for a future \`CLAUDE.md\` or plugin manifest adapter.
- For explicit dollar directives, route through the global \`louisgo\` CLI:
  - \`$start\` / \`$context\`: \`louisgo context\`
  - \`$status\`: \`louisgo status\`
  - \`$verify\`: \`louisgo verify\`
  - \`$finish\`: \`louisgo finish\`
  - \`$init\`: \`louisgo init\`

If \`louisgo\` is unavailable, use \`npx --yes louisgo@latest <subcommand>\`.`;
}
