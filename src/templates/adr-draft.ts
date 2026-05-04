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

<!-- 创建 ADR 前三问：1) 是否难以逆转？2) 缺少上下文时是否会让人意外？3) 是否存在真实取舍？全部回答"是"才值得写。-->

## 背景

<!-- 什么情况导致需要做决策？缺少这段上下文时，未来的读者会意外。 -->

## 决策（可选）

<!-- 我们选择了什么？为什么这个方案比其他选项好？如果背景已经足够清楚，一段话就够了。 -->

## 影响（可选）

<!-- 这个决策会带来什么可观察的后果？对哪些文件或模块有影响？ -->
`;
}
