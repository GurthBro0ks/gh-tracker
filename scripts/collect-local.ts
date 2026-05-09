import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import type {
  ActivityEvent,
  CollectorRun,
  DailyMachineStats,
  DailyRepoStats,
  Repo,
  RepoLocation,
  SnapshotEnvelope,
} from "../src/lib/contracts";
import { snapshotEnvelopeSchema } from "../src/lib/snapshot-schema";

const COLLECTOR_VERSION = "phase1-local-1";
const DEFAULT_ROOTS = ["/opt/slimy", "/home/slimy"];
const DEFAULT_DEPTH_LIMIT = 4;
const SNAPSHOT_BASE = path.join(process.cwd(), "data", "snapshots", "nuc2");
const SKIP_DIR_NAMES = new Set([
  "node_modules",
  ".next",
  "dist",
  "build",
  "coverage",
  ".cache",
  ".git",
]);

function nowIso(): string {
  return new Date().toISOString();
}

function toTimestamp(iso: string): string {
  return iso.replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
}

function runGit(repoPath: string, args: string[]): string {
  return execFileSync("git", ["-C", repoPath, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function runGitSafe(repoPath: string, args: string[], fallback = ""): string {
  try {
    return runGit(repoPath, args);
  } catch {
    return fallback;
  }
}

function redactRemote(remote: string): string {
  return remote
    .replace(/(https?:\/\/)([^/@\s]+)@/gi, "$1<redacted>@")
    .replace(/([?&][^=]{1,40}=)[^&\s]+/g, "$1<redacted>");
}

function parseRepoIdentity(remoteUrl: string, repoPath: string): { repoId: string; owner: string; name: string; remoteKey: string } {
  const normalized = remoteUrl.replace(/\.git$/, "");
  let owner = "local";
  let name = path.basename(repoPath);

  const githubMatch = normalized.match(/github\.com[:/]([^/]+)\/([^/]+)$/i);
  if (githubMatch) {
    owner = githubMatch[1];
    name = githubMatch[2];
  }

  const repoId = `${owner}-${name}`.toLowerCase();
  const remoteKey = `${owner}/${name}`;
  return { repoId, owner, name, remoteKey };
}

function parseStatusCounts(statusOutput: string): { dirty: boolean; staged: number; unstaged: number; untracked: number } {
  const lines = statusOutput.split("\n").filter(Boolean);
  let staged = 0;
  let unstaged = 0;
  let untracked = 0;

  for (const line of lines) {
    const x = line[0] ?? " ";
    const y = line[1] ?? " ";
    if (x === "?" && y === "?") {
      untracked += 1;
      continue;
    }
    if (x !== " ") staged += 1;
    if (y !== " ") unstaged += 1;
  }

  return { dirty: staged + unstaged + untracked > 0, staged, unstaged, untracked };
}

function parseAheadBehind(repoPath: string): { upstreamBranch: string | null; ahead: number; behind: number } {
  const upstream = runGitSafe(repoPath, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"]);
  if (!upstream) {
    return { upstreamBranch: null, ahead: 0, behind: 0 };
  }

  const counts = runGitSafe(repoPath, ["rev-list", "--left-right", "--count", `${upstream}...HEAD`], "0\t0");
  const [behindText, aheadText] = counts.split(/\s+/);
  const behind = Number.parseInt(behindText ?? "0", 10) || 0;
  const ahead = Number.parseInt(aheadText ?? "0", 10) || 0;

  return { upstreamBranch: upstream, ahead, behind };
}

function parseNumstatWindow(repoPath: string, since: string): { additions: number; deletions: number } {
  const output = runGitSafe(repoPath, ["log", `--since=${since}`, "--numstat", "--pretty=tformat:"]);
  let additions = 0;
  let deletions = 0;

  for (const line of output.split("\n")) {
    if (!line.trim()) continue;
    const [addText, delText] = line.split("\t");
    const add = Number.parseInt(addText, 10);
    const del = Number.parseInt(delText, 10);
    if (Number.isFinite(add)) additions += add;
    if (Number.isFinite(del)) deletions += del;
  }

  return { additions, deletions };
}

function parseDailyRepoStats(repoPath: string, machineId: string, repoId: string): DailyRepoStats[] {
  const output = runGitSafe(repoPath, ["log", "--since=7 days ago", "--date=short", "--pretty=format:__C__|%cd", "--numstat"]);
  const byDay = new Map<string, { commits: number; additions: number; deletions: number }>();
  let currentDay = "";

  for (const line of output.split("\n")) {
    if (!line.trim()) continue;
    if (line.startsWith("__C__|")) {
      currentDay = line.replace("__C__|", "").trim();
      const existing = byDay.get(currentDay) ?? { commits: 0, additions: 0, deletions: 0 };
      existing.commits += 1;
      byDay.set(currentDay, existing);
      continue;
    }

    if (!currentDay) continue;
    const [addText, delText] = line.split("\t");
    const add = Number.parseInt(addText, 10);
    const del = Number.parseInt(delText, 10);
    const existing = byDay.get(currentDay) ?? { commits: 0, additions: 0, deletions: 0 };
    if (Number.isFinite(add)) existing.additions += add;
    if (Number.isFinite(del)) existing.deletions += del;
    byDay.set(currentDay, existing);
  }

  return Array.from(byDay.entries())
    .map(([date, value]) => ({
      date,
      machineId,
      repoId,
      commits: value.commits,
      pushes: 0,
      additions: value.additions,
      deletions: value.deletions,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

async function discoverGitRepos(rootPath: string, depthLimit: number): Promise<string[]> {
  const repos: string[] = [];

  async function walk(currentPath: string, depth: number): Promise<void> {
    if (depth > depthLimit) return;
    if (["/proc", "/sys", "/run", "/var/lib/docker"].some((prefix) => currentPath === prefix || currentPath.startsWith(`${prefix}/`))) {
      return;
    }

    let entries;
    try {
      entries = await readdir(currentPath, { withFileTypes: true });
    } catch {
      return;
    }

    if (entries.some((entry) => entry.name === ".git")) {
      repos.push(currentPath);
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.isSymbolicLink()) continue;
      if (SKIP_DIR_NAMES.has(entry.name)) continue;
      await walk(path.join(currentPath, entry.name), depth + 1);
    }
  }

  await walk(rootPath, 0);
  return repos;
}

function aggregateDailyMachineStats(
  dailyRepoStats: DailyRepoStats[],
  machineId: string,
  repoLocations: RepoLocation[],
): DailyMachineStats[] {
  const byDay = new Map<string, DailyMachineStats>();

  for (const row of dailyRepoStats) {
    const existing =
      byDay.get(row.date) ??
      {
        date: row.date,
        machineId,
        commits: 0,
        pushes: 0,
        additions: 0,
        deletions: 0,
        activeRepos: 0,
        dirtyRepos: 0,
        unpushedRepos: 0,
      };
    existing.commits += row.commits;
    existing.pushes += row.pushes;
    existing.additions += row.additions;
    existing.deletions += row.deletions;
    byDay.set(row.date, existing);
  }

  const today = new Date().toISOString().slice(0, 10);
  const todayRow = byDay.get(today) ?? {
    date: today,
    machineId,
    commits: 0,
    pushes: 0,
    additions: 0,
    deletions: 0,
    activeRepos: 0,
    dirtyRepos: 0,
    unpushedRepos: 0,
  };

  todayRow.activeRepos = repoLocations.length;
  todayRow.dirtyRepos = repoLocations.filter((location) => location.dirty).length;
  todayRow.unpushedRepos = repoLocations.filter((location) => location.aheadCount > 0).length;
  byDay.set(today, todayRow);

  return Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date));
}

async function main() {
  const startedAt = nowIso();
  const machineId = process.env.GH_TRACKER_MACHINE_ID || "nuc2";
  const scanRoots = (process.env.GH_TRACKER_SCAN_ROOTS || DEFAULT_ROOTS.join(","))
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const depthLimit = Number.parseInt(process.env.GH_TRACKER_SCAN_DEPTH ?? `${DEFAULT_DEPTH_LIMIT}`, 10) || DEFAULT_DEPTH_LIMIT;

  const rootsToScan: string[] = [];
  for (const root of scanRoots) {
    try {
      const rootStats = await stat(root);
      if (rootStats.isDirectory()) rootsToScan.push(root);
    } catch {
      // Ignore missing roots.
    }
  }

  const errors: string[] = [];
  const discoveredRepos = new Set<string>();
  for (const root of rootsToScan) {
    const repos = await discoverGitRepos(root, depthLimit);
    for (const repo of repos) discoveredRepos.add(repo);
  }

  const repoLocations: RepoLocation[] = [];
  const reposById = new Map<string, Repo>();
  const activityEvents: ActivityEvent[] = [];
  const dailyRepoStats: DailyRepoStats[] = [];

  for (const repoPath of Array.from(discoveredRepos).sort()) {
    try {
      const remoteRaw = runGitSafe(repoPath, ["remote", "get-url", "origin"]);
      const remoteUrlRedacted = redactRemote(remoteRaw || "local://no-remote");
      const identity = parseRepoIdentity(remoteRaw || "", repoPath);
      if (!reposById.has(identity.repoId)) {
        reposById.set(identity.repoId, {
          id: identity.repoId,
          name: identity.name,
          owner: identity.owner,
          canonicalRemote: remoteUrlRedacted,
          remoteKey: identity.remoteKey,
        });
      }

      const branch = runGitSafe(repoPath, ["rev-parse", "--abbrev-ref", "HEAD"], "HEAD");
      const headSha = runGitSafe(repoPath, ["rev-parse", "HEAD"], "unknown");
      const statusOutput = runGitSafe(repoPath, ["status", "--porcelain"]);
      const statusCounts = parseStatusCounts(statusOutput);
      const aheadBehind = parseAheadBehind(repoPath);
      const latestCommitAt = runGitSafe(repoPath, ["log", "-1", "--format=%cI"]) || null;

      const commitsToday = Number.parseInt(runGitSafe(repoPath, ["rev-list", "--count", "--since=midnight", "HEAD"], "0"), 10) || 0;
      const commitsLast7Days = Number.parseInt(runGitSafe(repoPath, ["rev-list", "--count", "--since=7 days ago", "HEAD"], "0"), 10) || 0;
      const commitsLast30Days = Number.parseInt(runGitSafe(repoPath, ["rev-list", "--count", "--since=30 days ago", "HEAD"], "0"), 10) || 0;

      const todayNumstat = parseNumstatWindow(repoPath, "midnight");
      const weekNumstat = parseNumstatWindow(repoPath, "7 days ago");

      const localBranchCount = Number.parseInt(
        runGitSafe(repoPath, ["for-each-ref", "refs/heads", "--format=%(refname)"], "")
          .split("\n")
          .filter(Boolean).length.toString(),
        10,
      ) || 0;
      const remoteBranchCount = Number.parseInt(
        runGitSafe(repoPath, ["for-each-ref", "refs/remotes", "--format=%(refname)"], "")
          .split("\n")
          .filter((line) => line && !line.endsWith("/HEAD")).length.toString(),
        10,
      ) || 0;

      const locationId = `${machineId}:${repoPath}`;
      repoLocations.push({
        id: locationId,
        repoId: identity.repoId,
        machineId,
        path: repoPath,
        remoteUrlRedacted,
        upstreamBranch: aheadBehind.upstreamBranch,
        currentBranch: branch,
        headSha,
        dirty: statusCounts.dirty,
        stagedCount: statusCounts.staged,
        unstagedCount: statusCounts.unstaged,
        untrackedCount: statusCounts.untracked,
        aheadCount: aheadBehind.ahead,
        behindCount: aheadBehind.behind,
        latestCommitAt,
        commitsToday,
        commitsLast7Days,
        commitsLast30Days,
        additionsToday: todayNumstat.additions,
        deletionsToday: todayNumstat.deletions,
        additionsLast7Days: weekNumstat.additions,
        deletionsLast7Days: weekNumstat.deletions,
        localBranchCount,
        remoteBranchCount,
      });

      activityEvents.push({
        id: `${locationId}:status:${Date.now()}`,
        machineId,
        repoId: identity.repoId,
        repoLocationId: locationId,
        type: "status",
        timestamp: nowIso(),
        message: statusCounts.dirty
          ? `dirty repo, ahead=${aheadBehind.ahead}, behind=${aheadBehind.behind}`
          : `clean repo, ahead=${aheadBehind.ahead}, behind=${aheadBehind.behind}`,
      });

      if (latestCommitAt) {
        activityEvents.push({
          id: `${locationId}:commit:${headSha}`,
          machineId,
          repoId: identity.repoId,
          repoLocationId: locationId,
          type: "commit",
          timestamp: latestCommitAt,
          message: `latest commit ${headSha.slice(0, 12)} on ${branch}`,
        });
      }

      dailyRepoStats.push(...parseDailyRepoStats(repoPath, machineId, identity.repoId));
    } catch (error) {
      errors.push(`${repoPath}: ${(error as Error).message}`);
    }
  }

  const createdAt = nowIso();
  const dailyMachineStats = aggregateDailyMachineStats(dailyRepoStats, machineId, repoLocations);

  const collectorRun: CollectorRun = {
    id: `collect-${toTimestamp(createdAt)}`,
    machineId,
    collectorVersion: COLLECTOR_VERSION,
    mode: "local",
    result: errors.length ? "partial" : "ok",
    startedAt,
    finishedAt: createdAt,
    durationMs: Date.parse(createdAt) - Date.parse(startedAt),
    rootsScanned: rootsToScan,
    depthLimit,
    reposFound: repoLocations.length,
    errors,
  };

  const snapshot: SnapshotEnvelope = {
    schemaVersion: "1.0.0",
    createdAt,
    machine: {
      id: machineId,
      label: machineId.toUpperCase(),
      host: os.hostname(),
      platform: `${os.platform()}-${os.arch()}`,
    },
    collectorRun,
    repos: Array.from(reposById.values()),
    repoLocations,
    activityEvents: activityEvents.sort((a, b) => a.timestamp.localeCompare(b.timestamp)).slice(-200),
    dailyRepoStats,
    dailyMachineStats,
  };

  snapshotEnvelopeSchema.parse(snapshot);

  await mkdir(SNAPSHOT_BASE, { recursive: true });
  const timestampFile = `${toTimestamp(createdAt)}.json`;
  const latestPath = path.join(SNAPSHOT_BASE, "latest.json");
  const timestampPath = path.join(SNAPSHOT_BASE, timestampFile);
  const summaryPath = path.join(SNAPSHOT_BASE, "latest-summary.json");

  await writeFile(latestPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  await writeFile(timestampPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  await writeFile(
    summaryPath,
    `${JSON.stringify(
      {
        machineId,
        snapshotCreatedAt: createdAt,
        repoCount: snapshot.repos.length,
        repoLocationCount: snapshot.repoLocations.length,
        dirtyRepoCount: snapshot.repoLocations.filter((location) => location.dirty).length,
        unpushedRepoCount: snapshot.repoLocations.filter((location) => location.aheadCount > 0).length,
        collectorResult: snapshot.collectorRun.result,
        validation: "schema-ok",
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  process.stdout.write(`snapshot=${latestPath}\n`);
  process.stdout.write(`timestamped=${timestampPath}\n`);
  process.stdout.write(`summary=${summaryPath}\n`);
}

main().catch((error) => {
  process.stderr.write(`${(error as Error).stack || (error as Error).message}\n`);
  process.exit(1);
});
