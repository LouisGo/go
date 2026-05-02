<!-- louisgo-codex:start -->
# LouisGo Codex Workflow

When this repository contains `.louisgo/`, treat those files as the project memory and recovery protocol.

For ordinary coding requests, before changing files, inspect the available LouisGo context in this order:

1. `.louisgo/CONFIRM_REQ.md` when present.
2. `.louisgo/HANDOFF.md` when present.
3. `.louisgo/STATE.md`.
4. `.louisgo/MEMORY.md`.
5. Relevant files under `.louisgo/memory/` or `.louisgo/sessions/` only when needed.

When the user message starts with a LouisGo dollar directive, treat it as an explicit command:

Command selection: use `louisgo <subcommand>` by default. When working inside the `louisgo` source repository and `./dist/cli.js` exists, use `node ./dist/cli.js <subcommand>` so self-bootstrap runs the current local build instead of a stale global install.

- `$init`: run `louisgo init`.
- `$start`: run `louisgo status`, read `.louisgo/MISSION.md`, `.louisgo/CAPABILITIES.md`, `.louisgo/HANDOFF.md` when present, `.louisgo/STATE.md`, and `.louisgo/MEMORY.md`.
- `$status`: run `louisgo status`.
- `$verify`: run `louisgo verify`.
- `$pause`: legacy command; run `louisgo pause`.
- `$resume`: legacy alias; run `louisgo status` and prefer `.louisgo/HANDOFF.md`, then `.louisgo/STATE.md`.
- `$finish`: run `louisgo finish` and report the resulting `.louisgo/HANDOFF.md`.
- `$handoff-promote`: legacy command; run `louisgo handoff promote`.

These directives are backed by the `louisgo` CLI and the `.louisgo/` protocol files. If the protocol is missing, suggest `louisgo init`.
<!-- louisgo-codex:end -->
