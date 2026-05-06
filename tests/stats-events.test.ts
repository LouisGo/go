import { describe, expect, it } from "vitest";

import { statsEventSchema } from "../src/stats/events.js";

describe("stats event schema", () => {
  it("rejects negative token usage", () => {
    expect(() =>
      statsEventSchema.parse({
        schema: "louisgo-stats-event-v1",
        id: "bad",
        timestamp: "2026-05-01T12:00:00.000Z",
        source: "codex",
        tool: "codex",
        event: "codex.usage",
        confidence: "actual",
        usage: {
          input_tokens: -1,
        },
      }),
    ).toThrow();
  });

  it("rejects unknown sources and raw payload fields", () => {
    expect(() =>
      statsEventSchema.parse({
        schema: "louisgo-stats-event-v1",
        id: "bad",
        timestamp: "2026-05-01T12:00:00.000Z",
        source: "claude",
        tool: "codex",
        event: "codex.usage",
        confidence: "actual",
        payload: "do not store prompts",
      }),
    ).toThrow();
  });
});
