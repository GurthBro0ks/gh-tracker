import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { buildCanonicalRepos } from "@/lib/dashboard-adapter";

const repoRoot = process.cwd();

describe("phase6a action center", () => {
  it("renders action center and section labels in repo habitat", () => {
    const source = readFileSync(join(repoRoot, "src/components/repo-habitat.tsx"), "utf8");
    expect(source).toContain("Action Center");
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
    expect(source).toContain("git status --branch --short");
    expect(source).not.toContain("git reset --hard");
    expect(source).not.toContain("git clean -fd");
    expect(source).not.toContain("git push --force");
    expect(source).not.toContain("rm -rf");
    expect(source).not.toContain("sudo ");
  });

  it("represents mixed dirty state and preserves machine/location details", () => {
    const repos = [{ repoId: "gh-tracker", owner: "GurthBro0ks", name: "gh-tracker", canonicalRemote: "git@github.com:GurthBro0ks/gh-tracker.git", primaryLanguage: "TypeScript", github: null }];
    const rows = [
      { id: "a", repoId: "gh-tracker", machineId: "nuc1", path: "/opt/slimy/gh-tracker", branch: "main", dirty: true, unpushedCommits: 2 },
      { id: "b", repoId: "gh-tracker", machineId: "nuc2", path: "/opt/slimy/gh-tracker", branch: "main", dirty: false, unpushedCommits: 0 },
    ];
    const locations = [
      { id: "a", machineId: "nuc1", repoId: "gh-tracker", path: "/opt/slimy/gh-tracker", canonicalPath: "/opt/slimy/gh-tracker", remote: "git@github.com:GurthBro0ks/gh-tracker.git", canonicalRemote: "git@github.com:GurthBro0ks/gh-tracker.git", currentBranch: "main", headSha: "111", dirty: true, stagedCount: 1, unstagedCount: 0, untrackedCount: 0, aheadCount: 2, behindCount: 0, latestCommitAt: null },
      { id: "b", machineId: "nuc2", repoId: "gh-tracker", path: "/opt/slimy/gh-tracker", canonicalPath: "/opt/slimy/gh-tracker", remote: "git@github.com:GurthBro0ks/gh-tracker.git", canonicalRemote: "git@github.com:GurthBro0ks/gh-tracker.git", currentBranch: "main", headSha: "222", dirty: false, stagedCount: 0, unstagedCount: 0, untrackedCount: 0, aheadCount: 0, behindCount: 1, latestCommitAt: null },
    ];
    const machineStats = new Map<string, { machineId: string; commits: number; pushes: number; additions: number; deletions: number; dirty: boolean; unpushedCommits: number; branch: string; latestCommitAt: string | null }>();
    machineStats.set("gh-tracker:nuc1", { machineId: "nuc1", commits: 3, pushes: 0, additions: 30, deletions: 5, dirty: true, unpushedCommits: 2, branch: "main", latestCommitAt: null });
    machineStats.set("gh-tracker:nuc2", { machineId: "nuc2", commits: 1, pushes: 1, additions: 10, deletions: 4, dirty: false, unpushedCommits: 0, branch: "main", latestCommitAt: null });

    const canonical = buildCanonicalRepos(repos, rows, locations, machineStats);
    expect(canonical).toHaveLength(1);
    expect(canonical[0]?.dirtyState).toBe("mixed");
    expect(canonical[0]?.perMachineDetails).toHaveLength(2);
    expect(canonical[0]?.perLocationDetails).toHaveLength(2);
  });

  it("uses phase6a version and excludes nousearch-hermes-agent", () => {
    const adapter = readFileSync(join(repoRoot, "src/lib/dashboard-adapter.ts"), "utf8");
    expect(adapter).toContain("0.6.0-phase6a-action-center");
    const latestSummaryPath = join(repoRoot, "data/github/remotes/latest-summary.json");
    const json = readFileSync(latestSummaryPath, "utf8").toLowerCase();
    expect(json).not.toContain("nousearch-hermes-agent");
  });
});
