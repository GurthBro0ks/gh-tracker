import { describe, expect, it } from "vitest";
import type { CanonicalRepoView } from "@/lib/dashboard-adapter";
import { buildCleanupPlanner } from "../cleanup-planner";

function makeRepo(partial: Partial<CanonicalRepoView> & Pick<CanonicalRepoView, "repoId">): CanonicalRepoView {
  return {
    repoId: partial.repoId,
    displayName: partial.displayName ?? partial.repoId,
    owner: partial.owner ?? "GurthBro0ks",
    canonicalRemote: partial.canonicalRemote ?? `git@github.com:GurthBro0ks/${partial.repoId}.git`,
    primaryLanguage: partial.primaryLanguage ?? "TypeScript",
    machines: partial.machines ?? ["nuc1"],
    locationCount: partial.locationCount ?? 1,
    combinedCommits: partial.combinedCommits ?? 10,
    combinedPushes: partial.combinedPushes ?? 1,
    combinedAdditions: partial.combinedAdditions ?? 100,
    combinedDeletions: partial.combinedDeletions ?? 20,
    dirtyState: partial.dirtyState ?? "clean",
    unpushedTotal: partial.unpushedTotal ?? 0,
    latestBranch: partial.latestBranch ?? "main",
    latestCommitAt: partial.latestCommitAt ?? null,
    github: partial.github ?? null,
    perMachineDetails: partial.perMachineDetails ?? [{ machineId: "nuc1", commits: 10, pushes: 1, additions: 100, deletions: 20, dirty: false, unpushedCommits: partial.unpushedTotal ?? 0, branch: "main", latestCommitAt: null }],
    perLocationDetails: partial.perLocationDetails ?? [{ id: `${partial.repoId}-loc`, machineId: "nuc1", path: `/opt/slimy/${partial.repoId}`, branch: "main", dirty: partial.dirtyState === "dirty" || partial.dirtyState === "mixed", unpushedCommits: partial.unpushedTotal ?? 0, headSha: "", stagedCount: 0, unstagedCount: 0, untrackedCount: 0 }],
  };
}

describe("cleanup planner", () => {
  it("ranks dirty+unpushed above clean repos deterministically", () => {
    const clean = makeRepo({ repoId: "clean-repo", dirtyState: "clean", unpushedTotal: 0, combinedCommits: 12 });
    const urgent = makeRepo({ repoId: "urgent-repo", dirtyState: "mixed", unpushedTotal: 12, machines: ["nuc1", "nuc2"], perLocationDetails: [
      { id: "u1", machineId: "nuc1", path: "/opt/slimy/urgent-repo", branch: "main", dirty: true, unpushedCommits: 7, headSha: "", stagedCount: 0, unstagedCount: 0, untrackedCount: 0 },
      { id: "u2", machineId: "nuc2", path: "/opt/slimy/urgent-repo", branch: "main", dirty: true, unpushedCommits: 5, headSha: "", stagedCount: 0, unstagedCount: 0, untrackedCount: 0 },
    ] });

    const planner = buildCleanupPlanner([clean, urgent]);
    expect(planner[0].repoId).toBe("urgent-repo");
    expect(planner[0].priorityBand).toBe("critical");
    expect(planner[0].reasons.join(" ")).toContain("Mixed state across machines");
    expect(planner[1].priorityScore).toBeLessThan(planner[0].priorityScore);
  });

  it("keeps commands safe and copy-only oriented", () => {
    const repo = makeRepo({ repoId: "safety-repo", dirtyState: "dirty", unpushedTotal: 2 });
    const planner = buildCleanupPlanner([repo]);
    const group = planner[0].safeCommandGroups[0];
    const commands = group.commands.join("\n");
    expect(commands).toContain("git status --branch --short");
    expect(group.context).toBe("inspect-dirty");
    expect(commands).not.toContain("git reset --hard");
    expect(commands).not.toContain("git clean -fd");
    expect(commands).not.toContain("git push --force");
    expect(commands).not.toContain("rm -rf");
    expect(commands).not.toContain("sudo ");
  });

  it("generates verify-health commands for clean repos", () => {
    const repo = makeRepo({ repoId: "clean-repo", dirtyState: "clean", unpushedTotal: 0 });
    const planner = buildCleanupPlanner([repo]);
    const group = planner[0].safeCommandGroups[0];
    expect(group.context).toBe("verify-health");
    expect(group.commands.join("\n")).toContain("git remote -v");
  });

  it("generates inspect-unpushed commands for repos with unpushed commits", () => {
    const repo = makeRepo({ repoId: "unpushed-repo", dirtyState: "clean", unpushedTotal: 5 });
    const planner = buildCleanupPlanner([repo]);
    const group = planner[0].safeCommandGroups[0];
    expect(group.context).toBe("inspect-unpushed");
    expect(group.commands.join("\n")).toContain("@{u}..HEAD");
  });
});
