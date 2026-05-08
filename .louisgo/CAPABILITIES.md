---
schema: louisgo-capabilities-v1
updated_at: "2026-05-08T13:55:47.718Z"
---

# Capabilities

## Daily Loop

- Setup once: `louisgo init`
- Restore at task boundaries: `$start` or `louisgo context --goal "<task>"`
- Reuse the last context while the task and workspace state stay stable.
- Finish a phase: `$finish` or `louisgo finish`

## Verify

- Run verification: `louisgo verify`
- Default init does not copy verify scripts into the project.
- Result: `.louisgo/test-results.json`

## Context

- Start/recover: `louisgo context`
- Observe token/context stats: `louisgo stats`
- Import Codex usage explicitly: `louisgo stats import codex --days 7`
- List optional preset skills: `louisgo skill list`
- Enable preset skills on demand: `louisgo skill enable grill` or `louisgo skill enable caveman`
- Local skill discovery uses `.louisgo/skills/manifest.json`; if it is missing, LouisGo falls back to scanning `.louisgo/skills/*.md` and `.louisgo/skills/*/SKILL.md`.
- Skill bodies are lazy-loaded only when the user explicitly triggers a matching skill by name, alias, or description.
- Claude support is reserved for a future manifest/agent adapter.
- Pending decision UI: `louisgo confirm`
- Finish: `louisgo finish`
- Clear project-local LouisGo data with an interactive risk prompt: `louisgo clear`
- Pending decision: `.louisgo/CONFIRM_REQ.md`

## AI Contract

- User prompt is the task source; LouisGo files only provide context.
- Source, Git status, and verification results override memory.
- Write only durable facts to `STATE.md` or `MEMORY.md`; avoid chat logs.

## ADR Guidance

- Before creating an ADR, ask three questions: is the decision hard to reverse, would future readers be surprised without the context, and is there a real tradeoff? Write the ADR only when all three answers are yes.
- An ADR can be a single paragraph when background and decision fit together.
- Include impact and alternatives only when they add useful information.

## Optional Skills

LouisGo presets are not installed by default. Use `louisgo skill list` to inspect availability and `louisgo skill enable <name>` to add one only when useful. Enabling a skill writes the skill file plus `.louisgo/skills/manifest.json` so Codex can discover metadata first and read the full skill only when triggered. If the project already has a same-name skill under `.codex/skills/` or `.louisgo/skills/`, LouisGo reports the conflict and does not overwrite it.
