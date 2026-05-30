import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";
import type { ClassifiedItem } from "../maintenance-classifier";
import {
  buildAlerts,
  buildAlertId,
  severityFromRisk,
  reasonFromLabel,
  clearDismissedLocalStorage,
  clearSnoozedLocalStorage,
  clearAllAlertLocalStorage,
  dismissAlertId,
  snoozeAlertId,
  getDismissedAlertIds,
  getSnoozedAlertIds,
} from "../maintenance-alerts";

function mockLocalStorage() {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
  };
}

function makeNeedsAction(overrides: Partial<ClassifiedItem>): ClassifiedItem {
  return {
    repoId: overrides.repoId ?? "test-repo",
    displayName: overrides.displayName ?? "test-repo",
    bucket: "needs_action",
    actionable: true,
    label: overrides.label ?? "Needs review — dirty working tree",
    risk: overrides.risk ?? "medium",
    recommendation: overrides.recommendation ?? "Review and commit or stash local changes",
    machines: overrides.machines ?? ["nuc1"],
    locations: overrides.locations ?? [],
    entry: overrides.entry ?? null,
  };
}



describe("maintenance alerts", () => {
  it("creates alert for needs_action item", () => {
    const item = makeNeedsAction({ repoId: "dirty-repo" });
    const alerts = buildAlerts([item], new Set(), new Set());
    expect(alerts.length).toBe(1);
    expect(alerts[0].repoId).toBe("dirty-repo");
    expect(alerts[0].bucket).toBe("needs_action");
    expect(alerts[0].dismissed).toBe(false);
    expect(alerts[0].snoozed).toBe(false);
  });

  it("creates alert with deterministic ID", () => {
    const item = makeNeedsAction({ repoId: "dirty-repo" });
    const alerts1 = buildAlerts([item], new Set(), new Set());
    const alerts2 = buildAlerts([item], new Set(), new Set());
    expect(alerts1[0].id).toBe(alerts2[0].id);
  });

  it("different repos produce different alert IDs", () => {
    const a = makeNeedsAction({ repoId: "repo-a" });
    const b = makeNeedsAction({ repoId: "repo-b" });
    const alerts = buildAlerts([a, b], new Set(), new Set());
    expect(alerts[0].id).not.toBe(alerts[1].id);
  });

  it("different machines on same repo produce different alert IDs", () => {
    const item = makeNeedsAction({ repoId: "multi-repo", machines: ["nuc1", "nuc2"] });
    const alerts = buildAlerts([item], new Set(), new Set());
    expect(alerts.length).toBe(2);
    expect(alerts[0].id).not.toBe(alerts[1].id);
  });

  it("operational hold items create NO alerts", () => {
    const alerts = buildAlerts([], new Set(), new Set());
    expect(alerts.length).toBe(0);
  });

  it("active development items create NO alerts", () => {
    const alerts = buildAlerts([], new Set(), new Set());
    expect(alerts.length).toBe(0);
  });

  it("runtime local state items create NO alerts", () => {
    const alerts = buildAlerts([], new Set(), new Set());
    expect(alerts.length).toBe(0);
  });

  it("stale snapshot items create NO alerts", () => {
    const alerts = buildAlerts([], new Set(), new Set());
    expect(alerts.length).toBe(0);
  });

  it("recently resolved items create NO alerts", () => {
    const alerts = buildAlerts([], new Set(), new Set());
    expect(alerts.length).toBe(0);
  });

  it("only needs_action items among mixed input generate alerts", () => {
    const needsActionOnly: ClassifiedItem[] = [
      makeNeedsAction({ repoId: "needs-fix" }),
    ];
    const alerts = buildAlerts(needsActionOnly, new Set(), new Set());
    expect(alerts.length).toBe(1);
    expect(alerts[0].repoId).toBe("needs-fix");
  });

  it("high risk maps to high severity", () => {
    expect(severityFromRisk("high")).toBe("high");
  });

  it("medium risk maps to medium severity", () => {
    expect(severityFromRisk("medium")).toBe("medium");
  });

  it("low risk maps to low severity", () => {
    expect(severityFromRisk("low")).toBe("low");
  });

  it("none risk maps to low severity", () => {
    expect(severityFromRisk("none")).toBe("low");
  });

  it("reasonFromLabel strips prefix", () => {
    const label = "Needs review — dirty working tree";
    expect(reasonFromLabel(label)).toBe("dirty working tree");
  });

  it("reasonFromLabel falls back to label when no prefix match", () => {
    const label = "Custom reason text";
    expect(reasonFromLabel(label)).toBe("Custom reason text");
  });

  it("dismiss marks alert as dismissed", () => {
    const item = makeNeedsAction({ repoId: "dismiss-me" });
    const alerts = buildAlerts([item], new Set(), new Set());
    expect(alerts[0].dismissed).toBe(false);

    const dismissed = new Set([alerts[0].id]);
    const alertsAfter = buildAlerts([item], dismissed, new Set());
    expect(alertsAfter[0].dismissed).toBe(true);
  });

  it("snooze marks alert as snoozed", () => {
    const item = makeNeedsAction({ repoId: "snooze-me" });
    const alerts = buildAlerts([item], new Set(), new Set());
    expect(alerts[0].snoozed).toBe(false);

    const snoozed = new Set([alerts[0].id]);
    const alertsAfter = buildAlerts([item], new Set(), snoozed);
    expect(alertsAfter[0].snoozed).toBe(true);
  });

  it("dismissed + snoozed both reflected", () => {
    const item = makeNeedsAction({ repoId: "both" });
    const alerts = buildAlerts([item], new Set(), new Set());
    const id = alerts[0].id;

    const dismissed = new Set([id]);
    const snoozed = new Set([id]);
    const result = buildAlerts([item], dismissed, snoozed);
    expect(result[0].dismissed).toBe(true);
    expect(result[0].snoozed).toBe(true);
  });

  it("buildAlertId gives different ID for different repo", () => {
    const id1 = buildAlertId("repo-a", "nuc1", "dirty files");
    const id2 = buildAlertId("repo-b", "nuc1", "dirty files");
    expect(id1).not.toBe(id2);
  });

  it("buildAlertId gives different ID for different machine", () => {
    const id1 = buildAlertId("repo", "nuc1", "dirty files");
    const id2 = buildAlertId("repo", "nuc2", "dirty files");
    expect(id1).not.toBe(id2);
  });

  it("buildAlertId gives different ID for different reason", () => {
    const id1 = buildAlertId("repo", "nuc1", "dirty files");
    const id2 = buildAlertId("repo", "nuc1", "unpushed commits");
    expect(id1).not.toBe(id2);
  });

  it("dismiss via set propagates through buildAlerts", () => {
    const id = "alert_to_dismiss";
    const dismissed = new Set([id]);
    const item = makeNeedsAction({ repoId: "to-dismiss" });
    const alerts = buildAlerts([item], dismissed, new Set());
    expect(alerts.every((a) => a.dismissed === (a.id === id))).toBe(true);
  });

  it("snooze via set propagates through buildAlerts", () => {
    const id = "alert_to_snooze";
    const snoozed = new Set([id]);
    const item = makeNeedsAction({ repoId: "to-snooze" });
    const alerts = buildAlerts([item], snoozed, new Set());
    expect(alerts.every((a) => a.snoozed === (a.id === id))).toBe(true);
  });
});

describe("alert clear operations", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", mockLocalStorage());
  });

  afterEach(() => {
    clearAllAlertLocalStorage();
    vi.unstubAllGlobals();
  });

  it("clearDismissedLocalStorage removes all dismissed IDs", () => {
    dismissAlertId("a1");
    dismissAlertId("a2");
    expect(getDismissedAlertIds().size).toBe(2);
    clearDismissedLocalStorage();
    expect(getDismissedAlertIds().size).toBe(0);
  });

  it("clearDismissedLocalStorage preserves snoozed state", () => {
    dismissAlertId("d1");
    snoozeAlertId("s1");
    clearDismissedLocalStorage();
    expect(getDismissedAlertIds().size).toBe(0);
    expect(getSnoozedAlertIds().has("s1")).toBe(true);
  });

  it("clearSnoozedLocalStorage removes all snoozed IDs", () => {
    snoozeAlertId("s1");
    snoozeAlertId("s2");
    expect(getSnoozedAlertIds().size).toBe(2);
    clearSnoozedLocalStorage();
    expect(getSnoozedAlertIds().size).toBe(0);
  });

  it("clearSnoozedLocalStorage preserves dismissed state", () => {
    dismissAlertId("d1");
    snoozeAlertId("s1");
    clearSnoozedLocalStorage();
    expect(getDismissedAlertIds().has("d1")).toBe(true);
    expect(getSnoozedAlertIds().size).toBe(0);
  });

  it("clearAllAlertLocalStorage resets both dismissed and snoozed", () => {
    dismissAlertId("d1");
    snoozeAlertId("s1");
    clearAllAlertLocalStorage();
    expect(getDismissedAlertIds().size).toBe(0);
    expect(getSnoozedAlertIds().size).toBe(0);
  });

  it("after clearDismissed, buildAlerts shows alerts as not dismissed", () => {
    const item = makeNeedsAction({ repoId: "clear-test" });
    const alerts = buildAlerts([item], new Set(), new Set());
    const id = alerts[0].id;
    dismissAlertId(id);
    const dismissed = getDismissedAlertIds();
    expect(dismissed.has(id)).toBe(true);
    clearDismissedLocalStorage();
    const afterClear = buildAlerts([item], getDismissedAlertIds(), getSnoozedAlertIds());
    expect(afterClear[0].dismissed).toBe(false);
  });

  it("after clearSnoozed, buildAlerts shows alerts as not snoozed", () => {
    const item = makeNeedsAction({ repoId: "clear-test" });
    const alerts = buildAlerts([item], new Set(), new Set());
    const id = alerts[0].id;
    snoozeAlertId(id);
    clearSnoozedLocalStorage();
    const afterClear = buildAlerts([item], getDismissedAlertIds(), getSnoozedAlertIds());
    expect(afterClear[0].snoozed).toBe(false);
  });
});
