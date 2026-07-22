export type OpsFixtureCardLine = {
  label: string;
  value: string;
};

export type OpsPreviewResult = "PASS" | "WARN" | "REFUSED" | "FAIL" | "UNKNOWN" | "NOT_RUN";

export type ScheduleDryRunTarget = {
  scheduleId: string;
  targetMachine: string;
  risk: string;
  managedMode: string;
  liveEnableAllowed: boolean;
  liveDisableAllowed: boolean;
  liveRunOnceAllowed: boolean;
  planResult: OpsPreviewResult;
  planLines: string[];
  enableResult: OpsPreviewResult;
  enablePreview: string[];
  disableResult: OpsPreviewResult;
  disablePreview: string[];
  runOnceResult: OpsPreviewResult;
  runOncePreview: string[];
  notes: string[];
};

export type WorkspaceDryRunTarget = {
  workspaceId: string;
  targetMachine: string;
  canonicalSessionPreview: string;
  planResult: OpsPreviewResult;
  previewLines: string[];
  copyOnlyLines: string[];
  notes: string[];
};

export type TmuxSessionMetadata = {
  machine: string;
  sessionName: string;
  attached: boolean | null;
  windowCount: number;
  paneCount: number;
  canonical: boolean;
  workspaceId: string | null;
  notes: string[];
};

export type HabitatOpsFixture = {
  mode: "fixture_only";
  generatedAt: string;
  sourceMachine: string | null;
  safetyLabels: string[];
  notification: {
    discordSend: string;
    dedupeStatus: string;
    reportUrl: string;
    redactionNote: string;
    transportNote: string;
  };
  scheduleInventory: {
    userCrontabSummary: string;
    systemTimersSummary: string;
    readOnlyTargetCount: string;
    noMutationNote: string;
    lines: OpsFixtureCardLine[];
  };
  scheduleDryRun: {
    samplePlanTarget: string;
    planLines: string[];
    enablePreview: string[];
    disablePreview: string[];
    runOncePreview: string[];
  };
  scheduleDryRuns?: ScheduleDryRunTarget[];
  tmuxInventory: {
    sessionCount: string;
    windowCount: string;
    paneCount: string;
    metadataOnlyNote: string;
    noCaptureNote: string;
    lines: OpsFixtureCardLine[];
  };
  tmuxSessions?: TmuxSessionMetadata[];
  workspaceDryRun: {
    canonicalSessionPreview: string;
    previewLines: string[];
    copyOnlyLines: string[];
    noCreateReuseNote: string;
  };
  workspaceDryRuns?: WorkspaceDryRunTarget[];
  reports: {
    latestReport: string;
    expectedUrlPattern: string;
    adapterStatus: string;
  };
  footerSummary: string[];
};

export const habitatOpsFixture: HabitatOpsFixture = {
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
    lines: [
      { label: "User crontab", value: "heartbeat, watchdog, daily digest" },
      { label: "System timers", value: "apt-daily.timer, logrotate.timer, mc-restart.timer, sysstat-collect.timer" },
      { label: "Read-only targets", value: "gh-tracker-local-snapshot.timer, gh-tracker-github-health-sync.timer, nuc1-daily-report.timer" },
    ],
  },
  scheduleDryRun: {
    samplePlanTarget: "gh-tracker-local-snapshot-timer",
    planLines: [
      "managed_mode: managed_candidate",
      "risk_level: medium",
      "future safeguard: proof capture required before any live change window",
    ],
    enablePreview: [
      "WOULD_RUN: systemctl --user enable gh-tracker-local-snapshot.timer",
      "WOULD_RUN: systemctl --user start gh-tracker-local-snapshot.timer",
    ],
    disablePreview: [
      "WOULD_RUN: systemctl --user stop gh-tracker-local-snapshot.timer",
      "WOULD_RUN: systemctl --user disable gh-tracker-local-snapshot.timer",
    ],
    runOncePreview: [
      "WOULD_RUN: systemctl --user start gh-tracker-local-snapshot.service",
      "COPY_ONLY: inspect logs after preview in a future approved live phase",
    ],
  },
  scheduleDryRuns: [
    {
      scheduleId: "fixture-report-timer",
      targetMachine: "nuc1",
      risk: "medium",
      managedMode: "managed_candidate",
      liveEnableAllowed: false,
      liveDisableAllowed: false,
      liveRunOnceAllowed: false,
      planResult: "PASS",
      planLines: ["RESULT=PASS", "Fixture plan is read-only."],
      enableResult: "PASS",
      enablePreview: ["WOULD_RUN: enable fixture-report-timer"],
      disableResult: "WARN",
      disablePreview: ["WOULD_RUN: disable fixture-report-timer"],
      runOnceResult: "NOT_RUN",
      runOncePreview: ["Fixture run-once preview is unavailable."],
      notes: ["Fixture schedule metadata only."],
    },
    {
      scheduleId: "fixture-read-only-cron",
      targetMachine: "nuc2",
      risk: "high",
      managedMode: "read_only",
      liveEnableAllowed: false,
      liveDisableAllowed: false,
      liveRunOnceAllowed: false,
      planResult: "UNKNOWN",
      planLines: ["No fixture plan result was reported."],
      enableResult: "REFUSED",
      enablePreview: ["RESULT=REFUSED", "Read-only target cannot be enabled here."],
      disableResult: "REFUSED",
      disablePreview: ["RESULT=REFUSED", "Read-only target cannot be disabled here."],
      runOnceResult: "REFUSED",
      runOncePreview: ["RESULT=REFUSED", "Read-only target cannot be run here."],
      notes: ["Fixture refusal is distinct from failure."],
    },
    {
      scheduleId: "fixture-unavailable-timer",
      targetMachine: "nuc1",
      risk: "unknown",
      managedMode: "unavailable",
      liveEnableAllowed: false,
      liveDisableAllowed: false,
      liveRunOnceAllowed: false,
      planResult: "FAIL",
      planLines: ["RESULT=FAIL", "Fixture plan failed safely."],
      enableResult: "NOT_RUN",
      enablePreview: [],
      disableResult: "NOT_RUN",
      disablePreview: [],
      runOnceResult: "NOT_RUN",
      runOncePreview: [],
      notes: [],
    },
  ],
  tmuxInventory: {
    sessionCount: "3 sample sessions",
    windowCount: "3 sample windows",
    paneCount: "3 sample panes",
    metadataOnlyNote: "Session, window, and pane metadata only.",
    noCaptureNote: "Pane content and scrollback are not captured in this fixture view.",
    lines: [
      { label: "Session", value: "ops6-gh-tracker" },
      { label: "Window", value: "repo (active)" },
      { label: "Pane", value: "command=opencode path=/opt/slimy/gh-tracker size=232x52" },
    ],
  },
  tmuxSessions: [
    {
      machine: "nuc1",
      sessionName: "ops6-gh-tracker",
      attached: true,
      windowCount: 2,
      paneCount: 3,
      canonical: true,
      workspaceId: "gh-tracker",
      notes: ["Canonical fixture session; metadata only."],
    },
    {
      machine: "nuc1",
      sessionName: "fixture-loose-session",
      attached: false,
      windowCount: 1,
      paneCount: 1,
      canonical: false,
      workspaceId: null,
      notes: ["Unassociated fixture session; metadata only."],
    },
  ],
  workspaceDryRun: {
    canonicalSessionPreview: "ops6-gh-tracker",
    previewLines: [
      "WOULD_RUN: tmux new-session -d -s ops6-gh-tracker -c /opt/slimy/gh-tracker -n repo",
      "WOULD_RUN: tmux new-window -t ops6-gh-tracker -n app -c /opt/slimy/gh-tracker",
      "WOULD_RUN: tmux new-window -t ops6-gh-tracker -n data -c /home/slimy/slimy-harness",
    ],
    copyOnlyLines: [
      "COPY_ONLY: git status --short",
      "COPY_ONLY: curl -I https://habitat.slimyai.xyz/",
    ],
    noCreateReuseNote: "No create or reuse action exists here; this is preview text only.",
  },
  workspaceDryRuns: [
    {
      workspaceId: "gh-tracker",
      targetMachine: "nuc1",
      canonicalSessionPreview: "ops6-gh-tracker",
      planResult: "PASS",
      previewLines: ["WOULD_RUN: prepare fixture workspace gh-tracker"],
      copyOnlyLines: ["COPY_ONLY: inspect fixture workspace state"],
      notes: ["Fixture workspace preview only."],
    },
    {
      workspaceId: "diagnostics",
      targetMachine: "nuc1",
      canonicalSessionPreview: "ops6-diagnostics",
      planResult: "WARN",
      previewLines: ["WOULD_RUN: prepare fixture workspace diagnostics"],
      copyOnlyLines: ["COPY_ONLY: review fixture diagnostics"],
      notes: [],
    },
  ],
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
};
