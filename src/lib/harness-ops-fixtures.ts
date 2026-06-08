export type OpsFixtureCardLine = {
  label: string;
  value: string;
};

export type HabitatOpsFixture = {
  mode: "fixture_only";
  generatedAt: string;
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
  tmuxInventory: {
    sessionCount: string;
    windowCount: string;
    paneCount: string;
    metadataOnlyNote: string;
    noCaptureNote: string;
    lines: OpsFixtureCardLine[];
  };
  workspaceDryRun: {
    canonicalSessionPreview: string;
    previewLines: string[];
    copyOnlyLines: string[];
    noCreateReuseNote: string;
  };
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
