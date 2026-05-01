import { describe, expect, it } from "vitest";

describe("失败用例 fixture", () => {
  it("用于验证 Vitest 能发现失败", () => {
    expect("actual").toBe("expected");
  });
});
