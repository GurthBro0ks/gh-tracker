import { beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { renderToStaticMarkup } from "react-dom/server";
import { habitatOpsFixture } from "../harness-ops-fixtures";

const getSession = vi.fn();
const requireOwner = vi.fn();
const loadHabitatOpsSnapshot = vi.fn();

vi.mock("@/lib/auth/session", () => ({ getSession, requireOwner }));
vi.mock("@/lib/harness-ops-snapshot", () => ({ loadHabitatOpsSnapshot }));

const repoRoot = process.cwd();

function makeSnapshotResult(overrides: Record<string, unknown> = {}) {
  return {
    mode: "fixture",
    snapshotState: "missing",
    snapshotPath: "/home/slimy/harness-logs/ops-snapshots/latest.json",
    generatedAt: null,
    stateLabel: "SNAPSHOT MISSING",
    stateMessage: "No sanitized snapshot file is available yet. Fixture fallback is active.",
    freshnessMessage: "No sanitized snapshot file is available yet. Fixture fallback is active.",
    redactionMessage: "Redaction status unavailable because no snapshot was found.",
    data: {
      mode: "fixture_only",
      generatedAt: "2026-06-08T16:40:48Z",
      sourceMachine: "nuc1-fixture",
      safetyLabels: ["READ ONLY", "DRY RUN ONLY", "NO LIVE MUTATION", "FIXTURE ONLY"],
      notification: {
        discordSend: "Disabled in fixture-only mode",
        dedupeStatus: "Sample dedupe marker state: not checked in this page",
        reportUrl: "none",
        redactionNote: "Redaction note: destination details and credentials are omitted from fixture data.",
        transportNote: "This preview is not connected to any live notification transport.",
      },
      scheduleInventory: {
        userCrontabSummary: "Sample summary: 3 user crontab entries represented in fixture data.",
        systemTimersSummary: "Sample summary: 4 system timer targets represented in fixture data.",
        readOnlyTargetCount: "6 fixture targets shown as read-only candidates.",
        noMutationNote: "No cron, timer, or service state can be changed from this page.",
        lines: [{ label: "User crontab", value: "heartbeat, watchdog, daily digest" }],
      },
      scheduleDryRun: {
        samplePlanTarget: "gh-tracker-local-snapshot-timer",
        planLines: ["managed_mode: managed_candidate"],
        enablePreview: ["WOULD_RUN: systemctl --user enable gh-tracker-local-snapshot.timer"],
        disablePreview: ["WOULD_RUN: systemctl --user disable gh-tracker-local-snapshot.timer"],
        runOncePreview: ["WOULD_RUN: systemctl --user start gh-tracker-local-snapshot.service"],
      },
      tmuxInventory: {
        sessionCount: "3 sample sessions",
        windowCount: "3 sample windows",
        paneCount: "3 sample panes",
        metadataOnlyNote: "Session, window, and pane metadata only.",
        noCaptureNote: "Pane content and scrollback are not captured in this fixture view.",
        lines: [{ label: "Session", value: "ops6-gh-tracker" }],
      },
      workspaceDryRun: {
        canonicalSessionPreview: "ops6-gh-tracker",
        previewLines: ["WOULD_RUN: tmux new-session -d -s ops6-gh-tracker -c /opt/slimy/gh-tracker -n repo"],
        copyOnlyLines: ["COPY_ONLY: git status --short"],
        noCreateReuseNote: "No create or reuse action exists here; this is preview text only.",
      },
      reports: {
        latestReport: "No live report connected in fixture-only mode.",
        expectedUrlPattern: "https://harness.slimyai.xyz/reports/sessions/...",
        adapterStatus: "Backend adapter not connected.",
      },
      footerSummary: [
        "Live controls are not implemented.",
        "Backend adapter is not connected.",
        "Shell execution is not present in this route.",
        "Fixture-only mode is active.",
      ],
    },
    ...overrides,
  };
}

describe("Habitat /ops fixture-only page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ sub: "u1", email: "owner@test.com", role: "owner", iat: 0, exp: 9999999999 });
    requireOwner.mockReturnValue({ sub: "u1", email: "owner@test.com", role: "owner", iat: 0, exp: 9999999999 });
    loadHabitatOpsSnapshot.mockResolvedValue(makeSnapshotResult());
  });

  it("renders the missing-snapshot fallback and required cards", async () => {
    const { default: HabitatOpsPage } = await import("../../app/ops/page");
    const html = renderToStaticMarkup(await HabitatOpsPage());

    expect(html).toContain("Habitat /ops");
    expect(html).toContain("READ ONLY");
    expect(html).toContain("DRY RUN ONLY");
    expect(html).toContain("NO LIVE MUTATION");
    expect(html).toContain("FIXTURE ONLY");
    expect(html).toContain("SNAPSHOT MISSING");
    expect(html).toContain("Notification Status");
    expect(html).toContain("Schedule Inventory");
    expect(html).toContain("Schedule Dry-Run");
    expect(html).toContain("Tmux Inventory");
    expect(html).toContain("Workspace Dry-Run");
    expect(html).toContain("Reports");
    expect(html).toContain("Adapter Status");
    expect(html).toContain("Shell execution is not present in this route.");
  });

  it("renders snapshot mode when a valid snapshot exists", async () => {
    loadHabitatOpsSnapshot.mockResolvedValue(makeSnapshotResult({
      mode: "snapshot",
      snapshotState: "fresh",
      stateLabel: "SNAPSHOT MODE",
      stateMessage: "Sanitized snapshot data is active.",
      freshnessMessage: "Snapshot is recent and safe to display.",
      redactionMessage: "Redaction passed; rules v1; redacted 2 field(s).",
      generatedAt: "2026-06-08T19:16:55Z",
      data: {
        ...makeSnapshotResult().data,
        sourceMachine: "nuc1",
        safetyLabels: ["READ ONLY", "DRY RUN ONLY", "NO LIVE MUTATION", "SNAPSHOT MODE"],
        reports: {
          latestReport: "Latest sample report",
          expectedUrlPattern: "https://harness.slimyai.xyz/reports/sessions/report-proof-sample.json",
          adapterStatus: "Sanitized snapshot adapter active. No live runtime command execution.",
        },
      },
    }));
    const { default: HabitatOpsPage } = await import("../../app/ops/page");
    const html = renderToStaticMarkup(await HabitatOpsPage());

    expect(html).toContain("SNAPSHOT MODE");
    expect(html).not.toContain("FIXTURE ONLY");
    expect(html).toContain("Sanitized snapshot data is active.");
    expect(html).toContain("Redaction passed; rules v1; redacted 2 field(s).");
    expect(html).toContain("Source machine (read-only)");
    expect(html).toContain("nuc1");
  });

  it("renders every multi-target item and keeps status meanings distinct", async () => {
    loadHabitatOpsSnapshot.mockResolvedValue(makeSnapshotResult({
      mode: "snapshot",
      snapshotState: "fresh",
      stateLabel: "SNAPSHOT MODE",
      data: {
        ...makeSnapshotResult().data,
        sourceMachine: "nuc1",
        scheduleDryRuns: [
          {
            scheduleId: "schedule-pass",
            targetMachine: "nuc1",
            risk: "medium",
            managedMode: "managed_candidate",
            liveEnableAllowed: true,
            liveDisableAllowed: true,
            liveRunOnceAllowed: true,
            planResult: "PASS",
            planLines: ["RESULT=PASS"],
            enableResult: "WARN",
            enablePreview: ["RESULT=WARN"],
            disableResult: "NOT_RUN",
            disablePreview: [],
            runOnceResult: "UNKNOWN",
            runOncePreview: [],
            notes: ["Read-only schedule."],
          },
          {
            scheduleId: "schedule-refused",
            targetMachine: "nuc2",
            risk: "high",
            managedMode: "read_only",
            liveEnableAllowed: false,
            liveDisableAllowed: false,
            liveRunOnceAllowed: false,
            planResult: "FAIL",
            planLines: ["RESULT=FAIL"],
            enableResult: "REFUSED",
            enablePreview: ["RESULT=REFUSED"],
            disableResult: "REFUSED",
            disablePreview: ["RESULT=REFUSED"],
            runOnceResult: "REFUSED",
            runOncePreview: ["RESULT=REFUSED"],
            notes: [],
          },
        ],
        workspaceDryRuns: [
          {
            workspaceId: "workspace-one",
            targetMachine: "nuc1",
            canonicalSessionPreview: "ops6-workspace-one",
            planResult: "PASS",
            previewLines: ["WOULD_RUN: fixture workspace one"],
            copyOnlyLines: ["COPY_ONLY: inspect workspace one"],
            notes: ["Read-only workspace."],
          },
          {
            workspaceId: "workspace-two",
            targetMachine: "nuc1",
            canonicalSessionPreview: "ops6-workspace-two",
            planResult: "WARN",
            previewLines: ["WOULD_RUN: fixture workspace two"],
            copyOnlyLines: [],
            notes: [],
          },
        ],
        tmuxSessions: [
          {
            machine: "nuc1",
            sessionName: "ops6-workspace-one",
            attached: true,
            windowCount: 2,
            paneCount: 3,
            canonical: true,
            workspaceId: "workspace-one",
            notes: ["Metadata only."],
          },
          {
            machine: "nuc1",
            sessionName: "ops6-workspace-one-similar",
            attached: false,
            windowCount: 1,
            paneCount: 1,
            canonical: false,
            workspaceId: null,
            notes: [],
          },
          {
            machine: "nuc1",
            sessionName: "ops6-attachment-state-unavailable",
            attached: null,
            windowCount: 1,
            paneCount: 1,
            canonical: false,
            workspaceId: null,
            notes: ["Attachment state was not reported."],
          },
        ],
      },
    }));
    const { default: HabitatOpsPage } = await import("../../app/ops/page");
    const html = renderToStaticMarkup(await HabitatOpsPage());

    expect(html).toContain("Total schedule targets: 2");
    expect(html).toContain("schedule-pass");
    expect(html).toContain("schedule-refused");
    expect(html).toContain("PASS");
    expect(html).toContain("WARN");
    expect(html).toContain("REFUSED");
    expect(html).toContain("FAIL");
    expect(html).toContain("UNKNOWN");
    expect(html).toContain("NOT_RUN");
    expect(html.match(/>yes<\/dd>/g)).toHaveLength(3);
    expect(html.match(/>no<\/dd>/g)).toHaveLength(3);
    expect(html).toContain("Total workspace targets: 2");
    expect(html).toContain("workspace-one");
    expect(html).toContain("workspace-two");
    expect(html).toContain("ops6-workspace-one");
    expect(html).toContain("ops6-workspace-one-similar");
    expect(html).toContain("CANONICAL");
    expect(html).toContain("NONCANONICAL");
    expect(html).toContain("ATTACHED");
    expect(html).toContain("DETACHED");
    expect(html).toContain("ATTACHMENT UNKNOWN");
    expect(html).toContain("Unassociated");
    expect(html).toContain("Source machine (read-only)");
  });

  it("renders a safe fallback when the source machine is missing", async () => {
    loadHabitatOpsSnapshot.mockResolvedValue(makeSnapshotResult({
      data: {
        ...makeSnapshotResult().data,
        sourceMachine: null,
      },
    }));
    const { default: HabitatOpsPage } = await import("../../app/ops/page");
    const html = renderToStaticMarkup(await HabitatOpsPage());

    expect(html).toContain("Source machine (read-only)");
    expect(html).toContain("not reported");
    expect(html).not.toContain("nuc1-fixture");
    expect(html).not.toContain(">undefined<");
    expect(html).not.toContain(">null<");
  });

  it("renders every ID and session from the bundled multi-target fixture", async () => {
    const fixture = structuredClone(habitatOpsFixture);
    const longPreview = `LONG_PREVIEW_${"x".repeat(500)}`;
    fixture.scheduleDryRuns?.[0]?.planLines.push(longPreview);
    loadHabitatOpsSnapshot.mockResolvedValue(makeSnapshotResult({ data: fixture }));
    const { default: HabitatOpsPage } = await import("../../app/ops/page");
    const html = renderToStaticMarkup(await HabitatOpsPage());

    for (const target of fixture.scheduleDryRuns ?? []) {
      expect(html).toContain(target.scheduleId);
    }
    for (const target of fixture.workspaceDryRuns ?? []) {
      expect(html).toContain(target.workspaceId);
    }
    for (const session of fixture.tmuxSessions ?? []) {
      expect(html).toContain(session.sessionName);
    }
    expect(html).toContain(longPreview);
    expect(html).toContain("REFUSED");
    expect(html).toContain("FAIL");
    expect(html).toContain("UNKNOWN");
    expect(html).toContain("NOT_RUN");
  });

  it("uses singular schedule and workspace fallbacks for absent or empty arrays", async () => {
    loadHabitatOpsSnapshot.mockResolvedValue(makeSnapshotResult({
      data: {
        ...makeSnapshotResult().data,
        scheduleDryRuns: [],
        workspaceDryRuns: [],
        tmuxSessions: [],
      },
    }));
    const { default: HabitatOpsPage } = await import("../../app/ops/page");
    const html = renderToStaticMarkup(await HabitatOpsPage());

    expect(html).toContain("Sample plan target");
    expect(html).toContain("gh-tracker-local-snapshot-timer");
    expect(html).toContain("Canonical preview session");
    expect(html).toContain("ops6-gh-tracker");
    expect(html).toContain("Total structured sessions: 0");
    expect(html).toContain("No structured tmux sessions reported.");
  });

  it("renders a stale snapshot warning", async () => {
    loadHabitatOpsSnapshot.mockResolvedValue(makeSnapshotResult({
      mode: "snapshot",
      snapshotState: "stale",
      stateLabel: "STALE SNAPSHOT",
      stateMessage: "Sanitized snapshot data is stale but still safe to display.",
      freshnessMessage: "Snapshot is older than the preferred freshness threshold.",
    }));
    const { default: HabitatOpsPage } = await import("../../app/ops/page");
    const html = renderToStaticMarkup(await HabitatOpsPage());

    expect(html).toContain("STALE SNAPSHOT");
    expect(html).toContain("Sanitized snapshot data is stale but still safe to display.");
  });

  it("renders a safe invalid snapshot failure", async () => {
    loadHabitatOpsSnapshot.mockResolvedValue(makeSnapshotResult({
      snapshotState: "invalid",
      stateLabel: "SNAPSHOT INVALID",
      stateMessage: "The snapshot schema did not validate. Fixture fallback is active.",
      redactionMessage: "Raw snapshot content is hidden because validation failed.",
    }));
    const { default: HabitatOpsPage } = await import("../../app/ops/page");
    const html = renderToStaticMarkup(await HabitatOpsPage());

    expect(html).toContain("SNAPSHOT INVALID");
    expect(html).toContain("Fixture fallback is active.");
    expect(html).toContain("Raw snapshot content is hidden because validation failed.");
  });

  it("renders a safe redaction-failed snapshot failure", async () => {
    loadHabitatOpsSnapshot.mockResolvedValue(makeSnapshotResult({
      snapshotState: "redaction_failed",
      stateLabel: "REDACTION FAILED",
      stateMessage: "The snapshot failed sanitization checks. Fixture fallback is active.",
      redactionMessage: "Snapshot content is hidden because redaction did not pass.",
    }));
    const { default: HabitatOpsPage } = await import("../../app/ops/page");
    const html = renderToStaticMarkup(await HabitatOpsPage());

    expect(html).toContain("REDACTION FAILED");
    expect(html).toContain("Fixture fallback is active.");
    expect(html).toContain("Snapshot content is hidden because redaction did not pass.");
  });

  it("keeps the route fixture-only and free of action buttons or forms", () => {
    const pageSource = readFileSync(join(repoRoot, "src/app/ops/page.tsx"), "utf8");

    expect(pageSource).toContain("This page reads sanitized snapshot data only");
    expect(pageSource).not.toContain("<form");
    expect(pageSource).not.toContain("<button");
    expect(pageSource).not.toContain("type=\"button\"");
    expect(pageSource).not.toContain("type=\"submit\"");
    expect(pageSource).not.toContain("Enable</button>");
    expect(pageSource).not.toContain("Disable</button>");
    expect(pageSource).not.toContain("Run Once</button>");
    expect(pageSource).not.toContain("Restart</button>");
    expect(pageSource).not.toContain("Kill</button>");
    expect(pageSource).not.toContain("Create</button>");
    expect(pageSource).not.toContain("Reuse</button>");
    expect(pageSource).not.toContain("Launch</button>");
    expect(pageSource).not.toContain("Send</button>");
    expect(pageSource).not.toContain("Delete</button>");
    expect(pageSource).not.toContain("Apply</button>");
    expect(pageSource).not.toContain('"use client"');
    expect(pageSource).not.toContain("'use client'");
    expect(pageSource).not.toContain('"use server"');
    expect(pageSource).not.toContain("'use server'");
    expect(pageSource).not.toContain('method="post"');
    expect(pageSource).not.toContain("POST");
    expect(existsSync(join(repoRoot, "src/app/api/ops"))).toBe(false);
    expect(pageSource).toContain("<details");
    expect(pageSource).toContain("<summary");
  });

  it("introduces no shell execution imports or live runtime hooks", () => {
    const pageSource = readFileSync(join(repoRoot, "src/app/ops/page.tsx"), "utf8");
    const snapshotSource = readFileSync(join(repoRoot, "src/lib/harness-ops-snapshot.ts"), "utf8");

    for (const source of [pageSource, snapshotSource]) {
      expect(source).not.toContain("child_process");
      expect(source).not.toContain("exec(");
      expect(source).not.toContain("spawn(");
      expect(source).not.toContain("shelljs");
      expect(source).not.toContain("execa");
      expect(source).not.toContain("ops/harness-ops");
      expect(source).not.toContain("fetch(\"/api/ops");
      expect(source).not.toContain("fetch('/api/ops");
      expect(source).not.toContain("capture-pane");
      expect(source).not.toContain("paneContent");
      expect(source).not.toContain("scrollbackLines");
    }

    expect(pageSource).toContain("overflow-x-hidden");
    expect(pageSource).toContain("overflow-x-auto");
    expect(pageSource).toContain("min-w-0");
    expect(pageSource).toContain("break-words");
    expect(pageSource).toContain("[overflow-wrap:anywhere]");
    expect(pageSource).toContain("flex-wrap");
    expect(pageSource).toContain("focus-visible:outline");
  });

  it("keeps the owner gate before snapshot loading and fails closed", () => {
    const pageSource = readFileSync(join(repoRoot, "src/app/ops/page.tsx"), "utf8");
    const sessionIndex = pageSource.indexOf("await getSession()");
    const ownerIndex = pageSource.indexOf("requireOwner(session)");
    const loadIndex = pageSource.indexOf("await loadHabitatOpsSnapshot()");

    expect(sessionIndex).toBeGreaterThan(-1);
    expect(ownerIndex).toBeGreaterThan(sessionIndex);
    expect(loadIndex).toBeGreaterThan(ownerIndex);
    expect(pageSource).toContain('redirect("/login")');
  });

  it("does not read the snapshot when no session is present", async () => {
    getSession.mockResolvedValue(null);
    const { default: HabitatOpsPage } = await import("../../app/ops/page");

    await expect(HabitatOpsPage()).rejects.toThrow();
    expect(requireOwner).not.toHaveBeenCalled();
    expect(loadHabitatOpsSnapshot).not.toHaveBeenCalled();
  });

  it("does not read the snapshot when the owner check fails", async () => {
    requireOwner.mockImplementation(() => {
      throw new Error("not owner");
    });
    const { default: HabitatOpsPage } = await import("../../app/ops/page");

    await expect(HabitatOpsPage()).rejects.toThrow();
    expect(loadHabitatOpsSnapshot).not.toHaveBeenCalled();
  });
});
