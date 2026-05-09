# Product Definition

## Positioning

LouisGo is a task-continuity layer for AI coding work.

It helps a developer continue a long-running coding task across context
windows, Codex threads, devices, and bounded subagents without hand-maintaining
large transfer documents.

LouisGo is not a team memory database, chat transcript archive, vector store, or
agent swarm. It compiles the smallest useful context for the next AI action.

## Core Problem

AI coding breaks down when a task is larger than one conversation:

- The context window fills before the task is complete.
- The developer must open a new thread and re-explain the task.
- Work may need to continue on another device.
- Large refactors need focused subtask context, but one main model often owns
  the whole task.
- Manually maintained Markdown transfer files become noisy, stale, and expensive
  to inject into prompts.

The product must solve this specific problem first:

```text
Given an ongoing coding task, generate and restore the minimum sufficient state
needed for another AI session or bounded subagent to continue safely.
```

## Non-Negotiable Principles

### Private By Default

Personal task state is private by default and must not be written into the team
repository history.

This includes:

- Thread summaries.
- Checkpoints.
- Resume prompts.
- Token and cache stats.
- Temporary reasoning.
- Personal preferences.
- Subagent task queues.
- WIP patches that are not ready to share.

Team Git is for source code and team-approved project knowledge. LouisGo may use
Git as a personal sync backend, but it must not require private task memory to be
committed to the team repo.

### Task-Scoped, Not Project-Singleton

A project can have multiple active users, threads, tasks, and devices.

LouisGo must not assume a single global project state for the whole repository.
The primary durable object is an active task.

Minimum task state:

- Objective.
- Scope and constraints.
- Current plan.
- Progress.
- Key decisions.
- Changed files and intent.
- Verification status.
- Blockers.
- Next actions.
- Resume prompt.
- Optional subagent tasks.

### Minimum Sufficient Context

LouisGo should compile context, not accumulate memory.

Every context package should be short, sourced, and task-relevant. Old or broad
information should be excluded unless it directly affects the current action.

### Evidence Over Narrative

Source code, Git state, verification results, and explicit user instructions
override memory narratives.

Stored task state should distinguish facts from assumptions. It should record
where important claims came from when that source matters.

### Explicit Publication

Private task state can become shared project knowledge only through an explicit
publish action.

Default behavior:

```text
private task state -> stays private
team project knowledge -> published intentionally
```

LouisGo should make it easy to promote a small, reviewed item into shared
project knowledge, but it must never silently publish private thread memory.

## Storage Model

### Project Repository

The project repository remains the authoritative source for code, tests,
tracked project instructions, and team-approved documentation.

LouisGo should work when no LouisGo files are tracked by team Git.

Default behavior must keep personal LouisGo state outside the repository. If
LouisGo needs repo-local working files, they must be ignored by Git by default.

Tracked project content is optional and must be small. If used, it should contain
only team-safe anchors such as:

- Verification command discovery.
- Stable AI operating rules approved by the team.
- Shared project constraints.
- Links to existing project docs.

Tracked `.louisgo/` project memory is not the default product model. At most,
the repository may contain a small shared anchor after explicit user or team
choice.

### User-Private Store

Task continuity state lives outside team Git by default, for example:

```text
~/.louisgo/
  projects/<project-key>/
    tasks/<task-id>/
      state.md
      checkpoints/
      resume.md
      agents.md
      patches/
      stats/
```

The exact on-disk shape can change, but the boundary cannot: this store belongs
to the user, not the team repository.

### Cross-Device Sync

Cross-device continuity should sync the user-private store, not the team repo.

Supported sync paths can grow in stages:

1. Export/import a task bundle.
2. User-managed private folder sync such as iCloud, Dropbox, or Syncthing.
3. User-managed private Git remote.
4. Optional LouisGo Cloud.

The MVP should not require cloud infrastructure.

### Code State

Task state and code state are separate.

When code is ready to share, use ordinary team workflows:

- Feature branch.
- Draft pull request.
- Commit.

When code is not ready to share, LouisGo may reference or export private patch
bundles from the user-private store. It should not force WIP patches into team
Git history.

Before `resume` tells an AI to continue, it must check whether the required code
state is available:

- Same repository identity.
- Expected branch or worktree.
- Expected Git HEAD or recorded base commit.
- Expected diff hash, or an available private patch bundle.

If these do not match, LouisGo should report a blocked resume with the mismatch
and recovery options instead of producing a normal continuation prompt.

## Primary Workflow

### 1. Enable

```text
louisgo init
```

Purpose:

- Make LouisGo usable in the current repository.
- Install or update minimal AI entry instructions when the user chooses to do
  so.
- Configure local ignores for private LouisGo data.

`init` must avoid creating a large project protocol by default. It should not
pollute team Git with personal state.

### 2. Establish An Active Task

The task is the continuity boundary, but the MVP does not need a separate task
command namespace.

LouisGo may infer or create the active task from the first meaningful
`pause`/`resume` cycle. If multiple private tasks exist for the same repository,
LouisGo should ask the user to choose one or accept an explicit task identifier.

The underlying model must still be task-scoped even if the command surface stays
small.

### 3. Work Normally

The developer works with Codex, Claude Code, or another AI coding tool.

Before meaningful edits, the AI should run:

```text
louisgo context
```

`context` compiles:

- Current user request.
- Active task state.
- Relevant project anchors.
- Source and Git facts.
- Verification state.
- Only the task-relevant subset of prior checkpoints.

### 4. Pause

```text
louisgo pause
```

This is the primary product action.

It creates a concise checkpoint for continuing later, including:

- What changed.
- What was decided.
- What was verified.
- What remains uncertain.
- The next concrete action.
- A resume prompt suitable for a new thread.

`pause` should be cheap enough to run whenever context is getting full.

### 5. Resume

```text
louisgo resume
```

`resume` restores the selected task and emits a short context package for a new
thread or device.

It should answer:

- What task am I continuing?
- What is the current code state?
- What should the AI do first?
- What should the AI avoid?
- What must be verified before completion?

If the repository or patch state does not match the task checkpoint, `resume`
must stop and report the mismatch.

### 6. Verify

```text
louisgo verify
```

Verification remains a core fact source. It should record command, status,
timestamps, Git HEAD, diff hash, and a short summary.

Verification state belongs to the task when it describes task-specific work.
Project-level verification discovery can remain a project anchor.

### 7. Finish

```text
louisgo finish
```

`finish` marks a task phase as complete. It creates a private summary suitable
for commit prep, PR description, or next-session prep.

`finish` is not the primary recovery mechanism. Frequent continuity should be
handled by `pause` and `resume`.

## Context Compiler

`louisgo context` is the runtime compiler.

It should not dump every stored file into the prompt. It should choose a small
set of inputs based on the active task and current request.

Input classes:

- Current request.
- Active task state.
- Latest checkpoint.
- Relevant verification facts.
- Git status and diff summary.
- Project instructions such as `AGENTS.md`.
- Optional shared anchors.

Output requirements:

- Short.
- Source-labeled.
- Ordered by practical use.
- Clear about stale or missing verification.
- Clear about whether state is private or shared.

## Shared Knowledge Promotion

Promotion from private task state to team-shared project knowledge is future
product surface, not an MVP dependency.

The principle is required now:

- Never publish private task state automatically.
- Show exactly what would be shared.
- Require explicit user confirmation.
- Keep the published item small and team-safe.

The first implementation may simply avoid publishing entirely. A later command
surface can add explicit promotion once private task continuity is working.

## Subagent Boundary

Codex provides native subagent capabilities in the app and CLI. LouisGo should
not duplicate Codex's spawn, routing, waiting, closing, permission, sandbox, or
approval behavior.

MVP:

- Do not implement a LouisGo-owned subagent scheduler.
- Keep the task model flexible enough to reference optional subtask capsules and
  returned summaries later.
- Keep `context --capsule --goal "<task>"` as a narrow context renderer that can
  be handed to Codex-native subagents.

Later:

- Add an adapter that formats LouisGo task capsules for Codex-native subagents.
- Store returned summaries in the active private task when the user explicitly
  asks to preserve them.

Out of scope for now:

- Fully autonomous agent scheduling.
- Background worker pools.
- Unbounded multi-agent conversations.
- Reimplementing Codex-native subagent orchestration.

Reference:

- https://developers.openai.com/codex/subagents
- https://developers.openai.com/codex/concepts/subagents

## What To Keep From The Current Project

The current project has useful foundations that should be retained and
reframed:

Core keep:

- TypeScript CLI package.
- `init` as the setup entry.
- `context` as a prompt compiler.
- `verify` as the fact source for test status.
- `pause` as the primary checkpoint command.
- `finish` as formal phase completion.
- Front matter plus Markdown where human-readable state is useful.
- JSON only for machine facts such as verification results and stats.
- Local build/test packaging discipline.

Non-core keep:

- `stats` as diagnostics for token and cache behavior.
- `skill` as optional behavior presets loaded on demand.
- `clear` as a safe removal/reset path.

Non-core keep means these capabilities can remain if already present, but they
must not drive the task-continuity refactor.

What should be reframed:

- `.louisgo/` should not mean "tracked project memory" by default.
- `finish` should not carry the full continuity burden.
- `context` should compile task-relevant state, not expand protocol files.

## MVP Definition

LouisGo is useful when it can complete this loop:

```text
init -> context -> work -> pause -> resume in a new thread/device -> verify -> finish
```

Minimum success criteria:

- Private task state is not committed to team Git by default.
- In the default setup, `init`, `pause`, and `resume` do not add private LouisGo
  state to the team repository's `git status`.
- A new thread can continue the active task without reading long manual docs.
- A checkpoint is concise and directly actionable.
- Resume output identifies next action, risks, and verification state.
- Multiple tasks in the same repository do not overwrite one another.
- Cross-device transfer works through export/import or a user-private sync path.
- Team-shared knowledge is published only by explicit action.

## Non-Goals

Do not build these into the core product first:

- A team-wide memory database.
- Default cloud sync.
- Vector search.
- Full chat transcript storage.
- Automatic publication of AI conclusions.
- Full autonomous agent orchestration.
- A large tracked `.louisgo/` protocol in every repository.
- A replacement for Git branches, commits, or pull requests.

## Product Tests

A refactor should be judged against user outcomes, not protocol completeness:

- Can a developer resume a large refactor in a new thread within two minutes?
- Can another device continue using only private sync/export and the project
  repo?
- Does `git status` avoid unrelated LouisGo noise in a team repo?
- Is the resume context smaller than a manually maintained transfer document?
- Does the AI know what to do first after resume?
- Does the AI know what not to touch?
- Are verification gaps explicit?
- Can two tasks in one repo proceed without state collision?
- Can a subagent receive a narrow task without inheriting the full chat history?
