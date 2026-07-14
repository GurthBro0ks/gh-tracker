import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { proxy } from "../../../../proxy";
import { RUN_PROJECTION_FIXTURES } from "../../../lib/run-projection-fixtures";
import {
  INVALID_PROJECTION_FIXTURE_ID,
  buildContinuationText,
  getRunWorkspaceFixture,
  listRunWorkspaceFixtures,
} from "../_lib/fixtures";
import {
  RunWorkspaceDetail,
  RunWorkspaceIndex,
  RunWorkspaceUnavailable,
} from "../_components/run-workspace";

const getSession = vi.fn();
const requireOwner = vi.fn();

vi.mock("@/lib/auth/session", () => ({ getSession, requireOwner }));

const ownerSession = {
  sub: "owner-1",
  email: "owner@example.com",
  role: "owner",
  iat: 0,
  exp: 9_999_999_999,
};
const repoRoot = process.cwd();

describe("fixture-only Run Workspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue(ownerSession);
    requireOwner.mockReturnValue(ownerSession);
  });

  it("renders a bounded protected fixture index with six axes per run", () => {
    const fixtures = listRunWorkspaceFixtures(Date.parse("2026-07-14T14:05:00Z"));
    const html = renderToStaticMarkup(<RunWorkspaceIndex fixtures={fixtures} />);

    expect(fixtures).toHaveLength(5);
    expect(html).toContain("Latest synthetic run-projection fixtures");
    expect(html).toContain("reads no production run data");
    expect(html).toContain("5 of 50");
    expect(html).toContain("Invalid projection fixture");
    for (const projection of Object.values(RUN_PROJECTION_FIXTURES)) {
      expect(html).toContain(projection.run.run_id);
      expect(html).toContain(projection.run.phase);
      for (const value of [
        projection.state.execution,
        projection.state.evidence,
        projection.state.review,
        projection.state.acceptance,
        projection.state.owner_action,
        projection.state.notification,
      ]) {
        expect(html).toContain(value.replaceAll("_", " "));
      }
    }
  });

  it.each(Object.values(RUN_PROJECTION_FIXTURES).map((projection) => [projection.run.run_id, projection] as const))(
    "renders all required sections and honest fixture markers for %s",
    (runId, projection) => {
      const fixture = getRunWorkspaceFixture(runId, Date.parse("2026-07-14T14:05:00Z"));
      expect(fixture.kind).toBe("valid");
      if (fixture.kind !== "valid") throw new Error("expected valid fixture");
      const html = renderToStaticMarkup(<RunWorkspaceDetail fixture={fixture} />);

      expect(html).toContain(projection.run.phase);
      expect(html).toContain("Six-axis run status");
      expect(html).toContain("TEST_FIXTURE_ONLY=true");
      expect(html).toContain("production_acceptance_enabled=false");
      expect(html).toContain("production_storage_active=false");
      expect(html).toContain(`Owner acceptance: ${projection.state.acceptance}`);
      expect(html).toContain("Next recommended action");
      expect(html).toContain(projection.next_action ?? "No next action was recorded.");
      expect(html).toContain("Validation");
      expect(html).toContain("Evidence");
      expect(html).toContain("Artifacts");
      expect(html).toContain("Warnings / blockers");
      expect(html).toContain("Continuation handoff");
      expect(html).toContain("Raw JSON");
      expect(html).toContain("Sanitized run-projection.v1 fixture only");
      expect(html).toContain("Permanent report not yet available");
    },
  );

  it("renders the fixture continuation and a stable, fail-closed copy block", () => {
    const projection = RUN_PROJECTION_FIXTURES.completed_with_continuation;
    const fixture = getRunWorkspaceFixture(projection.run.run_id, Date.parse("2026-07-14T14:05:00Z"));
    if (fixture.kind !== "valid") throw new Error("expected valid fixture");
    const html = renderToStaticMarkup(<RunWorkspaceDetail fixture={fixture} />);
    const copyText = buildContinuationText(projection);

    expect(copyText).not.toBeNull();
    expect(copyText).toContain(`RUN_ID=${projection.run.run_id}`);
    expect(copyText).toContain("PUSH_AUTHORIZED=no");
    expect(copyText).toContain("DEPLOY_AUTHORIZED=no");
    expect(copyText).toContain("RESTART_AUTHORIZED=no");
    expect(copyText).toContain("HANDOFF_COMPLETE=no");
    expect(html).toContain("Copy continuation");
    expect(html).toContain("Copied authorization is not transitive");
  });

  it("builds permanent report links only through the existing owner SSO bridge", () => {
    const fixture = getRunWorkspaceFixture(
      RUN_PROJECTION_FIXTURES.completed_owner_qa_pending.run.run_id,
      Date.parse("2026-07-14T14:05:00Z"),
    );
    if (fixture.kind !== "valid") throw new Error("expected valid fixture");
    const withReport = structuredClone(fixture);
    withReport.projection.links.report_url =
      "https://harness.slimyai.xyz/reports/sessions/synthetic-rw1-report.json";
    const html = renderToStaticMarkup(<RunWorkspaceDetail fixture={withReport} />);

    expect(html).toContain("Permanent report");
    expect(html).toContain(
      "/reports/sso-bridge?returnTo=https%3A%2F%2Fharness.slimyai.xyz%2Freports%2Fsessions%2Fsynthetic-rw1-report.json",
    );
    expect(html).not.toContain('href="https://harness.slimyai.xyz/reports/sessions');
  });

  it("fails closed for unknown and invalid fixture IDs without raw projection leakage", () => {
    const missing = getRunWorkspaceFixture("not-a-canonical-run-id");
    const invalid = getRunWorkspaceFixture(INVALID_PROJECTION_FIXTURE_ID);

    expect(missing).toEqual({ kind: "missing", runId: "not-a-canonical-run-id" });
    expect(invalid).toMatchObject({
      kind: "invalid",
      errorClass: "schema_mismatch",
      message: expect.stringContaining("raw invalid input is not displayed"),
    });
    expect(JSON.stringify(invalid)).not.toContain("unexpected_canonical_fact");
    expect(JSON.stringify(invalid)).not.toContain("must be refused");
  });

  it("renders bounded unknown and invalid views without inferred run content", () => {
    const missing = getRunWorkspaceFixture("not-a-canonical-run-id");
    const invalid = getRunWorkspaceFixture(INVALID_PROJECTION_FIXTURE_ID);
    if (missing.kind === "valid" || invalid.kind !== "invalid") {
      throw new Error("expected missing and invalid fixture results");
    }
    const missingHtml = renderToStaticMarkup(<RunWorkspaceUnavailable result={missing} />);
    const invalidHtml = renderToStaticMarkup(<RunWorkspaceUnavailable result={invalid} />);

    expect(missingHtml).toContain("Run not found");
    expect(missingHtml).toContain("Nothing is inferred and no run content is shown.");
    expect(invalidHtml).toContain("Invalid projection");
    expect(invalidHtml).toContain("schema_mismatch");
    expect(invalidHtml).not.toContain("unexpected_canonical_fact");
    for (const html of [missingHtml, invalidHtml]) {
      expect(html).toContain("Open reports index");
      expect(html).toContain("/reports/sso-bridge?returnTo=");
    }
  });

  it("redirects both pages before fixture rendering when no session exists", async () => {
    getSession.mockResolvedValue(null);
    const { default: RunsPage } = await import("../page");
    const { default: RunDetailPage } = await import("../[runId]/page");

    await expect(RunsPage()).rejects.toBeTruthy();
    await expect(RunDetailPage({ params: Promise.resolve({ runId: RUN_PROJECTION_FIXTURES.active.run.run_id }) })).rejects.toBeTruthy();
    expect(requireOwner).not.toHaveBeenCalled();
  });

  it("redirects both pages when a non-owner session fails the defense-in-depth gate", async () => {
    requireOwner.mockImplementation(() => { throw new Error("forbidden"); });
    const { default: RunsPage } = await import("../page");
    const { default: RunDetailPage } = await import("../[runId]/page");

    await expect(RunsPage()).rejects.toBeTruthy();
    await expect(RunDetailPage({ params: Promise.resolve({ runId: RUN_PROJECTION_FIXTURES.active.run.run_id }) })).rejects.toBeTruthy();
  });

  it("keeps logged-out dynamic paths behind the default-deny proxy with no response body", () => {
    const response = proxy(new NextRequest(`https://habitat.slimyai.xyz/runs/${RUN_PROJECTION_FIXTURES.active.run.run_id}`));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://habitat.slimyai.xyz/login");
    expect(response.body).toBeNull();
  });

  it("keeps the implementation route-local, read-only, fixture-only, and responsive", () => {
    const files = [
      "src/app/runs/page.tsx",
      "src/app/runs/[runId]/page.tsx",
      "src/app/runs/_lib/fixtures.ts",
      "src/app/runs/_components/run-workspace.tsx",
      "src/app/runs/_components/copy-control.tsx",
    ];
    const source = files.map((file) => readFileSync(join(repoRoot, file), "utf8")).join("\n");

    expect(source).toContain("force-dynamic");
    expect(source).toContain("requireOwner");
    expect(source).toContain("overflow-x-hidden");
    expect(source).toContain("sm:grid-cols-2");
    expect(source).toContain("md:px-8");
    expect(source).toContain("min-h-11");
    expect(source).not.toContain("loadRunProjection");
    expect(source).not.toContain("RUN_PROJECTION_ROOT");
    expect(source).not.toContain("readFile(");
    expect(source).not.toContain("readFileSync(");
    expect(source).not.toContain("fetch(");
    expect(source).not.toContain("child_process");
    expect(source).not.toContain("<form");
    expect(source).not.toContain("method=\"post\"");
    expect(source).not.toContain("Approve</");
    expect(source).not.toContain("Reject</");
    expect(source).not.toContain("Restart</");
    expect(source).not.toContain("Deploy</");
    expect(source).not.toContain("Refresh now");
  });
});
