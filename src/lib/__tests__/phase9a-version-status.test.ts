import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { buildAlertId } from "../maintenance-alerts";

const repoRoot = process.cwd();

const TARGET_VERSION = "0.8.3-phase8d-alert-preferences";
const TARGET_TAG = "v0.8.3-phase8d-alert-preferences";
const STALE_VERSION = "0.7.3-phase7c-cleanup-queue";

describe("Phase 9A version status centralization", () => {
  it("app-version.ts exports correct APP_VERSION", () => {
    const source = readFileSync(join(repoRoot, "src/lib/app-version.ts"), "utf8");
    expect(source).toContain(`APP_VERSION = "${TARGET_VERSION}"`);
  });

  it("app-version.ts exports correct APP_RELEASE_TAG", () => {
    const source = readFileSync(join(repoRoot, "src/lib/app-version.ts"), "utf8");
    expect(source).toContain(`APP_RELEASE_TAG = "${TARGET_TAG}"`);
  });

  it("app-version.ts exports APP_RELEASE_PHASE", () => {
    const source = readFileSync(join(repoRoot, "src/lib/app-version.ts"), "utf8");
    expect(source).toContain("APP_RELEASE_PHASE");
    expect(source).toContain("Phase 8D");
  });

  it("app-version.ts exports APP_RELEASE_LABEL", () => {
    const source = readFileSync(join(repoRoot, "src/lib/app-version.ts"), "utf8");
    expect(source).toContain("APP_RELEASE_LABEL");
    expect(source).toContain("Alert Preferences");
  });

  it("app-version.ts exports APP_RELEASE_COMMIT", () => {
    const source = readFileSync(join(repoRoot, "src/lib/app-version.ts"), "utf8");
    expect(source).toContain("APP_RELEASE_COMMIT");
    expect(source).toContain("4ad8aee");
  });

  it("dashboard-adapter imports from centralized version source", () => {
    const adapter = readFileSync(join(repoRoot, "src/lib/dashboard-adapter.ts"), "utf8");
    expect(adapter).toContain('import { APP_VERSION } from "@/lib/app-version"');
    expect(adapter).toContain("version: APP_VERSION,");
    expect(adapter).not.toContain("0.7.3");
    expect(adapter).not.toContain("phase7c");
    expect(adapter).not.toContain("cleanup-queue");
  });

  it("header version pill renders activeData.version", () => {
    const dashboard = readFileSync(join(repoRoot, "src/components/dashboard.tsx"), "utf8");
    expect(dashboard).toContain("{activeData.version}");
    const pillMatches = dashboard.match(/activeData\.version/g);
    expect(pillMatches).not.toBeNull();
    expect(pillMatches!.length).toBeGreaterThanOrEqual(3);
  });

  it("Settings modal shows App version using activeData.version", () => {
    const dashboard = readFileSync(join(repoRoot, "src/components/dashboard.tsx"), "utf8");
    expect(dashboard).toContain("App version");
    const settingsVersionPattern = /App version[\s\S]*?{activeData\.version}/;
    expect(settingsVersionPattern.test(dashboard)).toBe(true);
  });

  it("Debug / Status Dock shows App version", () => {
    const dashboard = readFileSync(join(repoRoot, "src/components/dashboard.tsx"), "utf8");
    expect(dashboard).toContain('label="App version"');
  });

  it("Debug / Status Dock shows Release tag row", () => {
    const dashboard = readFileSync(join(repoRoot, "src/components/dashboard.tsx"), "utf8");
    expect(dashboard).toContain('label="Release tag"');
    expect(dashboard).toContain("{APP_RELEASE_TAG}");
  });

  it("Settings modal shows release tag", () => {
    const dashboard = readFileSync(join(repoRoot, "src/components/dashboard.tsx"), "utf8");
    expect(dashboard).toContain("{APP_RELEASE_TAG}");
  });

  it("dashboard imports APP_RELEASE_TAG from centralized source", () => {
    const dashboard = readFileSync(join(repoRoot, "src/components/dashboard.tsx"), "utf8");
    expect(dashboard).toContain('import { APP_RELEASE_TAG } from "@/lib/app-version"');
  });

  it("no stale version 0.7.3 appears in dashboard source", () => {
    const dashboard = readFileSync(join(repoRoot, "src/components/dashboard.tsx"), "utf8");
    expect(dashboard).not.toContain(STALE_VERSION);
  });

  it("no stale version 0.7.3 appears in dashboard-adapter source", () => {
    const adapter = readFileSync(join(repoRoot, "src/lib/dashboard-adapter.ts"), "utf8");
    expect(adapter).not.toContain(STALE_VERSION);
  });

  it("no execute/push/delete repo controls introduced", () => {
    const dashboard = readFileSync(join(repoRoot, "src/components/dashboard.tsx"), "utf8");
    expect(dashboard).not.toContain("git push");
    expect(dashboard).not.toContain("git execute");
    expect(dashboard).not.toContain("deleteRepo");
    expect(dashboard).not.toContain("executeCommand");
  });
});

describe("Phase 9A.1 alert hard refresh persistence", () => {
  it("server prefs useEffect gates on prefs.updatedAt > 0", () => {
    const dashboard = readFileSync(join(repoRoot, "src/components/dashboard.tsx"), "utf8");
    expect(dashboard).toContain("prefs.updatedAt > 0");
  });

  it("server prefs useEffect sets serverPrefsLoaded on non-ok response", () => {
    const dashboard = readFileSync(join(repoRoot, "src/components/dashboard.tsx"), "utf8");
    expect(dashboard).toContain("if (!res.ok) {");
    expect(dashboard).toContain("setServerPrefsLoaded(true)");
  });

  it("server prefs only overwrites dismissedAlertIds when updatedAt > 0", () => {
    const dashboard = readFileSync(join(repoRoot, "src/components/dashboard.tsx"), "utf8");
    const dismissedPattern = /setDismissedAlertIds\(fromServerDismissed\)/g;
    const matches = dashboard.match(dismissedPattern);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(1);
  });

  it("Alert Center 'Open Action Center' still works", () => {
    const dashboard = readFileSync(join(repoRoot, "src/components/dashboard.tsx"), "utf8");
    expect(dashboard).toContain("Open Action Center");
    expect(dashboard).toContain("handleActionCenterOpen");
  });

  it("Settings reset controls still present", () => {
    const dashboard = readFileSync(join(repoRoot, "src/components/dashboard.tsx"), "utf8");
    expect(dashboard).toContain("Clear dismissed");
    expect(dashboard).toContain("Clear snoozed");
    expect(dashboard).toContain("Clear all");
  });

  it("handleClearDismissed calls clearDismissedLocalStorage and syncs to server", () => {
    const dashboard = readFileSync(join(repoRoot, "src/components/dashboard.tsx"), "utf8");
    expect(dashboard).toContain("clearDismissedLocalStorage()");
    expect(dashboard).toContain("syncClearToServer");
  });

  it("handleClearSnoozed calls clearSnoozedLocalStorage", () => {
    const dashboard = readFileSync(join(repoRoot, "src/components/dashboard.tsx"), "utf8");
    expect(dashboard).toContain("clearSnoozedLocalStorage()");
  });

  it("server localStorage sync only happens inside updatedAt > 0 guard", () => {
    const dashboard = readFileSync(join(repoRoot, "src/components/dashboard.tsx"), "utf8");
    const guardBlock = dashboard.match(/if \(prefs\.updatedAt > 0\) \{[\s\S]*?\n        \}/);
    expect(guardBlock).not.toBeNull();
    expect(guardBlock![0]).toContain("localStorage.setItem");
    expect(guardBlock![0]).toContain("gh-tracker-alert-dismissed");
  });

  it("preferences route GET returns updatedAt field", () => {
    const route = readFileSync(join(repoRoot, "src/app/api/alerts/preferences/route.ts"), "utf8");
    expect(route).toContain("updatedAt");
  });

  it("buildAlertId is stable for same inputs", () => {
    const id1 = buildAlertId("repo-x", "nuc1", "dirty files");
    const id2 = buildAlertId("repo-x", "nuc1", "dirty files");
    expect(id1).toBe(id2);
  });

  it("Phase 9A version polish still intact in dashboard", () => {
    const dashboard = readFileSync(join(repoRoot, "src/components/dashboard.tsx"), "utf8");
    expect(dashboard).toContain('import { APP_RELEASE_TAG } from "@/lib/app-version"');
    expect(dashboard).not.toContain(STALE_VERSION);
  });

  it("no execute/push/delete controls in hard refresh fix", () => {
    const dashboard = readFileSync(join(repoRoot, "src/components/dashboard.tsx"), "utf8");
    expect(dashboard).not.toContain("git push");
    expect(dashboard).not.toContain("deleteRepo");
    expect(dashboard).not.toContain("executeCommand");
  });
});
