# Project Overview

LouisGo gives AI coding projects a Git-synced, auditable, trim-friendly context foundation. It is not a full knowledge base or background memory service. It organizes the prompt material an AI actually needs to reuse into the `.louisgo/` protocol.

## Current Loop

```text
init once -> ordinary sessions read context automatically -> start for deep recovery when needed -> verify records facts -> finish creates a formal handoff
```

This loop has been self-validated in this repository:

- This repository can recover context from its own `.louisgo/`.
- `louisgo context` generates a context package with sources, budget, and prompt-priority contract.
- After a fresh init with no real project memory, `louisgo context` uses a cold-start bypass instead of expanding template files.
- `louisgo status` reports protocol state, recovery source, verification state, and workspace diff.
- `louisgo verify` runs the project gate and writes machine-readable results.
- `louisgo finish` generates a formal `HANDOFF.md` for new-session recovery.
- `louisgo log` prints local diagnostic events so another session can see whether the workflow actually ran.
- External Git projects can start experiments through global `louisgo init`, `npx --yes louisgo@latest init`, or local `dist/cli.js init`.

## Documentation Boundary

| Document | Purpose |
| --- | --- |
| `README.md` | Public install path, daily usage, and external project experiments. |
| `README-zhCN.md` | Simplified Chinese README. |
| `docs/01-product.md` | Product model, AI behavior, and useful-loop definition. |
| `docs/02-protocol.md` | `.louisgo/` file protocol and data structures. |
| `docs/03-roadmap.md` | Completed foundation and next candidates. |

## Design Principles

- Keep daily entry points small: `init`, natural conversation, `$start`, and `$finish`.
- Keep initial output thin; behavior skills are enabled on demand with `louisgo skill`, discovered through a manifest, lazy-loaded by Codex, and never overwrite same-name project skills.
- The current user prompt always wins; LouisGo only provides a context prefix.
- Markdown plus YAML front matter is the default protocol format; JSON is reserved for verification results.
- `HANDOFF.md` is formal recovery; `STATE.md` and `MEMORY.md` support daily recovery.
- Source code, Git state, and verification results override memory narratives.
- Docs and protocol files should stay short enough for a new AI session to read quickly.
