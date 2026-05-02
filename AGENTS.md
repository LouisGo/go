<!-- louisgo-codex:start -->
# LouisGo Codex Workflow

When the user message starts with a LouisGo dollar directive, treat it as an explicit command:

Command selection: use `louisgo <subcommand>` by default. When working inside the `louisgo` source repository and `./dist/cli.js` exists, use `node ./dist/cli.js <subcommand>` so self-bootstrap runs the current local build instead of a stale global install.

- `$start`: run `louisgo status`, read `.louisgo/MISSION.md` and `.louisgo/CAPABILITIES.md`, then inspect `CONFIRM_REQ`, `QUICK_SAVE`, or `HANDOFF` if status indicates they matter.
- `$status`: run `louisgo status`.
- `$verify`: run `louisgo verify`.
- `$pause`: run `louisgo pause`.
- `$resume`: run `louisgo status` and prefer `.louisgo/HANDOFF.md` when present.
- `$finish`: run `louisgo finish` and remind the user to review/审阅 `.louisgo/HANDOFF_DRAFT.md` before `louisgo handoff promote`.
- `$handoff-promote`: run `louisgo handoff promote`.

These directives are backed by the `louisgo` CLI and the `.louisgo/` protocol files. If the protocol is missing, suggest `louisgo init`.
<!-- louisgo-codex:end -->
