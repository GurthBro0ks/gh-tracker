import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { loadHabitatOpsSnapshot } from "../harness-ops-snapshot";

const tempDirs: string[] = [];

async function makeTempFile(contents: string) {
  const dir = await mkdtemp(join(tmpdir(), "habitat-ops-snapshot-"));
  tempDirs.push(dir);
  const filePath = join(dir, "latest.json");
  await writeFile(filePath, contents, "utf8");
  return filePath;
}

function makeScheduleTarget(scheduleId: string, overrides: Record<string, unknown> = {}) {
  return {
    scheduleId,
    targetMachine: "nuc1",
    risk: "medium",
    managedMode: "managed_candidate",
    liveEnableAllowed: false,
    liveDisableAllowed: false,
    liveRunOnceAllowed: false,
    planResult: "PASS",
    planLines: ["RESULT=PASS"],
    enableResult: "PASS",
    enablePreview: ["WOULD_RUN: enable fixture target"],
    disableResult: "PASS",
    disablePreview: ["WOULD_RUN: disable fixture target"],
    runOnceResult: "PASS",
    runOncePreview: ["WOULD_RUN: preview fixture target"],
    notes: ["Read-only fixture metadata."],
    ...overrides,
  };
}

function makeWorkspaceTarget(workspaceId: string, overrides: Record<string, unknown> = {}) {
  return {
    workspaceId,
    targetMachine: "nuc1",
    canonicalSessionPreview: `ops6-${workspaceId}`,
    planResult: "PASS",
    previewLines: ["WOULD_RUN: prepare fixture workspace"],
    copyOnlyLines: ["COPY_ONLY: inspect fixture workspace"],
    notes: ["Read-only fixture metadata."],
    ...overrides,
  };
}

function makeTmuxSession(sessionName: string, overrides: Record<string, unknown> = {}) {
  return {
    machine: "nuc1",
    sessionName,
    attached: false,
    windowCount: 1,
    paneCount: 1,
    canonical: false,
    workspaceId: null,
    notes: ["Metadata only."],
    ...overrides,
  };
}

function makeSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    mode: "snapshot",
    generatedAt: new Date(Date.now() - 30_000).toISOString(),
    source: {
      producer: "manual",
      machine: "nuc1",
      repoPath: "/home/slimy/slimy-harness",
      producerVersion: "test",
    },
    freshness: {
      state: "fresh",
      maxAgeSeconds: 900,
      ageSeconds: 30,
      staleAfter: new Date(Date.now() + 870_000).toISOString(),
      message: "Snapshot is recent and safe to display.",
    },
    redaction: {
      status: "passed",
      rulesVersion: "v1",
      redactedFieldCount: 2,
      blockedFieldCount: 0,
      notes: ["Sanitized before write."],
    },
    safety: {
      readOnly: true,
      dryRunOnly: true,
      noLiveMutation: true,
      snapshotMode: true,
      backendAdapterConnected: false,
      shellExecutionPresent: false,
    },
    notificationStatus: {
      status: "ok",
      deliveryMode: "runtime",
      dedupeState: "sample_marker_present",
      reportUrl: "https://harness.slimyai.xyz/reports/sessions/report-proof-sample.json",
      redactionNote: "Destination details are sanitized.",
    },
    scheduleInventory: {
      summary: {
        userCrontabCount: 3,
        systemTimerCount: 4,
        readOnlyTargetCount: 6,
        notes: ["Read-only summary only."],
      },
      highlights: [
        { label: "User crontab", value: "heartbeat, watchdog, daily digest", risk: "medium" },
      ],
    },
    scheduleDryRun: {
      sampleTarget: "gh-tracker-local-snapshot-timer",
      planLines: ["managed_mode: managed_candidate"],
      enablePreview: ["WOULD_RUN: systemctl --user enable gh-tracker-local-snapshot.timer"],
      disablePreview: ["WOULD_RUN: systemctl --user disable gh-tracker-local-snapshot.timer"],
      runOncePreview: ["WOULD_RUN: systemctl --user start gh-tracker-local-snapshot.service"],
    },
    tmuxInventory: {
      summary: {
        sessionCount: 3,
        windowCount: 3,
        paneCount: 3,
      },
      notes: ["Metadata only.", "No pane scrollback or content captured."],
      highlights: [{ label: "Session", value: "ops6-gh-tracker" }],
    },
    workspaceDryRun: {
      canonicalSessionPreview: "ops6-gh-tracker",
      previewLines: ["WOULD_RUN: tmux new-session -d -s ops6-gh-tracker -c /opt/slimy/gh-tracker -n repo"],
      copyOnlyLines: ["COPY_ONLY: git status --short"],
      notes: ["Preview text only."],
    },
    harnessReports: {
      latest: [
        {
          label: "Latest sample report",
          url: "https://harness.slimyai.xyz/reports/sessions/report-proof-sample.json",
          result: "PASS",
        },
      ],
    },
    ...overrides,
  };
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("loadHabitatOpsSnapshot", () => {
  it("returns snapshot mode for a valid snapshot", async () => {
    const filePath = await makeTempFile(JSON.stringify(makeSnapshot()));
    const result = await loadHabitatOpsSnapshot(filePath);

    expect(result.mode).toBe("snapshot");
    expect(result.snapshotState).toBe("fresh");
    expect(result.stateLabel).toBe("SNAPSHOT MODE");
    expect(result.data.safetyLabels).toContain("SNAPSHOT MODE");
    expect(result.data.sourceMachine).toBe("nuc1");
    expect(result.data.scheduleDryRun.samplePlanTarget).toBe("gh-tracker-local-snapshot-timer");
    expect(result.data.workspaceDryRun.canonicalSessionPreview).toBe("ops6-gh-tracker");
  });

  it("keeps legacy-only schemaVersion 1 snapshots valid when additive arrays are absent", async () => {
    const filePath = await makeTempFile(JSON.stringify(makeSnapshot()));
    const result = await loadHabitatOpsSnapshot(filePath);

    expect(result.mode).toBe("snapshot");
    expect(result.data.scheduleDryRuns).toBeUndefined();
    expect(result.data.workspaceDryRuns).toBeUndefined();
    expect(result.data.tmuxSessions).toBeUndefined();
    expect(result.data.scheduleDryRun.planLines).toEqual(["managed_mode: managed_candidate"]);
    expect(result.data.workspaceDryRun.previewLines).toHaveLength(1);
    expect(result.data.tmuxInventory.lines[0]?.value).toBe("ops6-gh-tracker");
  });

  it("validates B1 additive arrays and retains every item alongside legacy fields", async () => {
    const scheduleDryRuns = Array.from({ length: 9 }, (_, index) => makeScheduleTarget(`schedule-${index}`));
    scheduleDryRuns[7] = makeScheduleTarget("read-only-schedule", {
      enableResult: "REFUSED",
      enablePreview: ["RESULT=REFUSED"],
    });
    const workspaceDryRuns = Array.from({ length: 10 }, (_, index) => makeWorkspaceTarget(`workspace-${index}`));
    const tmuxSessions = [
      makeTmuxSession("ops6-workspace-0", { attached: true, canonical: true, workspaceId: "workspace-0" }),
      makeTmuxSession("loose-session"),
      makeTmuxSession("attachment-unknown", { attached: null }),
    ];
    const filePath = await makeTempFile(JSON.stringify(makeSnapshot({ scheduleDryRuns, workspaceDryRuns, tmuxSessions })));
    const result = await loadHabitatOpsSnapshot(filePath);

    expect(result.mode).toBe("snapshot");
    expect(result.data.scheduleDryRuns).toHaveLength(9);
    expect(result.data.workspaceDryRuns).toHaveLength(10);
    expect(result.data.tmuxSessions).toHaveLength(3);
    expect(result.data.scheduleDryRuns?.[7]?.enableResult).toBe("REFUSED");
    expect(result.data.scheduleDryRuns?.[7]?.enableResult).not.toBe("FAIL");
    expect(result.data.scheduleDryRun.samplePlanTarget).toBe("gh-tracker-local-snapshot-timer");
    expect(result.data.workspaceDryRun.canonicalSessionPreview).toBe("ops6-gh-tracker");
  });

  it("retains empty additive arrays so the UI can apply the documented legacy fallbacks", async () => {
    const filePath = await makeTempFile(JSON.stringify(makeSnapshot({
      scheduleDryRuns: [],
      workspaceDryRuns: [],
      tmuxSessions: [],
    })));
    const result = await loadHabitatOpsSnapshot(filePath);

    expect(result.mode).toBe("snapshot");
    expect(result.data.scheduleDryRuns).toEqual([]);
    expect(result.data.workspaceDryRuns).toEqual([]);
    expect(result.data.tmuxSessions).toEqual([]);
    expect(result.data.scheduleDryRun.samplePlanTarget).toBe("gh-tracker-local-snapshot-timer");
  });

  it("fails safe when an additive item shape is invalid or notes are missing", async () => {
    const invalidShape = await makeTempFile(JSON.stringify(makeSnapshot({
      scheduleDryRuns: [makeScheduleTarget("bad-shape", { liveEnableAllowed: "false" })],
    })));
    const missingNotesTarget: Record<string, unknown> = makeScheduleTarget("missing-notes");
    delete missingNotesTarget.notes;
    const missingNotes = await makeTempFile(JSON.stringify(makeSnapshot({
      scheduleDryRuns: [missingNotesTarget],
    })));

    const invalidResult = await loadHabitatOpsSnapshot(invalidShape);
    const missingNotesResult = await loadHabitatOpsSnapshot(missingNotes);

    expect(invalidResult.mode).toBe("fixture");
    expect(invalidResult.snapshotState).toBe("invalid");
    expect(missingNotesResult.mode).toBe("fixture");
    expect(missingNotesResult.snapshotState).toBe("invalid");
  });

  it("retains duplicate schedule and workspace IDs as inert ordered snapshot data", async () => {
    const filePath = await makeTempFile(JSON.stringify(makeSnapshot({
      scheduleDryRuns: [makeScheduleTarget("duplicate"), makeScheduleTarget("duplicate")],
      workspaceDryRuns: [makeWorkspaceTarget("duplicate"), makeWorkspaceTarget("duplicate")],
    })));
    const result = await loadHabitatOpsSnapshot(filePath);

    expect(result.mode).toBe("snapshot");
    expect(result.data.scheduleDryRuns?.map((target) => target.scheduleId)).toEqual(["duplicate", "duplicate"]);
    expect(result.data.workspaceDryRuns?.map((target) => target.workspaceId)).toEqual(["duplicate", "duplicate"]);
  });

  it("enforces literal safety fields for snapshots with additive arrays", async () => {
    const filePath = await makeTempFile(JSON.stringify(makeSnapshot({
      safety: {
        readOnly: false,
        dryRunOnly: true,
        noLiveMutation: true,
        snapshotMode: true,
        backendAdapterConnected: false,
        shellExecutionPresent: false,
      },
      scheduleDryRuns: [makeScheduleTarget("fixture")],
    })));
    const result = await loadHabitatOpsSnapshot(filePath);

    expect(result.mode).toBe("fixture");
    expect(result.snapshotState).toBe("invalid");
  });

  it("falls back safely when the snapshot is missing", async () => {
    const result = await loadHabitatOpsSnapshot("/tmp/does-not-exist-habitat-ops-snapshot.json");

    expect(result.mode).toBe("fixture");
    expect(result.snapshotState).toBe("missing");
    expect(result.stateLabel).toBe("SNAPSHOT MISSING");
  });

  it("marks a valid but old snapshot as stale", async () => {
    const oldDate = new Date(Date.now() - 3_600_000).toISOString();
    const filePath = await makeTempFile(JSON.stringify(makeSnapshot({
      generatedAt: oldDate,
      freshness: {
        state: "fresh",
        maxAgeSeconds: 900,
        ageSeconds: 3600,
        staleAfter: new Date(Date.now() - 2_700_000).toISOString(),
        message: "Snapshot is older than the preferred freshness threshold.",
      },
    })));
    const result = await loadHabitatOpsSnapshot(filePath);

    expect(result.mode).toBe("snapshot");
    expect(result.snapshotState).toBe("stale");
    expect(result.stateLabel).toBe("STALE SNAPSHOT");
  });

  it("fails safe for invalid snapshot JSON", async () => {
    const filePath = await makeTempFile("{not valid json");
    const result = await loadHabitatOpsSnapshot(filePath);

    expect(result.mode).toBe("fixture");
    expect(result.snapshotState).toBe("invalid");
    expect(result.stateLabel).toBe("SNAPSHOT INVALID");
  });

  it("fails safe for redaction failed snapshots", async () => {
    const filePath = await makeTempFile(JSON.stringify(makeSnapshot({
      freshness: {
        state: "redaction_failed",
        maxAgeSeconds: 900,
        ageSeconds: 30,
        staleAfter: new Date(Date.now() + 870_000).toISOString(),
        message: "Snapshot failed redaction checks.",
      },
      redaction: {
        status: "failed",
        rulesVersion: "v1",
        redactedFieldCount: 0,
        blockedFieldCount: 1,
        notes: ["Blocked due to unsafe content."],
      },
    })));
    const result = await loadHabitatOpsSnapshot(filePath);

    expect(result.mode).toBe("fixture");
    expect(result.snapshotState).toBe("redaction_failed");
    expect(result.stateLabel).toBe("REDACTION FAILED");
  });
});
