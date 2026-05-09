# Project Overview

LouisGo is a task-continuity layer for AI coding work. It helps a developer pause
and resume a long-running coding task across context windows, devices, and AI
sessions without committing private task memory to the team repository.

## Current Loop

```text
init -> context -> work -> pause -> resume -> verify -> finish
```

- `init` installs a small project anchor and optional Codex routing.
- `context` compiles the current request, active private task, project anchor,
  Git facts, and verification state into a short prompt package.
- `pause` writes a private task checkpoint outside team Git.
- `resume` checks repository state and emits a continuation package, or blocks
  with the concrete mismatch.
- `verify` records verification facts and attaches them to the active task.
- `finish` writes a private phase summary for commit, PR, or next-session prep.

## Storage Boundary

Personal task state lives in the user-private store by default:

```text
~/.louisgo/
  projects/<project-key>/
    tasks/<task-id>/
```

The repository `.louisgo/` directory is now a small shared anchor, not the
primary recovery store. It may contain team-safe project rules, verification
discovery, optional local skills, and confirmation requests.

## Documentation Boundary

| Document | Purpose |
| --- | --- |
| `README.md` | Public install path and daily workflow. |
| `README-zhCN.md` | Simplified Chinese README. |
| `docs/01-product.md` | Product model and route definition. |
| `docs/02-protocol.md` | Private store, optional project anchor, and data shape. |

## Design Principles

- Private by default: personal task state does not enter team Git.
- Task-scoped: multiple tasks in one repository must not overwrite one another.
- Minimum sufficient context: compile what the next AI action needs, not all
  historical memory.
- Evidence over narrative: source, Git state, verification, and explicit user
  instructions override stored summaries.
- Subagent-aware but not an orchestrator: MVP can render narrow context
  capsules for Codex's native subagent workflow, but LouisGo does not schedule
  or manage subagents itself.
