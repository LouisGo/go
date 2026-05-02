export function createCodexSkillTemplate(): string {
  return `---
name: louisgo-workflow
description: Use when the user enters LouisGo workflow directives like $start, $status, $verify, $pause, $resume, $finish, or asks to use LouisGo inside Codex. 中文：识别 LouisGo 工作流指令并映射到对应 CLI 和 .louisgo 协议文件。
---

# LouisGo Workflow

When the user's message starts with one of the LouisGo dollar directives below, treat it as an explicit workflow command, not ordinary prose.

## Directive Mapping

| Directive | Required action |
| --- | --- |
| \`$start\` | Run \`louisgo status\`; read \`.louisgo/MISSION.md\` and \`.louisgo/CAPABILITIES.md\`; if status reports \`CONFIRM_REQ\`, \`QUICK_SAVE\`, or \`HANDOFF\`, read the corresponding file before advising next steps. |
| \`$status\` | Run \`louisgo status\` and report mode, current task, verification state, recovery source, and unresolved protocol signals. |
| \`$verify\` | Run \`louisgo verify\` and relay verification status, freshness, summary, and exit-code meaning. |
| \`$pause\` | Run \`louisgo pause\`; report where \`QUICK_SAVE.md\` was written. |
| \`$resume\` | Run \`louisgo status\`; prefer \`.louisgo/HANDOFF.md\` for formal recovery when present; otherwise report the current roadmap task and available recovery source. |
| \`$finish\` | Run \`louisgo finish\`; tell the user to review \`.louisgo/HANDOFF_DRAFT.md\` and then run \`louisgo handoff promote\` when approved. |
| \`$handoff-promote\` | Run \`louisgo handoff promote\`; report the resulting \`HANDOFF.md\` status. |

## Rules

- Always run the mapped \`louisgo\` command before answering a directive.
- If \`.louisgo/\` is missing or incomplete, report the issue and suggest \`louisgo init\`.
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
  short_description: "识别 LouisGo $start、$pause、$finish 和交接工作流"
  default_prompt: "在已启用 LouisGo 的仓库中使用 $start，读取 .louisgo 状态、使命、能力、恢复来源和当前任务。"
`;
}

export function createCodexAgentsBlock(): string {
  return `# LouisGo Codex Workflow

When the user message starts with a LouisGo dollar directive, treat it as an explicit command:

- \`$start\`: run \`louisgo status\`, read \`.louisgo/MISSION.md\` and \`.louisgo/CAPABILITIES.md\`, then inspect \`CONFIRM_REQ\`, \`QUICK_SAVE\`, or \`HANDOFF\` if status indicates they matter.
- \`$status\`: run \`louisgo status\`.
- \`$verify\`: run \`louisgo verify\`.
- \`$pause\`: run \`louisgo pause\`.
- \`$resume\`: run \`louisgo status\` and prefer \`.louisgo/HANDOFF.md\` when present.
- \`$finish\`: run \`louisgo finish\` and remind the user to review \`.louisgo/HANDOFF_DRAFT.md\` before \`louisgo handoff promote\`.
- \`$handoff-promote\`: run \`louisgo handoff promote\`.

These directives are backed by the \`louisgo\` CLI and the \`.louisgo/\` protocol files. If the protocol is missing, suggest \`louisgo init\`.`;
}
