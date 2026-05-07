export function createCodexSkillTemplate(): string {
  return `---
name: louisgo-workflow
description: "Restores project context from .louisgo/ protocol files and maps LouisGo dollar directives to CLI commands. Use when the user enters $init, $start, $status, $context, $verify, $finish, or when working inside a repository that contains .louisgo/."
---

# LouisGo Workflow

When a repository contains \`.louisgo/\`, treat LouisGo files as the project memory and recovery protocol.

For ordinary coding requests in an enabled repo, read the available recovery context before changing files:

1. Run \`louisgo context\` to get the compiled prompt context package.
2. If the context package or status reports \`.louisgo/CONFIRM_REQ.md\`, run \`louisgo confirm\` and present the choices before continuing.
3. If \`louisgo context\` is unavailable, fall back to reading \`.louisgo/CONFIRM_REQ.md\`, \`.louisgo/HANDOFF.md\`, \`.louisgo/STATE.md\`, and \`.louisgo/MEMORY.md\`.
4. Topic files under \`.louisgo/memory/\` only when relevant.
5. If the user asks to debug whether LouisGo helped, run \`louisgo log --tail 30\` and summarize \`.louisgo/RUNLOG.md\`.

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
- Keep user-facing explanations concise and in Simplified Chinese by default.
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
- Keep the response concise and in Simplified Chinese by default.
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
  short_description: "LouisGo 工作流：自动读取 .louisgo 记忆并识别 $start/$finish"
  default_prompt: "在已启用 LouisGo 的仓库中读取 .louisgo/HANDOFF.md、STATE.md 和 MEMORY.md，恢复项目上下文。"
`;
}

export function createCodexAgentsBlock(): string {
  return `# LouisGo Codex Workflow

When this repository contains \`.louisgo/\`, treat those files as the project memory and recovery protocol.

For ordinary coding requests, before changing files, inspect the available LouisGo context in this order:

1. Run \`louisgo context\`.
2. If the context package or status reports \`.louisgo/CONFIRM_REQ.md\`, run \`louisgo confirm\` and present the choices before continuing.
3. If \`louisgo context\` is unavailable, read \`.louisgo/CONFIRM_REQ.md\`, \`.louisgo/HANDOFF.md\`, \`.louisgo/STATE.md\`, and \`.louisgo/MEMORY.md\`.
4. Relevant files under \`.louisgo/memory/\` or \`.louisgo/sessions/\` only when needed.
5. If the user asks to debug the LouisGo workflow, run \`louisgo log --tail 30\` and summarize \`.louisgo/RUNLOG.md\`.

When the user message starts with a LouisGo dollar directive, treat it as an explicit command:

Command selection: when working inside the \`louisgo\` source repository and \`./dist/cli.js\` exists, use \`node ./dist/cli.js <subcommand>\`; otherwise use \`louisgo <subcommand>\` when available; if \`louisgo\` is not on PATH, use \`npx --yes louisgo@latest <subcommand>\`.

- \`$init\`: run \`louisgo init\`.
- \`$start\`: run \`louisgo context\`.
- \`$status\`: run \`louisgo status\`.
- \`$context\`: run \`louisgo context\`.
- \`$verify\`: run \`louisgo verify\`.
- \`$pause\`: legacy command; run \`louisgo pause\`.
- \`$resume\`: legacy alias; run \`louisgo context\` and prefer \`HANDOFF.md\`, then \`STATE.md\`.
- \`$finish\`: run \`louisgo finish\` and report the resulting \`.louisgo/HANDOFF.md\`.
- \`$handoff-promote\`: legacy command; run \`louisgo handoff promote\`.

These directives are backed by the \`louisgo\` CLI and the \`.louisgo/\` protocol files. If the protocol is missing, suggest \`louisgo init\`.`;
}
