import { readFile } from "fs/promises";
import { z } from "zod";
import { habitatOpsFixture, type HabitatOpsFixture, type OpsFixtureCardLine } from "./harness-ops-fixtures";

export const HABITAT_OPS_SNAPSHOT_PATH = "/home/slimy/harness-logs/ops-snapshots/latest.json";

export type HabitatOpsSnapshotState = "fresh" | "stale" | "missing" | "invalid" | "redaction_failed";

export type HabitatOpsSnapshotLoadResult = {
  mode: "snapshot" | "fixture";
  snapshotState: HabitatOpsSnapshotState;
  snapshotPath: string;
  generatedAt: string | null;
  stateLabel: string;
  stateMessage: string;
  freshnessMessage: string;
  redactionMessage: string;
  data: HabitatOpsFixture;
};

const riskSchema = z.enum(["low", "medium", "high", "unknown"]);

const snapshotSchema = z.object({
  schemaVersion: z.literal(1),
  mode: z.literal("snapshot"),
  generatedAt: z.string(),
  source: z.object({
    producer: z.enum(["manual", "harness_script", "approved_schedule"]),
    machine: z.string(),
    repoPath: z.string().optional(),
    producerVersion: z.string().optional(),
  }),
  freshness: z.object({
    state: z.enum(["fresh", "stale", "missing", "invalid", "redaction_failed"]),
    maxAgeSeconds: z.number().int().positive(),
    ageSeconds: z.number().nullable(),
    staleAfter: z.string().nullable(),
    message: z.string(),
  }),
  redaction: z.object({
    status: z.enum(["passed", "failed"]),
    rulesVersion: z.string(),
    redactedFieldCount: z.number().int().nonnegative(),
    blockedFieldCount: z.number().int().nonnegative(),
    notes: z.array(z.string()),
  }),
  safety: z.object({
    readOnly: z.literal(true),
    dryRunOnly: z.literal(true),
    noLiveMutation: z.literal(true),
    snapshotMode: z.literal(true),
    backendAdapterConnected: z.literal(false),
    shellExecutionPresent: z.literal(false),
  }),
  notificationStatus: z.object({
    status: z.enum(["ok", "warn", "error"]),
    deliveryMode: z.enum(["disabled", "runtime", "relay", "unknown"]),
    dedupeState: z.string(),
    reportUrl: z.string().nullable(),
    redactionNote: z.string(),
  }),
  scheduleInventory: z.object({
    summary: z.object({
      userCrontabCount: z.number().int().nonnegative(),
      systemTimerCount: z.number().int().nonnegative(),
      readOnlyTargetCount: z.number().int().nonnegative(),
      notes: z.array(z.string()),
    }),
    highlights: z.array(z.object({
      label: z.string(),
      value: z.string(),
      risk: riskSchema,
    })),
  }),
  scheduleDryRun: z.object({
    sampleTarget: z.string(),
    planLines: z.array(z.string()),
    enablePreview: z.array(z.string()),
    disablePreview: z.array(z.string()),
    runOncePreview: z.array(z.string()),
  }),
  tmuxInventory: z.object({
    summary: z.object({
      sessionCount: z.number().int().nonnegative(),
      windowCount: z.number().int().nonnegative(),
      paneCount: z.number().int().nonnegative(),
    }),
    notes: z.array(z.string()),
    highlights: z.array(z.object({
      label: z.string(),
      value: z.string(),
    })),
  }),
  workspaceDryRun: z.object({
    canonicalSessionPreview: z.string(),
    previewLines: z.array(z.string()),
    copyOnlyLines: z.array(z.string()),
    notes: z.array(z.string()),
  }),
  harnessReports: z.object({
    latest: z.array(z.object({
      label: z.string(),
      url: z.string(),
      result: z.string(),
      generatedAt: z.string().optional(),
    })),
    emptyMessage: z.string().optional(),
  }),
});

type HabitatOpsSnapshot = z.infer<typeof snapshotSchema>;

function cloneFixture(): HabitatOpsFixture {
  return structuredClone(habitatOpsFixture);
}

function summarizeNotes(notes: string[], fallback: string): string {
  return notes.length > 0 ? notes.join(" ") : fallback;
}

function convertHighlights(lines: Array<{ label: string; value: string; risk?: string }>): OpsFixtureCardLine[] {
  return lines.map((line) => ({
    label: line.risk ? `${line.label} (${line.risk})` : line.label,
    value: line.value,
  }));
}

function buildSnapshotFixture(snapshot: HabitatOpsSnapshot): HabitatOpsFixture {
  return {
    mode: "fixture_only",
    generatedAt: snapshot.generatedAt,
    safetyLabels: ["READ ONLY", "DRY RUN ONLY", "NO LIVE MUTATION", "SNAPSHOT MODE"],
    notification: {
      discordSend: `Snapshot delivery mode: ${snapshot.notificationStatus.deliveryMode}`,
      dedupeStatus: `Dedupe state: ${snapshot.notificationStatus.dedupeState}`,
      reportUrl: snapshot.notificationStatus.reportUrl ?? "none",
      redactionNote: snapshot.notificationStatus.redactionNote,
      transportNote: `Snapshot notification status: ${snapshot.notificationStatus.status}`,
    },
    scheduleInventory: {
      userCrontabSummary: `User crontab targets: ${snapshot.scheduleInventory.summary.userCrontabCount}`,
      systemTimersSummary: `System timers: ${snapshot.scheduleInventory.summary.systemTimerCount}`,
      readOnlyTargetCount: `Read-only targets: ${snapshot.scheduleInventory.summary.readOnlyTargetCount}`,
      noMutationNote: summarizeNotes(snapshot.scheduleInventory.summary.notes, "Snapshot inventory is read-only."),
      lines: convertHighlights(snapshot.scheduleInventory.highlights),
    },
    scheduleDryRun: {
      samplePlanTarget: snapshot.scheduleDryRun.sampleTarget,
      planLines: snapshot.scheduleDryRun.planLines,
      enablePreview: snapshot.scheduleDryRun.enablePreview,
      disablePreview: snapshot.scheduleDryRun.disablePreview,
      runOncePreview: snapshot.scheduleDryRun.runOncePreview,
    },
    tmuxInventory: {
      sessionCount: `${snapshot.tmuxInventory.summary.sessionCount} snapshot sessions`,
      windowCount: `${snapshot.tmuxInventory.summary.windowCount} snapshot windows`,
      paneCount: `${snapshot.tmuxInventory.summary.paneCount} snapshot panes`,
      metadataOnlyNote: snapshot.tmuxInventory.notes[0] ?? "Metadata only.",
      noCaptureNote: snapshot.tmuxInventory.notes[1] ?? "Pane capture is not available.",
      lines: convertHighlights(snapshot.tmuxInventory.highlights),
    },
    workspaceDryRun: {
      canonicalSessionPreview: snapshot.workspaceDryRun.canonicalSessionPreview,
      previewLines: snapshot.workspaceDryRun.previewLines,
      copyOnlyLines: snapshot.workspaceDryRun.copyOnlyLines,
      noCreateReuseNote: summarizeNotes(snapshot.workspaceDryRun.notes, "Snapshot preview only."),
    },
    reports: {
      latestReport: snapshot.harnessReports.latest[0]?.label ?? snapshot.harnessReports.emptyMessage ?? "No reports in snapshot.",
      expectedUrlPattern: snapshot.harnessReports.latest[0]?.url ?? "https://harness.slimyai.xyz/reports/sessions/...",
      adapterStatus: "Sanitized snapshot adapter active. No live runtime command execution.",
    },
    footerSummary: [
      "Live controls are not implemented.",
      "Snapshot data is read-only and sanitized before Habitat reads it.",
      "Shell execution is not present in this route.",
      "Snapshot mode is active.",
    ],
  };
}

function deriveFreshnessState(snapshot: HabitatOpsSnapshot): HabitatOpsSnapshotState {
  if (snapshot.redaction.status === "failed" || snapshot.freshness.state === "redaction_failed") {
    return "redaction_failed";
  }
  if (snapshot.freshness.state === "invalid") {
    return "invalid";
  }
  if (snapshot.freshness.state === "missing") {
    return "missing";
  }

  const generatedAtMs = Date.parse(snapshot.generatedAt);
  if (Number.isNaN(generatedAtMs)) {
    return "invalid";
  }

  const ageSeconds = Math.max(0, Math.floor((Date.now() - generatedAtMs) / 1000));
  return ageSeconds > snapshot.freshness.maxAgeSeconds || snapshot.freshness.state === "stale" ? "stale" : "fresh";
}

function buildFallback(
  snapshotPath: string,
  snapshotState: HabitatOpsSnapshotState,
  stateLabel: string,
  stateMessage: string,
  redactionMessage: string,
): HabitatOpsSnapshotLoadResult {
  return {
    mode: "fixture",
    snapshotState,
    snapshotPath,
    generatedAt: null,
    stateLabel,
    stateMessage,
    freshnessMessage: stateMessage,
    redactionMessage,
    data: cloneFixture(),
  };
}

export async function loadHabitatOpsSnapshot(snapshotPath = HABITAT_OPS_SNAPSHOT_PATH): Promise<HabitatOpsSnapshotLoadResult> {
  let raw: string;
  try {
    raw = await readFile(snapshotPath, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return buildFallback(
        snapshotPath,
        "missing",
        "SNAPSHOT MISSING",
        "No sanitized snapshot file is available yet. Fixture fallback is active.",
        "Redaction status unavailable because no snapshot was found.",
      );
    }

    return buildFallback(
      snapshotPath,
      "invalid",
      "SNAPSHOT INVALID",
      "The sanitized snapshot could not be read safely. Fixture fallback is active.",
      "Snapshot read failed before redaction status could be confirmed.",
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
      "The snapshot JSON could not be parsed. Fixture fallback is active.",
      "Raw snapshot content is hidden because parsing failed.",
    );
  }

  const snapshotResult = snapshotSchema.safeParse(parsed);
  if (!snapshotResult.success) {
    return buildFallback(
      snapshotPath,
      "invalid",
      "SNAPSHOT INVALID",
      "The snapshot schema did not validate. Fixture fallback is active.",
      "Raw snapshot content is hidden because validation failed.",
    );
  }

  const snapshot = snapshotResult.data;
  const snapshotState = deriveFreshnessState(snapshot);
  if (snapshotState === "redaction_failed") {
    return buildFallback(
      snapshotPath,
      "redaction_failed",
      "REDACTION FAILED",
      "The snapshot failed sanitization checks. Fixture fallback is active.",
      "Snapshot content is hidden because redaction did not pass.",
    );
  }
  if (snapshotState === "invalid") {
    return buildFallback(
      snapshotPath,
      "invalid",
      "SNAPSHOT INVALID",
      "The snapshot metadata was invalid. Fixture fallback is active.",
      "Snapshot content is hidden because validation failed.",
    );
  }

  return {
    mode: "snapshot",
    snapshotState,
    snapshotPath,
    generatedAt: snapshot.generatedAt,
    stateLabel: snapshotState === "stale" ? "STALE SNAPSHOT" : "SNAPSHOT MODE",
    stateMessage:
      snapshotState === "stale"
        ? "Sanitized snapshot data is stale but still safe to display."
        : "Sanitized snapshot data is active.",
    freshnessMessage: snapshot.freshness.message,
    redactionMessage: `Redaction ${snapshot.redaction.status}; rules ${snapshot.redaction.rulesVersion}; redacted ${snapshot.redaction.redactedFieldCount} field(s).`,
    data: buildSnapshotFixture(snapshot),
  };
}
