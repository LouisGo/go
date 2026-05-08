---
schema: louisgo-mission-v1
default_mode: assist
updated_at: "2026-05-03T13:23:31.000Z"
---

# Mission

## Goal

- LouisGo is a Git-synced prompt cache and context compiler for AI coding recovery, verification, and handoff.
- Daily entry points stay minimal: `$init` creates project protocol and AI integration, `$start` restores context, and `$finish` creates a formal handoff.
- Even without a handoff, a new session should recover required context through `louisgo context` from project contract, stable memory, and active state.

## Constraints

- Use Node.js >= 20, TypeScript, commander, zod, gray-matter, tsup, and vitest.
- Package name is `louisgo`; CLI entry is `dist/cli.js`.
- Protocol files use Markdown plus YAML front matter; default context must be short, readable, diffable, and committable.
- Do not introduce background services, vector databases, or heavyweight external memory unless the user explicitly confirms a direction change.
- The current user prompt always wins; LouisGo only provides a sourced, budgeted, trimmable context prefix.
- Source code, Git state, and verification results override memory files. Memory can help, but cannot replace fact checks.

## Confirm First

- npm publishing, licensing, package naming, public protocol breaking changes, and broad refactors.
- External model calls, cloud sync, databases, vector retrieval, or resident background services.
- Two or more viable directions, or any conflict between user instructions and this file.

## Decision Records

- For public APIs, persisted formats, critical dependencies, or cross-module boundary changes, draft an ADR under `.louisgo/ADR/draft/` first.
- ADR drafts become formal ADRs only after user confirmation.
