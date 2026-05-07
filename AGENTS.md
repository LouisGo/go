<!-- louisgo-codex:start -->
# LouisGo Codex Workflow

When this repository contains `.louisgo/`, treat those files as the project memory and recovery protocol.

For ordinary coding requests, before changing files, inspect the available LouisGo context in this order:

1. Run `louisgo context`.
2. If the context package or status reports `.louisgo/CONFIRM_REQ.md`, run `louisgo confirm` and present the choices before continuing.
3. If `louisgo context` is unavailable, read `.louisgo/CONFIRM_REQ.md`, `.louisgo/HANDOFF.md`, `.louisgo/STATE.md`, and `.louisgo/MEMORY.md`.
4. Relevant files under `.louisgo/memory/` or `.louisgo/sessions/` only when needed.
5. If the user asks to debug the LouisGo workflow, run `louisgo log --tail 30` and summarize `.louisgo/RUNLOG.md`.

When the user message starts with a LouisGo dollar directive, treat it as an explicit command:

Command selection: when working inside the `louisgo` source repository and `./dist/cli.js` exists, use `node ./dist/cli.js <subcommand>`; otherwise use `louisgo <subcommand>` when available; if `louisgo` is not on PATH, use `npx --yes louisgo@latest <subcommand>`.

- `$init`: run `louisgo init`.
- `$start`: run `louisgo context`.
- `$status`: run `louisgo status`.
- `$context`: run `louisgo context`.
- `$verify`: run `louisgo verify`.
- `$pause`: legacy command; run `louisgo pause`.
- `$resume`: legacy alias; run `louisgo context` and prefer `HANDOFF.md`, then `STATE.md`.
- `$finish`: run `louisgo finish` and report the resulting `.louisgo/HANDOFF.md`.
- `$handoff-promote`: legacy command; run `louisgo handoff promote`.

These directives are backed by the `louisgo` CLI and the `.louisgo/` protocol files. If the protocol is missing, suggest `louisgo init`.
<!-- louisgo-codex:end -->
