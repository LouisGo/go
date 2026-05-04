import { describe, expect, it } from "vitest";

import {
  adrFrontMatterSchema,
  capabilitiesFrontMatterSchema,
  confirmReqFrontMatterSchema,
  handoffFrontMatterSchema,
  louisGoModeSchema,
  memoryFrontMatterSchema,
  missingTaskId,
  missionFrontMatterSchema,
  quickSaveFrontMatterSchema,
  stateFrontMatterSchema,
  testResultsSchema,
  verificationStatusSchema,
} from "../src/protocol/schemas.js";

const timestamp = "2026-05-01T20:00:00+08:00";

describe("协议 schema", () => {
  it("可以校验合法协议对象并转换为内部 camelCase 字段", () => {
    expect(louisGoModeSchema.parse("assist")).toBe("assist");
    expect(verificationStatusSchema.parse("stale")).toBe("stale");

    expect(
      missionFrontMatterSchema.parse({
        schema: "louisgo-mission-v1",
        default_mode: "assist",
        updated_at: timestamp,
      }),
    ).toEqual({
      schema: "louisgo-mission-v1",
      defaultMode: "assist",
      updatedAt: timestamp,
    });

    expect(
      testResultsSchema.parse({
        schema: "louisgo-test-results-v1",
        command: ".louisgo/scripts/verify.sh",
        exit_code: 0,
        status: "passed",
        git_head: "abc123",
        diff_hash: "def456",
        started_at: timestamp,
        completed_at: "2026-05-01T20:01:00+08:00",
        summary: "验证通过",
      }),
    ).toMatchObject({
      exitCode: 0,
      gitHead: "abc123",
      diffHash: "def456",
      startedAt: timestamp,
    });

    expect(
      handoffFrontMatterSchema.parse({
        schema: "louisgo-handoff-v1",
        mode: "assist",
        task_id: "T001",
        git_head: "abc123",
        diff_hash: "def456",
        verification: "passed",
        generated_at: timestamp,
      }),
    ).toMatchObject({
      taskId: "T001",
      generatedAt: timestamp,
      verification: "passed",
    });

    expect(
      quickSaveFrontMatterSchema.parse({
        schema: "louisgo-quick-save-v1",
        mode: "auto",
        task_id: missingTaskId,
        git_head: "abc123",
        diff_hash: "def456",
        saved_at: timestamp,
      }),
    ).toMatchObject({
      mode: "auto",
      taskId: missingTaskId,
      savedAt: timestamp,
    });

    expect(
      capabilitiesFrontMatterSchema.parse({
        schema: "louisgo-capabilities-v1",
        updated_at: timestamp,
      }),
    ).toEqual({
      schema: "louisgo-capabilities-v1",
      updatedAt: timestamp,
    });

    expect(
      stateFrontMatterSchema.parse({
        schema: "louisgo-state-v1",
        mode: "assist",
        current_task: "T001",
        handoff: ".louisgo/HANDOFF.md",
        verification: "missing",
        git_head: "abc123",
        diff_hash: "def456",
        updated_at: timestamp,
      }),
    ).toMatchObject({
      currentTask: "T001",
      handoff: ".louisgo/HANDOFF.md",
      verification: "missing",
    });

    // phase 可选字段
    expect(
      stateFrontMatterSchema.parse({
        schema: "louisgo-state-v1",
        mode: "assist",
        phase: "explore",
        current_task: "T001",
        verification: "missing",
        git_head: "abc123",
        diff_hash: "def456",
        updated_at: timestamp,
      }),
    ).toMatchObject({
      mode: "assist",
      phase: "explore",
      currentTask: "T001",
    });

    expect(
      stateFrontMatterSchema.parse({
        schema: "louisgo-state-v1",
        mode: "assist",
        current_task: "T001",
        verification: "missing",
        git_head: "abc123",
        diff_hash: "def456",
        updated_at: timestamp,
      }).phase,
    ).toBeUndefined();

    expect(
      memoryFrontMatterSchema.parse({
        schema: "louisgo-memory-v1",
        updated_at: timestamp,
      }),
    ).toEqual({
      schema: "louisgo-memory-v1",
      updatedAt: timestamp,
    });
  });

  it("拒绝非法模式、非法验证状态和缺失字段", () => {
    expect(louisGoModeSchema.safeParse("guided").success).toBe(false);

    expect(
      handoffFrontMatterSchema.safeParse({
        schema: "louisgo-handoff-v1",
        mode: "assist",
        task_id: "T001",
        git_head: "abc123",
        diff_hash: "def456",
        verification: "unknown",
      }).success,
    ).toBe(false);

    expect(
      testResultsSchema.safeParse({
        schema: "louisgo-test-results-v1",
        command: ".louisgo/scripts/verify.sh",
        exit_code: 0,
        status: "passed",
        git_head: "abc123",
        started_at: timestamp,
        completed_at: "2026-05-01T20:01:00+08:00",
        summary: "验证通过",
      }).success,
    ).toBe(false);

    expect(
      missionFrontMatterSchema.safeParse({
        schema: "louisgo-mission-v1",
        default_mode: "assist",
        updated_at: "May 1, 2026",
      }).success,
    ).toBe(false);

    expect(
      missionFrontMatterSchema.safeParse({
        schema: "louisgo-mission-v1",
        default_mode: "assist",
        updated_at: "2026-05-01T20:00:00",
      }).success,
    ).toBe(false);

    expect(
      stateFrontMatterSchema.safeParse({
        schema: "louisgo-state-v1",
        mode: "assist",
        phase: "exploration",
        current_task: "T001",
        verification: "missing",
        git_head: "abc123",
        diff_hash: "def456",
        updated_at: timestamp,
      }).success,
    ).toBe(false);
  });

  it("覆盖确认请求和 ADR front matter", () => {
    expect(
      confirmReqFrontMatterSchema.parse({
        schema: "louisgo-confirm-req-v1",
        mode: "assist",
        task_id: "T003",
        status: "open",
        created_at: timestamp,
      }),
    ).toEqual({
      schema: "louisgo-confirm-req-v1",
      mode: "assist",
      taskId: "T003",
      status: "open",
      createdAt: timestamp,
    });

    expect(
      confirmReqFrontMatterSchema.safeParse({
        schema: "louisgo-confirm-req-v1",
        mode: "assist",
        task_id: "T003",
        status: "closed",
        created_at: timestamp,
      }).success,
    ).toBe(false);

    expect(
      adrFrontMatterSchema.parse({
        schema: "louisgo-adr-v1",
        status: "draft",
        adr_id: null,
        created_at: timestamp,
        confirmed_at: null,
      }),
    ).toEqual({
      schema: "louisgo-adr-v1",
      status: "draft",
      adrId: null,
      createdAt: timestamp,
      confirmedAt: null,
    });

    expect(
      adrFrontMatterSchema.parse({
        schema: "louisgo-adr-v1",
        status: "accepted",
        adr_id: "ADR-001",
        created_at: timestamp,
        confirmed_at: "2026-05-01T21:00:00+08:00",
      }),
    ).toMatchObject({
      status: "accepted",
      adrId: "ADR-001",
    });

    expect(
      adrFrontMatterSchema.safeParse({
        schema: "louisgo-adr-v1",
        status: "open",
        adr_id: null,
        created_at: timestamp,
        confirmed_at: null,
      }).success,
    ).toBe(false);
  });
});
