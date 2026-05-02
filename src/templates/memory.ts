export interface MemoryTemplateOptions {
  readonly updatedAt: string;
}

export function createMemoryTemplate(options: MemoryTemplateOptions): string {
  return `---
schema: louisgo-memory-v1
updated_at: "${options.updatedAt}"
---

# Memory

## Stable Notes

- LouisGo 使用 Markdown + YAML Front Matter 保存项目记忆。
- \`HANDOFF.md\` 是正式交接；本文件是日常滚动记忆索引。
- 代码事实、Git 状态和验证结果优先于记忆叙述。

## Topic Files

- \`.louisgo/memory/\` 可按主题新增长期记忆文件。

## Recent Sessions

- \`.louisgo/sessions/\` 可按需保存单次会话摘要。
`;
}
