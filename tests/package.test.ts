import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const packageJsonPath = join(process.cwd(), "package.json");

describe("npm 包配置", () => {
  it("声明 CLI bin、发布文件和基础元数据", async () => {
    const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as PackageJson;

    expect(packageJson.name).toBe("louisgo");
    expect(packageJson.version).toBe("0.1.0");
    expect(packageJson.description).toContain("AI coding context harness");
    expect(packageJson.license).toBe("MIT");
    expect(packageJson.bin).toEqual({ louisgo: "dist/cli.js" });
    expect(packageJson.files).toEqual(
      expect.arrayContaining(["dist", "README.md", "docs", "LICENSE"]),
    );
    expect(packageJson.keywords).toEqual(
      expect.arrayContaining(["ai", "cli", "harness", "handoff", "verification"]),
    );
    expect(packageJson.scripts).toMatchObject({
      build: "tsup",
      prepack: "pnpm build",
      "pack:check": "node scripts/pack-check.mjs",
    });
  });
});

interface PackageJson {
  readonly name?: string;
  readonly version?: string;
  readonly description?: string;
  readonly license?: string;
  readonly bin?: Record<string, string>;
  readonly files?: readonly string[];
  readonly keywords?: readonly string[];
  readonly scripts?: Record<string, string>;
}
