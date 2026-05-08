---
schema: louisgo-memory-v1
updated_at: "2026-05-08T19:03:00.000Z"
---

# Memory

## Stable Notes

- The user wants 80-90% of daily work to use only `$init`, `$start`, and `$finish`; advanced commands are for AI, diagnostics, and automation.
- LouisGo is positioned as a Git-synced prompt cache, not a default external memory system.
- `HANDOFF.md` is the formal, coarse-grained handoff. Prefer it when present, but a missing handoff must not make new sessions forget the project.
- `louisgo context` is an executable context compiler: it assembles stable layers, reports sources, controls budget, and preserves user-prompt priority.
- `louisgo status` must make protocol state, verification state, recovery source, and pending Git workspace changes clear to users and AI.
- Subagents use `louisgo context --capsule --goal "<task>"` for clean context instead of inheriting full chat history.
- `louisgo@0.1.0` has been published to npmjs with MIT license; registry install smoke test passed.
- CLI version is read from `package.json` so releases do not drift between package metadata and `louisgo --version`.
- `louisgo confirm --interactive` supports terminal selection and additional input; inside Codex, AI can still present and route the user's reply.
- `pnpm pack:check` uses an isolated npm cache and is included in this repository's LouisGo verification gate.
- Current self-bootstrap convergence goal: README is for humans, `AGENTS.md`/skills are for AI execution, and `context/status/verify/finish` are for experiments in other projects.
- T007 passed this repository's verification and a temporary external Git project smoke test: init/context/verify/finish/status all run.
- Generated recovery files such as `HANDOFF.md`, `STATE.md`, and `QUICK_SAVE.md` no longer count toward verification diff hash, so `$finish` does not immediately make verification stale.
- `RUNLOG.md` is a local diagnostic log: it records LouisGo command events and state summaries, is ignored by `.louisgo/.gitignore` by default, and can be sent to AI for debugging.
- T008 passed repository tests and a temporary external Git project smoke test: `louisgo log --tail 10` prints init/context/verify/finish events.
- T016 introduced Codex-first stats: `louisgo context` writes local token/section events, `louisgo stats import codex` explicitly imports Codex JSONL usage, and `.louisgo/stats/` is ignored by default without storing prompts, replies, or source code.
- Git operations for this repository must use the GitHub `LouisGo` account. The local `origin` remote is intentionally set to `git@github-louisgo:LouisGo/go.git`, where `github-louisgo` maps to `github.com` with `~/.ssh/id_ed25519_typey`; do not switch it back to the default `git@github.com` host, which authenticates as another account.

## Topic Files

- `.louisgo/memory/` is only for long-term topic memory that should be reused across sessions.

## Recent Sessions

- `.louisgo/sessions/` is only for audit, handoff, or key-session summaries when needed.
