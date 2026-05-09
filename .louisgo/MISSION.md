---
schema: louisgo-mission-v1
default_mode: assist
updated_at: "2026-05-08T13:55:47.718Z"
---

# Mission

## Goal

- LouisGo keeps AI coding task continuity in a user-private store, outside team Git by default.
- New sessions recover from concise private checkpoints, Git facts, and verification state rather than chat history.

## Constraints

- TypeScript CLI package published as `louisgo`.
- `.louisgo/` is only a small project anchor; personal checkpoints, stats, run logs, and resume packages live in the user-private store.
- User prompts override cached context; source, Git, and verification facts override memory.

## Confirm First

- Publishing, licensing, package naming, public protocol breakage, and broad refactors.
- Two or more viable directions, or instructions that conflict with this file.

## Decision Records

- For public APIs, persisted formats, critical dependencies, or cross-module boundary changes, draft an ADR under `.louisgo/ADR/draft/` first.
