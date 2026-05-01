import type { LouisGoMode } from "../protocol/schemas.js";

export interface ConfirmReqTemplateOptions {
  readonly mode: LouisGoMode;
  readonly taskId: string;
  readonly createdAt: string;
}

export function createConfirmReqTemplate(options: ConfirmReqTemplateOptions): string {
  return `---
schema: louisgo-confirm-req-v1
mode: ${options.mode}
task_id: ${options.taskId}
status: open
created_at: "${options.createdAt}"
---

# Confirm Request

## 背景

## 选项

- A. 选项说明
- B. 选项说明
- C. 选项说明
- D. 我重新说明需求

## 建议
`;
}
