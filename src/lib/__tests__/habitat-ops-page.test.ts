import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { renderToStaticMarkup } from "react-dom/server";

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
    }

    expect(pageSource).toContain("overflow-x-hidden");
    expect(pageSource).toContain("overflow-x-auto");
  });
});
