# LouisGo

LouisGo is a task-continuity layer for AI coding. It stores personal task
checkpoints outside team Git, then compiles the minimum context needed for a new
AI session to continue safely.

Simplified Chinese: [README-zhCN.md](README-zhCN.md)

## Minimal Loop

```text
npm install -g louisgo
louisgo init
louisgo context
# work normally with an AI coding tool
louisgo pause --message "what changed"
louisgo resume
louisgo verify
louisgo finish
```

| Stage | User action | CLI behavior |
| --- | --- | --- |
| Install | `npm install -g louisgo` | Installs the `louisgo` command. |
| Enable repo | `louisgo init` | Creates a small `.louisgo/` project anchor and optional Codex routing. |
| Work | `louisgo context` | Compiles current request, active task, project anchor, Git facts, and verification state. |
| Pause | `louisgo pause` | Writes a private task checkpoint under `~/.louisgo/`. |
| Resume | `louisgo resume` | Checks repo state and emits a continuation package, or blocks with mismatches. |
| Verify | `louisgo verify` | Runs project verification and attaches facts to the active task. |
| Finish | `louisgo finish` | Writes a private phase summary for commit, PR, or next-session prep. |

## Storage Model

Private task state lives outside the repository by default:

```text
~/.louisgo/
  projects/<project-key>/
    active-task.json
    tasks/<task-id>/
      meta.json
      state.md
      checkpoints/latest.md
      resume.md
      verification.json
      finish.md
```

The repository `.louisgo/` directory is a small shared anchor. It is not the
home for personal checkpoints, resume prompts, stats, run logs, transfer files,
or subagent task queues.

## Codex Usage

Install and initialize:

```text
npm install -g louisgo
cd /path/to/your/git-project
louisgo init
```

If you do not want to install globally first:

```text
npx --yes louisgo@latest init
```

Common commands:

```text
louisgo status
louisgo context --goal "continue the refactor"
louisgo pause --message "implemented parser boundary"
louisgo resume
louisgo verify
louisgo finish
```

Codex directive skills map `$context`, `$pause`, `$resume`, `$verify`, and
`$finish` to the same CLI commands.

For direct Codex integration setup, run `louisgo codex setup`.

## Subagents

Codex provides native subagent support. LouisGo does not implement its own
subagent scheduler in the MVP.

LouisGo can still prepare narrow context:

```text
louisgo context --capsule --goal "review verification flow"
```

That capsule can be handed to Codex-native subagents, while LouisGo remains
responsible only for task continuity and context compilation.

## Diagnostics

Diagnostics are private by default:

```text
louisgo log --tail 30
louisgo stats
louisgo stats import codex --days 7
```

Codex usage import stores token numbers only. It does not preserve prompts,
responses, source code, or secrets.

## Optional Tools

```text
louisgo skill list
louisgo clear --dry-run
```

`skill` is the optional local behavior-preset surface. `clear` removes the
project anchor after explicit confirmation.

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
- [Private Store And Project Anchor](docs/02-protocol.md)

## Release Metadata

- npm package: `louisgo`
- Current public version: `0.1.0`
- License: MIT
