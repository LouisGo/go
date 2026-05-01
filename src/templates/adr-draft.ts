export interface AdrDraftTemplateOptions {
  readonly createdAt: string;
  readonly title?: string;
}

export function createAdrDraftTemplate(options: AdrDraftTemplateOptions): string {
  const title = options.title?.trim() || "标题";

  return `---
schema: louisgo-adr-v1
status: draft
adr_id: null
created_at: "${options.createdAt}"
confirmed_at: null
---

# ADR Draft: ${title}

## 背景

## 决策

## 影响

## 备选方案
`;
}
