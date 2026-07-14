import { readFile } from "fs/promises";
import { join } from "path";
import { z } from "zod";


export const RUN_PROJECTION_SCHEMA_VERSION = "run-projection.v1" as const;
export const RUN_PROJECTION_ROOT = "/home/slimy/harness-logs/run-projections/";

export const RUN_PROJECTION_EXECUTION_STATES = [
  "CREATED",
  "ACTIVE",
  "INTERRUPTED",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "UNKNOWN",
] as const;

const TERMINAL_EXECUTION_STATES = new Set<(typeof RUN_PROJECTION_EXECUTION_STATES)[number]>([
  "COMPLETED",
  "FAILED",
  "CANCELLED",
]);

const RUN_ID_PATTERN = /^run_[0-9]{8}T[0-9]{12}Z_[0-9a-f]{32}$/;
const UTC_TIMESTAMP_PATTERN =
  /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]{1,6})?Z$/;
const SAFE_TEXT_PATTERN = /^[^\u0000-\u001f\u007f]+$/;
const SAFE_RELATIVE_PATH_PATTERN = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+$/;
const ABSOLUTE_PATH_PATTERN = /^(?!.*(?:^|\/)\.\.(?:\/|$))\/(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+\/?$/;
const PROOF_PATH_PATTERN = /^(?!.*(?:^|\/)\.\.(?:\/|$))\/(?:tmp|home\/slimy\/proofs)\/[A-Za-z0-9._/-]+$/;
const REPORT_URL_PATTERN = /^https:\/\/harness\.slimyai\.xyz\/reports\/sessions\/[A-Za-z0-9._-]+$/;
const WORKSPACE_PATH_PATTERN = /^\/runs\/run_[0-9]{8}T[0-9]{12}Z_[0-9a-f]{32}$/;
const WORKSPACE_URL_PATTERN = /^https:\/\/habitat\.slimyai\.xyz\/runs\/run_[0-9]{8}T[0-9]{12}Z_[0-9a-f]{32}$/;

const canonicalString = (maximum: number) =>
  z.string().min(1).max(maximum).regex(SAFE_TEXT_PATTERN);

const utcTimestampSchema = z
  .string()
  .regex(UTC_TIMESTAMP_PATTERN)
  .refine((value) => !Number.isNaN(Date.parse(value)), "invalid UTC timestamp");
const runIdSchema = z.string().regex(RUN_ID_PATTERN);
const boundedMessagesSchema = z.array(canonicalString(500)).max(20);
const nullableBooleanSchema = z.boolean().nullable();

const runSchema = z
  .object({
    run_id: runIdSchema,
    subject_type: z.string().regex(/^[a-z][a-z0-9._-]{0,63}$/),
    subject_id: canonicalString(256),
    project_id: z.string().regex(/^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/),
    phase: canonicalString(256),
    machine: canonicalString(256),
    model: canonicalString(256).nullable(),
    actor: canonicalString(256).nullable(),
    created_at: utcTimestampSchema,
    completed_at: utcTimestampSchema.nullable(),
    duration_minutes: z.number().nonnegative().nullable(),
    duration_source: canonicalString(256),
  })
  .strict();

const stateSchema = z
  .object({
    execution: z.enum(RUN_PROJECTION_EXECUTION_STATES),
    evidence: z.enum(["PENDING", "CAPTURED", "INCOMPLETE", "UNAVAILABLE", "UNKNOWN"]),
    review: z.enum(["NOT_RUN", "PASS", "WARN", "FAIL", "UNKNOWN"]),
    acceptance: z.enum([
      "NO_DECISION",
      "ACCEPTED",
      "CONDITIONALLY_ACCEPTED",
      "REJECTED",
      "SUPERSEDED",
      "UNKNOWN",
    ]),
    owner_action: z.enum([
      "NONE_REQUIRED",
      "OWNER_QA_PENDING",
      "OWNER_DECISION_PENDING",
      "DONE",
      "UNKNOWN",
    ]),
    notification: z.enum(["NOT_SENT", "SENT", "DEDUPED", "RELAYED", "UNKNOWN"]),
    stage: canonicalString(500).nullable(),
    blocked: z.boolean(),
    warnings: boundedMessagesSchema,
    blockers: boundedMessagesSchema,
  })
  .strict();

const flagsSchema = z
  .object({
    pushed: nullableBooleanSchema,
    deployed: nullableBooleanSchema,
    production_storage_active: nullableBooleanSchema,
    test_fixture_only: z.boolean(),
    production_acceptance_enabled: z.boolean(),
  })
  .strict();

const validationCheckSchema = z
  .object({
    id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/),
    name: canonicalString(256),
    status: canonicalString(256),
    passed: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
    source_artifact: z.string().min(1).max(512).regex(SAFE_RELATIVE_PATH_PATTERN),
  })
  .strict();

const validationSchema = z
  .object({
    summary: canonicalString(2000),
    checks: z.array(validationCheckSchema).max(100),
    deep_validation: z.enum(["CURRENT", "STALE", "UNAVAILABLE", "FAILED", "NOT_IMPLEMENTED"]),
    deep_validation_at: utcTimestampSchema.nullable(),
  })
  .strict();

const evidenceSchema = z
  .object({
    summary: canonicalString(2000),
    status: z.enum(["CAPTURED", "NOT_REVERIFIED", "MISSING", "UNKNOWN"]),
    checked_at: utcTimestampSchema.nullable(),
    proof_dir: z.string().min(2).max(4096).regex(PROOF_PATH_PATTERN).nullable(),
  })
  .strict();

const artifactsSchema = z
  .object({
    count: z.number().int().nonnegative(),
    displayed_files: z.array(z.string().min(1).max(255).regex(/^[^/\\\u0000-\u001f\u007f]+$/)).max(200),
    filter_explanation: canonicalString(2000),
  })
  .strict();

const acceptanceSchema = z
  .object({
    read_at: utcTimestampSchema.nullable(),
    acceptance_id: canonicalString(256).nullable(),
    scope: canonicalString(500).nullable(),
    limitations: boundedMessagesSchema,
    superseded_by: canonicalString(256).nullable(),
    source: canonicalString(256),
  })
  .strict();

const linksSchema = z
  .object({
    report_url: z.string().regex(REPORT_URL_PATTERN).nullable(),
    workspace_path: z.string().regex(WORKSPACE_PATH_PATTERN),
  })
  .strict();

const continuationSchema = z
  .object({
    run_id: runIdSchema,
    project: canonicalString(256),
    repository_path: z.string().min(2).max(4096).regex(ABSOLUTE_PATH_PATTERN),
    accepted_commit: z.string().regex(/^[0-9a-f]{40}(?:[0-9a-f]{24})?$/).nullable(),
    machine: canonicalString(256),
    current_stage: canonicalString(2000),
    proof_dir: z.string().min(2).max(4096).regex(PROOF_PATH_PATTERN).nullable(),
    report_url: z.string().regex(REPORT_URL_PATTERN).nullable(),
    workspace_url: z.string().regex(WORKSPACE_URL_PATTERN),
    what_passed: canonicalString(2000),
    what_failed: canonicalString(2000),
    blockers: boundedMessagesSchema,
    unresolved_questions: boundedMessagesSchema,
    manual_qa_state: canonicalString(256),
    authority_status: canonicalString(256),
    push_authorized: z.boolean(),
    deploy_authorized: z.boolean(),
    restart_authorized: z.boolean(),
    prohibited_actions: boundedMessagesSchema,
    next_bounded_mission: canonicalString(2000),
    required_startup_files: z
      .array(
        z
          .string()
          .min(1)
          .max(4096)
          .regex(/^(?!.*(?:^|\/)\.\.(?:\/|$))\/?[A-Za-z0-9._/-]+$/),
      )
      .min(1)
      .max(50),
    required_validation: z.array(canonicalString(500)).min(1).max(50),
    model_recommendation: canonicalString(256),
    writer_of_record: canonicalString(500),
    generated_at: utcTimestampSchema,
    source_projection_digest: z.string().regex(/^[0-9a-f]{64}$/).nullable(),
    handoff_complete: z.boolean(),
  })
  .strict();

const integritySchema = z
  .object({
    source_refs: z.array(canonicalString(500)).max(100),
    digest: z.string().regex(/^[0-9a-f]{64}$/).nullable(),
  })
  .strict();

export const runProjectionSchema = z
  .object({
    schema_version: z.literal(RUN_PROJECTION_SCHEMA_VERSION),
    generated_at: utcTimestampSchema,
    generated_by: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._@/-]{0,255}$/),
    source_machine: z.enum(["nuc1", "nuc2"]),
    run: runSchema,
    state: stateSchema,
    flags: flagsSchema,
    validation: validationSchema,
    evidence: evidenceSchema,
    artifacts: artifactsSchema,
    acceptance: acceptanceSchema,
    links: linksSchema,
    next_action: canonicalString(2000).nullable(),
    continuation: continuationSchema.nullable(),
    integrity: integritySchema,
  })
  .strict()
  .superRefine((projection, context) => {
    if (projection.links.workspace_path !== `/runs/${projection.run.run_id}`) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "workspace_path does not match the canonical run_id",
        path: ["links", "workspace_path"],
      });
    }
    if (projection.continuation) {
      if (projection.continuation.run_id !== projection.run.run_id) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "continuation run_id does not match the canonical run_id",
          path: ["continuation", "run_id"],
        });
      }
      const expectedUrl = `https://habitat.slimyai.xyz/runs/${projection.run.run_id}`;
      if (projection.continuation.workspace_url !== expectedUrl) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "continuation workspace_url does not match the canonical run_id",
          path: ["continuation", "workspace_url"],
        });
      }
    }
  });

export type RunProjection = z.infer<typeof runProjectionSchema>;
export type RunProjectionFreshness = "fresh" | "stale" | "old";
export type RunProjectionFreshnessLabel = RunProjectionFreshness | "final";
export type RunProjectionState = "valid" | "missing" | "invalid";
export type RunProjectionErrorClass =
  | "invalid_json"
  | "invalid_run_id"
  | "missing_path"
  | "read_error"
  | "schema_mismatch"
  | "unsupported_schema_version";

export class RunProjectionValidationError extends Error {
  readonly errorClass: RunProjectionErrorClass;

  constructor(errorClass: RunProjectionErrorClass, message: string) {
    super(message);
    this.name = "RunProjectionValidationError";
    this.errorClass = errorClass;
  }
}

export type RunProjectionLoadResult = {
  mode: "snapshot" | "fixture";
  projectionState: RunProjectionState;
  projectionPath: string;
  generatedAt: string | null;
  freshness: RunProjectionFreshness | null;
  freshnessLabel: RunProjectionFreshnessLabel | null;
  terminal: boolean;
  errorClass: RunProjectionErrorClass | null;
  stateMessage: string;
  data: RunProjection | null;
};

export type LoadRunProjectionOptions = {
  rootPath?: string;
  fixtureFallback?: RunProjection;
  nowMs?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseRunProjection(value: unknown): RunProjection {
  if (
    isRecord(value) &&
    "schema_version" in value &&
    value.schema_version !== RUN_PROJECTION_SCHEMA_VERSION
  ) {
    throw new RunProjectionValidationError(
      "unsupported_schema_version",
      "unsupported run projection schema_version refused",
    );
  }
  const result = runProjectionSchema.safeParse(value);
  if (!result.success) {
    throw new RunProjectionValidationError(
      "schema_mismatch",
      "run projection schema validation failed",
    );
  }
  return result.data;
}

export function parseRunProjectionJson(raw: string): RunProjection {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new RunProjectionValidationError("invalid_json", "run projection JSON could not be parsed");
  }
  return parseRunProjection(parsed);
}

export function isTerminalRunProjection(execution: RunProjection["state"]["execution"]): boolean {
  return TERMINAL_EXECUTION_STATES.has(execution);
}

export function deriveRunProjectionFreshness(
  generatedAt: string,
  execution: RunProjection["state"]["execution"],
  nowMs = Date.now(),
): {
  freshness: RunProjectionFreshness;
  freshnessLabel: RunProjectionFreshnessLabel;
  terminal: boolean;
} {
  const generatedAtMs = Date.parse(generatedAt);
  if (Number.isNaN(generatedAtMs)) {
    throw new RunProjectionValidationError("schema_mismatch", "generated_at is not a valid timestamp");
  }
  const ageMs = Math.max(0, nowMs - generatedAtMs);
  const freshness: RunProjectionFreshness =
    ageMs < 10 * 60 * 1000 ? "fresh" : ageMs < 24 * 60 * 60 * 1000 ? "stale" : "old";
  const terminal = isTerminalRunProjection(execution);
  return {
    freshness,
    freshnessLabel: terminal && freshness === "old" ? "final" : freshness,
    terminal,
  };
}

function buildValidResult(
  mode: RunProjectionLoadResult["mode"],
  projectionState: RunProjectionState,
  projectionPath: string,
  projection: RunProjection,
  nowMs: number,
): RunProjectionLoadResult {
  const freshness = deriveRunProjectionFreshness(
    projection.generated_at,
    projection.state.execution,
    nowMs,
  );
  const stateMessage =
    mode === "fixture"
      ? "The production projection is missing; explicit fixture fallback is active."
      : freshness.freshnessLabel === "final"
        ? "This projection is old and its execution state is terminal; treat it as a final or stale record."
        : `Run projection is ${freshness.freshness}.`;
  return {
    mode,
    projectionState,
    projectionPath,
    generatedAt: projection.generated_at,
    freshness: freshness.freshness,
    freshnessLabel: freshness.freshnessLabel,
    terminal: freshness.terminal,
    errorClass: mode === "fixture" ? "missing_path" : null,
    stateMessage,
    data: projection,
  };
}

function buildInvalidResult(
  projectionPath: string,
  projectionState: Exclude<RunProjectionState, "valid">,
  errorClass: RunProjectionErrorClass,
  stateMessage: string,
): RunProjectionLoadResult {
  return {
    mode: "snapshot",
    projectionState,
    projectionPath,
    generatedAt: null,
    freshness: null,
    freshnessLabel: null,
    terminal: false,
    errorClass,
    stateMessage,
    data: null,
  };
}

// A future producer is a dedicated run-projection exporter CLI invoked by named
// lifecycle call sites, including run-record-create and the completion notifier.
export async function loadRunProjection(
  runId: string,
  options: LoadRunProjectionOptions = {},
): Promise<RunProjectionLoadResult> {
  if (!RUN_ID_PATTERN.test(runId)) {
    return buildInvalidResult(
      RUN_PROJECTION_ROOT,
      "invalid",
      "invalid_run_id",
      "The requested run ID is not canonical.",
    );
  }

  const rootPath = options.rootPath ?? RUN_PROJECTION_ROOT;
  const projectionPath = join(rootPath, `${runId}.json`);
  let raw: string;
  try {
    raw = await readFile(projectionPath, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      if (options.fixtureFallback) {
        try {
          const fixture = parseRunProjection(options.fixtureFallback);
          return buildValidResult(
            "fixture",
            "missing",
            projectionPath,
            fixture,
            options.nowMs ?? Date.now(),
          );
        } catch (fixtureError) {
          const errorClass =
            fixtureError instanceof RunProjectionValidationError
              ? fixtureError.errorClass
              : "schema_mismatch";
          return buildInvalidResult(
            projectionPath,
            "invalid",
            errorClass,
            "The explicit fixture fallback did not validate.",
          );
        }
      }
      return buildInvalidResult(
        projectionPath,
        "missing",
        "missing_path",
        "No run projection file is available and no fixture fallback was supplied.",
      );
    }
    return buildInvalidResult(
      projectionPath,
      "invalid",
      "read_error",
      "The run projection could not be read safely.",
    );
  }

  try {
    const projection = parseRunProjectionJson(raw);
    return buildValidResult(
      "snapshot",
      "valid",
      projectionPath,
      projection,
      options.nowMs ?? Date.now(),
    );
  } catch (error) {
    const errorClass =
      error instanceof RunProjectionValidationError ? error.errorClass : "schema_mismatch";
    return buildInvalidResult(
      projectionPath,
      "invalid",
      errorClass,
      "The run projection was refused; raw input was not exposed.",
    );
  }
}
