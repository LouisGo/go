# Roadmap

## Completed Foundation

- Node.js + TypeScript CLI, package name `louisgo`, public version `0.1.0`.
- Lightweight `init` that creates a small `.louisgo/` project anchor instead of
  a large project memory protocol.
- User-private task store under `~/.louisgo/projects/<project-key>/tasks/`.
- Implicit active task creation through `verify`, `pause`, and `finish`.
- `louisgo context`: prompt compiler with private task context, project anchors,
  Git facts, verification state, budgets, and subagent capsule mode.
- `louisgo pause`: primary private checkpoint command.
- `louisgo resume`: repository-state readiness check plus resume package output.
- `louisgo verify`: verification runner with task-attached verification facts.
- `louisgo finish`: private phase summary for commit, PR, or next-session prep.
- `louisgo status`: reports private task state, verification freshness, and
  workspace diff.
- Codex integration: project agent block, directive skills, and lazy local skill
  discovery.
- Local diagnostics and stats now default to the private store.
- Legacy project-singleton recovery files were removed from the supported
  product surface.

## Next Candidates

- P1: task selection UX when multiple active tasks exist in one repository.
- P2: export/import private task bundles for cross-device continuity.
- P3: user-managed private sync guidance for iCloud, Dropbox, Syncthing, or a
  private Git remote.
- P4: improve `context --capsule` formatting for Codex-native subagents without
  adding LouisGo-owned orchestration.
- P5: add a lightweight repo map that caches only key paths, module boundaries,
  and verification entry.
- P6: explicit shared-knowledge promotion command that previews exactly what
  would enter team Git.
- P7: multi-platform rules output for Claude Code, Gemini CLI, Cursor, and
  similar tools.

## Out Of Scope

- No team-wide memory database.
- No default cloud sync.
- No vector search.
- No full chat transcript storage.
- No automatic publication of private task state.
- No LouisGo-owned subagent scheduler or worker pool.
- No replacement for Git branches, commits, or pull requests.
