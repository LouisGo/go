<!-- louisgo-codex:start -->
## LouisGo

When this repository contains `.louisgo/`, use LouisGo as a project-local recovery protocol.

- Existing project instructions in this file remain authoritative.
- On the first repository task in a new session, or before the first file edit after the branch, goal, or `.louisgo/` state changes, run `louisgo context`.
- If `louisgo context` already ran for the same task and workspace state, keep using that context; use `louisgo status` for a lightweight freshness check.
- If context or status reports `.louisgo/CONFIRM_REQ.md`, run `louisgo confirm` and present the choices before continuing.
- Local skill discovery uses `.louisgo/skills/manifest.json`. If it is absent, scan `.louisgo/skills/*.md` and `.louisgo/skills/*/SKILL.md` front matter. Do not read full skill files by default; when the user invokes a matching skill by name, alias, or trigger phrase, read only that skill file and apply it.
- Codex is the active local-skill adapter; Claude support is reserved for a future `CLAUDE.md` or plugin manifest adapter.
- For explicit dollar directives, route through the global `louisgo` CLI:
  - `$start` / `$context`: `louisgo context`
  - `$status`: `louisgo status`
  - `$verify`: `louisgo verify`
  - `$finish`: `louisgo finish`
  - `$init`: `louisgo init`

If `louisgo` is unavailable, use `npx --yes louisgo@latest <subcommand>`.
<!-- louisgo-codex:end -->
