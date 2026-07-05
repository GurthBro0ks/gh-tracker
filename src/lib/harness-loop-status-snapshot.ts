import { readFile } from "fs/promises";
import { z } from "zod";
import {
  habitatLoopStatusFixture,
  LOOP_STATUS_DISPLAY_STATES,
  type HabitatLoopStatusFixture,
  type LoopStatusItemView,
} from "./harness-loop-status-fixtures";

export const HABITAT_LOOP_STATUS_SNAPSHOT_PATH = "/home/slimy/harness-logs/loop-status-snapshot/latest.json";

const LOOP_STATUS_MAX_AGE_SECONDS = 900;

export type HabitatLoopStatusSnapshotState = "fresh" | "stale" | "missing" | "invalid";

export type HabitatLoopStatusLoadResult = {
  mode: "snapshot" | "fixture";
  snapshotState: HabitatLoopStatusSnapshotState;
  snapshotPath: string;
  generatedAt: string | null;
  stateLabel: string;
  stateMessage: string;
  data: HabitatLoopStatusFixture;
};

const displayStateSchema = z.enum(LOOP_STATUS_DISPLAY_STATES);

const itemSchema = z.object({
  id: z.string(),
  phase: z.string(),
  title: z.string(),
  target_machine: z.string(),
  target_repo: z.string(),
  model_recommendation: z.string(),
  glm_thinking_level: z.string(),
  status: displayStateSchema,
  safety_level: z.string(),
  proof_dir: z.string(),
  proof_gate_verdict: z.string(),
  manual_qa_status: z.string(),
  next_required_gate: z.string(),
  blocked_reason: z.string(),
  updated_at: z.string(),
  warnings_count: z.number().int().nonnegative(),
  reasons_count: z.number().int().nonnegative(),
});

const byStatusSchema = z.object({
  OK: z.number().int().nonnegative(),
  WARN: z.number().int().nonnegative(),
  BLOCKED: z.number().int().nonnegative(),
  FAIL: z.number().int().nonnegative(),
  UNKNOWN: z.number().int().nonnegative(),
});

// Frozen Phase 1 schema. Only the fields on this schema, and only the
// allow-listed subset projected in `projectSnapshot`, may ever reach the UI.
const snapshotSchema = z.object({
  schema_version: z.literal("loop-status.v1"),
  generated_at: z.string(),
  generator: z.string(),
  source: z.object({
    queue_path: z.string(),
    proof_root: z.string(),
  }),
  summary: z.object({
    total_items: z.number().int().nonnegative(),
    by_status: byStatusSchema,
    by_gate: z.record(z.string(), z.number().int().nonnegative()),
    highest_risk_state: displayStateSchema,
    has_blockers: z.boolean(),
    has_failures: z.boolean(),
    stale_count: z.number().int().nonnegative(),
  }),
  items: z.array(itemSchema),
  safety: z.object({
    shell_execution_present: z.literal(false),
    mutation_controls_present: z.literal(false),
    request_time_shell_required: z.literal(false),
    secrets_redacted: z.literal(true),
    owner_gate_required_for_ui: z.literal(true),
  }),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
});

type LoopStatusSnapshot = z.infer<typeof snapshotSchema>;

function cloneFixture(): HabitatLoopStatusFixture {
  return structuredClone(habitatLoopStatusFixture);
}

// Projects the raw exporter schema down to only the fields this UI is
// allowed to display. Fields like id, target_machine, target_repo,
// model_recommendation, glm_thinking_level, safety_level, proof_dir,
// warnings_count, and reasons_count are intentionally dropped here.
function projectSnapshot(snapshot: LoopStatusSnapshot): HabitatLoopStatusFixture {
  const items: LoopStatusItemView[] = snapshot.items.map((item) => ({
    phase: item.phase,
    title: item.title,
    status: item.status,
    proofGateVerdict: item.proof_gate_verdict,
    manualQaStatus: item.manual_qa_status,
    nextRequiredGate: item.next_required_gate,
    blockedReason: item.blocked_reason,
    updatedAt: item.updated_at,
  }));

  return {
    mode: "fixture_only",
    generatedAt: snapshot.generated_at,
    summary: {
      totalItems: snapshot.summary.total_items,
      byStatus: snapshot.summary.by_status,
      byGate: snapshot.summary.by_gate,
      highestRiskState: snapshot.summary.highest_risk_state,
      hasBlockers: snapshot.summary.has_blockers,
      hasFailures: snapshot.summary.has_failures,
    },
    items,
    safety: {
      shellExecutionPresent: snapshot.safety.shell_execution_present,
      mutationControlsPresent: snapshot.safety.mutation_controls_present,
      requestTimeShellRequired: snapshot.safety.request_time_shell_required,
      secretsRedacted: snapshot.safety.secrets_redacted,
      ownerGateRequiredForUi: snapshot.safety.owner_gate_required_for_ui,
    },
    footerSummary: [
      "Live controls are not implemented.",
      "This page reads a sanitized static snapshot only.",
      "Shell execution is not present in this route.",
      "Snapshot mode is active.",
    ],
  };
}

function deriveFreshnessState(generatedAt: string): HabitatLoopStatusSnapshotState {
  const generatedAtMs = Date.parse(generatedAt);
  if (Number.isNaN(generatedAtMs)) return "invalid";
  const ageSeconds = Math.max(0, Math.floor((Date.now() - generatedAtMs) / 1000));
  return ageSeconds > LOOP_STATUS_MAX_AGE_SECONDS ? "stale" : "fresh";
}

function buildFallback(
  snapshotPath: string,
  snapshotState: HabitatLoopStatusSnapshotState,
  stateLabel: string,
  stateMessage: string,
): HabitatLoopStatusLoadResult {
  return {
    mode: "fixture",
    snapshotState,
    snapshotPath,
    generatedAt: null,
    stateLabel,
    stateMessage,
    data: cloneFixture(),
  };
}

export async function loadHabitatLoopStatusSnapshot(
  snapshotPath = HABITAT_LOOP_STATUS_SNAPSHOT_PATH,
): Promise<HabitatLoopStatusLoadResult> {
  let raw: string;
  try {
    raw = await readFile(snapshotPath, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return buildFallback(
        snapshotPath,
        "missing",
        "SNAPSHOT MISSING",
        "No sanitized loop-status snapshot file is available yet. Fixture fallback is active.",
      );
    }
    return buildFallback(
      snapshotPath,
      "invalid",
      "SNAPSHOT INVALID",
      "The sanitized loop-status snapshot could not be read safely. Fixture fallback is active.",
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return buildFallback(
      snapshotPath,
      "invalid",
      "SNAPSHOT INVALID",
      "The loop-status snapshot JSON could not be parsed. Fixture fallback is active.",
    );
  }

  const snapshotResult = snapshotSchema.safeParse(parsed);
  if (!snapshotResult.success) {
    return buildFallback(
      snapshotPath,
      "invalid",
      "SNAPSHOT INVALID",
      "The loop-status snapshot schema did not validate. Fixture fallback is active.",
    );
  }

  const snapshot = snapshotResult.data;
  const snapshotState = deriveFreshnessState(snapshot.generated_at);
  if (snapshotState === "invalid") {
    return buildFallback(
      snapshotPath,
      "invalid",
      "SNAPSHOT INVALID",
      "The loop-status snapshot timestamp was invalid. Fixture fallback is active.",
    );
  }

  return {
    mode: "snapshot",
    snapshotState,
    snapshotPath,
    generatedAt: snapshot.generated_at,
    stateLabel: snapshotState === "stale" ? "STALE SNAPSHOT" : "SNAPSHOT MODE",
    stateMessage:
      snapshotState === "stale"
        ? "Sanitized loop-status snapshot data is stale but still safe to display."
        : "Sanitized loop-status snapshot data is active.",
    data: projectSnapshot(snapshot),
  };
}
