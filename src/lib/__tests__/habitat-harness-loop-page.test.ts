import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { renderToStaticMarkup } from "react-dom/server";

const getSession = vi.fn();
const requireOwner = vi.fn();
const loadHabitatLoopStatusSnapshot = vi.fn();

vi.mock("@/lib/auth/session", () => ({ getSession, requireOwner }));
vi.mock("@/lib/harness-loop-status-snapshot", () => ({ loadHabitatLoopStatusSnapshot }));

const repoRoot = process.cwd();

function makeSnapshotResult(overrides: Record<string, unknown> = {}) {
  return {
    mode: "fixture",
    snapshotState: "missing",
    snapshotPath: "/home/slimy/harness-logs/loop-status-snapshot/latest.json",
    generatedAt: null,
    stateLabel: "SNAPSHOT MISSING",
    stateMessage: "No sanitized loop-status snapshot file is available yet. Fixture fallback is active.",
    data: {
      mode: "fixture_only",
      generatedAt: "2026-06-08T16:40:48Z",
      summary: {
        totalItems: 3,
        byStatus: { OK: 1, WARN: 1, BLOCKED: 1, FAIL: 0, UNKNOWN: 0 },
        byGate: { PASS_ELIGIBLE: 1, PENDING: 1, UNKNOWN: 1 },
        highestRiskState: "BLOCKED",
        hasBlockers: true,
        hasFailures: false,
      },
      items: [
        {
          phase: "sample-phase-ready-for-owner-qa",
          title: "Sample ready-for-owner-QA item",
          status: "OK",
          proofGateVerdict: "PASS_ELIGIBLE",
          manualQaStatus: "pending",
          nextRequiredGate: "owner manual QA",
          blockedReason: "",
          updatedAt: "2026-06-08T15:02:00Z",
        },
        {
          phase: "sample-phase-on-hold",
          title: "Sample item on hold",
          status: "BLOCKED",
          proofGateVerdict: "UNKNOWN",
          manualQaStatus: "not_started",
          nextRequiredGate: "unblock queue item",
          blockedReason: "Sample blocked reason for fixture-only preview.",
          updatedAt: "2026-06-08T13:45:00Z",
        },
      ],
      safety: {
        shellExecutionPresent: false,
        mutationControlsPresent: false,
        requestTimeShellRequired: false,
        secretsRedacted: true,
        ownerGateRequiredForUi: true,
      },
      footerSummary: [
        "Live controls are not implemented.",
        "This page reads a sanitized static snapshot only.",
        "Shell execution is not present in this route.",
        "Fixture-only mode is active.",
      ],
    },
    ...overrides,
  };
}

describe("Habitat /harness/loop fixture-only page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ sub: "u1", email: "owner@test.com", role: "owner", iat: 0, exp: 9999999999 });
    requireOwner.mockReturnValue({ sub: "u1", email: "owner@test.com", role: "owner", iat: 0, exp: 9999999999 });
    loadHabitatLoopStatusSnapshot.mockResolvedValue(makeSnapshotResult());
  });

  it("renders the missing-snapshot fallback and required sections", async () => {
    const { default: HabitatLoopStatusPage } = await import("../../app/harness/loop/page");
    const html = renderToStaticMarkup(await HabitatLoopStatusPage());

    expect(html).toContain("Habitat Harness Loop Status");
    expect(html).toContain("READ ONLY");
    expect(html).toContain("NO MUTATION CONTROLS");
    expect(html).toContain("FIXTURE ONLY");
    expect(html).toContain("SNAPSHOT MISSING");
    expect(html).toContain("Summary");
    expect(html).toContain("Loop Items");
    expect(html).toContain("Safety Summary");
    expect(html).toContain("Sample ready-for-owner-QA item");
    expect(html).toContain("Sample blocked reason for fixture-only preview.");
    expect(html).toContain("Shell execution is not present in this route.");
    expect(html).not.toContain("Refreshing this snapshot is manual-only");
  });

  it("renders snapshot mode when a valid snapshot exists", async () => {
    loadHabitatLoopStatusSnapshot.mockResolvedValue(makeSnapshotResult({
      mode: "snapshot",
      snapshotState: "fresh",
      stateLabel: "SNAPSHOT MODE",
      stateMessage: "Sanitized loop-status snapshot data is active.",
      generatedAt: "2026-06-08T19:16:55Z",
    }));
    const { default: HabitatLoopStatusPage } = await import("../../app/harness/loop/page");
    const html = renderToStaticMarkup(await HabitatLoopStatusPage());

    expect(html).toContain("SNAPSHOT MODE");
    expect(html).not.toContain("FIXTURE ONLY");
    expect(html).toContain("Sanitized loop-status snapshot data is active.");
    expect(html).not.toContain("Refreshing this snapshot is manual-only");
  });

  it("renders a stale snapshot warning with a manual-refresh runbook pointer", async () => {
    loadHabitatLoopStatusSnapshot.mockResolvedValue(makeSnapshotResult({
      mode: "snapshot",
      snapshotState: "stale",
      stateLabel: "STALE SNAPSHOT",
      stateMessage: "Sanitized loop-status snapshot data is stale but still safe to display.",
    }));
    const { default: HabitatLoopStatusPage } = await import("../../app/harness/loop/page");
    const html = renderToStaticMarkup(await HabitatLoopStatusPage());

    expect(html).toContain("STALE SNAPSHOT");
    expect(html).toContain("Sanitized loop-status snapshot data is stale but still safe to display.");
    expect(html).toContain("Refreshing this snapshot is manual-only");
    expect(html).toContain("manual-loop-status-snapshot-workflow.md");
  });

  it("renders a safe invalid snapshot failure", async () => {
    loadHabitatLoopStatusSnapshot.mockResolvedValue(makeSnapshotResult({
      snapshotState: "invalid",
      stateLabel: "SNAPSHOT INVALID",
      stateMessage: "The loop-status snapshot schema did not validate. Fixture fallback is active.",
    }));
    const { default: HabitatLoopStatusPage } = await import("../../app/harness/loop/page");
    const html = renderToStaticMarkup(await HabitatLoopStatusPage());

    expect(html).toContain("SNAPSHOT INVALID");
    expect(html).toContain("Fixture fallback is active.");
    expect(html).not.toContain("Refreshing this snapshot is manual-only");
  });

  it("renders an empty state when there are no items", async () => {
    loadHabitatLoopStatusSnapshot.mockResolvedValue(makeSnapshotResult({
      data: {
        ...makeSnapshotResult().data,
        items: [],
        summary: { totalItems: 0, byStatus: { OK: 0, WARN: 0, BLOCKED: 0, FAIL: 0, UNKNOWN: 0 }, byGate: {}, highestRiskState: "UNKNOWN", hasBlockers: false, hasFailures: false },
      },
    }));
    const { default: HabitatLoopStatusPage } = await import("../../app/harness/loop/page");
    const html = renderToStaticMarkup(await HabitatLoopStatusPage());

    expect(html).toContain("No loop items are present in this snapshot.");
  });

  it("redirects to /login when there is no session", async () => {
    getSession.mockResolvedValue(null);
    const { default: HabitatLoopStatusPage } = await import("../../app/harness/loop/page");

    await expect(HabitatLoopStatusPage()).rejects.toBeTruthy();
  });

  it("keeps the route fixture-only and free of action buttons, forms, or mutation copy", () => {
    const pageSource = readFileSync(join(repoRoot, "src/app/harness/loop/page.tsx"), "utf8");

    expect(pageSource).toContain("cannot");
    expect(pageSource).toContain("mutate queue or proof state");
    expect(pageSource).not.toContain("<form");
    expect(pageSource).not.toContain("<button");
    expect(pageSource).not.toContain("type=\"button\"");
    expect(pageSource).not.toContain("type=\"submit\"");
    expect(pageSource).not.toContain("Retry</");
    expect(pageSource).not.toContain("Approve</");
    expect(pageSource).not.toContain("Reject</");
    expect(pageSource).not.toContain("Re-run</");
    expect(pageSource).not.toContain("Rerun</");
    expect(pageSource).not.toContain("Delete</");
    expect(pageSource).not.toContain("Apply</");
  });

  it("introduces no shell execution imports, no request-time shell, and no disallowed raw fields", () => {
    const pageSource = readFileSync(join(repoRoot, "src/app/harness/loop/page.tsx"), "utf8");
    const snapshotSource = readFileSync(join(repoRoot, "src/lib/harness-loop-status-snapshot.ts"), "utf8");

    for (const source of [pageSource, snapshotSource]) {
      expect(source).not.toContain("child_process");
      expect(source).not.toContain("exec(");
      expect(source).not.toContain("spawn(");
      expect(source).not.toContain("shelljs");
      expect(source).not.toContain("execa");
      expect(source).not.toContain("fetch(\"/api/harness");
      expect(source).not.toContain("fetch('/api/harness");
    }

    for (const disallowed of ["target_machine", "target_repo", "model_recommendation", "glm_thinking_level", "safety_level", "proof_dir", "warnings_count", "reasons_count"]) {
      expect(pageSource).not.toContain(disallowed);
    }

    expect(pageSource).toContain("overflow-x-hidden");
  });
});
