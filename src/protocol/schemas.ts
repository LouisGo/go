import { z } from "zod";

export const louisGoModeSchema = z.enum(["auto", "assist", "manual"]);
export type LouisGoMode = z.infer<typeof louisGoModeSchema>;

export const verificationStatusSchema = z.enum([
  "passed",
  "failed",
  "error",
  "skipped",
  "missing",
  "stale",
]);
export type VerificationStatus = z.infer<typeof verificationStatusSchema>;

export const testResultStatusSchema = z.enum(["passed", "failed", "error", "skipped"]);
export type TestResultStatus = z.infer<typeof testResultStatusSchema>;
export const missingTaskId = "NO_TASK";

const nonEmptyStringSchema = z.string().min(1);
const isoDateTimeSchema = z.iso.datetime({ offset: true });
const taskIdSchema = z.string().regex(/^T\d{3,}$/, "任务 ID 必须类似 T001");
const taskReferenceSchema = z.union([taskIdSchema, z.literal(missingTaskId)]);
const nullableStringSchema = z.string().min(1).nullable();
const nullableDateTimeSchema = isoDateTimeSchema.nullable();

export interface GitSnapshot {
  readonly gitHead: string;
  readonly diffHash: string;
}

export const testResultsSchema = z
  .object({
    schema: z.literal("louisgo-test-results-v1"),
    command: nonEmptyStringSchema,
    exit_code: z.number().int(),
    status: testResultStatusSchema,
    git_head: nonEmptyStringSchema,
    diff_hash: nonEmptyStringSchema,
    started_at: isoDateTimeSchema,
    completed_at: isoDateTimeSchema,
    summary: z.string(),
  })
  .transform((data) => ({
    schema: data.schema,
    command: data.command,
    exitCode: data.exit_code,
    status: data.status,
    gitHead: data.git_head,
    diffHash: data.diff_hash,
    startedAt: data.started_at,
    completedAt: data.completed_at,
    summary: data.summary,
  }));
export type TestResults = z.output<typeof testResultsSchema>;

export const handoffFrontMatterSchema = z
  .object({
    schema: z.literal("louisgo-handoff-v1"),
    mode: louisGoModeSchema,
    task_id: taskReferenceSchema,
    git_head: nonEmptyStringSchema,
    diff_hash: nonEmptyStringSchema,
    verification: verificationStatusSchema,
    generated_at: isoDateTimeSchema.optional(),
    confirmed_at: isoDateTimeSchema.optional(),
  })
  .transform((data) => ({
    schema: data.schema,
    mode: data.mode,
    taskId: data.task_id,
    gitHead: data.git_head,
    diffHash: data.diff_hash,
    verification: data.verification,
    ...(data.generated_at === undefined ? {} : { generatedAt: data.generated_at }),
    ...(data.confirmed_at === undefined ? {} : { confirmedAt: data.confirmed_at }),
  }));
export type HandoffFrontMatter = z.output<typeof handoffFrontMatterSchema>;

export const quickSaveFrontMatterSchema = z
  .object({
    schema: z.literal("louisgo-quick-save-v1"),
    mode: louisGoModeSchema,
    task_id: taskReferenceSchema,
    git_head: nonEmptyStringSchema,
    diff_hash: nonEmptyStringSchema,
    saved_at: isoDateTimeSchema,
  })
  .transform((data) => ({
    schema: data.schema,
    mode: data.mode,
    taskId: data.task_id,
    gitHead: data.git_head,
    diffHash: data.diff_hash,
    savedAt: data.saved_at,
  }));
export type QuickSaveFrontMatter = z.output<typeof quickSaveFrontMatterSchema>;

export const confirmReqFrontMatterSchema = z
  .object({
    schema: z.literal("louisgo-confirm-req-v1"),
    mode: louisGoModeSchema,
    task_id: taskReferenceSchema,
    status: z.literal("open"),
    created_at: isoDateTimeSchema,
  })
  .transform((data) => ({
    schema: data.schema,
    mode: data.mode,
    taskId: data.task_id,
    status: data.status,
    createdAt: data.created_at,
  }));
export type ConfirmReqFrontMatter = z.output<typeof confirmReqFrontMatterSchema>;

export const adrFrontMatterSchema = z
  .object({
    schema: z.literal("louisgo-adr-v1"),
    status: z.enum(["draft", "accepted", "superseded"]),
    adr_id: nullableStringSchema,
    created_at: isoDateTimeSchema,
    confirmed_at: nullableDateTimeSchema,
  })
  .transform((data) => ({
    schema: data.schema,
    status: data.status,
    adrId: data.adr_id,
    createdAt: data.created_at,
    confirmedAt: data.confirmed_at,
  }));
export type AdrFrontMatter = z.output<typeof adrFrontMatterSchema>;

export const missionFrontMatterSchema = z
  .object({
    schema: z.literal("louisgo-mission-v1"),
    default_mode: louisGoModeSchema,
    updated_at: isoDateTimeSchema,
  })
  .transform((data) => ({
    schema: data.schema,
    defaultMode: data.default_mode,
    updatedAt: data.updated_at,
  }));
export type MissionFrontMatter = z.output<typeof missionFrontMatterSchema>;

export const capabilitiesFrontMatterSchema = z
  .object({
    schema: z.literal("louisgo-capabilities-v1"),
    updated_at: isoDateTimeSchema,
  })
  .transform((data) => ({
    schema: data.schema,
    updatedAt: data.updated_at,
  }));
export type CapabilitiesFrontMatter = z.output<typeof capabilitiesFrontMatterSchema>;

export const stateFrontMatterSchema = z
  .object({
    schema: z.literal("louisgo-state-v1"),
    mode: louisGoModeSchema,
    current_task: taskReferenceSchema,
    handoff: z.string().min(1).optional(),
    verification: verificationStatusSchema,
    git_head: nonEmptyStringSchema,
    diff_hash: nonEmptyStringSchema,
    updated_at: isoDateTimeSchema,
  })
  .transform((data) => ({
    schema: data.schema,
    mode: data.mode,
    currentTask: data.current_task,
    ...(data.handoff === undefined ? {} : { handoff: data.handoff }),
    verification: data.verification,
    gitHead: data.git_head,
    diffHash: data.diff_hash,
    updatedAt: data.updated_at,
  }));
export type StateFrontMatter = z.output<typeof stateFrontMatterSchema>;

export const memoryFrontMatterSchema = z
  .object({
    schema: z.literal("louisgo-memory-v1"),
    updated_at: isoDateTimeSchema,
  })
  .transform((data) => ({
    schema: data.schema,
    updatedAt: data.updated_at,
  }));
export type MemoryFrontMatter = z.output<typeof memoryFrontMatterSchema>;
