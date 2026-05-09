# Private Store And Project Anchor

LouisGo has two storage surfaces:

- **User-private store**: the primary task continuity store.
- **Project anchor**: a small optional `.louisgo/` directory inside the
  repository for team-safe rules and confirmation signals.

Private task state must not be committed to team Git by default.

## User-Private Store

Default layout:

```text
~/.louisgo/
  projects/<project-key>/
    project.json
    active-task.json
    RUNLOG.md
    stats/
      events.jsonl
      imports.json
    tasks/
      <task-id>/
        meta.json
        state.md
        checkpoints/
          latest.md
        resume.md
        verification.json
        finish.md
```

`LOUISGO_HOME` can override the store root for tests, temporary environments,
or user-managed sync folders.

## Task Identity

`project-key` is derived from stable repository identity, preferring the Git
remote and falling back to the Git root path. The active task is stored per
project, so multiple repositories and multiple tasks do not collide.

`meta.json` records:

- task id and objective
- task status
- repository identity
- workspace root
- branch
- base and current Git HEAD
- diff hash
- created and updated timestamps

## Resume Readiness

`louisgo resume` must check the current code state before emitting a normal
continuation package.

Resume is blocked when any required state mismatches:

- repository identity
- branch
- Git HEAD
- diff hash

Blocked resume output must list the mismatch and avoid pretending the task is
safe to continue.

## Project Anchor

Default `louisgo init` creates only a small project anchor:

```text
.louisgo/
  MISSION.md
  CAPABILITIES.md
  .gitignore
```

The anchor can contain team-safe information:

- stable project constraints
- verification command discovery
- optional local skill manifest
- confirmation requests that need explicit user input

It is not the default place for personal checkpoints, resume prompts, stats,
run logs, or subagent task queues.

## Commands

- `louisgo init`: create the project anchor and optional Codex integration.
- `louisgo context`: compile the current request, active task, project anchor,
  Git facts, and verification state.
- `louisgo pause`: write or update the active private task checkpoint.
- `louisgo resume`: validate code state and emit a resume package.
- `louisgo verify`: run verification and attach results to the active task.
- `louisgo finish`: mark the task phase complete and write a private summary.
- `louisgo status`: report project anchor, active private task, verification,
  and workspace status.

## Subagent Boundary

Codex has native subagent support. LouisGo MVP does not implement a scheduler,
worker pool, or merge coordinator.

LouisGo only keeps the architecture flexible:

- `context --capsule --goal "<task>"` can render a narrow context package.
- Task state may reference optional returned summaries.
- Future adapters may format LouisGo capsules for Codex-native subagents.

LouisGo must not duplicate Codex's native spawn, routing, waiting, closing,
permissions, sandbox, or approval behavior.
