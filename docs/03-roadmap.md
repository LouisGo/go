# Roadmap

## Completed Foundation

- Node.js + TypeScript CLI, package name `louisgo`, public version `0.1.0`.
- `.louisgo/` protocol initialization: mission, capabilities, state, memory, roadmap, and verification support.
- Codex integration: skills, project agent managed block, task-boundary `louisgo context` refresh, and lazy local skill loading from `.louisgo/skills/manifest.json`.
- `louisgo context`: layered prompt cache compilation with sources, budget, and user-prompt priority contract.
- `louisgo status`: protocol completeness, current task, verification state, recovery source, and workspace diff reporting.
- `louisgo verify`: repository verification entry, `test-results.json` writing, and freshness checking.
- `louisgo finish`: formal `HANDOFF.md` generation with Git diff, verification, blockers, confirmation requests, and next steps.
- `louisgo confirm`: structured confirmation request reading with command-line selection and terminal fallback.
- `louisgo log`: local diagnostic logs for checking whether the workflow worked across projects.
- Self-validation in this repository: format, typecheck, test, build, and pack check are included in the LouisGo verification gate.
- Work phase management: `STATE.md` supports explore, execute, and idle phases with phase-aware context guidance.
- ROADMAP completion signals: task lines support `#completion:` suffixes.
- Structured evidence chain: `STATE.md` Evidence supports claim, basis, and implication format.
- `CONTEXT.md` protocol file: optional domain glossary that context assembly includes when present.
- Simplified ADR draft template: three-question filter, optional sections, and single-paragraph support.
- Codex skill description normalization: English two-sentence descriptions with localized titles moved into body text.
- Domain glossary hint in context headers when `CONTEXT.md` exists.
- Codex-first stats: local context token estimates, explicit Codex usage import, cached token ratio, and simulated savings.
- Lightweight init: `init` writes only the minimal protocol, and context uses cold-start bypass before real memory exists.
- On-demand preset skills: `louisgo skill list/enable/disable` manages grill and caveman, refreshes a local manifest, reserves a Claude adapter slot, and detects same-name project skill conflicts.
- Project cleanup: `louisgo clear --dry-run` previews targets, and `louisgo clear` uses a direction-key confirmation prompt before deleting project `.louisgo/` and the managed project-agent block.

## Next Candidates

- P1: interactive platform selection during `init`: Codex, Claude Code, Gemini CLI, Cursor, and other CLIs.
- P2: emit rules or memory files for non-Codex platforms.
- P3: add a lightweight repo map that caches only key paths, module boundaries, and verification entry.
- P4: improve `context --capsule` with clearer subagent write boundaries and return format.
- P5: auto-fill `CONTEXT.md` candidates from code during exploration.
- P6: multi-platform rules output for Claude Code, Gemini CLI, and similar tools.
- P7: extend stats adapters to Claude Code, OpenCode, and Cursor, with user-defined pricing.

## Out Of Scope

- No background service, database, vector search, or cloud sync by default.
- No full chat transcript storage by default.
- Memory never overrides source code, Git state, verification results, or the current user prompt.
