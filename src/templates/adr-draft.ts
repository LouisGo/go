export interface AdrDraftTemplateOptions {
  readonly createdAt: string;
  readonly title?: string;
}

export function createAdrDraftTemplate(options: AdrDraftTemplateOptions): string {
  const title = options.title?.trim() || "Title";

  return `---
schema: louisgo-adr-v1
status: draft
adr_id: null
created_at: "${options.createdAt}"
confirmed_at: null
---

# ADR Draft: ${title}

<!-- Before creating an ADR, ask: 1) Is this hard to reverse? 2) Would future readers be surprised without the context? 3) Is there a real tradeoff? Write the ADR only when all three answers are yes. -->

## Background

<!-- What situation made this decision necessary? Future readers should not be surprised by missing context. -->

## Decision (Optional)

<!-- What did we choose, and why is this option better than the alternatives? One paragraph is enough when the background is already clear. -->

## Impact (Optional)

<!-- What observable consequences does this decision create? Which files or modules are affected? -->
`;
}
