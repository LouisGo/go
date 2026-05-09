export interface MissionTemplateOptions {
  readonly updatedAt: string;
}

export function createMissionTemplate(options: MissionTemplateOptions): string {
  return `---
schema: louisgo-mission-v1
default_mode: assist
updated_at: "${options.updatedAt}"
---

# Mission

## Goal

- Describe the project goal in 1-3 durable bullets.
- LouisGo keeps private task continuity outside team Git so new sessions can recover without chat history.

## Constraints

- Record stable stack, naming, compatibility, release, and security constraints here.
- User prompts override cached context; source, Git, and verification facts override memory.

## Confirm First

- Publishing, licensing, package naming, public protocol breakage, and broad refactors.
- Two or more viable directions, or instructions that conflict with this file.

## Decision Records

- For public APIs, persisted formats, critical dependencies, or cross-module boundary changes, draft and confirm an explicit decision before changing shared project anchors.
`;
}
