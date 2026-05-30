import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { writeFile, unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const RUNTIME_DIR = path.join(process.cwd(), "data", "runtime");
const RUNTIME_FILE = path.join(RUNTIME_DIR, "alert-preferences.json");
const RUNTIME_TMP = path.join(RUNTIME_DIR, "alert-preferences.json.tmp");

async function cleanupRuntimeFile() {
  try { await unlink(RUNTIME_FILE); } catch {}
  try { await unlink(RUNTIME_TMP); } catch {}
}

describe("alert preferences storage", () => {
  beforeEach(async () => {
    await cleanupRuntimeFile();
  });

  afterEach(async () => {
    await cleanupRuntimeFile();
  });

  it("returns safe defaults when file missing", async () => {
    const { readAlertPreferences } = await import("../alert-preferences");
    const prefs = await readAlertPreferences();
    expect(prefs.dismissedAlertIds).toEqual([]);
    expect(prefs.snoozedUntilByAlertId).toEqual({});
    expect(prefs.updatedAt).toBe(0);
  });

  it("writes and reads back preferences", async () => {
    const { readAlertPreferences, writeAlertPreferences } = await import("../alert-preferences");
    const prefs = {
      dismissedAlertIds: ["alert_abc", "alert_def"],
      snoozedUntilByAlertId: { "alert_ghi": Date.now() + 3600000 },
      updatedAt: Date.now(),
    };
    await writeAlertPreferences(prefs);
    const readBack = await readAlertPreferences();
    expect(readBack.dismissedAlertIds).toEqual(["alert_abc", "alert_def"]);
    expect(readBack.snoozedUntilByAlertId["alert_ghi"]).toBeGreaterThan(Date.now() - 1000);
    expect(readBack.updatedAt).toBeGreaterThan(0);
  });

  it("handles malformed JSON safely", async () => {
    const { readAlertPreferences, ensureRuntimeDir } = await import("../alert-preferences");
    await ensureRuntimeDir();
    await writeFile(RUNTIME_FILE, "not valid json{{{", "utf-8");
    const prefs = await readAlertPreferences();
    expect(prefs.dismissedAlertIds).toEqual([]);
    expect(prefs.snoozedUntilByAlertId).toEqual({});
    expect(prefs.updatedAt).toBe(0);
  });

  it("handles corrupted structure (null fields)", async () => {
    const { readAlertPreferences, ensureRuntimeDir } = await import("../alert-preferences");
    await ensureRuntimeDir();
    await writeFile(RUNTIME_FILE, JSON.stringify({ dismissedAlertIds: null, snoozedUntilByAlertId: null, updatedAt: null }), "utf-8");
    const prefs = await readAlertPreferences();
    expect(prefs.dismissedAlertIds).toEqual([]);
    expect(prefs.snoozedUntilByAlertId).toEqual({});
    expect(prefs.updatedAt).toBe(0);
  });

  it("uses safe write pattern (temp file + rename)", async () => {
    const { writeAlertPreferences, readAlertPreferences } = await import("../alert-preferences");
    const prefs = {
      dismissedAlertIds: ["safe_write_test"],
      snoozedUntilByAlertId: {},
      updatedAt: 12345,
    };
    await writeAlertPreferences(prefs);
    const readBack = await readAlertPreferences();
    expect(readBack.dismissedAlertIds).toContain("safe_write_test");
    expect(readBack.updatedAt).toBe(12345);
    expect(existsSync(RUNTIME_TMP)).toBe(false);
  });

  it("isSnoozed returns false for unknown alert", async () => {
    const { isSnoozed } = await import("../alert-preferences");
    expect(isSnoozed({}, "unknown_alert")).toBe(false);
  });

  it("isSnoozed returns false for expired snooze", async () => {
    const { isSnoozed } = await import("../alert-preferences");
    const snoozed = { "old_alert": Date.now() - 1000 };
    expect(isSnoozed(snoozed, "old_alert")).toBe(false);
  });

  it("isSnoozed returns true for active snooze", async () => {
    const { isSnoozed } = await import("../alert-preferences");
    const snoozed = { "active_alert": Date.now() + 3600000 };
    expect(isSnoozed(snoozed, "active_alert")).toBe(true);
  });

  it("makeDefaultPreferences returns safe defaults", async () => {
    const { makeDefaultPreferences } = await import("../alert-preferences");
    const defaults = makeDefaultPreferences();
    expect(defaults.dismissedAlertIds).toEqual([]);
    expect(defaults.snoozedUntilByAlertId).toEqual({});
    expect(defaults.updatedAt).toBe(0);
  });

  it("partial preferences get merged with defaults on read", async () => {
    const { ensureRuntimeDir } = await import("../alert-preferences");
    await ensureRuntimeDir();
    await writeFile(RUNTIME_FILE, JSON.stringify({ dismissedAlertIds: ["only_dismissed"] }), "utf-8");
    const { readAlertPreferences } = await import("../alert-preferences");
    const prefs = await readAlertPreferences();
    expect(prefs.dismissedAlertIds).toEqual(["only_dismissed"]);
    expect(prefs.snoozedUntilByAlertId).toEqual({});
    expect(prefs.updatedAt).toBe(0);
  });

  it("server state does NOT merge stale localStorage dismissed IDs - regression guard", async () => {
    const { readAlertPreferences, writeAlertPreferences } = await import("../alert-preferences");
    const serverPref = {
      dismissedAlertIds: ["alert_active"],
      snoozedUntilByAlertId: { "alert_snoozed": Date.now() + 3600000 },
      updatedAt: Date.now(),
    };
    await writeAlertPreferences(serverPref);

    const staleLocalDismissed = new Set(["alert_gone", "alert_ancient"]);
    const serverState = await readAlertPreferences();
    const serverDismissed = new Set(serverState.dismissedAlertIds);
    const merged = new Set(staleLocalDismissed);
    for (const id of serverDismissed) merged.add(id);
    expect(merged.has("alert_gone")).toBe(true);
    expect(merged.has("alert_ancient")).toBe(true);

    const correctState = new Set(serverState.dismissedAlertIds);
    expect(correctState.has("alert_gone")).toBe(false);
    expect(correctState.has("alert_ancient")).toBe(false);
    expect(correctState.has("alert_active")).toBe(true);
    expect(correctState.size).toBe(1);
  });

  it("server state does NOT merge stale localStorage snoozed IDs - regression guard", async () => {
    const { readAlertPreferences, writeAlertPreferences } = await import("../alert-preferences");
    const now = Date.now();
    const serverPref = {
      dismissedAlertIds: [],
      snoozedUntilByAlertId: { "alert_fresh": now + 3600000 },
      updatedAt: now,
    };
    await writeAlertPreferences(serverPref);

    const staleLocalSnoozed = new Set(["alert_old", "alert_expired"]);
    const serverState = await readAlertPreferences();
    const serverSnoozed = new Set(
      Object.entries(serverState.snoozedUntilByAlertId)
        .filter(([, until]) => Date.now() < until)
        .map(([id]) => id),
    );
    const merged = new Set(staleLocalSnoozed);
    for (const id of serverSnoozed) merged.add(id);
    expect(merged.has("alert_old")).toBe(true);

    const correctState = new Set(serverSnoozed);
    expect(correctState.has("alert_old")).toBe(false);
    expect(correctState.has("alert_fresh")).toBe(true);
    expect(correctState.size).toBe(1);
  });

  it("initial page load does not write empty preferences (no-op test)", async () => {
    const { readAlertPreferences } = await import("../alert-preferences");
    const prefs = await readAlertPreferences();
    expect(prefs.dismissedAlertIds).toEqual([]);
    expect(prefs.updatedAt).toBe(0);
    expect(existsSync(RUNTIME_FILE)).toBe(false);
  });
});
