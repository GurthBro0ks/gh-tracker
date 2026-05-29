import type { CanonicalRepoView, PerLocationDetail } from "@/lib/dashboard-adapter";
import type { CleanupPlannerEntry } from "@/lib/cleanup-planner";

export type MaintenanceBucket =
  | "needs_action"
  | "operational_hold"
  | "active_development"
  | "runtime_local_state"
  | "stale_snapshot"
  | "recently_resolved";

export type ClassifiedItem = {
  repoId: string;
  displayName: string;
  bucket: MaintenanceBucket;
  actionable: boolean;
  label: string;
  risk: "high" | "medium" | "low" | "none";
  recommendation: string;
  machines: string[];
  locations: Array<{
    machineId: string;
    path: string;
    dirty: boolean;
    unpushedCommits: number;
    branch: string;
  }>;
  entry: CleanupPlannerEntry | null;
};

export type MaintenanceBuckets = {
  needsAction: ClassifiedItem[];
  operationalHold: ClassifiedItem[];
  activeDevelopment: ClassifiedItem[];
  runtimeLocalState: ClassifiedItem[];
  staleSnapshot: ClassifiedItem[];
  recentlyResolved: ClassifiedItem[];
  counts: {
    rawDirty: number;
    rawUnpushed: number;
    actionable: number;
    knownHolds: number;
  };
};

export const BUCKET_LABELS: Record<MaintenanceBucket, string> = {
  needs_action: "Needs Action",
  operational_hold: "Operational Hold",
  active_development: "Active Development",
  runtime_local_state: "Runtime / Local State",
  stale_snapshot: "Stale Snapshot",
  recently_resolved: "Recently Resolved",
};

export const BUCKET_DESCRIPTIONS: Record<MaintenanceBucket, string> = {
  needs_action: "Real unresolved issues requiring attention",
  operational_hold: "Intentional no-push operational queues",
  active_development: "Repos intentionally in progress — do not clean",
  runtime_local_state: "Known runtime dirt and local state — review if needed",
  stale_snapshot: "Old laptop/snapshot entries — refresh source machine",
  recently_resolved: "Clean repos and resolved cleanup wins",
};

function classifyRepoInternal(
  repo: CanonicalRepoView,
  entry: CleanupPlannerEntry | null,
): {
  bucket: MaintenanceBucket;
  actionable: boolean;
  label: string;
  risk: "high" | "medium" | "low" | "none";
  recommendation: string;
} {
  const repoId = repo.repoId.toLowerCase();
  const paths = repo.perLocationDetails.map((l) => l.path);
  const allPaths = paths.join(" ").toLowerCase();
  const isDirty = repo.dirtyState === "dirty" || repo.dirtyState === "mixed";
  const hasUnpushed = repo.unpushedTotal > 0;
  const entryScore = entry?.priorityScore ?? 0;

  if (repoId.includes("mailbox_outbox") || allPaths.includes("mailbox_outbox")) {
    return {
      bucket: "operational_hold",
      actionable: false,
      label: "Operational hold — no push",
      risk: "low",
      recommendation: "Inspect queue state; do not push unless explicitly draining",
    };
  }

  if (repoId.includes("sbuild") || repoId.includes("slimy-kb-game")) {
    return {
      bucket: "active_development",
      actionable: false,
      label: "Active development — do not clean",
      risk: "low",
      recommendation: "Continue development; cleanup not required",
    };
  }

  if (repoId.includes("pm_updown") || repoId.includes("slimy-monorepo")) {
    return {
      bucket: "runtime_local_state",
      actionable: false,
      label: "Runtime/local state — review if cleanup needed",
      risk: "low",
      recommendation: "Runtime artifacts, review if cleanup needed",
    };
  }

  const onlyOnLaptop = repo.machines.length === 1 && repo.machines[0] === "laptop";
  if (onlyOnLaptop) {
    return {
      bucket: "stale_snapshot",
      actionable: false,
      label: "Stale snapshot — refresh source machine",
      risk: "low",
      recommendation: "Refresh laptop snapshot to get current state",
    };
  }

  const hasDiverged = repo.perLocationDetails.some(
    (loc) => loc.unpushedCommits > 0,
  );

  const hasStagedContent = repo.perLocationDetails.some(
    (loc) => loc.stagedCount > 0,
  );

  if (isDirty && hasUnpushed && hasStagedContent) {
    return {
      bucket: "needs_action",
      actionable: true,
      label: "Needs review — dirty with staged changes and unpushed commits",
      risk: "high",
      recommendation: "Review and commit or stash local changes, then push",
    };
  }

  if (hasDiverged && isDirty) {
    return {
      bucket: "needs_action",
      actionable: true,
      label: "Needs review — diverged and dirty",
      risk: "high",
      recommendation: "Review branch state and resolve divergence",
    };
  }

  if (isDirty && entryScore >= 30) {
    return {
      bucket: "needs_action",
      actionable: true,
      label: "Needs review — dirty working tree",
      risk: "medium",
      recommendation: "Review and commit or stash local changes",
    };
  }

  if (hasUnpushed && entryScore >= 20) {
    return {
      bucket: "needs_action",
      actionable: true,
      label: "Review before push — unpushed commits",
      risk: "medium",
      recommendation: "Review unpushed commits and push after review",
    };
  }

  if (isDirty) {
    return {
      bucket: "needs_action",
      actionable: true,
      label: "Needs review — dirty state",
      risk: "low",
      recommendation: "Review dirty files and determine if cleanup is needed",
    };
  }

  if (hasUnpushed) {
    return {
      bucket: "needs_action",
      actionable: true,
      label: "Review before push",
      risk: "low",
      recommendation: "Review and push pending commits",
    };
  }

  return {
    bucket: "recently_resolved",
    actionable: false,
    label: "Clean — no issues detected",
    risk: "none",
    recommendation: "No action needed",
  };
}

export function classifyRepo(
  repo: CanonicalRepoView,
  entry: CleanupPlannerEntry | null,
): ClassifiedItem {
  const result = classifyRepoInternal(repo, entry);
  return {
    repoId: repo.repoId,
    displayName: repo.displayName,
    bucket: result.bucket,
    actionable: result.actionable,
    label: result.label,
    risk: result.risk,
    recommendation: result.recommendation,
    machines: repo.machines,
    locations: repo.perLocationDetails.map((loc: PerLocationDetail) => ({
      machineId: loc.machineId,
      path: loc.path,
      dirty: loc.dirty,
      unpushedCommits: loc.unpushedCommits,
      branch: loc.branch,
    })),
    entry,
  };
}

export function buildMaintenanceBuckets(
  canonicalRepos: CanonicalRepoView[],
  plannerEntries: Map<string, CleanupPlannerEntry>,
  rawDirtyCount: number,
  rawUnpushedCount: number,
): MaintenanceBuckets {
  const needsAction: ClassifiedItem[] = [];
  const operationalHold: ClassifiedItem[] = [];
  const activeDevelopment: ClassifiedItem[] = [];
  const runtimeLocalState: ClassifiedItem[] = [];
  const staleSnapshot: ClassifiedItem[] = [];
  const recentlyResolved: ClassifiedItem[] = [];

  for (const repo of canonicalRepos) {
    const entry = plannerEntries.get(repo.repoId) ?? null;
    const item = classifyRepo(repo, entry);

    switch (item.bucket) {
      case "needs_action":
        needsAction.push(item);
        break;
      case "operational_hold":
        operationalHold.push(item);
        break;
      case "active_development":
        activeDevelopment.push(item);
        break;
      case "runtime_local_state":
        runtimeLocalState.push(item);
        break;
      case "stale_snapshot":
        staleSnapshot.push(item);
        break;
      case "recently_resolved":
        recentlyResolved.push(item);
        break;
    }
  }

  const actionable = needsAction.length;
  const knownHolds =
    operationalHold.length +
    activeDevelopment.length +
    runtimeLocalState.length +
    staleSnapshot.length;

  return {
    needsAction,
    operationalHold,
    activeDevelopment,
    runtimeLocalState,
    staleSnapshot,
    recentlyResolved,
    counts: {
      rawDirty: rawDirtyCount,
      rawUnpushed: rawUnpushedCount,
      actionable,
      knownHolds,
    },
  };
}
