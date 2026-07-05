export const LOOP_STATUS_DISPLAY_STATES = ["OK", "WARN", "BLOCKED", "FAIL", "UNKNOWN"] as const;

export type LoopStatusDisplayState = (typeof LOOP_STATUS_DISPLAY_STATES)[number];

export type LoopStatusItemView = {
  phase: string;
  title: string;
  status: LoopStatusDisplayState;
  proofGateVerdict: string;
  manualQaStatus: string;
  nextRequiredGate: string;
  blockedReason: string;
  updatedAt: string;
};

export type LoopStatusByStatusView = Record<LoopStatusDisplayState, number>;

export type LoopStatusSummaryView = {
  totalItems: number;
  byStatus: LoopStatusByStatusView;
  byGate: Record<string, number>;
  highestRiskState: LoopStatusDisplayState;
  hasBlockers: boolean;
  hasFailures: boolean;
};

export type LoopStatusSafetyView = {
  shellExecutionPresent: boolean;
  mutationControlsPresent: boolean;
  requestTimeShellRequired: boolean;
  secretsRedacted: boolean;
  ownerGateRequiredForUi: boolean;
};

export type HabitatLoopStatusFixture = {
  mode: "fixture_only";
  generatedAt: string;
  summary: LoopStatusSummaryView;
  items: LoopStatusItemView[];
  safety: LoopStatusSafetyView;
  footerSummary: string[];
};

export const habitatLoopStatusFixture: HabitatLoopStatusFixture = {
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
      phase: "sample-phase-in-review",
      title: "Sample draft item awaiting review",
      status: "WARN",
      proofGateVerdict: "PENDING",
      manualQaStatus: "not_started",
      nextRequiredGate: "proof review",
      blockedReason: "",
      updatedAt: "2026-06-08T14:20:00Z",
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
};
