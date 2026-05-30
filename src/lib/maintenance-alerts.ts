import type { ClassifiedItem, MaintenanceBucket } from "@/lib/maintenance-classifier";

export type AlertSeverity = "high" | "medium" | "low";

export type Alert = {
  id: string;
  repoId: string;
  displayName: string;
  machine: string;
  bucket: MaintenanceBucket;
  reason: string;
  severity: AlertSeverity;
  recommendation: string;
  dismissed: boolean;
  snoozed: boolean;
};

const DISMISSED_KEY = "gh-tracker-alert-dismissed";
const SNOOZED_KEY = "gh-tracker-alert-snoozed";

function getStoredSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

function storeSet(key: string, ids: Set<string>): void {
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(ids)));
  } catch {
  }
}

export function getDismissedAlertIds(): Set<string> {
  return getStoredSet(DISMISSED_KEY);
}

export function dismissAlertId(id: string): void {
  const ids = getDismissedAlertIds();
  ids.add(id);
  storeSet(DISMISSED_KEY, ids);
}

export function restoreAlertId(id: string): void {
  const ids = getDismissedAlertIds();
  ids.delete(id);
  storeSet(DISMISSED_KEY, ids);
}

export function getSnoozedAlertIds(): Set<string> {
  return getStoredSet(SNOOZED_KEY);
}

export function snoozeAlertId(id: string): void {
  const ids = getSnoozedAlertIds();
  ids.add(id);
  storeSet(SNOOZED_KEY, ids);
}

export function unsnoozeAlertId(id: string): void {
  const ids = getSnoozedAlertIds();
  ids.delete(id);
  storeSet(SNOOZED_KEY, ids);
}

export function clearDismissedLocalStorage(): void {
  storeSet(DISMISSED_KEY, new Set());
}

export function clearSnoozedLocalStorage(): void {
  storeSet(SNOOZED_KEY, new Set());
}

export function clearAllAlertLocalStorage(): void {
  storeSet(DISMISSED_KEY, new Set());
  storeSet(SNOOZED_KEY, new Set());
}

export function buildAlertId(
  repoId: string,
  machineId: string,
  reason: string,
): string {
  const raw = `${repoId}::${machineId}::${reason}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `alert_${Math.abs(hash).toString(36)}`;
}

export function severityFromRisk(
  risk: "high" | "medium" | "low" | "none",
): AlertSeverity {
  if (risk === "high") return "high";
  if (risk === "medium") return "medium";
  return "low";
}

export function reasonFromLabel(label: string): string {
  const cleaned = label.replace(/^(Needs review|Review before push|Review before push)\s*[-–—]\s*/i, "").trim();
  return cleaned || label;
}

export function buildAlerts(
  needsActionItems: ClassifiedItem[],
  dismissedIds?: Set<string>,
  snoozedIds?: Set<string>,
): Alert[] {
  const dismissed = dismissedIds ?? getDismissedAlertIds();
  const snoozed = snoozedIds ?? getSnoozedAlertIds();

  const alerts: Alert[] = [];

  for (const item of needsActionItems) {
    const reason = reasonFromLabel(item.label);
    const repoId = item.repoId;
    const machines = item.machines.length > 0 ? item.machines : ["unknown"];

    for (const machineId of machines) {
      const id = buildAlertId(repoId, machineId, reason);
      alerts.push({
        id,
        repoId,
        displayName: item.displayName,
        machine: machineId,
        bucket: item.bucket,
        reason,
        severity: severityFromRisk(item.risk),
        recommendation: item.recommendation,
        dismissed: dismissed.has(id),
        snoozed: snoozed.has(id),
      });
    }
  }

  return alerts;
}
