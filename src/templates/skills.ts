export function createGrillSkill(): string {
  return `# Grill

Before writing or changing any code, defend your understanding of the existing code and data.

## Protocol

1. Summarize what you believe the relevant code currently does, citing file paths and line numbers.
2. List every assumption you are making (inputs, invariants, side effects).
3. Check each assumption against the actual source. Flag any mismatch immediately.
4. Reference terms from CONTEXT.md if it exists — use the project's own vocabulary.
5. Only after passing all checks, proceed with the change.

## Anti-patterns

- Do not paraphrase the user's request back to them.
- Do not skip the assumption check because "it's a simple change."
- Do not silently resolve conflicts — flag them before acting.
`;
}

export function createCavemanSkill(): string {
  return `# Caveman

Explain your reasoning in the simplest language possible.

## Protocol

1. State what you are about to do in one plain sentence.
2. Show the change (diff or code block).
3. Explain why it works in one sentence.
4. If the user needs to act, say so explicitly in one sentence.

## Rules

- One idea per message unless the user asked for more.
- No jargon unless it is defined in CONTEXT.md.
- If a concept is complex, use an analogy — not more jargon.
- If you are unsure, say "I am not sure" and explain what is missing.
`;
}

export function createDiagnoseSkill(): string {
  return `# Diagnose

When something is broken, investigate before proposing a fix.

## Protocol

1. Reproduce or locate the failing behavior. Cite the error, test, or log line.
2. Trace the cause through the code — do not guess from the error message alone.
3. List every possible root cause ranked by likelihood.
4. For each cause, state what evidence would confirm or rule it out.
5. After confirming the cause, propose the minimal fix and explain why it addresses the root cause.

## Integration

- Run \`louisgo verify\` before and after the fix to confirm the fix does not introduce regressions.
- If the fix involves protocol files (STATE.md, HANDOFF.md, etc.), validate with \`louisgo status\`.
- Document the root cause in a brief note — add to MEMORY.md only if the lesson is reusable.
`;
}

export function createZoomOutSkill(): string {
  return `# Zoom Out

When the user asks a broad question or you are deep in implementation, step back and show the big picture.

## Protocol

1. Identify what layer the current work sits in (e.g., protocol design, CLI surface, template generation, context compilation).
2. Describe the relationship between that layer and adjacent layers in one or two sentences.
3. If the user is asking "how should we approach X," list the options with one-line trade-offs.
4. Reference CONTEXT.md for domain vocabulary — match the project's own terms.
5. If a decision has long-term implications, note whether an ADR would be appropriate (see ADR Guidance in CAPABILITIES.md).

## Anti-patterns

- Do not dive into implementation details when the question is architectural.
- Do not list options without trade-offs.
- Do not skip the layer context — the user may not share your mental model.
`;
}
