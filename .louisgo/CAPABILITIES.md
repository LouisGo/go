---
schema: louisgo-capabilities-v1
updated_at: "2026-05-04T06:21:00.000Z"
---

# Capabilities

## Daily Commands

- `$init`: initialize the `.louisgo/` protocol and install the required AI integration for the current platform.
- Natural conversation: AI runs `louisgo context` before editing; ordinary new sessions do not require repeated `$start`.
- `$start`: manual deep recovery; run `louisgo context` and report recovery source, verification state, and first action.
- `$finish`: finish the phase and generate formal `.louisgo/HANDOFF.md`.

## Context

- Main recovery command: `louisgo context --goal "<current goal>" --budget <tokens>`
- Subagent capsule: `louisgo context --capsule --goal "<subtask>" --budget <tokens>`
- Assembly order: MISSION/CAPABILITIES -> MEMORY -> HANDOFF -> CONFIRM_REQ/STATE.
- Output must include sources, budget report, and the user-prompt priority contract.

## Stats

- Local observation command: `louisgo stats`
- Explicit Codex usage import: `louisgo stats import codex --days 7`
- Stats store only token numbers, section metadata, and source file fingerprints. They do not store prompts, chat text, or source code.

## Verify

- macOS / Linux command: `.louisgo/scripts/verify.sh`
- Windows command: `.louisgo/scripts/verify.ps1`
- Result: `.louisgo/test-results.json`
- Current project verification includes `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm pack:check`.
- `louisgo status` reports whether the Git workspace still has pending changes, so a passed verification result is not confused with a clean result boundary.

## Signals

- Pending confirmation: `.louisgo/CONFIRM_REQ.md`
- Friendly confirmation entry: `louisgo confirm`, `louisgo confirm --choice <A|B|C|D>`, or `louisgo confirm --interactive`
- Diagnostic log: `.louisgo/RUNLOG.md` or `louisgo log --tail 30`
- Formal handoff: `.louisgo/HANDOFF.md`
- Rolling state: `.louisgo/STATE.md`
- Stable memory index: `.louisgo/MEMORY.md`
- Optional domain glossary: `.louisgo/CONTEXT.md`

## ADR Guidance

- Before creating an ADR, ask three questions: is the decision hard to reverse, would future readers be surprised without the context, and is there a real tradeoff? Write the ADR only when all three answers are yes.
- An ADR can be a single paragraph when background and decision fit together.
- Include impact and alternatives only when they add useful information.

## Active Skills

Behavioral skills live in `.louisgo/skills/` as on-demand reference files. They are NOT auto-injected into the context package; read them only when the situation calls for it.

- **grill**: Stress-test a plan or design by interviewing the user relentlessly about every branch of the decision tree. Use when the user says "grill me" or wants to validate a design before committing to implementation.
- **caveman**: Ultra-compressed communication that drops filler, articles, and pleasantries while keeping full technical accuracy. Use when the user says "caveman mode" or wants fewer tokens.

Users can add, edit, or remove skill files. Invoke a skill explicitly when its scenario matches the current task.
