# Roadmap

## Self-Bootstrap Closed Loop

- [x] T001 Manually try the LouisGo self-bootstrap flow
- [x] T002 Confirm npm public version, license, and package name
- [x] T003 Pre-publish review and formal publish
- [x] T004 Read CLI version from package.json as the single source of truth
- [x] T005 Add interactive confirm selection and additional input
- [x] T006 Use an isolated npm cache for pack:check and include it in verification
- [x] T007 Converge the bootstrap result into a minimal loop humans can understand, AI can execute, and external projects can test
- [x] T008 Add LouisGo workflow logs that can be sent to AI for cross-project diagnostics
- [x] T009 Work phase management (explore/execute/idle)
- [x] T010 ROADMAP completion signal (#completion:)
- [x] T011 Structured evidence chain (STATE.md Evidence section)
- [x] T012 Optional CONTEXT.md protocol file
- [x] T013 Simplify ADR draft template
- [x] T014 Normalize Codex skill descriptions
- [x] T015 Add domain glossary hint to context header
- [x] T016 Codex-first stats and context observation

## Next Candidates

- P1: choose AI platform interactively during `init` instead of splitting it into several user commands.
- P2: emit matching rule files for Claude Code, Gemini CLI, Cursor, and similar platforms.
- P3: add a lightweight repo map that caches only key paths and module boundaries.
- P4: improve `context --capsule` subagent write boundaries and return format.
- P5: auto-fill CONTEXT.md by extracting candidate terms from code during exploration.
- P6: multi-platform rules output for Claude Code, Gemini CLI, and similar tools.
- P7: extend stats adapters to Claude Code, OpenCode, and Cursor, with user-defined pricing.
