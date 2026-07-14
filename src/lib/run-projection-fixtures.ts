import type { RunProjection } from "./run-projection";


function defineFixture(fixture: RunProjection): RunProjection {
  return fixture;
}

export const activeRunProjectionFixture = defineFixture({
  schema_version: "run-projection.v1",
  generated_at: "2026-07-14T10:00:00Z",
  generated_by: "rw0-fixture",
  source_machine: "nuc1",
  run: {
    run_id: "run_20260714T095800000001Z_00000000000000000000000000000001",
    subject_type: "repository",
    subject_id: "rw0-synthetic@0000000000000000000000000000000000000000",
    project_id: "rw0-synthetic",
    phase: "rw0-synthetic-active",
    machine: "NUC1",
    model: null,
    actor: "synthetic-agent",
    created_at: "2026-07-14T09:58:00Z",
    completed_at: null,
    duration_minutes: null,
    duration_source: "not_recorded",
  },
  state: {
    execution: "ACTIVE",
    evidence: "PENDING",
    review: "NOT_RUN",
    acceptance: "NO_DECISION",
    owner_action: "NONE_REQUIRED",
    notification: "NOT_SENT",
    stage: "Synthetic execution in progress",
    blocked: false,
    warnings: [],
    blockers: [],
  },
  flags: {
    pushed: false,
    deployed: false,
    production_storage_active: false,
    test_fixture_only: true,
    production_acceptance_enabled: false,
  },
  validation: {
    summary: "Synthetic active fixture; validation has not run.",
    checks: [],
    deep_validation: "NOT_IMPLEMENTED",
    deep_validation_at: null,
  },
  evidence: {
    summary: "Synthetic evidence is incomplete while the fixture run is active.",
    status: "NOT_REVERIFIED",
    checked_at: null,
    proof_dir: "/tmp/rw0-fixture-active",
  },
  artifacts: {
    count: 0,
    displayed_files: [],
    filter_explanation: "No synthetic artifacts are listed for the active fixture.",
  },
  acceptance: {
    read_at: null,
    acceptance_id: null,
    scope: null,
    limitations: ["Synthetic fixture only; no authority or acceptance is asserted."],
    superseded_by: null,
    source: "not_production_active",
  },
  links: {
    report_url: null,
    workspace_path: "/runs/run_20260714T095800000001Z_00000000000000000000000000000001",
  },
  next_action: "Allow the synthetic run to finish before reviewing fixture validation.",
  continuation: null,
  integrity: {
    source_refs: ["rw0-fixture:synthetic-only"],
    digest: null,
  },
});

export const completedOwnerQaPendingRunProjectionFixture = defineFixture({
  ...activeRunProjectionFixture,
  generated_at: "2026-07-14T11:00:00Z",
  run: {
    ...activeRunProjectionFixture.run,
    run_id: "run_20260714T100000000002Z_00000000000000000000000000000002",
    phase: "rw0-synthetic-owner-qa-pending",
    model: "GPT/Codex synthetic",
    created_at: "2026-07-14T10:00:00Z",
    completed_at: "2026-07-14T10:30:00Z",
    duration_minutes: 30,
    duration_source: "synthetic-fixture",
  },
  state: {
    execution: "COMPLETED",
    evidence: "CAPTURED",
    review: "PASS",
    acceptance: "NO_DECISION",
    owner_action: "OWNER_QA_PENDING",
    notification: "NOT_SENT",
    stage: "Synthetic technical validation complete; owner QA pending",
    blocked: false,
    warnings: [],
    blockers: [],
  },
  validation: {
    summary: "Synthetic checks: 2 passed, 0 failed, 2 total.",
    checks: [
      {
        id: "synthetic-focused",
        name: "Synthetic focused checks",
        status: "PASS",
        passed: 2,
        failed: 0,
        total: 2,
        source_artifact: "focused-pytest.txt",
      },
    ],
    deep_validation: "NOT_IMPLEMENTED",
    deep_validation_at: null,
  },
  evidence: {
    summary: "Synthetic fixture evidence is present but is not production evidence.",
    status: "CAPTURED",
    checked_at: "2026-07-14T10:31:00Z",
    proof_dir: "/tmp/rw0-fixture-owner-qa-pending",
  },
  artifacts: {
    count: 2,
    displayed_files: ["focused-pytest.txt", "manual-qa-checklist.md"],
    filter_explanation: "Only synthetic fixture artifact names are displayed.",
  },
  acceptance: {
    read_at: null,
    acceptance_id: null,
    scope: null,
    limitations: ["Technical PASS is not owner acceptance."],
    superseded_by: null,
    source: "not_production_active",
  },
  links: {
    report_url:
      "https://harness.slimyai.xyz/reports/sessions/report-fixture-run-workspace-rw1.json",
    workspace_path: "/runs/run_20260714T100000000002Z_00000000000000000000000000000002",
  },
  next_action: "Owner reviews the synthetic fixture; no acceptance decision has been made.",
  integrity: {
    source_refs: ["rw0-fixture:synthetic-only", "fixture-checks:synthetic"],
    digest: null,
  },
});

export const supersededRunProjectionFixture = defineFixture({
  ...completedOwnerQaPendingRunProjectionFixture,
  generated_at: "2026-07-14T12:00:00Z",
  run: {
    ...completedOwnerQaPendingRunProjectionFixture.run,
    run_id: "run_20260714T090000000003Z_00000000000000000000000000000003",
    phase: "rw0-synthetic-superseded",
    created_at: "2026-07-14T09:00:00Z",
    completed_at: "2026-07-14T09:20:00Z",
    duration_minutes: 20,
  },
  state: {
    ...completedOwnerQaPendingRunProjectionFixture.state,
    acceptance: "SUPERSEDED",
    owner_action: "DONE",
    stage: "Synthetic superseded fixture state",
    warnings: ["SUPERSEDED is fixture data and carries no production authority."],
  },
  validation: {
    summary: "Synthetic checks: 1 passed, 0 failed, 1 total.",
    checks: [
      {
        id: "synthetic-contract",
        name: "Synthetic contract check",
        status: "PASS",
        passed: 1,
        failed: 0,
        total: 1,
        source_artifact: "synthetic-contract.txt",
      },
    ],
    deep_validation: "NOT_IMPLEMENTED",
    deep_validation_at: null,
  },
  evidence: {
    summary: "Synthetic fixture evidence only.",
    status: "CAPTURED",
    checked_at: "2026-07-14T09:21:00Z",
    proof_dir: "/tmp/rw0-fixture-superseded",
  },
  artifacts: {
    count: 1,
    displayed_files: ["synthetic-contract.txt"],
    filter_explanation: "Only a synthetic artifact name is displayed.",
  },
  acceptance: {
    read_at: null,
    acceptance_id: "synthetic-acceptance-fixture-0003",
    scope: "synthetic-fixture-only",
    limitations: ["This superseded state is fixture-only and is not a production decision."],
    superseded_by: "run_20260714T100000000002Z_00000000000000000000000000000002",
    source: "not_production_active",
  },
  links: {
    report_url: null,
    workspace_path: "/runs/run_20260714T090000000003Z_00000000000000000000000000000003",
  },
  next_action: "Use the newer synthetic fixture when testing superseded-state navigation.",
  integrity: {
    source_refs: ["rw0-fixture:synthetic-only"],
    digest: null,
  },
});

export const fixtureFlaggedRunProjectionFixture = defineFixture({
  ...activeRunProjectionFixture,
  generated_at: "2026-07-14T13:00:00Z",
  run: {
    ...activeRunProjectionFixture.run,
    run_id: "run_20260714T125900000004Z_00000000000000000000000000000004",
    phase: "rw0-synthetic-fixture-flags",
    actor: null,
    created_at: "2026-07-14T12:59:00Z",
  },
  state: {
    execution: "CREATED",
    evidence: "UNKNOWN",
    review: "UNKNOWN",
    acceptance: "UNKNOWN",
    owner_action: "UNKNOWN",
    notification: "UNKNOWN",
    stage: null,
    blocked: false,
    warnings: ["TEST_FIXTURE_ONLY=true", "production_acceptance_enabled=false"],
    blockers: [],
  },
  flags: {
    pushed: null,
    deployed: null,
    production_storage_active: false,
    test_fixture_only: true,
    production_acceptance_enabled: false,
  },
  validation: {
    summary: "UNKNOWN values remain explicit in this synthetic fixture.",
    checks: [],
    deep_validation: "UNAVAILABLE",
    deep_validation_at: null,
  },
  evidence: {
    summary: "No production evidence exists for this synthetic fixture.",
    status: "UNKNOWN",
    checked_at: null,
    proof_dir: "/tmp/rw0-fixture-flags",
  },
  artifacts: {
    count: 0,
    displayed_files: [],
    filter_explanation: "Synthetic fixture contains no artifacts.",
  },
  acceptance: {
    read_at: null,
    acceptance_id: null,
    scope: null,
    limitations: ["Fixture flags must be rendered verbatim; production acceptance is disabled."],
    superseded_by: null,
    source: "not_production_active",
  },
  links: {
    report_url: null,
    workspace_path: "/runs/run_20260714T125900000004Z_00000000000000000000000000000004",
  },
  next_action: "Display fixture-only and production-disabled markers without coercing UNKNOWN.",
});

export const completedWithContinuationRunProjectionFixture = defineFixture({
  ...completedOwnerQaPendingRunProjectionFixture,
  generated_at: "2026-07-14T14:00:00Z",
  run: {
    ...completedOwnerQaPendingRunProjectionFixture.run,
    run_id: "run_20260714T133000000005Z_00000000000000000000000000000005",
    phase: "rw0-synthetic-completed-with-continuation",
    created_at: "2026-07-14T13:30:00Z",
    completed_at: "2026-07-14T13:50:00Z",
    duration_minutes: 20,
  },
  validation: {
    summary: "Synthetic checks: 2 passed, 0 failed, 2 total.",
    checks: [
      {
        id: "synthetic-continuation",
        name: "Synthetic continuation fixture check",
        status: "PASS",
        passed: 2,
        failed: 0,
        total: 2,
        source_artifact: "synthetic-continuation.txt",
      },
    ],
    deep_validation: "NOT_IMPLEMENTED",
    deep_validation_at: null,
  },
  evidence: {
    summary: "Synthetic fixture evidence only; no production proof is referenced.",
    status: "CAPTURED",
    checked_at: "2026-07-14T13:51:00Z",
    proof_dir: "/tmp/rw0-fixture-completed-with-continuation",
  },
  artifacts: {
    count: 1,
    displayed_files: ["synthetic-continuation.txt"],
    filter_explanation: "Only a synthetic fixture artifact name is displayed.",
  },
  acceptance: {
    read_at: null,
    acceptance_id: null,
    scope: null,
    limitations: ["Technical PASS is not owner acceptance; copied authorization is not transitive."],
    superseded_by: null,
    source: "not_production_active",
  },
  links: {
    report_url: null,
    workspace_path: "/runs/run_20260714T133000000005Z_00000000000000000000000000000005",
  },
  next_action: "Owner reviews the synthetic continuation shape; do not treat it as authorization.",
  continuation: {
    run_id: "run_20260714T133000000005Z_00000000000000000000000000000005",
    project: "rw0-synthetic",
    repository_path: "/tmp/rw0-fixture/repository",
    accepted_commit: "0000000000000000000000000000000000000000",
    machine: "NUC1",
    current_stage: "Synthetic completed state with owner QA pending.",
    proof_dir: "/tmp/rw0-fixture-completed-with-continuation",
    report_url: null,
    workspace_url:
      "https://habitat.slimyai.xyz/runs/run_20260714T133000000005Z_00000000000000000000000000000005",
    what_passed: "Synthetic fixture contract checks passed.",
    what_failed: "No synthetic fixture checks failed.",
    blockers: [],
    unresolved_questions: ["Owner review remains pending for this synthetic fixture."],
    manual_qa_state: "pending_owner_review",
    authority_status: "not_production_active",
    push_authorized: false,
    deploy_authorized: false,
    restart_authorized: false,
    prohibited_actions: [
      "Copied authorization is not transitive; obtain fresh live-owner authorization for any new action.",
      "Do not push, deploy, restart services, or activate production storage from this fixture.",
    ],
    next_bounded_mission:
      "Use this synthetic object only to test later fixture-mode continuation rendering.",
    required_startup_files: [
      "AGENTS.md",
      "claude-progress.md",
      "feature_list.json",
      "PROJECT_NARRATIVE.md",
      "server-state.md",
      "init.sh",
    ],
    required_validation: [
      "Confirm current machine matches continuation machine.",
      "Obtain fresh live-owner authorization before any hard-to-reverse action.",
    ],
    model_recommendation: "GPT/Codex synthetic",
    writer_of_record: "Synthetic fixture only; no writer authority is conveyed.",
    generated_at: "2026-07-14T14:00:00Z",
    source_projection_digest: null,
    handoff_complete: false,
  },
  integrity: {
    source_refs: ["rw0-fixture:synthetic-only", "continuation-fixture:synthetic-only"],
    digest: null,
  },
});

export const RUN_PROJECTION_FIXTURES = {
  active: activeRunProjectionFixture,
  completed_owner_qa_pending: completedOwnerQaPendingRunProjectionFixture,
  superseded: supersededRunProjectionFixture,
  fixture_flagged: fixtureFlaggedRunProjectionFixture,
  completed_with_continuation: completedWithContinuationRunProjectionFixture,
} as const;

export type RunProjectionFixtureName = keyof typeof RUN_PROJECTION_FIXTURES;

export function cloneRunProjectionFixture(name: RunProjectionFixtureName): RunProjection {
  return structuredClone(RUN_PROJECTION_FIXTURES[name]);
}
