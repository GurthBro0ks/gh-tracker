import { readFile, stat } from "node:fs/promises";
import { ZodError } from "zod";
import { goalRecordEventSchema, proofIndexSchema, type GoalRecordEventRaw, type HarnessCleanroomSafeValue, type ProofSummaryRaw } from "./harness-cleanroom-status-schema";

export const HARNESS_PROOF_INDEX_PATH = "/home/slimy/harness-logs/state/proof-index.json";
export const HARNESS_GOAL_RECORD_PATH = "/home/slimy/harness-logs/state/goal-records.jsonl";

const MAX_SAFE_TEXT_LENGTH = 220;
const ACTIVE_STATES = new Set(["queued", "running", "paused", "blocked", "retrying", "warn"]);

export type CleanroomSourceStatus = "ready" | "missing" | "invalid_json" | "schema_mismatch" | "empty";

export type CleanroomProofView = {
  id: string;
  phase: string | null;
  result: string | null;
  targetMachine: string | null;
  targetRepo: string | null;
  proofDir: string;
  validationSummary: string | null;
  manualQaStatus: string | null;
  discordStatus: string | null;
  reportUrl: string | null;
  changedFiles: string[];
  commitSha: string | null;
  pushed: boolean | null;
  riskFlags: string[];
  resultFilePresent: boolean;
  resultFilePartial: boolean;
  updatedAt: string | null;
  isWarn: boolean;
  isFail: boolean;
  isManualQaPending: boolean;
  sortTime: number;
};

export type CleanroomGoalView = {
  goalId: string;
  phase: string | null;
  state: string;
  reason: string;
  targetMachine: string | null;
  targetRepo: string | null;
  proofDir: string | null;
  manualQaStatus: string | null;
  blocker: string | null;
  reportUrl: string | null;
  timestamp: string;
  isActive: boolean;
  isManualQaPending: boolean;
  sortTime: number;
};

export type CleanroomStatusView = {
  proofIndex: {
    status: CleanroomSourceStatus;
    dataSource: string;
    message: string;
    generatedAt: string | null;
    fileSizeBytes: number | null;
    proofCount: number;
    proofs: CleanroomProofView[];
    latestProof: CleanroomProofView | null;
  };
  goalRecord: {
    status: CleanroomSourceStatus;
    dataSource: string;
    message: string;
    fileSizeBytes: number | null;
    eventCount: number;
    latestGoals: CleanroomGoalView[];
    activeGoal: CleanroomGoalView | null;
  };
};

export async function loadHarnessCleanroomStatus(paths: { proofIndexPath?: string; goalRecordPath?: string } = {}): Promise<CleanroomStatusView> {
  const [proofIndex, goalRecord] = await Promise.all([
    loadProofIndex(paths.proofIndexPath ?? HARNESS_PROOF_INDEX_PATH),
    loadGoalRecord(paths.goalRecordPath ?? HARNESS_GOAL_RECORD_PATH),
  ]);
  return { proofIndex, goalRecord };
}

async function loadProofIndex(indexPath: string): Promise<CleanroomStatusView["proofIndex"]> {
  let fileSizeBytes: number | null = null;
  let raw: string;
  try {
    const stats = await stat(indexPath);
    fileSizeBytes = stats.size;
    raw = await readFile(indexPath, "utf8");
  } catch {
    return emptyProofIndex("missing", indexPath, "Clean-room proof index is missing. Run the harness trace-store exporter to populate it.", fileSizeBytes);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return emptyProofIndex("invalid_json", indexPath, "Clean-room proof index is not valid JSON.", fileSizeBytes);
  }

  const validated = proofIndexSchema.safeParse(parsed);
  if (!validated.success) {
    return emptyProofIndex("schema_mismatch", indexPath, formatSchemaMessage(validated.error), fileSizeBytes);
  }

  const proofs = validated.data.proofs.map(normalizeProof).sort((a, b) => b.sortTime - a.sortTime || a.id.localeCompare(b.id));
  return {
    status: proofs.length > 0 ? "ready" : "empty",
    dataSource: indexPath,
    message: proofs.length > 0 ? "Clean-room proof index loaded from generated metadata." : "Clean-room proof index is valid but has zero proof rows.",
    generatedAt: validated.data.generated_at,
    fileSizeBytes,
    proofCount: validated.data.proof_count,
    proofs,
    latestProof: proofs[0] ?? null,
  };
}

async function loadGoalRecord(recordPath: string): Promise<CleanroomStatusView["goalRecord"]> {
  let fileSizeBytes: number | null = null;
  let raw: string;
  try {
    const stats = await stat(recordPath);
    fileSizeBytes = stats.size;
    raw = await readFile(recordPath, "utf8");
  } catch {
    return emptyGoalRecord("missing", recordPath, "Clean-room goal record is missing. Goal state appears after explicit append events.", fileSizeBytes);
  }

  const events: GoalRecordEventRaw[] = [];
  for (const [index, line] of raw.split(/\r?\n/).entries()) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return emptyGoalRecord("invalid_json", recordPath, `Clean-room goal record has invalid JSONL on line ${index + 1}.`, fileSizeBytes);
    }
    const validated = goalRecordEventSchema.safeParse(parsed);
    if (!validated.success) {
      return emptyGoalRecord("schema_mismatch", recordPath, formatSchemaMessage(validated.error), fileSizeBytes);
    }
    events.push(validated.data);
  }

  const latestByGoal = new Map<string, CleanroomGoalView>();
  for (const event of events) {
    latestByGoal.set(event.goal_id, normalizeGoal(event));
  }
  const latestGoals = Array.from(latestByGoal.values()).sort((a, b) => b.sortTime - a.sortTime || a.goalId.localeCompare(b.goalId));
  const activeGoal = latestGoals.find((goal) => goal.isActive) ?? null;
  return {
    status: events.length > 0 ? "ready" : "empty",
    dataSource: recordPath,
    message: events.length > 0 ? "Clean-room goal record loaded from append-only JSONL." : "Clean-room goal record is valid but has zero events.",
    fileSizeBytes,
    eventCount: events.length,
    latestGoals,
    activeGoal,
  };
}

function emptyProofIndex(status: CleanroomSourceStatus, dataSource: string, message: string, fileSizeBytes: number | null): CleanroomStatusView["proofIndex"] {
  return { status, dataSource, message, generatedAt: null, fileSizeBytes, proofCount: 0, proofs: [], latestProof: null };
}

function emptyGoalRecord(status: CleanroomSourceStatus, dataSource: string, message: string, fileSizeBytes: number | null): CleanroomStatusView["goalRecord"] {
  return { status, dataSource, message, fileSizeBytes, eventCount: 0, latestGoals: [], activeGoal: null };
}

function normalizeProof(raw: ProofSummaryRaw): CleanroomProofView {
  const result = safeString(raw.result);
  const manualQaStatus = safeString(raw.manual_qa_status);
  return {
    id: raw.id,
    phase: safeString(raw.phase),
    result,
    targetMachine: safeString(raw.target_machine),
    targetRepo: safeString(raw.target_repo),
    proofDir: raw.proof_dir,
    validationSummary: safeString(raw.validation_summary),
    manualQaStatus,
    discordStatus: safeString(raw.discord_status),
    reportUrl: safeUrl(raw.report_url),
    changedFiles: raw.changed_files.map((value) => safeString(value) ?? "").filter(Boolean).slice(0, 12),
    commitSha: safeString(raw.commit_sha),
    pushed: raw.pushed,
    riskFlags: raw.risk_flags.map((value) => safeString(value) ?? "").filter(Boolean).slice(0, 12),
    resultFilePresent: raw.result_file_present,
    resultFilePartial: raw.result_file_partial,
    updatedAt: safeString(raw.updated_at),
    isWarn: (result ?? "").toLowerCase().includes("warn"),
    isFail: (result ?? "").toLowerCase().includes("fail"),
    isManualQaPending: isManualQaPending(manualQaStatus),
    sortTime: Date.parse(safeString(raw.updated_at) ?? "") || 0,
  };
}

function normalizeGoal(raw: GoalRecordEventRaw): CleanroomGoalView {
  const manualQaStatus = safeString(raw.manual_qa_status);
  return {
    goalId: raw.goal_id,
    phase: safeString(raw.phase),
    state: raw.state,
    reason: safeString(raw.reason) ?? "reason unavailable",
    targetMachine: safeString(raw.target_machine),
    targetRepo: safeString(raw.target_repo),
    proofDir: safeString(raw.proof_dir),
    manualQaStatus,
    blocker: safeString(raw.blocker),
    reportUrl: safeUrl(raw.report_url),
    timestamp: raw.timestamp,
    isActive: ACTIVE_STATES.has(raw.state),
    isManualQaPending: isManualQaPending(manualQaStatus),
    sortTime: Date.parse(raw.timestamp) || 0,
  };
}

function safeString(value: HarnessCleanroomSafeValue | undefined): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed.length > MAX_SAFE_TEXT_LENGTH ? `${trimmed.slice(0, MAX_SAFE_TEXT_LENGTH - 3)}...` : trimmed;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function safeUrl(value: HarnessCleanroomSafeValue | undefined): string | null {
  const text = safeString(value);
  if (!text || text === "none") return null;
  try {
    const url = new URL(text);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.hostname !== "harness.slimyai.xyz") return null;
    if (!url.pathname.startsWith("/reports")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function isManualQaPending(status: string | null) {
  if (!status) return true;
  const normalized = status.toLowerCase();
  return !["pass", "passed", "accepted", "complete", "completed", "none", "not_required", "not_applicable"].includes(normalized);
}

function formatSchemaMessage(error: ZodError) {
  const first = error.issues[0];
  if (!first) return "Clean-room harness status schema mismatch.";
  return `Clean-room harness status schema mismatch at ${first.path.join(".") || "root"}: ${first.message}`;
}
