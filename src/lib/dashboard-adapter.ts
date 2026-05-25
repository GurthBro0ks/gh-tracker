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

export type DashboardGithubHealth = {
  status: "synced" | "partial" | "pending" | "failed";
  latestSyncAt: string | null;
  syncedRepoCount: number;
  partialRepoCount: number;
  failedRepoCount: number;
  warningCount: number;
  repos: Record<string, DashboardGithubRepoHealth>;
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
};

export function buildDemoDashboardData(): DashboardData {
  const totalCommitsToday = machines.reduce((sum, machine) => sum + machine.commitsToday, 0);
  const pushesToday = machines.reduce((sum, machine) => sum + machine.pushesToday, 0);
  const codingStreakDays = Math.max(...machines.map((machine) => machine.streak));
  const mostActiveRepo = [...repoCommitDistribution].sort((a, b) => b.commits - a.commits)[0]?.repoId ?? "n/a";
  const mostActiveMachine = [...machines].sort((a, b) => b.commitsToday - a.commitsToday)[0]?.label ?? "n/a";

  return {
    mode: "demo",
    version: "0.3.0-phase2",
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
    repoCatalog: repos.map((repo) => ({
      repoId: repo.id,
      owner: repo.owner,
      name: repo.name,
      canonicalRemote: `git@github.com:${repo.owner}/${repo.name}.git`,
      primaryLanguage: repo.primaryLanguage,
      github: null,
    })),
    repoRows: repoLocations.map((location) => ({
      id: location.id,
      repoId: location.repoId,
      machineId: location.machineId,
      path: location.path,
      branch: location.branch,
      dirty: location.dirty,
      unpushedCommits: location.unpushedCommits,
    })),
    timeline: demoActivityEvents,
    commitTrend: commitsPerDay,
    repoDistribution: repoCommitDistribution,
    heatmap: heatmapWeeks,
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

  const dateRows = new Map<string, { day: string; total: number; laptop: number; nuc1: number; nuc2: number; additions: number; deletions: number }>();
  for (const dayRow of snapshot.dailyMachineStats) {
    const label = dayRow.date.slice(5);
    const entry = dateRows.get(dayRow.date) ?? { day: label, total: 0, laptop: 0, nuc1: 0, nuc2: 0, additions: 0, deletions: 0 };
    entry.total += dayRow.commits;
    if (dayRow.machineId === "laptop") entry.laptop += dayRow.commits;
    if (dayRow.machineId === "nuc1") entry.nuc1 += dayRow.commits;
    if (dayRow.machineId === "nuc2") entry.nuc2 += dayRow.commits;
    entry.additions += dayRow.additions;
    entry.deletions += dayRow.deletions;
    dateRows.set(dayRow.date, entry);
  }

  // Build machine cards from all unique machine IDs in repoLocations
  const machineIdSet = new Set(snapshot.repoLocations.map((l) => l.machineId));
  const machineCards = Array.from(machineIdSet).map((machineId) => {
    const machineLocs = snapshot.repoLocations.filter((l) => l.machineId === machineId);
    const today = snapshot.dailyMachineStats.find((entry) => entry.machineId === machineId && entry.date === snapshot.createdAt.slice(0, 10));
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

  const todayStats = snapshot.dailyMachineStats.filter((entry) => entry.date === snapshot.createdAt.slice(0, 10));
  const totalCommitsToday = todayStats.reduce((sum, entry) => sum + entry.commits, 0);
  const pushesToday = todayStats.reduce((sum, entry) => sum + entry.pushes, 0);

  const loadedMachineIds = Array.from(new Set(snapshot.repoLocations.map((l) => l.machineId)));
  const laptopStatus = loadedMachineIds.includes("laptop") ? "loaded" : "pending";

  return {
    mode,
    version: "0.5.0-phase5a",
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
    repoCatalog: snapshot.repos.map((repo) => ({
      repoId: repo.id,
      owner: repo.owner,
      name: repo.name,
      canonicalRemote: repo.canonicalRemote,
      primaryLanguage: null,
      github: null,
    })),
    repoRows,
    timeline: snapshot.activityEvents,
    commitTrend: Array.from(dateRows.values()).sort((a, b) => a.day.localeCompare(b.day)),
    repoDistribution,
    heatmap: heatmapWeeks,
  };
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
  };
}

export function mergeGithubHealth(data: DashboardData, github: DashboardGithubHealth): DashboardData {
  const repoCatalog = data.repoCatalog.map((repo) => {
    const fullName = `${repo.owner}/${repo.name}`.toLowerCase();
    const githubHealth = github.repos[repo.repoId] ?? github.repos[fullName] ?? null;
    return { ...repo, github: githubHealth };
  });

  return {
    ...data,
    githubHealth: github,
    repoCatalog,
  };
}
