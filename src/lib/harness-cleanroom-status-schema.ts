import { z } from "zod";

export const harnessCleanroomSafeValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const proofSummarySchema = z.object({
  id: z.string().min(1),
  phase: harnessCleanroomSafeValueSchema.optional().default(null),
  result: harnessCleanroomSafeValueSchema.optional().default(null),
  target_machine: harnessCleanroomSafeValueSchema.optional().default(null),
  target_repo: harnessCleanroomSafeValueSchema.optional().default(null),
  proof_dir: z.string().min(1),
  validation_summary: harnessCleanroomSafeValueSchema.optional().default(null),
  manual_qa_status: harnessCleanroomSafeValueSchema.optional().default(null),
  discord_status: harnessCleanroomSafeValueSchema.optional().default(null),
  report_url: harnessCleanroomSafeValueSchema.optional().default(null),
  changed_files: z.array(z.string()).default([]),
  commit_sha: harnessCleanroomSafeValueSchema.optional().default(null),
  pushed: z.union([z.boolean(), z.null()]).optional().default(null),
  risk_flags: z.array(z.string()).default([]),
  result_file_present: z.boolean().default(false),
  result_file_partial: z.boolean().default(false),
  updated_at: harnessCleanroomSafeValueSchema.optional().default(null),
}).passthrough();

export const proofIndexSchema = z.object({
  schema_version: z.literal("slimy-proof-index/v1"),
  generated_at: z.string().min(1),
  proof_roots: z.array(z.string()).default([]),
  proof_count: z.number().int().nonnegative(),
  proofs: z.array(proofSummarySchema).default([]),
}).passthrough();

export const goalRecordEventSchema = z.object({
  schema_version: z.literal("slimy-goal-record/v1"),
  timestamp: z.string().min(1),
  goal_id: z.string().min(1),
  phase: harnessCleanroomSafeValueSchema.optional().default(null),
  state: z.enum(["queued", "running", "paused", "blocked", "retrying", "failed", "complete", "accepted", "warn"]),
  reason: z.string().min(1),
  target_machine: harnessCleanroomSafeValueSchema.optional().default(null),
  target_repo: harnessCleanroomSafeValueSchema.optional().default(null),
  proof_dir: harnessCleanroomSafeValueSchema.optional().default(null),
  manual_qa_status: harnessCleanroomSafeValueSchema.optional().default(null),
  blocker: harnessCleanroomSafeValueSchema.optional().default(null),
  report_url: harnessCleanroomSafeValueSchema.optional().default(null),
}).passthrough().refine((event) => !("passes" in event), {
  message: "goal records must not include passes",
});

export type ProofIndexRaw = z.infer<typeof proofIndexSchema>;
export type ProofSummaryRaw = z.infer<typeof proofSummarySchema>;
export type GoalRecordEventRaw = z.infer<typeof goalRecordEventSchema>;
export type HarnessCleanroomSafeValue = z.infer<typeof harnessCleanroomSafeValueSchema>;
