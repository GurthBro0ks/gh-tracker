import {
  RUN_PROJECTION_FIXTURES,
  type RunProjectionFixtureName,
} from "../../../lib/run-projection-fixtures";
import {
  RunProjectionValidationError,
  deriveRunProjectionFreshness,
  parseRunProjection,
  type RunProjection,
  type RunProjectionFreshnessLabel,
} from "../../../lib/run-projection";

export const INVALID_PROJECTION_FIXTURE_ID =
  "run_20260714T140000000006Z_00000000000000000000000000000006";
const CANONICAL_RUN_ID_PATTERN = /^run_[0-9]{8}T[0-9]{12}Z_[0-9a-f]{32}$/;

const FIXTURE_ORDER: RunProjectionFixtureName[] = [
  "completed_with_continuation",
  "fixture_flagged",
  "superseded",
  "completed_owner_qa_pending",
  "active",
];

export type RunWorkspaceFixture = {
  kind: "valid";
  projection: RunProjection;
  freshnessLabel: RunProjectionFreshnessLabel;
  terminal: boolean;
};

export type InvalidRunWorkspaceFixture = {
  kind: "invalid";
  runId: string;
  errorClass: string;
  message: string;
};

export type RunWorkspaceFixtureResult =
  | RunWorkspaceFixture
  | InvalidRunWorkspaceFixture
  | { kind: "missing"; runId: string };

function asWorkspaceFixture(projection: RunProjection, nowMs = Date.now()): RunWorkspaceFixture {
  const freshness = deriveRunProjectionFreshness(
    projection.generated_at,
    projection.state.execution,
    nowMs,
  );
  return {
    kind: "valid",
    projection,
    freshnessLabel: freshness.freshnessLabel,
    terminal: freshness.terminal,
  };
}

export function isCanonicalRunId(runId: string): boolean {
  return CANONICAL_RUN_ID_PATTERN.test(runId);
}

export function listRunWorkspaceFixtures(nowMs = Date.now()): RunWorkspaceFixture[] {
  return FIXTURE_ORDER.map((name) => asWorkspaceFixture(RUN_PROJECTION_FIXTURES[name], nowMs));
}

export function getRunWorkspaceFixture(
  runId: string,
  nowMs = Date.now(),
): RunWorkspaceFixtureResult {
  const fixture = Object.values(RUN_PROJECTION_FIXTURES).find(
    (candidate) => candidate.run.run_id === runId,
  );
  if (fixture) return asWorkspaceFixture(fixture, nowMs);

  if (runId === INVALID_PROJECTION_FIXTURE_ID) {
    const invalidFixture = {
      ...RUN_PROJECTION_FIXTURES.active,
      run: { ...RUN_PROJECTION_FIXTURES.active.run, run_id: runId },
      links: { ...RUN_PROJECTION_FIXTURES.active.links, workspace_path: `/runs/${runId}` },
      unexpected_canonical_fact: "must be refused",
    };
    try {
      parseRunProjection(invalidFixture);
    } catch (error) {
      return {
        kind: "invalid",
        runId,
        errorClass:
          error instanceof RunProjectionValidationError ? error.errorClass : "schema_mismatch",
        message: "This synthetic projection was refused; raw invalid input is not displayed.",
      };
    }
  }

  return { kind: "missing", runId };
}

export function buildContinuationText(projection: RunProjection): string | null {
  const continuation = projection.continuation;
  if (!continuation) return null;

  const list = (values: string[]) => (values.length ? values.join(" | ") : "none");
  return [
    `RUN_ID=${continuation.run_id}`,
    `PROJECT=${continuation.project}`,
    `REPOSITORY_PATH=${continuation.repository_path}`,
    `ACCEPTED_COMMIT=${continuation.accepted_commit ?? "UNKNOWN"}`,
    `MACHINE=${continuation.machine}`,
    `CURRENT_STAGE=${continuation.current_stage}`,
    `PROOF_DIR=${continuation.proof_dir ?? "UNKNOWN"}`,
    `REPORT_URL=${continuation.report_url ?? "UNKNOWN"}`,
    `WORKSPACE_URL=${continuation.workspace_url}`,
    `WHAT_PASSED=${continuation.what_passed}`,
    `WHAT_FAILED=${continuation.what_failed}`,
    `BLOCKERS=${list(continuation.blockers)}`,
    `UNRESOLVED_QUESTIONS=${list(continuation.unresolved_questions)}`,
    `MANUAL_QA_STATE=${continuation.manual_qa_state}`,
    `AUTHORITY_STATUS=${continuation.authority_status}`,
    `PUSH_AUTHORIZED=${continuation.push_authorized ? "yes" : "no"}`,
    `DEPLOY_AUTHORIZED=${continuation.deploy_authorized ? "yes" : "no"}`,
    `RESTART_AUTHORIZED=${continuation.restart_authorized ? "yes" : "no"}`,
    `PROHIBITED_ACTIONS=${list(continuation.prohibited_actions)}`,
    `NEXT_BOUNDED_MISSION=${continuation.next_bounded_mission}`,
    `REQUIRED_STARTUP_FILES=${list(continuation.required_startup_files)}`,
    `REQUIRED_VALIDATION=${list(continuation.required_validation)}`,
    `MODEL_RECOMMENDATION=${continuation.model_recommendation}`,
    `WRITER_OF_RECORD=${continuation.writer_of_record}`,
    `GENERATED_AT=${continuation.generated_at}`,
    `SOURCE_PROJECTION_DIGEST=${continuation.source_projection_digest ?? "UNKNOWN"}`,
    `HANDOFF_COMPLETE=${continuation.handoff_complete ? "yes" : "no"}`,
  ].join("\n");
}
