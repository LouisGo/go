import { describe, expect, it } from "vitest";

import { countSections, countTextTokens, truncateToTokens } from "../src/stats/token-counter.js";

describe("token counter", () => {
  it("counts English, Chinese, and front matter text", () => {
    expect(countTextTokens("hello world")).toBeGreaterThan(0);
    expect(countTextTokens("上下文缓存")).toBeGreaterThan(0);
    expect(
      countTextTokens(`---
schema: louisgo-state-v1
---

# State
`),
    ).toBeGreaterThan(0);
  });

  it("truncates by token budget", () => {
    const result = truncateToTokens("alpha beta gamma delta epsilon", 3);

    expect(result.truncated).toBe(true);
    expect(result.tokens).toBeLessThanOrEqual(3);
    expect(countTextTokens(result.text)).toBeLessThanOrEqual(3);
  });

  it("counts section tokens without changing content", () => {
    const result = countSections([
      {
        source: ".louisgo/MEMORY.md",
        title: "Memory",
        content: "# Memory\n\n- stable note\n",
      },
    ]);

    expect(result).toEqual([
      {
        source: ".louisgo/MEMORY.md",
        title: "Memory",
        tokens: expect.any(Number),
      },
    ]);
  });
});
