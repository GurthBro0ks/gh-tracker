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

export type DashboardDataMode = "demo" | "local_snapshot";

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
  machineCards: Array<{ id: string; label: string; host: string; commitsToday: number; pushesToday: number; activeRepos: number; streak: number }>;
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
    version: "0.2.0-phase1",
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
    machineCards: machines.map((machine) => ({
      id: machine.id,
      label: machine.label,
      host: machine.host,
      commitsToday: machine.commitsToday,
      pushesToday: machine.pushesToday,
      activeRepos: machine.activeRepos,
      streak: machine.streak,
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

  const machineCards = [snapshot.machine.id].map((machineId) => {
    const today = snapshot.dailyMachineStats.find((entry) => entry.machineId === machineId && entry.date === snapshot.createdAt.slice(0, 10));
    return {
      id: snapshot.machine.id,
      label: snapshot.machine.label,
      host: snapshot.machine.host,
      commitsToday: today?.commits ?? 0,
      pushesToday: today?.pushes ?? 0,
      activeRepos: today?.activeRepos ?? snapshot.repoLocations.length,
      streak: 1,
    };
  });

  const repoDistribution = Array.from(repoCommitMap.entries())
    .map(([repoId, commits]) => ({ repoId, commits }))
    .sort((a, b) => b.commits - a.commits);

  const mostActiveRepo = repoDistribution[0]?.repoId ?? "n/a";
  const mostActiveMachine = snapshot.machine.label;
  const todayStats = snapshot.dailyMachineStats.find((entry) => entry.machineId === snapshot.machine.id && entry.date === snapshot.createdAt.slice(0, 10));

  return {
    mode: "local_snapshot",
    version: "0.2.0-phase1",
    sourceTimestamp: snapshot.createdAt,
    latestLocalSnapshotTime: snapshot.createdAt,
    localRepoCount: snapshot.repoLocations.length,
    dirtyRepoCount,
    unpushedRepoCount,
    collectorLastResult: snapshot.collectorRun.result,
    validationStatus: "validated",
    machineCount: 1,
    repoCount: snapshot.repos.length,
    totalCommitsToday: todayStats?.commits ?? 0,
    pushesToday: todayStats?.pushes ?? 0,
    codingStreakDays: 1,
    mostActiveRepo,
    mostActiveMachine,
    machineCards,
    repoRows,
    timeline: snapshot.activityEvents,
    commitTrend: Array.from(dateRows.values()).sort((a, b) => a.day.localeCompare(b.day)),
    repoDistribution,
    heatmap: heatmapWeeks,
  };
}
