import {
  activityEvents as demoActivityEvents,
  commitsPerDay,
  heatmapWeeks,
  lastDemoRefresh,
  machines,
  repoCommitDistribution,
  repoLocations,
  repos,
} from "@/lib/demo-data";
import type { SnapshotEnvelope } from "@/lib/contracts";

export type DashboardDataMode = "demo" | "local_snapshot" | "aggregated";

export type DashboardGithubRepoHealth = {
  canonicalRepo: string;
  fullName: string;
  defaultBranch: string | null;
  visibility: "private" | "public" | "unknown";
  isArchived: boolean | null;
  pushedAt: string | null;
  updatedAt: string | null;
  latestRelease: {
    tagName: string | null;
    name: string | null;
    publishedAt: string | null;
    ageDays: number | null;
    status: "fresh" | "aging" | "stale" | "none" | "unknown";
  };
  pullRequests: { open: number | null; stale: number | null };
  issues: { open: number | null; stale: number | null };
  ci: {
    status: "success" | "failure" | "in_progress" | "none" | "unknown";
    conclusion: string | null;
    workflowName: string | null;
    createdAt: string | null;
  };
  health: {
    score: number;
    label: "healthy" | "watch" | "attention" | "unknown";
    reasons: string[];
  };
  sync: { status: "ok" | "partial" | "failed"; warnings: string[]; error: string | null };
};

export type GithubHealthFreshness = "fresh" | "stale" | "old" | "missing";

export type DashboardGithubHealth = {
  status: "synced" | "partial" | "pending" | "failed";
  latestSyncAt: string | null;
  syncedRepoCount: number;
  partialRepoCount: number;
  failedRepoCount: number;
  warningCount: number;
  repos: Record<string, DashboardGithubRepoHealth>;
  freshness: GithubHealthFreshness;
  syncAgeMinutes: number | null;
};

export type PerMachineDetail = {
  machineId: string;
  commits: number;
  pushes: number;
  additions: number;
  deletions: number;
  dirty: boolean;
  unpushedCommits: number;
  branch: string;
  latestCommitAt: string | null;
};

export type PerLocationDetail = {
  id: string;
  machineId: string;
  path: string;
  branch: string;
  dirty: boolean;
  unpushedCommits: number;
  headSha: string;
  stagedCount: number;
  unstagedCount: number;
  untrackedCount: number;
};

export type CanonicalRepoView = {
  repoId: string;
  displayName: string;
  owner: string;
  canonicalRemote: string;
  primaryLanguage: string | null;
  machines: string[];
  locationCount: number;
  combinedCommits: number;
  combinedPushes: number;
  combinedAdditions: number;
  combinedDeletions: number;
  dirtyState: "clean" | "dirty" | "mixed";
  unpushedTotal: number;
  latestBranch: string | null;
  latestCommitAt: string | null;
  github: DashboardGithubRepoHealth | null;
  perMachineDetails: PerMachineDetail[];
  perLocationDetails: PerLocationDetail[];
};

export type DashboardData = {
  mode: DashboardDataMode;
  version: string;
  sourceTimestamp: string;
  latestLocalSnapshotTime: string | null;
  localRepoCount: number;
  dirtyRepoCount: number;
  unpushedRepoCount: number;
  collectorLastResult: string;
  validationStatus: string;
  machineCount: number;
  repoCount: number;
  totalCommitsToday: number;
  pushesToday: number;
  codingStreakDays: number;
  mostActiveRepo: string;
  mostActiveMachine: string;
  loadedMachineIds: string[];
  laptopStatus: "loaded" | "pending";
  excludedReposCount?: number;
  githubHealth: DashboardGithubHealth;
  machineCards: Array<{ id: string; label: string; host: string; commitsToday: number; pushesToday: number; activeRepos: number; streak: number }>;
  repoCatalog: Array<{ repoId: string; owner: string; name: string; canonicalRemote: string; primaryLanguage: string | null; github?: DashboardGithubRepoHealth | null }>;
  repoRows: Array<{ id: string; repoId: string; machineId: string; path: string; branch: string; dirty: boolean; unpushedCommits: number }>;
  timeline: Array<{ id: string; machineId: string; repoId: string; type: "commit" | "push" | "status"; timestamp: string; message: string }>;
  commitTrend: Array<{ day: string; total: number; laptop: number; nuc1: number; nuc2: number; additions: number; deletions: number }>;
  repoDistribution: Array<{ repoId: string; commits: number }>;
  heatmap: number[][];
  canonicalRepos: CanonicalRepoView[];
};

function isoDateUTC(input: Date): string {
  return input.toISOString().slice(0, 10);
}

function addUtcDays(isoDay: string, delta: number): string {
  const date = new Date(`${isoDay}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return isoDateUTC(date);
}

function buildContinuousDailyTrend(
  dailyMachineStats: SnapshotEnvelope["dailyMachineStats"],
  endDayIso: string,
  days = 30,
) {
  const byDay = new Map<string, { day: string; total: number; laptop: number; nuc1: number; nuc2: number; additions: number; deletions: number }>();
  for (const dayRow of dailyMachineStats) {
    const label = dayRow.date.slice(5);
    const entry = byDay.get(dayRow.date) ?? { day: label, total: 0, laptop: 0, nuc1: 0, nuc2: 0, additions: 0, deletions: 0 };
    entry.total += dayRow.commits;
    if (dayRow.machineId === "laptop") entry.laptop += dayRow.commits;
    if (dayRow.machineId === "nuc1") entry.nuc1 += dayRow.commits;
    if (dayRow.machineId === "nuc2") entry.nuc2 += dayRow.commits;
    entry.additions += dayRow.additions;
    entry.deletions += dayRow.deletions;
    byDay.set(dayRow.date, entry);
  }

  const startDayIso = addUtcDays(endDayIso, -(days - 1));
  const trend: Array<{ day: string; total: number; laptop: number; nuc1: number; nuc2: number; additions: number; deletions: number }> = [];
  for (let i = 0; i < days; i += 1) {
    const dayIso = addUtcDays(startDayIso, i);
    const existing = byDay.get(dayIso);
    trend.push(
      existing ?? {
        day: dayIso.slice(5),
        total: 0,
        laptop: 0,
        nuc1: 0,
        nuc2: 0,
        additions: 0,
        deletions: 0,
      },
    );
  }
  return trend;
}

function buildHeatmapFromTrend(trend: Array<{ total: number }>, weeks = 6): number[][] {
  const totalCells = weeks * 7;
  const tail = trend.slice(-totalCells);
  const padded = Array.from({ length: Math.max(0, totalCells - tail.length) }, () => ({ total: 0 })).concat(tail);
  const maxTotal = Math.max(1, ...padded.map((row) => row.total));
  const scaled = padded.map((row) => Math.max(0, Math.min(7, Math.round((row.total / maxTotal) * 7))));
  const grid: number[][] = [];
  for (let i = 0; i < weeks; i += 1) {
    grid.push(scaled.slice(i * 7, i * 7 + 7));
  }
  return grid;
}

export function buildDemoDashboardData(): DashboardData {
  const totalCommitsToday = machines.reduce((sum, machine) => sum + machine.commitsToday, 0);
  const pushesToday = machines.reduce((sum, machine) => sum + machine.pushesToday, 0);
  const codingStreakDays = Math.max(...machines.map((machine) => machine.streak));
  const mostActiveRepo = [...repoCommitDistribution].sort((a, b) => b.commits - a.commits)[0]?.repoId ?? "n/a";
  const mostActiveMachine = [...machines].sort((a, b) => b.commitsToday - a.commitsToday)[0]?.label ?? "n/a";

  const repoCatalog = repos.map((repo) => ({
    repoId: repo.id,
    owner: repo.owner,
    name: repo.name,
    canonicalRemote: `git@github.com:${repo.owner}/${repo.name}.git`,
    primaryLanguage: repo.primaryLanguage,
    github: null,
  }));

  const repoRows = repoLocations.map((location) => ({
    id: location.id,
    repoId: location.repoId,
    machineId: location.machineId,
    path: location.path,
    branch: location.branch,
    dirty: location.dirty,
    unpushedCommits: location.unpushedCommits,
  }));

  return {
    mode: "demo",
    version: "0.6.3-phase6d1-pet-evolution",
    sourceTimestamp: lastDemoRefresh,
    latestLocalSnapshotTime: null,
    localRepoCount: 0,
    dirtyRepoCount: 0,
    unpushedRepoCount: 0,
    collectorLastResult: "not installed",
    validationStatus: "not run",
    machineCount: machines.length,
    repoCount: repos.length,
    totalCommitsToday,
    pushesToday,
    codingStreakDays,
    mostActiveRepo,
    mostActiveMachine,
    loadedMachineIds: machines.map((m) => m.id),
    laptopStatus: "loaded",
    excludedReposCount: 0,
    githubHealth: emptyGithubHealth(),
    machineCards: machines.map((machine) => ({
      id: machine.id,
      label: machine.label,
      host: machine.host,
      commitsToday: machine.commitsToday,
      pushesToday: machine.pushesToday,
      activeRepos: machine.activeRepos,
      streak: machine.streak,
    })),
    repoCatalog,
    repoRows,
    timeline: demoActivityEvents,
    commitTrend: commitsPerDay,
    repoDistribution: repoCommitDistribution,
    heatmap: heatmapWeeks,
    canonicalRepos: buildCanonicalRepos(repoCatalog, repoRows, [], new Map()),
  };
}

export function buildDashboardDataFromSnapshot(snapshot: SnapshotEnvelope): DashboardData {
  const isAggregate = snapshot.machine.id === "aggregate";
  const mode: DashboardDataMode = isAggregate ? "aggregated" : "local_snapshot";

  const repoRows = snapshot.repoLocations.map((location) => ({
    id: location.id,
    repoId: location.repoId,
    machineId: location.machineId,
    path: location.path,
    branch: location.currentBranch,
    dirty: location.dirty,
    unpushedCommits: location.aheadCount,
  }));

  const dirtyRepoCount = repoRows.filter((row) => row.dirty).length;
  const unpushedRepoCount = repoRows.filter((row) => row.unpushedCommits > 0).length;

  const repoCommitMap = new Map<string, number>();
  for (const row of snapshot.dailyRepoStats) {
    repoCommitMap.set(row.repoId, (repoCommitMap.get(row.repoId) ?? 0) + row.commits);
  }

  const todayIso = isoDateUTC(new Date());
  const commitTrend = buildContinuousDailyTrend(snapshot.dailyMachineStats, todayIso, 30);
  const heatmap = buildHeatmapFromTrend(commitTrend, 6);

  // Build machine cards from all unique machine IDs in repoLocations
  const machineIdSet = new Set(snapshot.repoLocations.map((l) => l.machineId));
  const machineCards = Array.from(machineIdSet).map((machineId) => {
    const machineLocs = snapshot.repoLocations.filter((l) => l.machineId === machineId);
    const today = snapshot.dailyMachineStats.find((entry) => entry.machineId === machineId && entry.date === todayIso);
    const machineMeta = snapshot.machine.id === machineId ? snapshot.machine : undefined;
    return {
      id: machineId,
      label: machineMeta?.label ?? machineId.toUpperCase(),
      host: machineMeta?.host ?? machineId,
      commitsToday: today?.commits ?? 0,
      pushesToday: today?.pushes ?? 0,
      activeRepos: today?.activeRepos ?? machineLocs.length,
      streak: 1,
    };
  });

  const repoDistribution = Array.from(repoCommitMap.entries())
    .map(([repoId, commits]) => ({ repoId, commits }))
    .sort((a, b) => b.commits - a.commits);

  const mostActiveRepo = repoDistribution[0]?.repoId ?? "n/a";
  const mostActiveMachine = machineCards.sort((a, b) => b.commitsToday - a.commitsToday)[0]?.label ?? "n/a";

  const todayStats = snapshot.dailyMachineStats.filter((entry) => entry.date === todayIso);
  const totalCommitsToday = todayStats.reduce((sum, entry) => sum + entry.commits, 0);
  const pushesToday = todayStats.reduce((sum, entry) => sum + entry.pushes, 0);

  const loadedMachineIds = Array.from(new Set(snapshot.repoLocations.map((l) => l.machineId)));
  const laptopStatus = loadedMachineIds.includes("laptop") ? "loaded" : "pending";

  const repoCatalog = snapshot.repos.map((repo) => ({
    repoId: repo.id,
    owner: repo.owner,
    name: repo.name,
    canonicalRemote: repo.canonicalRemote,
    primaryLanguage: null,
    github: null,
  }));

  // Build stats per repo per machine from dailyRepoStats
  const repoMachineStats = new Map<string, PerMachineDetail>();
  for (const stat of snapshot.dailyRepoStats) {
    const key = `${stat.repoId}:${stat.machineId}`;
    const existing = repoMachineStats.get(key);
    if (existing) {
      existing.commits += stat.commits;
      existing.pushes += stat.pushes;
      existing.additions += stat.additions;
      existing.deletions += stat.deletions;
    } else {
      repoMachineStats.set(key, {
        machineId: stat.machineId,
        commits: stat.commits,
        pushes: stat.pushes,
        additions: stat.additions,
        deletions: stat.deletions,
        dirty: false,
        unpushedCommits: 0,
        branch: "",
        latestCommitAt: null,
      });
    }
  }

  const canonicalRepos = buildCanonicalRepos(repoCatalog, repoRows, snapshot.repoLocations, repoMachineStats);

  return {
    mode,
    version: "0.6.3-phase6d1-pet-evolution",
    sourceTimestamp: snapshot.createdAt,
    latestLocalSnapshotTime: snapshot.createdAt,
    localRepoCount: snapshot.repoLocations.length,
    dirtyRepoCount,
    unpushedRepoCount,
    collectorLastResult: snapshot.collectorRun.result,
    validationStatus: "validated",
    machineCount: machineCards.length,
    repoCount: snapshot.repos.length,
    totalCommitsToday,
    pushesToday,
    codingStreakDays: 1,
    mostActiveRepo,
    mostActiveMachine,
    loadedMachineIds,
    laptopStatus,
    githubHealth: emptyGithubHealth(),
    machineCards,
    repoCatalog,
    repoRows,
    timeline: snapshot.activityEvents,
    commitTrend,
    repoDistribution,
    heatmap,
    canonicalRepos,
  };
}

export function buildCanonicalRepos(
  repoCatalog: DashboardData["repoCatalog"],
  repoRows: DashboardData["repoRows"],
  repoLocations: import("@/lib/contracts").RepoLocation[],
  repoMachineStats: Map<string, PerMachineDetail>,
): CanonicalRepoView[] {
  const groups = new Map<string, {
    repoId: string;
    owner: string;
    canonicalRemote: string;
    primaryLanguage: string | null;
    machines: Set<string>;
    locations: PerLocationDetail[];
    machineDetails: Map<string, PerMachineDetail>;
    dirtyCount: number;
    cleanCount: number;
    unpushedTotal: number;
    latestCommitAt: string | null;
    latestBranch: string | null;
  }>();

  for (const catalogEntry of repoCatalog) {
    groups.set(catalogEntry.repoId, {
      repoId: catalogEntry.repoId,
      owner: catalogEntry.owner,
      canonicalRemote: catalogEntry.canonicalRemote,
      primaryLanguage: catalogEntry.primaryLanguage,
      machines: new Set(),
      locations: [],
      machineDetails: new Map(),
      dirtyCount: 0,
      cleanCount: 0,
      unpushedTotal: 0,
      latestCommitAt: null,
      latestBranch: null,
    });
  }

  // Process repo rows (locations)
  for (const row of repoRows) {
    const group = groups.get(row.repoId);
    if (!group) continue;

    group.machines.add(row.machineId);

    const location: PerLocationDetail = {
      id: row.id,
      machineId: row.machineId,
      path: row.path,
      branch: row.branch,
      dirty: row.dirty,
      unpushedCommits: row.unpushedCommits,
      headSha: "",
      stagedCount: 0,
      unstagedCount: 0,
      untrackedCount: 0,
    };

    // Enrich with location data if available
    const fullLocation = repoLocations.find((l) => l.id === row.id);
    if (fullLocation) {
      location.headSha = fullLocation.headSha;
      location.stagedCount = fullLocation.stagedCount;
      location.unstagedCount = fullLocation.unstagedCount;
      location.untrackedCount = fullLocation.untrackedCount;
    }

    group.locations.push(location);

    if (row.dirty) {
      group.dirtyCount++;
    } else {
      group.cleanCount++;
    }
    group.unpushedTotal += row.unpushedCommits;

    // Track machine detail
    const machineKey = `${row.repoId}:${row.machineId}`;
    let machineDetail = group.machineDetails.get(row.machineId);
    if (!machineDetail) {
      const stats = repoMachineStats.get(machineKey);
      machineDetail = stats ? { ...stats } : {
        machineId: row.machineId,
        commits: 0,
        pushes: 0,
        additions: 0,
        deletions: 0,
        dirty: row.dirty,
        unpushedCommits: row.unpushedCommits,
        branch: row.branch,
        latestCommitAt: fullLocation?.latestCommitAt ?? null,
      };
      group.machineDetails.set(row.machineId, machineDetail);
    } else {
      machineDetail.dirty = machineDetail.dirty || row.dirty;
      machineDetail.unpushedCommits += row.unpushedCommits;
      if (fullLocation?.latestCommitAt && (!machineDetail.latestCommitAt || fullLocation.latestCommitAt > machineDetail.latestCommitAt)) {
        machineDetail.latestCommitAt = fullLocation.latestCommitAt;
      }
    }
  }

  return Array.from(groups.values()).map((group) => {
    let dirtyState: CanonicalRepoView["dirtyState"] = "clean";
    if (group.dirtyCount > 0 && group.cleanCount > 0) dirtyState = "mixed";
    else if (group.dirtyCount > 0) dirtyState = "dirty";

    const perMachineDetails = Array.from(group.machineDetails.values());
    const combinedCommits = perMachineDetails.reduce((sum, d) => sum + d.commits, 0);
    const combinedPushes = perMachineDetails.reduce((sum, d) => sum + d.pushes, 0);
    const combinedAdditions = perMachineDetails.reduce((sum, d) => sum + d.additions, 0);
    const combinedDeletions = perMachineDetails.reduce((sum, d) => sum + d.deletions, 0);

    return {
      repoId: group.repoId,
      displayName: group.repoId,
      owner: group.owner,
      canonicalRemote: group.canonicalRemote,
      primaryLanguage: group.primaryLanguage,
      machines: Array.from(group.machines),
      locationCount: group.locations.length,
      combinedCommits,
      combinedPushes,
      combinedAdditions,
      combinedDeletions,
      dirtyState,
      unpushedTotal: group.unpushedTotal,
      latestBranch: group.latestBranch,
      latestCommitAt: group.latestCommitAt,
      github: null,
      perMachineDetails,
      perLocationDetails: group.locations,
    };
  }).filter((repo) => repo.locationCount > 0);
}

function emptyGithubHealth(): DashboardGithubHealth {
  return {
    status: "pending",
    latestSyncAt: null,
    syncedRepoCount: 0,
    partialRepoCount: 0,
    failedRepoCount: 0,
    warningCount: 0,
    repos: {},
    freshness: "missing",
    syncAgeMinutes: null,
  };
}

export function mergeGithubHealth(data: DashboardData, github: DashboardGithubHealth): DashboardData {
  const repoCatalog = data.repoCatalog.map((repo) => {
    const fullName = `${repo.owner}/${repo.name}`.toLowerCase();
    const githubHealth = github.repos[repo.repoId] ?? github.repos[fullName] ?? null;
    return { ...repo, github: githubHealth };
  });

  const canonicalRepos = data.canonicalRepos.map((repo) => {
    const fullName = `${repo.owner}/${repo.displayName}`.toLowerCase();
    const githubHealth = github.repos[repo.repoId] ?? github.repos[fullName] ?? null;
    return { ...repo, github: githubHealth };
  });

  return {
    ...data,
    githubHealth: github,
    repoCatalog,
    canonicalRepos,
  };
}
