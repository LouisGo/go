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

- task: ${currentTask}
- verification: ${verification}
- handoff: prefer \`.louisgo/HANDOFF.md\` when present

## Next

- run \`louisgo context\` for recovery; update this file after meaningful work
`;
}
