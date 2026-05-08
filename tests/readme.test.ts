import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createCli } from "../src/cli.js";

const readmePath = join(process.cwd(), "README.md");

describe("README 使用说明", () => {
  it("记录主路径和保留命令", async () => {
    const readme = await readFile(readmePath, "utf8");
    const program = createCli();
    const commandNames = program.commands.map((command) => command.name());
    const handoff = program.commands.find((command) => command.name() === "handoff");

    for (const command of [
      "init",
      "context",
      "stats",
      "confirm",
      "log",
      "status",
      "verify",
      "pause",
      "finish",
      "handoff",
      "codex",
      "skill",
      "clear",
    ]) {
      expect(commandNames).toContain(command);
    }

    expect(handoff?.commands.map((command) => command.name())).toContain("promote");
    expect(readme).toContain("npm install -g louisgo");
    expect(readme).toContain("npx --yes louisgo@latest init");
    expect(readme).toContain("$start");
    expect(readme).toContain("$finish");
    expect(readme).toContain("HANDOFF.md -> STATE.md -> MEMORY.md");
    expect(readme).toContain("louisgo context");
    expect(readme).toContain("louisgo stats");
    expect(readme).toContain("louisgo skill list");
    expect(readme).toContain('louisgo clear --confirm "DELETE LOUISGO"');
    expect(readme).toContain("louisgo log");
    expect(readme).toContain("handoff promote");
    expect(
      program.commands
        .find((command) => command.name() === "codex")
        ?.commands.map((command) => command.name()),
    ).toContain("setup");
    expect(readme).toContain("codex setup");
  });
});
