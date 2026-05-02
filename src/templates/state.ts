import type { LouisGoMode, VerificationStatus } from "../protocol/schemas.js";

export interface StateTemplateOptions {
  readonly updatedAt: string;
  readonly mode?: LouisGoMode;
  readonly currentTask?: string;
  readonly verification?: VerificationStatus;
  readonly gitHead?: string;
  readonly diffHash?: string;
}

export function createStateTemplate(options: StateTemplateOptions): string {
  const mode = options.mode ?? "assist";
  const currentTask = options.currentTask ?? "T001";
  const verification = options.verification ?? "missing";
  const gitHead = options.gitHead ?? "NO_HEAD";
  const diffHash = options.diffHash ?? "NO_DIFF";

  return `---
schema: louisgo-state-v1
mode: ${mode}
current_task: ${currentTask}
handoff: .louisgo/HANDOFF.md
verification: ${verification}
git_head: ${gitHead}
diff_hash: ${diffHash}
updated_at: "${options.updatedAt}"
---

# State

## Now

- 当前任务：${currentTask}
- 验证状态：${verification}
- 正式交接：如果存在，优先读取 \`.louisgo/HANDOFF.md\`。

## Next

- 第一次启用后，运行 \`$start\` 建立上下文；日常新会话按 \`AGENTS.md\` 自动读取本文件。

## Recovery Order

1. \`.louisgo/HANDOFF.md\`
2. \`.louisgo/STATE.md\`
3. \`.louisgo/MEMORY.md\`
4. \`.louisgo/memory/*.md\`
5. \`.louisgo/sessions/*.md\`
`;
}
