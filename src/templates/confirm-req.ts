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

## Background

## Options

- A. Option description
- B. Option description
- C. Option description
- D. I will restate the requirement

## Recommendation
`;
}
