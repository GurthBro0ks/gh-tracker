import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { writeFile, mkdir, unlink, rmdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const TEST_DIR = path.join(process.cwd(), "data", "runtime-test");

describe("alert preferences storage", () => {
  beforeEach(async () => {
    if (!existsSync(TEST_DIR)) {
      await mkdir(TEST_DIR, { recursive: true });
    }
  });

  afterEach(async () => {
    const file = path.join(TEST_DIR, "alert-preferences.json");
    const tmp = path.join(TEST_DIR, "alert-preferences.json.tmp");
    try { await unlink(file); } catch {}
    try { await unlink(tmp); } catch {}
    try { await rmdir(TEST_DIR); } catch {}
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
    const { readAlertPreferences } = await import("../alert-preferences");
    const file = path.join(process.cwd(), "data", "runtime", "alert-preferences.json");
    const dir = path.dirname(file);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    await writeFile(file, "not valid json{{{", "utf-8");
    const prefs = await readAlertPreferences();
    expect(prefs.dismissedAlertIds).toEqual([]);
    expect(prefs.snoozedUntilByAlertId).toEqual({});
    expect(prefs.updatedAt).toBe(0);
    try { await unlink(file); } catch {}
  });

  it("handles corrupted structure (null fields)", async () => {
    const { readAlertPreferences, ensureRuntimeDir } = await import("../alert-preferences");
    await ensureRuntimeDir();
    const file = path.join(process.cwd(), "data", "runtime", "alert-preferences.json");
    await writeFile(file, JSON.stringify({ dismissedAlertIds: null, snoozedUntilByAlertId: null, updatedAt: null }), "utf-8");
    const prefs = await readAlertPreferences();
    expect(prefs.dismissedAlertIds).toEqual([]);
    expect(prefs.snoozedUntilByAlertId).toEqual({});
    expect(prefs.updatedAt).toBe(0);
    try { await unlink(file); } catch {}
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
    const tmpPath = path.join(process.cwd(), "data", "runtime", "alert-preferences.json.tmp");
    expect(existsSync(tmpPath)).toBe(false);
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
    const file = path.join(process.cwd(), "data", "runtime", "alert-preferences.json");
    await writeFile(file, JSON.stringify({ dismissedAlertIds: ["only_dismissed"] }), "utf-8");
    const { readAlertPreferences } = await import("../alert-preferences");
    const prefs = await readAlertPreferences();
    expect(prefs.dismissedAlertIds).toEqual(["only_dismissed"]);
    expect(prefs.snoozedUntilByAlertId).toEqual({});
    expect(prefs.updatedAt).toBe(0);
    try { await unlink(file); } catch {}
  });
});
