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

- LouisGo is a Git-tracked prompt cache for AI coding context.
- Source, Git status, and verification results override memory.
- \`HANDOFF.md\` is formal recovery; this file is the stable memory index.
- Keep this file short; move reusable details into topic files only when they survive multiple sessions.

## Topic Files

- Add \`.louisgo/memory/<topic>.md\` files only for durable architecture, product, testing, or deployment knowledge.

## Recent Sessions

- Add \`.louisgo/sessions/\` summaries only when useful for audit, handoff, or long-running work.
`;
}
