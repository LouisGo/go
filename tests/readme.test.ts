import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createCli } from "../src/cli.js";

const readmePath = join(process.cwd(), "README.md");

describe("README 使用说明", () => {
  it("记录的 CLI 命令和实际命令保持一致", async () => {
    const readme = await readFile(readmePath, "utf8");
    const program = createCli();
    const commandNames = program.commands.map((command) => command.name());
    const handoff = program.commands.find((command) => command.name() === "handoff");

    for (const command of ["init", "status", "verify", "pause", "finish", "handoff"]) {
      expect(commandNames).toContain(command);
      expect(readme).toContain(`louisgo ${command}`);
    }

    expect(handoff?.commands.map((command) => command.name())).toContain("promote");
    expect(readme).toContain("louisgo handoff promote");
    expect(readme).toContain("npx louisgo init");
  });
});
