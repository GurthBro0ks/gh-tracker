import type { ClassifiedItem, MaintenanceBucket } from "@/lib/maintenance-classifier";
import type { AlertPreferences } from "@/lib/alert-preferences";

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
const LOCAL_UPDATED_AT_KEY = "gh-tracker-alert-preferences-updated";

function getStoredSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set<string>();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set<string>();
    return new Set(parsed.filter((entry): entry is string => typeof entry === "string"));
  } catch {
    return new Set<string>();
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
  touchLocalUpdatedAt();
}

export function restoreAlertId(id: string): void {
  const ids = getDismissedAlertIds();
  ids.delete(id);
  storeSet(DISMISSED_KEY, ids);
  touchLocalUpdatedAt();
}

function setLocalUpdatedAt(value: number): void {
  try {
    localStorage.setItem(LOCAL_UPDATED_AT_KEY, value.toString());
  } catch {
  }
}

function readLocalUpdatedAt(): number {
  const raw = localStorage.getItem(LOCAL_UPDATED_AT_KEY);
  if (!raw) return 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function touchLocalUpdatedAt(value?: number): void {
  setLocalUpdatedAt(value ?? Date.now());
}

export function getSnoozedAlertIds(): Set<string> {
  const raw = localStorage.getItem(SNOOZED_KEY);
  if (!raw) return new Set<string>();
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) {
      const now = Date.now();
      const ids = new Set<string>();
      for (const [id, until] of Object.entries(parsed)) {
        if (typeof until === "number" && now < until) {
          ids.add(id);
        }
      }
      return ids;
    }
    return new Set<string>();
  } catch {
    return new Set<string>();
  }
}

export function getSnoozedUntilByAlertId(): Record<string, number> {
  const raw = localStorage.getItem(SNOOZED_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed;
    }
    return {};
  } catch {
    return {};
  }
}

export function snoozeAlertId(id: string, until: number = Date.now() + 3600000): void {
  const raw = localStorage.getItem(SNOOZED_KEY);
  let parsed: Record<string, number> = {};
  if (raw) {
    try {
      parsed = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) {
        parsed = {};
      }
    } catch {
      parsed = {};
    }
  }
  parsed[id] = until;
  try {
    localStorage.setItem(SNOOZED_KEY, JSON.stringify(parsed));
  } catch {
  }
  touchLocalUpdatedAt();
}

export function unsnoozeAlertId(id: string): void {
  const raw = localStorage.getItem(SNOOZED_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null) {
      delete parsed[id];
      try {
        localStorage.setItem(SNOOZED_KEY, JSON.stringify(parsed));
      } catch {
      }
    }
  } catch {
  }
  touchLocalUpdatedAt();
}

export function clearDismissedLocalStorage(): void {
  storeSet(DISMISSED_KEY, new Set());
  touchLocalUpdatedAt();
}

export function clearSnoozedLocalStorage(): void {
  try {
    localStorage.setItem(SNOOZED_KEY, JSON.stringify({}));
  } catch {
  }
  touchLocalUpdatedAt();
}

export function clearAllAlertLocalStorage(): void {
  storeSet(DISMISSED_KEY, new Set());
  try {
    localStorage.setItem(SNOOZED_KEY, JSON.stringify({}));
  } catch {
  }
  touchLocalUpdatedAt();
}

export function getLocalPreferences(): AlertPreferences {
  return {
    dismissedAlertIds: Array.from(getDismissedAlertIds()),
    snoozedUntilByAlertId: getSnoozedUntilByAlertId(),
    updatedAt: readLocalUpdatedAt(),
  };
}

export function persistLocalPreferences(prefs: AlertPreferences): void {
  storeSet(DISMISSED_KEY, new Set(prefs.dismissedAlertIds));
  try {
    localStorage.setItem(SNOOZED_KEY, JSON.stringify(prefs.snoozedUntilByAlertId));
  } catch {
  }
  touchLocalUpdatedAt(prefs.updatedAt);
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
