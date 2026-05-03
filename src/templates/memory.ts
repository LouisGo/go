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

- Git-tracked prompt cache; source/Git/verify facts override memory.
- \`HANDOFF.md\` is formal recovery; this file is a stable index.

## Topic Files

- Add topic files under \`.louisgo/memory/\` only when reused across sessions.

## Recent Sessions

- Add \`.louisgo/sessions/\` summaries only when useful for audit or handoff.
`;
}
