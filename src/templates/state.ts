import type { LouisGoMode, VerificationStatus } from "../protocol/schemas.js";
import { missingTaskId } from "../protocol/schemas.js";

export interface StateTemplateOptions {
  readonly updatedAt: string;
  readonly mode?: LouisGoMode;
  readonly phase?: string;
  readonly currentTask?: string;
  readonly verification?: VerificationStatus;
  readonly gitHead?: string;
  readonly diffHash?: string;
}

export function createStateTemplate(options: StateTemplateOptions): string {
  const mode = options.mode ?? "assist";
  const phase = options.phase ?? "idle";
  const currentTask = options.currentTask ?? missingTaskId;
  const verification = options.verification ?? "missing";
  const gitHead = options.gitHead ?? "NO_HEAD";
  const diffHash = options.diffHash ?? "NO_DIFF";

  return `---
schema: louisgo-state-v1
mode: ${mode}
phase: ${phase}
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
- recovery: prefer \`.louisgo/HANDOFF.md\` when present; otherwise use this file and \`.louisgo/MEMORY.md\`
- focus: fill this with the current concrete development goal

## Next

- first action: inspect \`louisgo context\`, then follow the user's latest prompt
- after meaningful work: update this file, run verification when appropriate, then use \`$finish\` for formal handoff

## Evidence

- claim: | basis: | implication:
`;
}
