# LouisGo

LouisGo is a lightweight context harness for AI coding. It stores project goals, constraints, state, memory, verification results, and formal handoffs in `.louisgo/`, so a new AI session can recover context from Git files instead of relying on chat history.

Simplified Chinese: [README-zhCN.md](README-zhCN.md)

## Minimal Loop

Most users only need this path:

```text
npm install -g louisgo -> louisgo init -> natural AI coding -> $start for deep recovery when needed -> $finish for formal handoff
```

| Stage              | User action                | AI / CLI behavior                                                                 |
| ------------------ | -------------------------- | --------------------------------------------------------------------------------- |
| Install command    | `npm install -g louisgo`   | Gives new Codex sessions a stable `louisgo context`, `status`, and `finish` entry. |
| Enable project     | `louisgo init`             | Creates the minimal `.louisgo/` protocol, Codex skills, and project agent entry.   |
| Daily work         | Ask the AI normally        | AI reads `louisgo context` through project agent instructions before editing.      |
| Optional skills    | `louisgo skill enable ...` | Enables preset skills only when needed and blocks same-name project conflicts.     |
| Context drift      | Enter `$start`             | Rebuilds the context package, preferring `HANDOFF.md -> STATE.md -> MEMORY.md`.    |
| Phase handoff      | Enter `$finish`            | Records verification, Git diff, blockers, next steps, and `.louisgo/HANDOFF.md`.   |
| Project cleanup    | `louisgo clear ...`        | Removes `.louisgo/` after explicit confirmation and removes the managed agent block. |
| New machine/session | Pull Git and continue      | New AI sessions recover required context from `.louisgo/` and source code.         |

`context`, `stats`, `skill`, `clear`, `confirm`, `log`, `status`, `verify`, `pause`, `handoff promote`, and `codex setup` exist for AI, advanced users, and compatibility flows. They are not the daily main path.

## Why It Helps

LouisGo does not run a background service, database, or vector memory. It only caches prompt material that is useful, auditable, and commit-friendly for AI coding:

- `MISSION.md`: project goals, constraints, and confirm-first rules.
- `CAPABILITIES.md`: available commands, verification entry, and AI behavior contract.
- `STATE.md`: current task, verification state, and next step.
- `MEMORY.md`: durable memory index; not a chat transcript. It is created only after real memory exists.
- `HANDOFF.md`: formal recovery snapshot at the end of a phase.
- `test-results.json`: verification facts.
- `.louisgo/stats/`: local token and context observation events, ignored by default.

Core rule: **the current user prompt is always the task source; LouisGo only provides a sourced, budgeted, trim-friendly context prefix.** If memory conflicts with source code, Git state, or verification results, trust the facts.

## Codex Usage

Install the global command first:

```text
npm install -g louisgo
```

Then run this inside the target Git repository:

```text
louisgo init
```

After that, keep asking Codex for work normally. `init` installs the LouisGo Codex integration so ordinary new sessions read `louisgo context` before editing files. If the repository root already has `AGENTS.md`, `AGENT.md`, `Agent.md`, `agents.md`, or `agent.md`, LouisGo only updates its managed block in that file. If none exists, it creates `AGENTS.md`.

If you do not want to install globally first, use the one-shot entry:

```text
npx --yes louisgo@latest init
```

Generated Codex instructions prefer `louisgo <subcommand>`. If the global command is unavailable, they can fall back to `npx --yes louisgo@latest <subcommand>`.

Manual recovery:

```text
$start
```

Phase completion:

```text
$finish
```

Protocol and workspace status:

```text
louisgo status
```

`status` reports protocol completeness, current task, verification state, recovery source, and whether the Git workspace has pending changes.

Workflow diagnostics:

```text
louisgo log --tail 30
```

You can also send `.louisgo/RUNLOG.md`. It records command-level events, recovery source, verification state, and workspace summaries. It does not record user prompt text or full chat content.

Token and context observation:

```text
louisgo stats
louisgo stats import codex --days 7
```

`stats` reads only this project's `.louisgo/stats/` by default. Codex usage import is explicit via `stats import codex`; it extracts token numbers from Codex session JSONL files without storing prompts, responses, or source code.

Enable optional LouisGo preset skills:

```text
louisgo skill list
louisgo skill enable grill
louisgo skill enable caveman
```

Preset skills are not written during `init`. When enabling one, LouisGo checks `.codex/skills/` and `.louisgo/skills/` for same-name skills. If it finds a conflict, it reports it and does not overwrite project content.

Remove LouisGo project-local protocol and caches:

```text
louisgo clear --dry-run
```

After reviewing the risk, run:

```text
louisgo clear
```

`clear` shows the risk and cleanup targets, then requires confirmation through a direction-key selection prompt. It deletes this Git project's `.louisgo/`, including memory, handoffs, verification results, diagnostics, stats, and caches. It also removes the LouisGo-managed Codex block from project agent instruction files. It does not delete product source code, global Codex config, or global skills.

## External Project Experiment

Using the published package:

```text
cd /path/to/your/git-project
npm install -g louisgo
louisgo init
louisgo context --goal "recover project context"
louisgo verify
louisgo finish
```

Using a local build from this repository:

```text
pnpm build
cd /path/to/your/git-project
node "/Users/louistation/Documents/New project/dist/cli.js" init
node "/Users/louistation/Documents/New project/dist/cli.js" context --goal "recover project context"
node "/Users/louistation/Documents/New project/dist/cli.js" verify
node "/Users/louistation/Documents/New project/dist/cli.js" finish
```

The experiment is not meant to make every project's tests pass automatically. It confirms that `.louisgo/` can be created, AI can recover context, verification results can be recorded, and phase results can become formal handoffs.

## Protocol Directory

| Path                         | Purpose                                                                                |
| ---------------------------- | -------------------------------------------------------------------------------------- |
| `.louisgo/MISSION.md`        | Project contract.                                                                      |
| `.louisgo/CAPABILITIES.md`   | Capabilities, verification entry, and AI behavior contract.                            |
| `.louisgo/STATE.md`          | Current state and next step.                                                           |
| `.louisgo/MEMORY.md`         | Durable memory index, created on demand.                                               |
| `.louisgo/HANDOFF.md`        | Formal handoff snapshot.                                                               |
| `.louisgo/CONFIRM_REQ.md`    | Structured signal for decisions that need user confirmation.                           |
| `.louisgo/RUNLOG.md`         | Local diagnostic log, ignored by `.louisgo/.gitignore` by default.                     |
| `.louisgo/stats/`            | Local stats events and Codex import index, ignored by `.louisgo/.gitignore` by default. |
| `.louisgo/ROADMAP.md`        | Created on demand when stable cross-session task tracking is useful.                   |
| `.louisgo/skills/`           | Optional LouisGo preset skills enabled on demand.                                      |

## Development Commands

```text
pnpm format:check
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm pack:check
node ./dist/cli.js verify
```

## Docs

- [Overview](docs/00-overview.md)
- [Product Path](docs/01-product.md)
- [File Protocol](docs/02-protocol.md)
- [Roadmap](docs/03-roadmap.md)

## Release Metadata

- npm package: `louisgo`
- Current public version: `0.1.0`
- License: MIT
