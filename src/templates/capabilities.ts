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

## Active Skills

Behavioral skills live in \`.louisgo/skills/\` as on-demand reference files. They are NOT auto-injected into the context package — read them when the situation calls for it.

- **grill**: Stress-test a plan or design by interviewing the user relentlessly about every branch of the decision tree. Use when the user says "grill me" or wants to validate a design before committing to implementation.
- **caveman**: Ultra-compressed communication — drop filler, articles, and pleasantries while keeping full technical accuracy. Use when the user says "caveman mode" or wants fewer tokens.
- **diagnose**: Trace the root cause through the code before proposing a fix — do not guess from the error message alone. Run \`louisgo verify\` before and after the fix. Use when debugging failures or regressions.
- **zoom-out**: Step back and show the big picture — identify layers, explain relationships, list options with one-line trade-offs. Use when the user asks a broad question or you are deep in implementation details.

Users can add, edit, or remove skill files. Invoke a skill explicitly when its scenario matches the current task.
`;
}
