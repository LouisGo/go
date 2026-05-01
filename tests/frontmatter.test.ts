import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  FrontMatterError,
  frontMatterErrorCodes,
  readFrontMatter,
  writeFrontMatter,
} from "../src/protocol/frontmatter.js";
import { missionFrontMatterSchema } from "../src/protocol/schemas.js";

const timestamp = "2026-05-01T20:00:00+08:00";

describe("Markdown Front Matter 读写", () => {
  it("可以写入并读取 Front Matter 和正文", async () => {
    await using tempDir = await createTempDir();
    const filePath = join(tempDir.path, "MISSION.md");

    await writeFrontMatter(
      filePath,
      {
        schema: "louisgo-mission-v1",
        default_mode: "assist",
        updated_at: timestamp,
      },
      "# Mission\n\n## 项目目标\n",
      missionFrontMatterSchema,
    );

    const raw = await readFile(filePath, "utf8");
    const document = await readFrontMatter(filePath, missionFrontMatterSchema);

    expect(raw).toContain("default_mode: assist");
    expect(document).toEqual({
      frontMatter: {
        schema: "louisgo-mission-v1",
        defaultMode: "assist",
        updatedAt: timestamp,
      },
      body: "# Mission\n\n## 项目目标\n",
    });
  });

  it("空文件返回缺失 Front Matter 错误", async () => {
    await using tempDir = await createTempDir();
    const filePath = join(tempDir.path, "EMPTY.md");

    await writeFile(filePath, "", "utf8");

    await expect(readFrontMatter(filePath, missionFrontMatterSchema)).rejects.toMatchObject({
      code: frontMatterErrorCodes.missingFrontMatter,
      filePath,
    });
  });

  it("缺失 Front Matter 时返回明确错误", async () => {
    await using tempDir = await createTempDir();
    const filePath = join(tempDir.path, "MISSION.md");

    await writeFile(filePath, "# Mission\n", "utf8");

    await expect(readFrontMatter(filePath, missionFrontMatterSchema)).rejects.toMatchObject({
      code: frontMatterErrorCodes.missingFrontMatter,
      filePath,
    });
  });

  it("schema 不匹配时返回文件路径和字段信息", async () => {
    await using tempDir = await createTempDir();
    const filePath = join(tempDir.path, "MISSION.md");

    await writeFile(
      filePath,
      `---
schema: louisgo-quick-save-v1
---

# Mission
`,
      "utf8",
    );

    await expect(readFrontMatter(filePath, missionFrontMatterSchema)).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof FrontMatterError &&
        error.code === frontMatterErrorCodes.schemaInvalid &&
        error.filePath === filePath &&
        error.issues?.some((issue) => issue.field === "schema") === true &&
        error.issues?.some((issue) => issue.field === "default_mode") === true,
    );
  });

  it("缺少 Front Matter 结束分隔符时返回明确错误", async () => {
    await using tempDir = await createTempDir();
    const filePath = join(tempDir.path, "MISSION.md");

    await writeFile(
      filePath,
      `---
schema: louisgo-mission-v1
default_mode: assist
updated_at: ${timestamp}
# Mission
`,
      "utf8",
    );

    await expect(readFrontMatter(filePath, missionFrontMatterSchema)).rejects.toMatchObject({
      code: frontMatterErrorCodes.malformedFrontMatter,
      filePath,
    });
  });

  it("写入时校验协议字段，避免内部 camelCase 对象直接写回", async () => {
    await using tempDir = await createTempDir();
    const filePath = join(tempDir.path, "MISSION.md");

    await expect(
      writeFrontMatter(
        filePath,
        {
          schema: "louisgo-mission-v1",
          defaultMode: "assist",
          updatedAt: timestamp,
        },
        "# Mission\n",
        missionFrontMatterSchema,
      ),
    ).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof FrontMatterError &&
        error.code === frontMatterErrorCodes.schemaInvalid &&
        error.filePath === filePath &&
        error.issues?.some((issue) => issue.field === "default_mode") === true,
    );
  });
});

interface TempDir extends AsyncDisposable {
  readonly path: string;
}

async function createTempDir(): Promise<TempDir> {
  const path = await mkdtemp(join(tmpdir(), "louisgo-"));

  return {
    path,
    async [Symbol.asyncDispose]() {
      await rm(path, { force: true, recursive: true });
    },
  };
}
