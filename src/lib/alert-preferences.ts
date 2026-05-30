import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { rename } from "fs/promises";
import path from "path";

const PREFERENCES_DIR = path.join(process.cwd(), "data", "runtime");
const PREFERENCES_FILE = path.join(PREFERENCES_DIR, "alert-preferences.json");

export type AlertPreferences = {
  dismissedAlertIds: string[];
  snoozedUntilByAlertId: Record<string, number>;
  updatedAt: number;
};

export function makeDefaultPreferences(): AlertPreferences {
  return {
    dismissedAlertIds: [],
    snoozedUntilByAlertId: {},
    updatedAt: 0,
  };
}

export async function ensureRuntimeDir(): Promise<void> {
  if (!existsSync(PREFERENCES_DIR)) {
    await mkdir(PREFERENCES_DIR, { recursive: true });
  }
}

export async function readAlertPreferences(): Promise<AlertPreferences> {
  try {
    if (!existsSync(PREFERENCES_FILE)) {
      return makeDefaultPreferences();
    }
    const raw = await readFile(PREFERENCES_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      dismissedAlertIds: Array.isArray(parsed.dismissedAlertIds) ? parsed.dismissedAlertIds : [],
      snoozedUntilByAlertId:
        typeof parsed.snoozedUntilByAlertId === "object" && parsed.snoozedUntilByAlertId !== null
          ? parsed.snoozedUntilByAlertId
          : {},
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : 0,
    };
  } catch {
    return makeDefaultPreferences();
  }
}

export function isSnoozed(snoozedUntilByAlertId: Record<string, number>, alertId: string): boolean {
  const until = snoozedUntilByAlertId[alertId];
  if (!until) return false;
  return Date.now() < until;
}

export async function writeAlertPreferences(prefs: AlertPreferences): Promise<void> {
  await ensureRuntimeDir();
  const tmpFile = PREFERENCES_FILE + ".tmp";
  await writeFile(tmpFile, JSON.stringify(prefs, null, 2), "utf-8");
  await rename(tmpFile, PREFERENCES_FILE);
}
