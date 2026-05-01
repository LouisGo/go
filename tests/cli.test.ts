import { describe, expect, it } from "vitest";

import { createCli } from "../src/cli.js";

describe("CLI 入口", () => {
  it("可以生成基础帮助信息", () => {
    const program = createCli();

    expect(program.name()).toBe("louisgo");
    expect(program.description()).toContain("AI 编程 Harness");
    expect(program.helpInformation()).toContain("Usage: louisgo");
  });
});
