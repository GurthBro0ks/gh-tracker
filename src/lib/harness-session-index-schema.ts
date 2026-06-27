import { z } from "zod";

export const harnessSafeValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

const safeStringArraySchema = z.array(z.string()).default([]);

export const harnessSessionSummarySchema = z.object({
  session_id: harnessSafeValueSchema.optional().default(null),
  phase: harnessSafeValueSchema.optional().default(null),
  result: harnessSafeValueSchema.optional().default(null),
  status: harnessSafeValueSchema.optional().default(null),
  project: harnessSafeValueSchema.optional().default(null),
  repo: harnessSafeValueSchema.optional().default(null),
  feature_id: harnessSafeValueSchema.optional().default(null),
  machine: harnessSafeValueSchema.optional().default(null),
  nuc: harnessSafeValueSchema.optional().default(null),
  commit: harnessSafeValueSchema.optional().default(null),
  head: harnessSafeValueSchema.optional().default(null),
  pushed: harnessSafeValueSchema.optional().default(null),
  proof_dir: harnessSafeValueSchema.optional().default(null),
  report_url: harnessSafeValueSchema.optional().default(null),
  created_at: harnessSafeValueSchema.optional().default(null),
  archived_at: harnessSafeValueSchema.optional().default(null),
  reported_at: harnessSafeValueSchema.optional().default(null),
  timestamp: harnessSafeValueSchema.optional().default(null),
  started_at: harnessSafeValueSchema.optional().default(null),
  finished_at: harnessSafeValueSchema.optional().default(null),
  duration_minutes: harnessSafeValueSchema.optional().default(null),
  manual_qa_status: harnessSafeValueSchema.optional().default(null),
  discord_sent: harnessSafeValueSchema.optional().default(null),
  notify_mode: harnessSafeValueSchema.optional().default(null),
  dedupe_result: harnessSafeValueSchema.optional().default(null),
  services_restarted: harnessSafeValueSchema.optional().default(null),
  caddy_changed: harnessSafeValueSchema.optional().default(null),
  dns_changed: harnessSafeValueSchema.optional().default(null),
  cron_changed: harnessSafeValueSchema.optional().default(null),
  timer_changed: harnessSafeValueSchema.optional().default(null),
  tmux_changed: harnessSafeValueSchema.optional().default(null),
  secrets_printed: harnessSafeValueSchema.optional().default(null),
  webhook_values_printed: harnessSafeValueSchema.optional().default(null),
  warnings: safeStringArraySchema,
  failures: safeStringArraySchema,
  next_action: harnessSafeValueSchema.optional().default(null),
  source_report: z.string().min(1).optional().default("unknown-source-report.json"),
}).passthrough();

const harnessSessionIndexVersionSchema = z
  .literal("harness-session-index/v1")
  .optional()
  .nullable()
  .default(null);

export const harnessSessionIndexSchema = z.object({
  schema_version: harnessSessionIndexVersionSchema,
  schema: harnessSessionIndexVersionSchema,
  generated_at: z.string().min(1).optional().nullable().default(null),
  generated_by: z.string().min(1).optional().nullable().default(null),
  source_machine: z.string().min(1).optional().nullable().default(null),
  session_count: z.number().int().nonnegative().optional().nullable().default(null),
  sessions: z.array(harnessSessionSummarySchema).default([]),
}).passthrough();

export type HarnessSessionIndexRaw = z.infer<typeof harnessSessionIndexSchema>;
export type HarnessSessionSummaryRaw = z.infer<typeof harnessSessionSummarySchema>;
export type HarnessSafeValue = z.infer<typeof harnessSafeValueSchema>;
