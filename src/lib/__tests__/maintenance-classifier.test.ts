import { describe, expect, it } from "vitest";
import type { CanonicalRepoView } from "@/lib/dashboard-adapter";
import type { CleanupPlannerEntry } from "@/lib/cleanup-planner";
import { classifyRepo, buildMaintenanceBuckets, BUCKET_LABELS } from "../maintenance-classifier";

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
    perMachineDetails: partial.perMachineDetails ?? [
      { machineId: "nuc1", commits: 10, pushes: 1, additions: 100, deletions: 20, dirty: false, unpushedCommits: partial.unpushedTotal ?? 0, branch: "main", latestCommitAt: null },
    ],
    perLocationDetails: partial.perLocationDetails ?? [
      { id: `${partial.repoId}-loc`, machineId: "nuc1", path: `/opt/slimy/${partial.repoId}`, branch: "main", dirty: partial.dirtyState === "dirty" || partial.dirtyState === "mixed", unpushedCommits: partial.unpushedTotal ?? 0, headSha: "", stagedCount: 0, unstagedCount: 0, untrackedCount: 0 },
    ],
  };
}

function makeEntry(
  repoId: string,
  overrides?: Partial<CleanupPlannerEntry>,
): CleanupPlannerEntry {
  return {
    repoId,
    displayName: overrides?.displayName ?? repoId,
    repoClass: "standard",
    suppressNormalCleanup: false,
    suggestedMode: "normal",
    safetyNote: null,
    priorityScore: overrides?.priorityScore ?? 0,
    priorityBand: overrides?.priorityBand ?? "info",
    reasons: overrides?.reasons ?? [],
    suggestions: overrides?.suggestions ?? [],
    recommendedActions: overrides?.recommendedActions ?? [],
    affectedMachines: overrides?.affectedMachines ?? ["nuc1"],
    affectedLocations: overrides?.affectedLocations ?? [
      { machineId: "nuc1", path: `/opt/slimy/${repoId}`, branch: "main", dirty: false, unpushedCommits: 0 },
    ],
    safeCommandGroups: overrides?.safeCommandGroups ?? [],
    proofCommandGroups: overrides?.proofCommandGroups ?? [],
  };
}

describe("maintenance classifier", () => {
  it("classifies mailbox_outbox as operational_hold", () => {
    const repo = makeRepo({
      repoId: "local-mailbox_outbox",
      perLocationDetails: [{
        id: "mb1",
        machineId: "nuc1",
        path: "/home/slimy/nuc-comms/mailbox_outbox",
        branch: "main",
        dirty: true,
        unpushedCommits: 21,
        headSha: "",
        stagedCount: 0,
        unstagedCount: 0,
        untrackedCount: 3,
      }],
      dirtyState: "dirty",
      unpushedTotal: 21,
    });
    const result = classifyRepo(repo, null);
    expect(result.bucket).toBe("operational_hold");
    expect(result.actionable).toBe(false);
    expect(result.label).toContain("Operational hold");
  });

  it("classifies sbuild as active_development", () => {
    const repo = makeRepo({ repoId: "sbuild", dirtyState: "dirty" });
    const result = classifyRepo(repo, null);
    expect(result.bucket).toBe("active_development");
    expect(result.actionable).toBe(false);
    expect(result.label).toContain("Active development");
  });

  it("classifies slimy-kb-game as active_development", () => {
    const repo = makeRepo({ repoId: "slimy-kb-game", dirtyState: "dirty" });
    const result = classifyRepo(repo, null);
    expect(result.bucket).toBe("active_development");
    expect(result.actionable).toBe(false);
    expect(result.label).toContain("Active development");
  });

  it("classifies pm_updown as runtime_local_state", () => {
    const repo = makeRepo({ repoId: "pm_updown_bot_bundle", dirtyState: "dirty" });
    const result = classifyRepo(repo, null);
    expect(result.bucket).toBe("runtime_local_state");
    expect(result.actionable).toBe(false);
    expect(result.label).toContain("Runtime/local state");
  });

  it("classifies slimy-monorepo as runtime_local_state", () => {
    const repo = makeRepo({ repoId: "slimy-monorepo", dirtyState: "dirty" });
    const result = classifyRepo(repo, null);
    expect(result.bucket).toBe("runtime_local_state");
    expect(result.actionable).toBe(false);
    expect(result.label).toContain("Runtime/local state");
  });

  it("classifies stale laptop snapshot as stale_snapshot", () => {
    const repo = makeRepo({
      repoId: "some-old-repo",
      machines: ["laptop"],
      dirtyState: "clean",
      unpushedTotal: 0,
    });
    const result = classifyRepo(repo, null);
    expect(result.bucket).toBe("stale_snapshot");
    expect(result.actionable).toBe(false);
    expect(result.label).toContain("Stale snapshot");
  });

  it("classifies diverged repo with high score as needs_action high risk", () => {
    const repo = makeRepo({
      repoId: "diverged-repo",
      dirtyState: "dirty",
      unpushedTotal: 12,
      perLocationDetails: [{
        id: "d1",
        machineId: "nuc1",
        path: "/opt/slimy/diverged-repo",
        branch: "main",
        dirty: true,
        unpushedCommits: 12,
        headSha: "",
        stagedCount: 5,
        unstagedCount: 3,
        untrackedCount: 1,
      }],
    });
    const entry = makeEntry("diverged-repo", { priorityScore: 85, priorityBand: "critical" });
    const result = classifyRepo(repo, entry);
    expect(result.bucket).toBe("needs_action");
    expect(result.actionable).toBe(true);
    expect(result.risk).toBe("high");
  });

  it("classifies dirty repo with medium score as needs_action medium risk", () => {
    const repo = makeRepo({
      repoId: "dirty-repo",
      dirtyState: "dirty",
      unpushedTotal: 0,
    });
    const entry = makeEntry("dirty-repo", { priorityScore: 35, priorityBand: "medium" });
    const result = classifyRepo(repo, entry);
    expect(result.bucket).toBe("needs_action");
    expect(result.actionable).toBe(true);
    expect(result.risk).toBe("medium");
  });

  it("classifies unpushed non-hold repo as needs_action", () => {
    const repo = makeRepo({
      repoId: "unpushed-repo",
      dirtyState: "clean",
      unpushedTotal: 5,
    });
    const entry = makeEntry("unpushed-repo", { priorityScore: 25, priorityBand: "low" });
    const result = classifyRepo(repo, entry);
    expect(result.bucket).toBe("needs_action");
    expect(result.actionable).toBe(true);
  });

  it("classifies clean repo with no issues as recently_resolved", () => {
    const repo = makeRepo({
      repoId: "clean-plugin-repo",
      dirtyState: "clean",
      unpushedTotal: 0,
      combinedCommits: 50,
    });
    const entry = makeEntry("clean-plugin-repo", { priorityScore: 0, priorityBand: "info" });
    const result = classifyRepo(repo, entry);
    expect(result.bucket).toBe("recently_resolved");
    expect(result.actionable).toBe(false);
    expect(result.label).toContain("Clean");
  });

  it("buildMaintenanceBuckets aggregates counts correctly", () => {
    const repos = [
      makeRepo({ repoId: "clean-repo", dirtyState: "clean", unpushedTotal: 0 }),
      makeRepo({
        repoId: "dirty-repo",
        dirtyState: "dirty",
        unpushedTotal: 3,
        perLocationDetails: [{
          id: "dr1",
          machineId: "nuc1",
          path: "/opt/slimy/dirty-repo",
          branch: "main",
          dirty: true,
          unpushedCommits: 3,
          headSha: "",
          stagedCount: 1,
          unstagedCount: 1,
          untrackedCount: 0,
        }],
      }),
      makeRepo({
        repoId: "local-mailbox_outbox",
        dirtyState: "dirty",
        unpushedTotal: 21,
        perLocationDetails: [{
          id: "mb1",
          machineId: "nuc1",
          path: "/home/slimy/nuc-comms/mailbox_outbox",
          branch: "main",
          dirty: true,
          unpushedCommits: 21,
          headSha: "",
          stagedCount: 0,
          unstagedCount: 0,
          untrackedCount: 3,
        }],
      }),
      makeRepo({ repoId: "sbuild", dirtyState: "dirty", unpushedTotal: 1 }),
      makeRepo({ repoId: "pm_updown_bot_bundle", dirtyState: "dirty", unpushedTotal: 0 }),
      makeRepo({ repoId: "laptop-only-repo", machines: ["laptop"], dirtyState: "clean" }),
    ];

    const entries = new Map<string, CleanupPlannerEntry>();
    entries.set("clean-repo", makeEntry("clean-repo"));
    entries.set("dirty-repo", makeEntry("dirty-repo", { priorityScore: 30, priorityBand: "medium" }));
    entries.set("local-mailbox_outbox", makeEntry("local-mailbox_outbox", { priorityScore: 5, priorityBand: "info" }));
    entries.set("sbuild", makeEntry("sbuild", { priorityScore: 5, priorityBand: "info" }));
    entries.set("pm_updown_bot_bundle", makeEntry("pm_updown_bot_bundle", { priorityScore: 15, priorityBand: "low" }));
    entries.set("laptop-only-repo", makeEntry("laptop-only-repo"));

    const buckets = buildMaintenanceBuckets(repos, entries, 4, 2);

    expect(buckets.counts.rawDirty).toBe(4);
    expect(buckets.counts.rawUnpushed).toBe(2);

    expect(buckets.needsAction.length).toBe(1);
    expect(buckets.needsAction[0].repoId).toBe("dirty-repo");
    expect(buckets.operationalHold.length).toBe(1);
    expect(buckets.operationalHold[0].repoId).toBe("local-mailbox_outbox");
    expect(buckets.activeDevelopment.length).toBe(1);
    expect(buckets.activeDevelopment[0].repoId).toBe("sbuild");
    expect(buckets.runtimeLocalState.length).toBe(1);
    expect(buckets.runtimeLocalState[0].repoId).toBe("pm_updown_bot_bundle");
    expect(buckets.staleSnapshot.length).toBe(1);
    expect(buckets.staleSnapshot[0].repoId).toBe("laptop-only-repo");
    expect(buckets.recentlyResolved.length).toBe(1);
    expect(buckets.recentlyResolved[0].repoId).toBe("clean-repo");

    expect(buckets.counts.actionable).toBe(1);
    expect(buckets.counts.knownHolds).toBe(4);
  });

  it("bucket labels are defined and human-readable", () => {
    const buckets: Array<import("@/lib/maintenance-classifier").MaintenanceBucket> = [
      "needs_action",
      "operational_hold",
      "active_development",
      "runtime_local_state",
      "stale_snapshot",
      "recently_resolved",
    ];
    for (const bucket of buckets) {
      expect(BUCKET_LABELS[bucket]).toBeDefined();
      expect(BUCKET_LABELS[bucket].length).toBeGreaterThan(3);
    }
  });

  it("classifies all remaining hold repos correctly in real-world scenario", () => {
    const repos: CanonicalRepoView[] = [
      makeRepo({ repoId: "mailbox_outbox", dirtyState: "dirty", unpushedTotal: 2 }),
      makeRepo({ repoId: "local-mailbox_outbox", dirtyState: "dirty", unpushedTotal: 21 }),
      makeRepo({ repoId: "sbuild", dirtyState: "dirty" }),
      makeRepo({ repoId: "slimy-kb-game", dirtyState: "dirty" }),
      makeRepo({ repoId: "pm_updown_bot_bundle", dirtyState: "dirty" }),
      makeRepo({ repoId: "slimy-monorepo", dirtyState: "dirty" }),
      makeRepo({ repoId: "gh-tracker", dirtyState: "dirty", perLocationDetails: [{ id: "gt1", machineId: "nuc1", path: "/opt/slimy/gh-tracker", branch: "main", dirty: true, unpushedCommits: 0, headSha: "", stagedCount: 0, unstagedCount: 1, untrackedCount: 0 }] }),
    ];

    const results = repos.map((r) => classifyRepo(r, null));
    const buckets = results.map((r) => r.bucket);

    expect(buckets).toContain("operational_hold");
    expect(buckets).toContain("active_development");
    expect(buckets).toContain("runtime_local_state");
    expect(buckets).toContain("needs_action");

    const mailboxItems = results.filter((r) => r.repoId.includes("mailbox_outbox"));
    expect(mailboxItems.every((r) => r.bucket === "operational_hold")).toBe(true);

    const devItems = results.filter((r) => r.repoId === "sbuild" || r.repoId === "slimy-kb-game");
    expect(devItems.every((r) => r.bucket === "active_development")).toBe(true);

    const runtimeItems = results.filter((r) => r.repoId === "pm_updown_bot_bundle" || r.repoId === "slimy-monorepo");
    expect(runtimeItems.every((r) => r.bucket === "runtime_local_state")).toBe(true);
  });
});
