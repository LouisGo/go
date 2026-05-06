import { createHash, randomUUID } from "node:crypto";

import { z } from "zod";

export const statsSourceSchema = z.enum(["context", "codex"]);
export type StatsSource = z.infer<typeof statsSourceSchema>;

export const statsToolSchema = z.enum(["louisgo", "codex"]);
export type StatsTool = z.infer<typeof statsToolSchema>;

export const statsEventNameSchema = z.enum(["louisgo.context", "codex.usage"]);
export type StatsEventName = z.infer<typeof statsEventNameSchema>;

export const statsConfidenceSchema = z.enum(["actual", "estimated", "simulated"]);
export type StatsConfidence = z.infer<typeof statsConfidenceSchema>;

export const statsLayerSchema = z.enum(["runtime", "L1", "L2", "L3", "L4"]);
export type StatsLayer = z.infer<typeof statsLayerSchema>;

export const statsStabilitySchema = z.enum(["stable", "dynamic"]);
export type StatsStability = z.infer<typeof statsStabilitySchema>;

const nonNegativeIntegerSchema = z.number().int().nonnegative();

export const tokenUsageSchema = z
  .object({
    input_tokens: nonNegativeIntegerSchema.optional(),
    cached_input_tokens: nonNegativeIntegerSchema.optional(),
    output_tokens: nonNegativeIntegerSchema.optional(),
    reasoning_output_tokens: nonNegativeIntegerSchema.optional(),
    total_tokens: nonNegativeIntegerSchema.optional(),
  })
  .strict();
export type TokenUsage = z.infer<typeof tokenUsageSchema>;

export const contextSectionStatsSchema = z
  .object({
    source: z.string().min(1),
    title: z.string().min(1),
    layer: statsLayerSchema,
    stability: statsStabilitySchema,
    tokens: nonNegativeIntegerSchema,
    included: z.boolean(),
    truncated: z.boolean(),
  })
  .strict();
export type ContextSectionStats = z.infer<typeof contextSectionStatsSchema>;

export const contextStatsSchema = z
  .object({
    budget_tokens: nonNegativeIntegerSchema,
    compiled_context_tokens: nonNegativeIntegerSchema,
    full_protocol_baseline_tokens: nonNegativeIntegerSchema,
    avoided_context_tokens: nonNegativeIntegerSchema,
    cache_eligible_prefix_tokens: nonNegativeIntegerSchema,
    truncated: z.boolean(),
    sections: z.array(contextSectionStatsSchema),
  })
  .strict();
export type ContextStats = z.infer<typeof contextStatsSchema>;

export const savingsStatsSchema = z
  .object({
    confidence: z.literal("simulated"),
    avoided_context_tokens: nonNegativeIntegerSchema,
    cache_eligible_prefix_tokens: nonNegativeIntegerSchema,
  })
  .strict();
export type SavingsStats = z.infer<typeof savingsStatsSchema>;

export const codexStatsSchema = z
  .object({
    source_file: z.string().min(1),
    source_file_hash: z.string().regex(/^[a-f0-9]{64}$/),
    source_line: nonNegativeIntegerSchema,
    usage_kind: z.enum(["last_token_usage", "total_token_usage", "token_count"]),
    session_id: z.string().min(1).optional(),
  })
  .strict();
export type CodexStats = z.infer<typeof codexStatsSchema>;

export const statsEventSchema = z
  .object({
    schema: z.literal("louisgo-stats-event-v1"),
    id: z.string().min(1),
    timestamp: z.iso.datetime({ offset: true }),
    source: statsSourceSchema,
    tool: statsToolSchema,
    event: statsEventNameSchema,
    confidence: statsConfidenceSchema,
    usage: tokenUsageSchema.optional(),
    context: contextStatsSchema.optional(),
    savings: savingsStatsSchema.optional(),
    codex: codexStatsSchema.optional(),
  })
  .strict();
export type StatsEvent = z.infer<typeof statsEventSchema>;

export interface CreateContextStatsEventOptions {
  readonly timestamp: string;
  readonly context: ContextStats;
}

export function createContextStatsEvent(options: CreateContextStatsEventOptions): StatsEvent {
  return statsEventSchema.parse({
    schema: "louisgo-stats-event-v1",
    id: randomUUID(),
    timestamp: options.timestamp,
    source: "context",
    tool: "louisgo",
    event: "louisgo.context",
    confidence: "estimated",
    usage: {
      input_tokens: options.context.compiled_context_tokens,
      total_tokens: options.context.compiled_context_tokens,
    },
    context: options.context,
    savings: {
      confidence: "simulated",
      avoided_context_tokens: options.context.avoided_context_tokens,
      cache_eligible_prefix_tokens: options.context.cache_eligible_prefix_tokens,
    },
  });
}

export interface CreateCodexUsageEventOptions {
  readonly timestamp: string;
  readonly usage: TokenUsage;
  readonly sourceFile: string;
  readonly sourceFileHash: string;
  readonly sourceLine: number;
  readonly usageKind: CodexStats["usage_kind"];
  readonly sessionId?: string;
}

export function createCodexUsageEvent(options: CreateCodexUsageEventOptions): StatsEvent {
  const id = createHash("sha256")
    .update("codex\0")
    .update(options.sourceFileHash)
    .update("\0")
    .update(String(options.sourceLine))
    .update("\0")
    .update(options.usageKind)
    .update("\0")
    .update(JSON.stringify(options.usage))
    .digest("hex");

  return statsEventSchema.parse({
    schema: "louisgo-stats-event-v1",
    id,
    timestamp: options.timestamp,
    source: "codex",
    tool: "codex",
    event: "codex.usage",
    confidence: "actual",
    usage: options.usage,
    codex: {
      source_file: options.sourceFile,
      source_file_hash: options.sourceFileHash,
      source_line: options.sourceLine,
      usage_kind: options.usageKind,
      ...(options.sessionId === undefined ? {} : { session_id: options.sessionId }),
    },
  });
}
