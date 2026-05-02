export function createCodexSkillTemplate(): string {
  return `---
name: louisgo-workflow
description: Use when the user enters LouisGo workflow directives like $init, $start, or $finish, or when working inside a repo that contains .louisgo. 中文：LouisGo 工作流：自动读取项目记忆并映射核心指令。
---

# LouisGo Workflow

When a repository contains \`.louisgo/\`, treat LouisGo files as the project memory and recovery protocol.

For ordinary coding requests in an enabled repo, read the available recovery context before changing files:

1. \`.louisgo/CONFIRM_REQ.md\` when present.
2. \`.louisgo/HANDOFF.md\` when present.
3. \`.louisgo/STATE.md\`.
4. \`.louisgo/MEMORY.md\`.
5. Topic files under \`.louisgo/memory/\` only when relevant.

When the user's message starts with one of the LouisGo dollar directives below, treat it as an explicit workflow command, not ordinary prose.

## Command Selection

Use \`louisgo <subcommand>\` by default. When working inside the \`louisgo\` source repository and \`./dist/cli.js\` exists, use \`node ./dist/cli.js <subcommand>\` so self-bootstrap runs the current local build instead of a stale global install.

## Directive Mapping

| Directive | Required action |
| --- | --- |
| \`$init\` | Run \`louisgo init\`; report that protocol files and Codex integration were installed. |
| \`$start\` | Run \`louisgo status\`; read \`.louisgo/MISSION.md\`, \`.louisgo/CAPABILITIES.md\`, \`.louisgo/HANDOFF.md\` when present, \`.louisgo/STATE.md\`, and \`.louisgo/MEMORY.md\`; report the restored context and first next action. |
| \`$status\` | Run \`louisgo status\` and report mode, current task, verification state, recovery source, and unresolved protocol signals. |
| \`$verify\` | Run \`louisgo verify\` and relay verification status, freshness, summary, and exit-code meaning. |
| \`$pause\` | Legacy command: run \`louisgo pause\`; report where \`QUICK_SAVE.md\` was written. |
| \`$resume\` | Legacy alias for deep recovery: run \`louisgo status\`; prefer \`.louisgo/HANDOFF.md\`, then \`.louisgo/STATE.md\`. |
| \`$finish\` | Run \`louisgo finish\`; report the resulting \`.louisgo/HANDOFF.md\`, verification status, cleanup result, and next action. |
| \`$handoff-promote\` | Legacy command: run \`louisgo handoff promote\`; report the resulting \`HANDOFF.md\` status. |

## Rules

- Always run the mapped \`louisgo\` command before answering a directive.
- Command selection may replace \`louisgo <subcommand>\` with \`node ./dist/cli.js <subcommand>\` only for the local \`louisgo\` source repository.
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
  readonly shortDescription: string;
  readonly description: string;
  readonly action: string;
}

export function createCodexDirectiveSkillTemplate(
  options: CodexDirectiveSkillTemplateOptions,
): string {
  return `---
name: ${options.name}
description: ${options.description} 中文：${options.shortDescription}。
---

# ${options.title}

When the user invokes \`${options.directive}\`, treat it as an explicit LouisGo workflow command.

Required action:

${options.action}

Command selection:

- Use \`louisgo <subcommand>\` by default.
- When working inside the \`louisgo\` source repository and \`./dist/cli.js\` exists, use \`node ./dist/cli.js <subcommand>\` so self-bootstrap runs the current local build instead of a stale global install.

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

1. \`.louisgo/CONFIRM_REQ.md\` when present.
2. \`.louisgo/HANDOFF.md\` when present.
3. \`.louisgo/STATE.md\`.
4. \`.louisgo/MEMORY.md\`.
5. Relevant files under \`.louisgo/memory/\` or \`.louisgo/sessions/\` only when needed.

When the user message starts with a LouisGo dollar directive, treat it as an explicit command:

Command selection: use \`louisgo <subcommand>\` by default. When working inside the \`louisgo\` source repository and \`./dist/cli.js\` exists, use \`node ./dist/cli.js <subcommand>\` so self-bootstrap runs the current local build instead of a stale global install.

- \`$init\`: run \`louisgo init\`.
- \`$start\`: run \`louisgo status\`, read \`.louisgo/MISSION.md\`, \`.louisgo/CAPABILITIES.md\`, \`.louisgo/HANDOFF.md\` when present, \`.louisgo/STATE.md\`, and \`.louisgo/MEMORY.md\`.
- \`$status\`: run \`louisgo status\`.
- \`$verify\`: run \`louisgo verify\`.
- \`$pause\`: legacy command; run \`louisgo pause\`.
- \`$resume\`: legacy alias; run \`louisgo status\` and prefer \`.louisgo/HANDOFF.md\`, then \`.louisgo/STATE.md\`.
- \`$finish\`: run \`louisgo finish\` and report the resulting \`.louisgo/HANDOFF.md\`.
- \`$handoff-promote\`: legacy command; run \`louisgo handoff promote\`.

These directives are backed by the \`louisgo\` CLI and the \`.louisgo/\` protocol files. If the protocol is missing, suggest \`louisgo init\`.`;
}
