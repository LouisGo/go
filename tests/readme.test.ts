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

    for (const command of [
      "init",
      "context",
      "resume",
      "stats",
      "confirm",
      "log",
      "status",
      "verify",
      "pause",
      "finish",
      "codex",
      "skill",
      "clear",
    ]) {
      expect(commandNames).toContain(command);
    }

    expect(readme).toContain("npm install -g louisgo");
    expect(readme).toContain("npx --yes louisgo@latest init");
    expect(readme).toContain("$pause");
    expect(readme).toContain("$resume");
    expect(readme).toContain("louisgo context");
    expect(readme).toContain("louisgo pause");
    expect(readme).toContain("louisgo resume");
    expect(readme).toContain("louisgo stats");
    expect(readme).toContain("louisgo skill list");
    expect(readme).toContain("louisgo clear");
    expect(readme).toContain("louisgo log");
    expect(readme).not.toContain("handoff promote");
    expect(
      program.commands
        .find((command) => command.name() === "codex")
        ?.commands.map((command) => command.name()),
    ).toContain("setup");
    expect(readme).toContain("codex setup");
  });
});
