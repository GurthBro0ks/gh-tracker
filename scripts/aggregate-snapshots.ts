import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { SnapshotEnvelope, Repo, RepoLocation, DailyRepoStats, DailyMachineStats, ActivityEvent } from "../src/lib/contracts";
import { snapshotEnvelopeSchema } from "../src/lib/snapshot-schema";

const MACHINES_DIR = path.join(process.cwd(), "data", "snapshots", "machines");
const AGGREGATE_DIR = path.join(process.cwd(), "data", "snapshots", "aggregate");

const DEFAULT_ALLOWED_OWNERS = "GurthBro0ks";

function getAllowedOwners(): string[] {
  const env = process.env.GH_TRACKER_ALLOWED_REMOTE_OWNERS || DEFAULT_ALLOWED_OWNERS;
  return env.split(",").map((o) => o.trim()).filter(Boolean);
}

function getExcludedRepoNames(): string[] {
  const env = process.env.GH_TRACKER_EXCLUDE_REPO_NAMES;
  if (!env) return [];
  return env.split(",").map((n) => n.trim()).filter(Boolean);
}

type ExcludedRepoEntry = {
  repoName: string;
  repoId: string;
  owner: string;
  remoteKey: string;
  canonicalRemote: string;
  machineId: string;
  paths: string[];
  reason: string;
};

function isRepoAllowed(repo: Repo, allowedOwners: string[], excludedNames: string[]): boolean {
  if (excludedNames.includes(repo.name)) {
    return false;
  }
  if (repo.owner === "local") {
    return true;
  }
  return allowedOwners.includes(repo.owner);
}

function filterSnapshot(
  snapshot: SnapshotEnvelope,
  allowedOwners: string[],
  excludedNames: string[]
): { filtered: SnapshotEnvelope; excluded: ExcludedRepoEntry[] } {
  const allowedRepoIds = new Set<string>();
  const excluded: ExcludedRepoEntry[] = [];

  for (const repo of snapshot.repos) {
    if (isRepoAllowed(repo, allowedOwners, excludedNames)) {
      allowedRepoIds.add(repo.id);
    } else {
      const reason = excludedNames.includes(repo.name)
        ? "explicitly_excluded"
        : "owner_not_allowed";
      excluded.push({
        repoName: repo.name,
        repoId: repo.id,
        owner: repo.owner,
        remoteKey: repo.remoteKey,
        canonicalRemote: repo.canonicalRemote,
        machineId: snapshot.machine.id,
        paths: [],
        reason,
      });
    }
  }

  const excludedPaths = new Map<string, string[]>();
  for (const loc of snapshot.repoLocations) {
    if (!allowedRepoIds.has(loc.repoId)) {
      const paths = excludedPaths.get(loc.repoId) || [];
      paths.push(loc.path);
      excludedPaths.set(loc.repoId, paths);
    }
  }

  for (const entry of excluded) {
    entry.paths = excludedPaths.get(entry.repoId) || [];
  }

  const filteredRepos = snapshot.repos.filter((r) => allowedRepoIds.has(r.id));
  const filteredLocations = snapshot.repoLocations.filter((l) => allowedRepoIds.has(l.repoId));
  const filteredEvents = snapshot.activityEvents.filter((e) => allowedRepoIds.has(e.repoId));
  const filteredDailyRepoStats = snapshot.dailyRepoStats.filter((s) => allowedRepoIds.has(s.repoId));

  const filteredDailyMachineStats = recalculateDailyMachineStats(filteredDailyRepoStats, filteredLocations);

  const filtered: SnapshotEnvelope = {
    ...snapshot,
    repos: filteredRepos,
    repoLocations: filteredLocations,
    activityEvents: filteredEvents,
    dailyRepoStats: filteredDailyRepoStats,
    dailyMachineStats: filteredDailyMachineStats,
    collectorRun: {
      ...snapshot.collectorRun,
      reposFound: filteredLocations.length,
    },
  };

  return { filtered, excluded };
}

function recalculateDailyMachineStats(
  dailyRepoStats: DailyRepoStats[],
  locations: RepoLocation[]
): DailyMachineStats[] {
  const byKey = new Map<string, DailyMachineStats>();
  for (const stat of dailyRepoStats) {
    const key = `${stat.date}:${stat.machineId}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.commits += stat.commits;
      existing.pushes += stat.pushes;
      existing.additions += stat.additions;
      existing.deletions += stat.deletions;
    } else {
      byKey.set(key, {
        date: stat.date,
        machineId: stat.machineId,
        commits: stat.commits,
        pushes: stat.pushes,
        additions: stat.additions,
        deletions: stat.deletions,
        activeRepos: 0,
        dirtyRepos: 0,
        unpushedRepos: 0,
      });
    }
  }

  for (const loc of locations) {
    const today = new Date().toISOString().slice(0, 10);
    const key = `${today}:${loc.machineId}`;
    const entry = byKey.get(key);
    if (entry) {
      entry.activeRepos += 1;
      if (loc.dirty) entry.dirtyRepos += 1;
      if (loc.aheadCount > 0) entry.unpushedRepos += 1;
    }
  }

  return Array.from(byKey.values()).sort((a, b) => a.date.localeCompare(b.date));
}

async function loadMachineSnapshots(): Promise<SnapshotEnvelope[]> {
  const snapshots: SnapshotEnvelope[] = [];
  let entries: string[] = [];
  try {
    entries = await readdir(MACHINES_DIR);
  } catch {
    return snapshots;
  }

  for (const machineId of entries) {
    const latestPath = path.join(MACHINES_DIR, machineId, "latest.json");
    try {
      const raw = await readFile(latestPath, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      const snapshot = snapshotEnvelopeSchema.parse(parsed);
      snapshots.push(snapshot);
    } catch {
      // Skip unreadable/invalid snapshots
    }
  }

  return snapshots;
}

function mergeRepos(snapshots: SnapshotEnvelope[]): Repo[] {
  const byId = new Map<string, Repo>();
  for (const snapshot of snapshots) {
    for (const repo of snapshot.repos) {
      if (!byId.has(repo.id)) {
        byId.set(repo.id, repo);
      }
    }
  }
  return Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id));
}

function mergeRepoLocations(snapshots: SnapshotEnvelope[]): RepoLocation[] {
  const locations: RepoLocation[] = [];
  for (const snapshot of snapshots) {
    for (const loc of snapshot.repoLocations) {
      locations.push(loc);
    }
  }
  return locations;
}

function mergeDailyRepoStats(snapshots: SnapshotEnvelope[]): DailyRepoStats[] {
  const byKey = new Map<string, DailyRepoStats>();
  for (const snapshot of snapshots) {
    for (const stat of snapshot.dailyRepoStats) {
      const key = `${stat.date}:${stat.repoId}`;
      const existing = byKey.get(key);
      if (existing) {
        existing.commits += stat.commits;
        existing.pushes += stat.pushes;
        existing.additions += stat.additions;
        existing.deletions += stat.deletions;
      } else {
        byKey.set(key, { ...stat });
      }
    }
  }
  return Array.from(byKey.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function mergeDailyMachineStats(snapshots: SnapshotEnvelope[]): DailyMachineStats[] {
  const byKey = new Map<string, DailyMachineStats>();
  for (const snapshot of snapshots) {
    for (const stat of snapshot.dailyMachineStats) {
      const key = `${stat.date}:${stat.machineId}`;
      const existing = byKey.get(key);
      if (existing) {
        existing.commits += stat.commits;
        existing.pushes += stat.pushes;
        existing.additions += stat.additions;
        existing.deletions += stat.deletions;
        existing.activeRepos = Math.max(existing.activeRepos, stat.activeRepos);
        existing.dirtyRepos = Math.max(existing.dirtyRepos, stat.dirtyRepos);
        existing.unpushedRepos = Math.max(existing.unpushedRepos, stat.unpushedRepos);
      } else {
        byKey.set(key, { ...stat });
      }
    }
  }
  return Array.from(byKey.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function mergeActivityEvents(snapshots: SnapshotEnvelope[]): ActivityEvent[] {
  const byId = new Map<string, ActivityEvent>();
  for (const snapshot of snapshots) {
    for (const event of snapshot.activityEvents) {
      if (!byId.has(event.id)) {
        byId.set(event.id, event);
      }
    }
  }
  return Array.from(byId.values())
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .slice(-300);
}

function computeAggregateStats(snapshots: SnapshotEnvelope[], allLocations: RepoLocation[]) {
  const totalMachines = snapshots.length;
  const activeMachines = snapshots.filter((s) => s.repoLocations.length > 0).length;
  const totalRepos = allLocations.length;
  const uniqueRepos = new Set(allLocations.map((l) => l.repoId)).size;
  const dirtyRepos = allLocations.filter((l) => l.dirty).length;
  const unpushedRepos = allLocations.filter((l) => l.aheadCount > 0).length;
  const behindRepos = allLocations.filter((l) => l.behindCount > 0).length;

  const commitsToday = allLocations.reduce((sum, l) => sum + l.commitsToday, 0);
  const commitsLast7Days = allLocations.reduce((sum, l) => sum + l.commitsLast7Days, 0);
  const commitsLast30Days = allLocations.reduce((sum, l) => sum + l.commitsLast30Days, 0);

  const additionsToday = allLocations.reduce((sum, l) => sum + l.additionsToday, 0);
  const deletionsToday = allLocations.reduce((sum, l) => sum + l.deletionsToday, 0);
  const additionsLast7Days = allLocations.reduce((sum, l) => sum + l.additionsLast7Days, 0);
  const deletionsLast7Days = allLocations.reduce((sum, l) => sum + l.deletionsLast7Days, 0);

  return {
    totalMachines,
    activeMachines,
    totalRepos,
    uniqueRepos,
    dirtyRepos,
    unpushedRepos,
    behindRepos,
    commitsToday,
    commitsLast7Days,
    commitsLast30Days,
    additionsToday,
    deletionsToday,
    additionsLast7Days,
    deletionsLast7Days,
  };
}

async function main() {
  const rawSnapshots = await loadMachineSnapshots();

  if (rawSnapshots.length === 0) {
    process.stderr.write("no machine snapshots found\n");
    process.exit(1);
  }

  const allowedOwners = getAllowedOwners();
  const excludedNames = getExcludedRepoNames();

  const snapshots: SnapshotEnvelope[] = [];
  const allExcluded: ExcludedRepoEntry[] = [];

  for (const snapshot of rawSnapshots) {
    const { filtered, excluded } = filterSnapshot(snapshot, allowedOwners, excludedNames);
    snapshots.push(filtered);
    allExcluded.push(...excluded);
  }

  const repos = mergeRepos(snapshots);
  const repoLocations = mergeRepoLocations(snapshots);
  const dailyRepoStats = mergeDailyRepoStats(snapshots);
  const dailyMachineStats = mergeDailyMachineStats(snapshots);
  const activityEvents = mergeActivityEvents(snapshots);

  const aggregateStats = computeAggregateStats(snapshots, repoLocations);

  const createdAt = new Date().toISOString();
  const aggregate: SnapshotEnvelope & { aggregateStats: typeof aggregateStats } = {
    schemaVersion: "1.0.0",
    createdAt,
    machine: {
      id: "aggregate",
      label: "Aggregate",
      host: "dashboard",
      platform: "node",
    },
    collectorRun: {
      id: `aggregate-${createdAt.replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z")}`,
      machineId: "aggregate",
      collectorVersion: "phase4b1-aggregate-1",
      mode: "local",
      result: "ok",
      startedAt: createdAt,
      finishedAt: createdAt,
      durationMs: 0,
      rootsScanned: ["aggregate"],
      depthLimit: 1,
      reposFound: repoLocations.length,
      errors: [],
    },
    repos,
    repoLocations,
    activityEvents,
    dailyRepoStats,
    dailyMachineStats,
    aggregateStats,
  };

  await mkdir(AGGREGATE_DIR, { recursive: true });

  const latestPath = path.join(AGGREGATE_DIR, "latest.json");
  const summaryPath = path.join(AGGREGATE_DIR, "latest-summary.json");
  const excludedPath = path.join(AGGREGATE_DIR, "excluded_repos_report.json");

  await writeFile(latestPath, `${JSON.stringify(aggregate, null, 2)}\n`, "utf8");

  const summary = {
    aggregateCreatedAt: createdAt,
    machinesLoaded: snapshots.map((s) => ({
      machineId: s.machine.id,
      host: s.machine.host,
      snapshotCreatedAt: s.createdAt,
      repoCount: s.repoLocations.length,
    })),
    ...aggregateStats,
  };

  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  const excludedReport = {
    generatedAt: createdAt,
    allowedOwners,
    excludedRepoNames: excludedNames.length > 0 ? excludedNames : undefined,
    excludedCount: allExcluded.length,
    excluded: allExcluded,
  };

  await writeFile(excludedPath, `${JSON.stringify(excludedReport, null, 2)}\n`, "utf8");

  process.stdout.write(`machines=${snapshots.length}\n`);
  process.stdout.write(`total_repo_locations=${repoLocations.length}\n`);
  process.stdout.write(`unique_repos=${aggregateStats.uniqueRepos}\n`);
  process.stdout.write(`dirty=${aggregateStats.dirtyRepos}\n`);
  process.stdout.write(`unpushed=${aggregateStats.unpushedRepos}\n`);
  process.stdout.write(`excluded=${allExcluded.length}\n`);
  process.stdout.write(`latest=${latestPath}\n`);
  process.stdout.write(`summary=${summaryPath}\n`);
  process.stdout.write(`excluded_report=${excludedPath}\n`);
}

main().catch((error) => {
  process.stderr.write(`${(error as Error).stack || (error as Error).message}\n`);
  process.exit(1);
});
