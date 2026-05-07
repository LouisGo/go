export interface CapabilitiesTemplateOptions {
  readonly updatedAt: string;
}

export function createCapabilitiesTemplate(options: CapabilitiesTemplateOptions): string {
  return `---
schema: louisgo-capabilities-v1
updated_at: "${options.updatedAt}"
---

# Capabilities

## Daily Loop

- Setup once: \`louisgo init\`
- Restore when needed: \`$start\` or \`louisgo context --goal "<task>"\`
- Work normally: AI reads this prompt cache before changing files.
- Finish a phase: \`$finish\` or \`louisgo finish\`

## Verify

- macOS / Linux: \`.louisgo/scripts/verify.sh\`
- Windows: \`.louisgo/scripts/verify.ps1\`
- Result: \`.louisgo/test-results.json\`

## Context

- Start/recover: \`louisgo context\`
- Observe token/context stats: \`louisgo stats\`
- Import Codex usage explicitly: \`louisgo stats import codex --days 7\`
- List optional preset skills: \`louisgo skill list\`
- Enable preset skills on demand: \`louisgo skill enable grill\` or \`louisgo skill enable caveman\`
- Pending decision UI: \`louisgo confirm\`
- Finish: \`louisgo finish\`
- Pending decision: \`.louisgo/CONFIRM_REQ.md\`

## AI Contract

- User prompt is the task source; LouisGo files only provide context.
- Source, Git status, and verification results override memory.
- Write only durable facts to \`STATE.md\` or \`MEMORY.md\`; avoid chat logs.

## ADR Guidance

- 创建 ADR 前三问：是否难以逆转？缺少上下文是否会让人意外？是否存在真实取舍？全部回答"是"才值得写。
- ADR 可以只有一段话（背景 + 决策合并）。
- "影响"和"备选方案"只在有实际内容时才写。

## Optional Skills

LouisGo presets are not installed by default. Use \`louisgo skill list\` to inspect availability and \`louisgo skill enable <name>\` to add one only when useful. If the project already has a same-name skill under \`.codex/skills/\` or \`.louisgo/skills/\`, LouisGo reports the conflict and does not overwrite it.
`;
}
