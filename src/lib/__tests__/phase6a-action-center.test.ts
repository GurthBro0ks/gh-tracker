import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const repoRoot = process.cwd();

describe("phase6a action center", () => {
  it("renders action center and section labels in repo habitat", () => {
    const source = readFileSync(join(repoRoot, "src/components/repo-habitat.tsx"), "utf8");
    expect(source).toContain("Open Action Center");
    expect(source).toContain("Repo Action Center");
    expect(source).toContain("Overview");
    expect(source).toContain("Machines & Locations");
    expect(source).toContain("Local Git State");
    expect(source).toContain("GitHub Remote Health");
    expect(source).toContain("Care Plan");
    expect(source).toContain("Copy Commands");
  });

  it("keeps command text copy-only and non-destructive by default", () => {
    const source = readFileSync(join(repoRoot, "src/components/repo-habitat.tsx"), "utf8");
    expect(source).toContain("All actions are manual operator actions. This app does not execute commands.");
    expect(source).toContain("navigator.clipboard?.writeText");
    expect(source).toContain("Copy");
    expect(source).toContain("git status --branch --short");
    expect(source).not.toContain("git reset --hard");
    expect(source).not.toContain("git clean -fd");
    expect(source).not.toContain("git push --force");
    expect(source).not.toContain("rm -rf");
    expect(source).not.toContain("sudo ");
  });

  it("retains mixed dirty-state and canonical detail logic", () => {
    const source = readFileSync(join(repoRoot, "src/lib/dashboard-adapter.ts"), "utf8");
    expect(source).toContain('if (group.dirtyCount > 0 && group.cleanCount > 0) dirtyState = "mixed"');
    expect(source).toContain("perMachineDetails");
    expect(source).toContain("perLocationDetails");
  });

  it("uses phase6a version and excludes nousearch-hermes-agent", () => {
    const adapter = readFileSync(join(repoRoot, "src/lib/dashboard-adapter.ts"), "utf8");
    expect(adapter).toContain("0.6.0-phase6a-action-center");
    const latestSummaryPath = join(repoRoot, "data/github/remotes/latest-summary.json");
    const json = readFileSync(latestSummaryPath, "utf8").toLowerCase();
    expect(json).not.toContain("nousearch-hermes-agent");
  });
});
