export interface RunLogTemplateOptions {
  readonly updatedAt: string;
  readonly maxEvents?: number;
}

export const defaultRunLogMaxEvents = 80;
export const runLogEventsMarker = "<!-- louisgo-runlog:events -->";

export function createRunLogTemplate(options: RunLogTemplateOptions): string {
  const maxEvents = options.maxEvents ?? defaultRunLogMaxEvents;

  return `---
schema: louisgo-runlog-v1
updated_at: "${options.updatedAt}"
max_events: ${maxEvents}
---

# Run Log

This is a compact diagnostic trace for LouisGo workflow behavior. It records command-level events only; it should not store user prompts, chat transcripts, secrets, or source code.

## How To Share

- Send this file when you want another AI session to diagnose whether LouisGo helped or got in the way.
- Pair it with \`.louisgo/HANDOFF.md\` only when the recovery state matters.
- Newest events are first and older events are trimmed automatically.

## Events

${runLogEventsMarker}
`;
}

export function createLouisGoGitignoreTemplate(): string {
  return `RUNLOG.md
stats/
`;
}
