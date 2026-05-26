"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useMemo, useState } from "react";
import type { CanonicalRepoView, DashboardData, DashboardDataMode, DashboardGithubRepoHealth } from "@/lib/dashboard-adapter";
import type { RepoHealth, RepoHealthBucket, RepoPet } from "@/lib/contracts";
import { generateRepoPet, deriveRepoHealth } from "@/lib/repo-habitat";
import { RepoHabitatGrid } from "@/components/repo-habitat";
import { RepoPetSprite, type RepoPetSpriteStatus } from "@/components/repo-pet-sprite";
import { buildHeatmapInspectorCells } from "@/lib/heatmap-inspector";
import { buildCleanupPlanner } from "@/lib/cleanup-planner";

const PIE_COLORS = ["#d717ff", "#97ff4c", "#53b4ff", "#ff74ae", "#ffc44d", "#a98dff"];

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-fuchsia-400/50 bg-gradient-to-b from-[rgba(18,9,32,0.95)] to-[rgba(8,4,15,0.95)] px-3 py-2 shadow-[0_0_24px_rgba(215,23,255,0.22)]"
      style={{ maxWidth: "calc(100vw - 2rem)" }}
    >
      <p className="font-sans text-xs uppercase tracking-[0.08em] text-lime-300">{label}</p>
      <div className="mt-1 space-y-0.5">
        {payload.map((entry, index) => (
          <p key={index} className="font-mono text-xs text-violet-100">
            <span style={{ color: entry.color }} className="mr-1">●</span>
            <span className="text-violet-300">{entry.name}:</span>{" "}
            <span className="font-bold text-lime-300">{formatCompact(entry.value)}</span>
          </p>
        ))}
      </div>
    </div>
  );
}

function formatAgo(timestamp: string) {
  const minutes = Math.max(1, Math.floor((Date.now() - Date.parse(timestamp)) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function githubStatusLabel(status: DashboardData["githubHealth"]["status"]) {
  if (status === "synced") return "Synced";
  if (status === "partial") return "Partial";
  if (status === "failed") return "Failed";
  return "Pending Phase 5";
}

function formatSyncAge(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

function bucketFromScore(score: number): RepoHealthBucket {
  if (score >= 90) return "legendary";
  if (score >= 75) return "healthy";
  if (score >= 55) return "needs_care";
  if (score >= 35) return "stressed";
  return "sick";
}

function getPetSpriteStatus(row: { health: RepoHealth; pet: RepoPet; canonicalRepo?: CanonicalRepoView }): RepoPetSpriteStatus {
  const dirty = row.canonicalRepo ? row.canonicalRepo.dirtyState !== "clean" : row.health.local.dirty;
  const unpushed = row.canonicalRepo?.unpushedTotal ?? row.health.sync.aheadCount;
  if (unpushed > 0) return "alert";
  if (dirty || row.health.bucket === "needs_care" || row.health.bucket === "stressed" || row.health.bucket === "sick") return "needs-care";
  if (row.pet.mood === "focused") return "focused";
  return "healthy";
}

function mergeRemoteHealth(base: RepoHealth, github?: DashboardGithubRepoHealth | null): RepoHealth {
  if (!github) return base;

  const score = Math.max(0, Math.min(100, Math.round(base.score * 0.65 + github.health.score * 0.35)));
  const careActions = new Set(base.careActions);

  if (github.latestRelease.status === "none" || github.latestRelease.status === "stale") careActions.add("review_release_plan");
  if ((github.pullRequests.open ?? 0) > 0 || (github.pullRequests.stale ?? 0) > 0) careActions.add("triage_prs");
  if ((github.issues.open ?? 0) > 0 || (github.issues.stale ?? 0) > 0) careActions.add("triage_issues");
  if (github.ci.status === "failure") careActions.add("set_up_ci_sync");

  return {
    ...base,
    score,
    bucket: bucketFromScore(score),
    release: {
      freshnessDays: github.latestRelease.ageDays,
      commitsSinceRelease: null,
      status: github.latestRelease.status === "fresh" ? "fresh" : github.latestRelease.status === "aging" ? "aging" : github.latestRelease.status === "unknown" ? "not_synced" : "stale",
    },
    sync: {
      ...base.sync,
      githubSyncConfigured: true,
    },
    ci: {
      status: github.ci.status === "success" ? "passing" : github.ci.status === "failure" ? "failing" : "unknown",
      lastRunAt: github.ci.createdAt,
    },
    prPressure: github.pullRequests.open,
    issuePressure: github.issues.open,
    attentionReasons: base.attentionReasons.filter((reason) => !reason.endsWith("_unknown")),
    careActions: Array.from(careActions),
  };
}

type DashboardProps = {
  demoData: DashboardData;
  localData: DashboardData | null;
  session?: { email: string; role: string } | null;
};

export default function Dashboard({ demoData, localData, session }: DashboardProps) {
  const [mode, setMode] = useState<DashboardDataMode>(localData?.mode === "aggregated" ? "aggregated" : "demo");
  const [dateRange, setDateRange] = useState("14d");
  const [machineFilter, setMachineFilter] = useState<string>("all");
  const [repoFilter, setRepoFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"combined" | "split">("combined");
  const [activityFilter, setActivityFilter] = useState<"all" | "commit" | "push" | "status">("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [expandedRepos, setExpandedRepos] = useState<Set<string>>(new Set());
  const [selectedHeatmapDay, setSelectedHeatmapDay] = useState(0);
  const [actionCenterRepoId, setActionCenterRepoId] = useState<string | null>(null);

  const activeData = (mode === "local_snapshot" || mode === "aggregated") && localData ? localData : demoData;

  const toggleRepoExpand = (repoId: string) => {
    setExpandedRepos((prev) => {
      const next = new Set(prev);
      if (next.has(repoId)) {
        next.delete(repoId);
      } else {
        next.add(repoId);
      }
      return next;
    });
  };

  const activeLocations = useMemo(
    () =>
      activeData.repoRows.filter(
        (location) =>
          (machineFilter === "all" || location.machineId === machineFilter) &&
          (repoFilter === "all" || location.repoId === repoFilter),
      ),
    [activeData.repoRows, machineFilter, repoFilter],
  );

  const events = useMemo(
    () =>
      activeData.timeline.filter(
        (event) =>
          (machineFilter === "all" || event.machineId === machineFilter) &&
          (repoFilter === "all" || event.repoId === repoFilter) &&
          (activityFilter === "all" || event.type === activityFilter),
      ),
    [activeData.timeline, machineFilter, repoFilter, activityFilter],
  );

  const dedupedEvents = useMemo(() => {
    const groups = new Map<string, { event: typeof events[0]; machines: string[] }>();
    for (const event of events) {
      const key = `${event.repoId}:${event.type}:${event.message}`;
      const existing = groups.get(key);
      if (existing) {
        if (!existing.machines.includes(event.machineId)) {
          existing.machines.push(event.machineId);
        }
      } else {
        groups.set(key, { event, machines: [event.machineId] });
      }
    }
    return Array.from(groups.values())
      .sort((a, b) => b.event.timestamp.localeCompare(a.event.timestamp))
      .slice(0, 20);
  }, [events]);

  const trend = useMemo(() => {
    if (dateRange === "7d") return activeData.commitTrend.slice(-7);
    if (dateRange === "30d") return activeData.commitTrend.slice(-30);
    return activeData.commitTrend;
  }, [activeData.commitTrend, dateRange]);

  const habitatRows = useMemo(() => {
    const repoCommitLookup = new Map(activeData.repoDistribution.map((row) => [row.repoId, row.commits]));
    return activeData.canonicalRepos.slice(0, 8).map((canonicalRepo) => {
      const github = canonicalRepo.github;
      const commitsLast30Days = repoCommitLookup.get(canonicalRepo.repoId) ?? canonicalRepo.combinedCommits;
      const isDirty = canonicalRepo.dirtyState === "dirty" || canonicalRepo.dirtyState === "mixed";
      const signal = {
        machineId: canonicalRepo.machines.join(","),
        dirty: isDirty,
        stagedCount: isDirty ? 1 : 0,
        unstagedCount: isDirty ? 1 : 0,
        untrackedCount: isDirty ? 1 : 0,
        aheadCount: canonicalRepo.unpushedTotal,
        behindCount: 0,
        commitsToday: Math.min(4, commitsLast30Days),
        commitsLast7Days: Math.max(1, Math.floor(commitsLast30Days / 4)),
        commitsLast30Days,
      };
      const health = mergeRemoteHealth(deriveRepoHealth(signal), github);
      const pet = generateRepoPet(
        {
          repoId: canonicalRepo.repoId,
          owner: canonicalRepo.owner ?? "unknown",
          name: canonicalRepo.displayName ?? canonicalRepo.repoId,
          canonicalRemote: canonicalRepo.canonicalRemote ?? `git@github.com:unknown/${canonicalRepo.repoId}.git`,
          primaryLanguage: canonicalRepo.primaryLanguage ?? null,
        },
        signal,
        health,
      );

      return {
        repoId: canonicalRepo.repoId,
        machineId: canonicalRepo.machines.join(","),
        health,
        pet,
        github,
        canonicalRepo,
      };
    });
  }, [activeData.canonicalRepos, activeData.repoDistribution]);

  const activeRepoCount = new Set(activeLocations.map((entry) => entry.repoId)).size;
  const activeMachineCount = new Set(activeLocations.map((entry) => entry.machineId)).size || activeData.machineCount;
  const dirtyCount = activeLocations.filter((location) => location.dirty).length;
  const lineChangeSeries = trend.map((row) => row.additions + row.deletions).filter((value) => value > 0);
  const maxLineChange = lineChangeSeries.length ? Math.max(...lineChangeSeries) : 0;
  const medianLineChange = lineChangeSeries.length
    ? [...lineChangeSeries].sort((a, b) => a - b)[Math.floor(lineChangeSeries.length / 2)]
    : 0;
  const hasLineChangeOutlier = maxLineChange > 50000 && (medianLineChange === 0 || maxLineChange >= medianLineChange * 8);
  const githubRepos = activeData.repoCatalog.map((repo) => repo.github).filter((repo): repo is DashboardGithubRepoHealth => Boolean(repo));
  const githubHealthAvailable = activeData.githubHealth.status !== "pending";
  const githubOpenPrs = githubRepos.reduce((sum, repo) => sum + (repo.pullRequests.open ?? 0), 0);
  const githubOpenIssues = githubRepos.reduce((sum, repo) => sum + (repo.issues.open ?? 0), 0);
  const githubFailingCi = githubRepos.filter((repo) => repo.ci.status === "failure").length;
  const githubNoRelease = githubRepos.filter((repo) => repo.latestRelease.status === "none").length;
  const heatmapCells = useMemo(() => buildHeatmapInspectorCells(activeData.heatmap, activeData.commitTrend, activeData.timeline), [activeData.heatmap, activeData.commitTrend, activeData.timeline]);
  const selectedHeatmapCell = heatmapCells[selectedHeatmapDay] ?? null;
  const cleanupPlanner = useMemo(() => buildCleanupPlanner(activeData.canonicalRepos), [activeData.canonicalRepos]);
  const plannerTop = cleanupPlanner.slice(0, 5);
  const plannerCounts = {
    critical: cleanupPlanner.filter((item) => item.priorityBand === "critical").length,
    high: cleanupPlanner.filter((item) => item.priorityBand === "high").length,
    medium: cleanupPlanner.filter((item) => item.priorityBand === "medium").length,
  };
  const plannerByRepo = new Map(cleanupPlanner.map((entry) => [entry.repoId, entry]));

  return (
    <main className="mx-auto w-full max-w-[1500px] px-3 pb-6 sm:px-4 md:px-8" style={{ paddingTop: "max(1rem, env(safe-area-inset-top))", paddingBottom: "max(5.5rem, calc(env(safe-area-inset-bottom) + 2rem))" }}>
      <header className="neon-panel mb-4 rounded-xl px-3 py-3 sm:mb-6 sm:px-5 sm:py-4">
        <p className="text-[10px] uppercase tracking-[0.25em] text-fuchsia-200/80 sm:text-xs">Slimy.ai telemetry deck</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3 sm:mt-2 sm:gap-4">
          <div>
            <h1 className="font-sans text-xl uppercase tracking-[0.08em] text-white sm:text-3xl md:text-4xl">gh-tracker dashboard</h1>
            <p className="mt-0.5 text-xs text-violet-100/80 sm:mt-1 sm:text-sm">
              {activeData.laptopStatus === "loaded"
                ? "Aggregated local Git activity across Laptop, NUC1, and NUC2"
                : "Local-first Git/GitHub activity view for NUC1, NUC2, and Laptop (pending manual snapshot import)"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`rounded border px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] sm:px-3 sm:text-xs sm:tracking-[0.15em] ${mode === "demo" ? "border-lime-300 bg-lime-300/20 text-lime-200" : "border-fuchsia-400/50 bg-black/30 text-violet-200"}`}
              onClick={() => setMode("demo")}
            >
              {mode === "demo" ? "● Demo" : "Demo"}
            </button>
            <button
              type="button"
              disabled={!localData}
              className={`rounded border px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] sm:px-3 sm:text-xs sm:tracking-[0.15em] ${mode === "local_snapshot" ? "border-lime-300 bg-lime-300/20 text-lime-200" : "border-fuchsia-400/50 bg-black/30 text-violet-200"} ${!localData ? "cursor-not-allowed opacity-50" : ""}`}
              onClick={() => setMode("local_snapshot")}
            >
              {mode === "local_snapshot" ? "● Local Snapshot" : "Local Snapshot"}
            </button>
            <button
              type="button"
              disabled={!localData || localData.mode !== "aggregated"}
              className={`rounded border px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] sm:px-3 sm:text-xs sm:tracking-[0.15em] ${mode === "aggregated" ? "border-lime-300 bg-lime-300/20 text-lime-200" : "border-fuchsia-400/50 bg-black/30 text-violet-200"} ${(!localData || localData.mode !== "aggregated") ? "cursor-not-allowed opacity-50" : ""}`}
              onClick={() => setMode("aggregated")}
            >
              {mode === "aggregated" ? "● Aggregated" : "Aggregated"}
            </button>
            <button
              type="button"
              className="rounded border border-fuchsia-400/50 bg-black/30 px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-violet-200 sm:px-3 sm:text-xs sm:tracking-[0.15em]"
              onClick={() => setSettingsOpen(true)}
            >
              Settings
            </button>
          </div>
        </div>
      </header>

      <section className="neon-panel mb-4 rounded-xl p-3 sm:mb-6 sm:p-4">
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          className="flex w-full items-center justify-between sm:hidden"
        >
          <h2 className="font-sans text-sm uppercase tracking-[0.08em]">Filters</h2>
          <span className="text-xs text-violet-200">{filtersOpen ? "▲ Hide" : "▼ Show"}</span>
        </button>
        <h2 className="mb-3 hidden font-sans text-lg uppercase tracking-[0.08em] sm:block">Filters</h2>
        <div className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-5 ${filtersOpen ? "" : "hidden sm:grid"}`}>
          <label className="text-xs uppercase tracking-[0.15em] text-violet-200">
            Date Range
            <select value={dateRange} onChange={(e) => setDateRange(e.target.value)} className="mt-2 w-full rounded border border-fuchsia-400/50 bg-black/40 px-2 py-2 text-sm">
              <option value="7d">Last 7 days</option>
              <option value="14d">Last 14 days</option>
              <option value="30d">Last 30 days</option>
            </select>
          </label>
          <label className="text-xs uppercase tracking-[0.15em] text-violet-200">
            Machine
            <select value={machineFilter} onChange={(e) => setMachineFilter(e.target.value)} className="mt-2 w-full rounded border border-fuchsia-400/50 bg-black/40 px-2 py-2 text-sm">
              <option value="all">All machines</option>
              {activeData.machineCards.map((machine) => (
                <option key={machine.id} value={machine.id}>{machine.label}</option>
              ))}
            </select>
          </label>
          <label className="text-xs uppercase tracking-[0.15em] text-violet-200">
            Repo
            <select value={repoFilter} onChange={(e) => setRepoFilter(e.target.value)} className="mt-2 w-full rounded border border-fuchsia-400/50 bg-black/40 px-2 py-2 text-sm">
              <option value="all">All repos</option>
              {Array.from(new Set(activeData.repoRows.map((repo) => repo.repoId))).map((repoId) => (
                <option key={repoId} value={repoId}>{repoId}</option>
              ))}
            </select>
          </label>
          <label className="text-xs uppercase tracking-[0.15em] text-violet-200">
            View Mode
            <select value={viewMode} onChange={(e) => setViewMode(e.target.value as "combined" | "split")} className="mt-2 w-full rounded border border-fuchsia-400/50 bg-black/40 px-2 py-2 text-sm">
              <option value="combined">Combined</option>
              <option value="split">Split by machine</option>
            </select>
          </label>
          <label className="text-xs uppercase tracking-[0.15em] text-violet-200">
            Activity Type
            <select value={activityFilter} onChange={(e) => setActivityFilter(e.target.value as "all" | "commit" | "push" | "status")} className="mt-2 w-full rounded border border-fuchsia-400/50 bg-black/40 px-2 py-2 text-sm">
              <option value="all">All events</option>
              <option value="commit">Commits</option>
              <option value="push">Pushes</option>
              <option value="status">Status checks</option>
            </select>
          </label>
        </div>
      </section>

      <section className="mb-4 grid grid-cols-2 gap-2 sm:mb-6 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <Metric label="Commits today" value={`${activeData.totalCommitsToday}`} compact />
        <Metric label="Active repos" value={`${activeRepoCount}`} compact />
        <Metric label="Dirty" value={`${dirtyCount}`} danger compact />
        <Metric label="Machines" value={`${activeMachineCount}`} compact />
      </section>

      {githubHealthAvailable ? (
        <section className="neon-panel mb-4 rounded-xl p-3 sm:mb-6 sm:p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="font-sans text-sm uppercase tracking-[0.12em] text-fuchsia-200 sm:text-lg">GitHub Remote Health</h2>
              <p className="mt-0.5 text-[10px] text-violet-300/85 sm:text-xs">
                Read-only sync via GitHub CLI · Latest sync {activeData.githubHealth.latestSyncAt ? formatAgo(activeData.githubHealth.latestSyncAt) : "unknown"}
              </p>
            </div>
            <div className="flex flex-wrap gap-1">
              <span className={`rounded border px-2 py-1 text-[10px] uppercase tracking-[0.12em] ${activeData.githubHealth.status === "synced" ? "border-lime-300/50 bg-lime-400/10 text-lime-200" : activeData.githubHealth.status === "partial" ? "border-amber-300/50 bg-amber-400/10 text-amber-200" : "border-rose-300/50 bg-rose-400/10 text-rose-200"}`}>
                {githubStatusLabel(activeData.githubHealth.status)}
              </span>
              {activeData.githubHealth.freshness !== "missing" && (
                <span className={`rounded border px-2 py-1 text-[10px] uppercase tracking-[0.12em] ${activeData.githubHealth.freshness === "fresh" ? "border-lime-300/50 bg-lime-400/10 text-lime-200" : activeData.githubHealth.freshness === "stale" ? "border-amber-300/50 bg-amber-400/10 text-amber-200" : "border-rose-300/50 bg-rose-400/10 text-rose-200"}`}>
                  {activeData.githubHealth.freshness === "fresh" ? "Fresh" : activeData.githubHealth.freshness === "stale" ? "Stale" : "Old"}
                </span>
              )}
            </div>
          </div>
          <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-4">
            <Status label="Repos synced" value={`${activeData.githubHealth.syncedRepoCount}/${githubRepos.length}`} />
            <Status label="Partial/failed" value={`${activeData.githubHealth.partialRepoCount}/${activeData.githubHealth.failedRepoCount}`} />
            <Status label="Release gaps" value={githubNoRelease > 0 ? `${githubNoRelease} with no release` : "latest releases found"} />
            <Status label="CI pressure" value={githubFailingCi > 0 ? `${githubFailingCi} failing` : "no failures in latest runs"} />
            <Status label="Open PRs" value={`${githubOpenPrs}`} />
            <Status label="Open issues" value={`${githubOpenIssues}`} />
            <Status label="Sync age" value={activeData.githubHealth.syncAgeMinutes != null ? formatSyncAge(activeData.githubHealth.syncAgeMinutes) : "unknown"} />
            <Status label="Data source" value="ownership-filtered aggregate" />
          </div>
        </section>
      ) : null}

      {habitatRows.length > 0 && (
        <section className="neon-panel mb-4 rounded-xl p-3 sm:mb-6 sm:hidden">
          <h3 className="mb-2 font-sans text-xs uppercase tracking-[0.12em] text-fuchsia-200">Habitat Quick View</h3>
          <div className="relative">
            <div className="pointer-events-none absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-[rgba(8,4,15,0.95)] to-transparent" />
            <div className="flex snap-x gap-2 overflow-x-auto pb-1 pr-6 [scroll-padding-inline:0.75rem]">
            {habitatRows.slice(0, 4).map((row) => (
              <div key={`${row.repoId}-${row.machineId}`} className="flex min-w-[78%] max-w-[78%] snap-start flex-shrink-0 items-center gap-2 rounded-lg border border-fuchsia-400/30 bg-black/35 p-2">
                <RepoPetSprite species={row.pet.species} stage={row.pet.stage} state={row.pet.animationState} status={getPetSpriteStatus(row)} mode="compact" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-sans uppercase tracking-[0.06em] text-white">{row.repoId}</p>
                  <p className="text-[10px] text-violet-300">{row.pet.species} · {row.pet.stage} · {row.health.score} pts</p>
                </div>
              </div>
            ))}
            </div>
          </div>
        </section>
      )}

      <section className="mb-6 hidden gap-4 sm:grid sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Total commits today" value={`${activeData.totalCommitsToday}`} />
        <Metric label="Pushes today" value={`${activeData.pushesToday}`} />
        <Metric label="Active repos" value={`${activeRepoCount}`} />
        <Metric label="Active machines" value={`${activeMachineCount}`} />
        <Metric label="Coding streak" value={`${activeData.codingStreakDays} days`} />
        <Metric label="Most active repo" value={activeData.mostActiveRepo} />
        <Metric label="Most active machine" value={activeData.mostActiveMachine} />
        <Metric label="Dirty locations" value={`${dirtyCount}`} danger />
      </section>

      <section className="mb-6 grid gap-4 lg:grid-cols-3">
        {activeData.machineCards.map((machine) => (
          <article key={machine.id} className="neon-panel rounded-xl p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-violet-200">{machine.label}</p>
            <p className="text-xs text-violet-300/80">{machine.host}</p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-violet-300/80">Commits</span><p className="metric-glow text-xl text-lime-300">{machine.commitsToday}</p></div>
              <div><span className="text-violet-300/80">Pushes</span><p className="text-xl text-fuchsia-200">{machine.pushesToday}</p></div>
              <div><span className="text-violet-300/80">Repos</span><p className="text-xl text-cyan-200">{machine.activeRepos}</p></div>
              <div><span className="text-violet-300/80">Streak</span><p className="text-xl text-amber-200">{machine.streak}d</p></div>
            </div>
          </article>
        ))}
      </section>

      <RepoHabitatGrid
        rows={habitatRows}
        expandedRepos={expandedRepos}
        onToggleExpand={toggleRepoExpand}
        actionCenterRepoId={actionCenterRepoId}
        onActionCenterChange={setActionCenterRepoId}
        cleanupPriorityMap={plannerByRepo}
      />

      <section className="neon-panel mb-6 rounded-xl p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-sans text-sm uppercase tracking-[0.18em] text-fuchsia-200">Repo Cleanup Planner</h3>
            <p className="mt-1 text-xs text-violet-200/85">Ranked, read-only cleanup priorities. Commands are copy-only and never executed by this app.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <Status label="Repos needing attention" value={`${cleanupPlanner.filter((item) => item.priorityScore > 0).length}`} />
            <Status label="Critical" value={`${plannerCounts.critical}`} />
            <Status label="High" value={`${plannerCounts.high}`} />
            <Status label="Medium" value={`${plannerCounts.medium}`} />
          </div>
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {plannerTop.map((item) => (
            <article key={item.repoId} className="rounded-xl border border-fuchsia-400/30 bg-black/30 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-sans text-sm uppercase tracking-[0.08em] text-white">{item.displayName}</p>
                <span className={`rounded border px-2 py-1 text-[10px] uppercase tracking-[0.12em] ${item.priorityBand === "critical" ? "border-rose-300/60 bg-rose-400/10 text-rose-200" : item.priorityBand === "high" ? "border-amber-300/60 bg-amber-400/10 text-amber-200" : item.priorityBand === "medium" ? "border-cyan-300/60 bg-cyan-400/10 text-cyan-200" : "border-violet-300/60 bg-violet-400/10 text-violet-200"}`}>
                  {item.priorityBand} · {item.priorityScore}
                </span>
              </div>
              <p className="mt-1 text-xs text-violet-200/80">Machines: {item.affectedMachines.join(", ").toUpperCase()}</p>
              <p className="mt-1 text-xs text-violet-200/80">Locations: {item.affectedLocations.map((loc) => `${loc.machineId}:${loc.path}`).join("; ") || "none"}</p>
              <ul className="mt-2 space-y-1 text-xs text-violet-100/90">
                {item.reasons.slice(0, 3).map((reason, idx) => (
                  <li key={`${item.repoId}:reason:${idx}`} className="rounded border border-white/10 bg-black/35 px-2 py-1">{reason}</li>
                ))}
              </ul>
              <div className="mt-2 flex flex-wrap gap-2">
                {item.recommendedActions.slice(0, 3).map((action) => (
                  <span key={`${item.repoId}:action:${action}`} className="rounded border border-cyan-300/35 bg-cyan-400/10 px-2 py-1 text-[10px] uppercase tracking-[0.1em] text-cyan-100">{action}</span>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button type="button" className="rounded border border-fuchsia-300/45 bg-fuchsia-400/10 px-3 py-1 text-[10px] uppercase tracking-[0.12em] text-fuchsia-100" onClick={() => setActionCenterRepoId(item.repoId)}>
                  Open Action Center
                </button>
                {item.safeCommandGroups[0] ? (
                  <button
                    type="button"
                    className="rounded border border-cyan-300/45 bg-cyan-400/10 px-3 py-1 text-[10px] uppercase tracking-[0.12em] text-cyan-100"
                    onClick={() => {
                      void navigator.clipboard?.writeText(item.safeCommandGroups[0].commands.join("\n"));
                    }}
                  >
                    Copy Inspection Commands
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mb-6 grid gap-4 xl:grid-cols-2">
        <article className="neon-panel rounded-xl p-4">
          <h3 className="mb-3 font-sans text-sm uppercase tracking-[0.18em] text-fuchsia-200">Commits Per Day</h3>
          <div className="h-64 min-h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid stroke="rgba(255,255,255,0.1)" strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fill: "#d2c1f0", fontSize: 12 }} />
                <YAxis tick={{ fill: "#d2c1f0", fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey={viewMode === "combined" ? "total" : "laptop"} stroke="#97ff4c" strokeWidth={2} />
                {viewMode === "split" ? (
                  <>
                    <Line type="monotone" dataKey="nuc1" stroke="#d717ff" strokeWidth={2} />
                    <Line type="monotone" dataKey="nuc2" stroke="#53b4ff" strokeWidth={2} />
                  </>
                ) : null}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="neon-panel rounded-xl p-4">
          <h3 className="mb-3 font-sans text-sm uppercase tracking-[0.18em] text-fuchsia-200">Stacked Commits By Machine</h3>
          <div className="h-64 min-h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend}>
                <CartesianGrid stroke="rgba(255,255,255,0.1)" strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fill: "#d2c1f0", fontSize: 12 }} />
                <YAxis tick={{ fill: "#d2c1f0", fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="laptop" stackId="a" fill="#97ff4c" />
                <Bar dataKey="nuc1" stackId="a" fill="#d717ff" />
                <Bar dataKey="nuc2" stackId="a" fill="#53b4ff" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="neon-panel rounded-xl p-4">
          <h3 className="mb-3 font-sans text-sm uppercase tracking-[0.18em] text-fuchsia-200">Repo Activity Share</h3>
          <div className="h-64 min-h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={activeData.repoDistribution.slice(0, 6)} dataKey="commits" nameKey="repoId" cx="50%" cy="50%" outerRadius={90} label>
                  {activeData.repoDistribution.slice(0, 6).map((item, index) => (
                    <Cell key={item.repoId} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="neon-panel rounded-xl p-4">
          <h3 className="mb-3 font-sans text-sm uppercase tracking-[0.18em] text-fuchsia-200">Additions Vs Deletions</h3>
          <div className="h-64 min-h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
                <CartesianGrid stroke="rgba(255,255,255,0.1)" strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fill: "#d2c1f0", fontSize: 12 }} />
                <YAxis tick={{ fill: "#d2c1f0", fontSize: 12 }} tickFormatter={(value) => formatCompact(Number(value))} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="additions" stackId="1" stroke="#97ff4c" fill="#97ff4c66" />
                <Area type="monotone" dataKey="deletions" stackId="2" stroke="#ff74ae" fill="#ff74ae66" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {hasLineChangeOutlier ? (
            <p className="mt-2 text-xs text-amber-200/90">Outlier detected: at least one day has unusually large line changes. Raw values are preserved; verify generated-file noise during Phase 4B.</p>
          ) : null}
        </article>
      </section>

      <section className="mb-6 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="neon-panel rounded-xl p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-sans text-sm uppercase tracking-[0.18em] text-fuchsia-200">Repo Locations</h3>
            <span className="text-[10px] text-violet-300/70 sm:text-xs">Grouped by canonical repo · {activeData.canonicalRepos.length} repos · {activeData.repoRows.length} locations</span>
          </div>
          <div className="space-y-2 sm:hidden">
            {activeData.canonicalRepos.map((repo) => (
              <article
                key={repo.repoId}
                className="rounded-lg border border-white/10 bg-black/30 p-2.5 text-xs cursor-pointer"
                onClick={() => toggleRepoExpand(repo.repoId)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") toggleRepoExpand(repo.repoId); }}
              >
                <p className="font-sans text-sm uppercase tracking-[0.06em] text-white break-words">{repo.repoId}</p>
                <p className="mt-0.5 text-[11px] text-violet-300">
                  {repo.machines.join(", ").toUpperCase()} · {repo.locationCount} location{repo.locationCount !== 1 ? "s" : ""}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  <p className="rounded border border-white/10 px-1.5 py-1">Dirty: <span className={repo.dirtyState === "clean" ? "text-lime-300" : repo.dirtyState === "mixed" ? "text-amber-300" : "text-rose-300"}>{repo.dirtyState}</span></p>
                  <p className="rounded border border-white/10 px-1.5 py-1">Unpushed: <span className="text-amber-200">{repo.unpushedTotal}</span></p>
                  <p className="rounded border border-white/10 px-1.5 py-1">Commits: <span className="text-lime-300">{repo.combinedCommits}</span></p>
                  <p className="rounded border border-white/10 px-1.5 py-1">Pushes: <span className="text-fuchsia-200">{repo.combinedPushes}</span></p>
                </div>
                {expandedRepos.has(repo.repoId) && (
                  <div className="mt-2 space-y-1 border-t border-white/10 pt-2">
                    {repo.perLocationDetails.map((loc) => (
                      <div key={loc.id} className="text-[10px] text-violet-200/80">
                        <span className="uppercase text-violet-300">{loc.machineId}</span> · {loc.path} · {loc.branch} · {loc.dirty ? <span className="text-rose-300">dirty</span> : <span className="text-lime-300">clean</span>} · unpushed:{loc.unpushedCommits}
                      </div>
                    ))}
                  </div>
                )}
                {!expandedRepos.has(repo.repoId) && repo.perMachineDetails.length > 1 && (
                  <p className="mt-1 text-center text-[10px] text-violet-300/60">Tap to expand</p>
                )}
              </article>
            ))}
          </div>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="text-violet-200">
                <tr>
                  <th className="pb-2">Repo</th>
                  <th className="pb-2">Machines</th>
                  <th className="pb-2">Locations</th>
                  <th className="pb-2">Dirty</th>
                  <th className="pb-2">Unpushed</th>
                  <th className="pb-2">Commits</th>
                </tr>
              </thead>
              <tbody>
                {activeData.canonicalRepos.map((repo) => (
                  <>
                    <tr
                      key={repo.repoId}
                      className="border-t border-white/10 cursor-pointer hover:bg-white/5"
                      onClick={() => toggleRepoExpand(repo.repoId)}
                    >
                      <td className="py-2 font-sans uppercase tracking-[0.04em]">{repo.repoId}</td>
                      <td className="py-2 uppercase">{repo.machines.join(", ")}</td>
                      <td className="py-2">{repo.locationCount}</td>
                      <td className="py-2">
                        <span className={repo.dirtyState === "clean" ? "text-lime-300" : repo.dirtyState === "mixed" ? "text-amber-300" : "text-rose-300"}>
                          {repo.dirtyState}
                        </span>
                      </td>
                      <td className="py-2">{repo.unpushedTotal > 0 ? <span className="text-amber-200">{repo.unpushedTotal}</span> : <span className="text-violet-200/70">0</span>}</td>
                      <td className="py-2"><span className="text-lime-300">{repo.combinedCommits}</span></td>
                    </tr>
                    {expandedRepos.has(repo.repoId) && (
                      <tr className="border-t border-white/5">
                        <td colSpan={6} className="py-2">
                          <div className="space-y-1 pl-4">
                            {repo.perLocationDetails.map((loc) => (
                              <div key={loc.id} className="flex flex-wrap items-center gap-2 text-xs text-violet-200/80">
                                <span className="uppercase text-violet-300 w-16">{loc.machineId}</span>
                                <span className="break-all flex-1 min-w-[200px]">{loc.path}</span>
                                <span className="w-24">{loc.branch}</span>
                                <span className={loc.dirty ? "text-rose-300 w-12" : "text-lime-300 w-12"}>{loc.dirty ? "dirty" : "clean"}</span>
                                <span className="w-16">unpushed:{loc.unpushedCommits}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="neon-panel rounded-xl p-4">
          <h3 className="mb-3 font-sans text-sm uppercase tracking-[0.18em] text-fuchsia-200">Activity Heatmap</h3>
          <p className="mb-2 text-xs text-violet-200/90">Tap a day to inspect activity.</p>
          <div className="space-y-1">
            {activeData.heatmap.map((week, weekIndex) => (
              <div key={`week-${weekIndex}`} className="grid grid-cols-7 gap-1">
                {week.map((value, dayIndex) => (
                  <button
                    key={`cell-${weekIndex}-${dayIndex}`}
                    type="button"
                    aria-label={`Heatmap day ${weekIndex + 1}-${dayIndex + 1}`}
                    className="h-7 rounded border transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-300/70"
                    style={{
                      background: `rgba(151,255,76,${0.1 + value * 0.11})`,
                      border: selectedHeatmapDay === weekIndex * 7 + dayIndex ? "2px solid rgba(83,180,255,0.95)" : "1px solid rgba(215,23,255,0.25)",
                    }}
                    title={`Activity level ${value}`}
                    onClick={() => setSelectedHeatmapDay(weekIndex * 7 + dayIndex)}
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="mt-3 rounded border border-cyan-300/35 bg-black/30 p-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-cyan-200">Activity Day Inspector</p>
            {selectedHeatmapCell?.detailsAvailable ? (
              <div className="mt-2 space-y-1 text-xs text-violet-100">
                <p>Date: <span className="text-lime-200">{selectedHeatmapCell.dateLabel}</span></p>
                <p>Intensity: <span className="text-lime-200">{selectedHeatmapCell.intensity}</span></p>
                <p>Commits: <span className="text-lime-200">{selectedHeatmapCell.commitCount ?? "unknown"}</span></p>
                <p>Machines: <span className="text-lime-200">{selectedHeatmapCell.machineSummary ?? "unknown"}</span></p>
                <p>Repo summary: <span className="text-lime-200">{selectedHeatmapCell.repoSummary ?? "No detailed activity available for this day"}</span></p>
              </div>
            ) : (
              <p className="mt-2 text-xs text-violet-200/80">No detailed activity available for this day.</p>
            )}
          </div>
        </article>
      </section>

      <section className="mb-6 grid gap-4 xl:grid-cols-2">
        <article className="neon-panel rounded-xl p-4">
          <h3 className="mb-3 font-sans text-sm uppercase tracking-[0.18em] text-fuchsia-200">Recent Activity Timeline</h3>
          <ul className="space-y-2 text-sm">
            {dedupedEvents.map(({ event, machines }) => (
              <li key={event.id} className="rounded border border-white/10 bg-black/30 p-2">
                <p className="text-xs uppercase tracking-[0.16em] text-violet-200">
                  {event.type} — {machines.length > 1 ? `${machines.join(", ")}` : event.machineId} — {event.repoId}
                  {machines.length > 1 && (
                    <span className="ml-1 text-[10px] text-amber-200/80">({machines.length} machines)</span>
                  )}
                </p>
                <p className="text-violet-50">{event.message}</p>
                <p className="text-xs text-violet-300/70">{formatAgo(event.timestamp)}</p>
              </li>
            ))}
          </ul>
        </article>

        <article className="neon-panel rounded-xl p-4">
          <h3 className="mb-3 font-sans text-sm uppercase tracking-[0.18em] text-fuchsia-200">Top Repos Leaderboard</h3>
          <ol className="space-y-2">
            {activeData.repoDistribution.slice(0, 8).map((repo, index) => (
              <li key={repo.repoId} className="flex items-center justify-between rounded border border-white/10 bg-black/30 px-3 py-2 text-sm">
                <span className="text-violet-100">#{index + 1} {repo.repoId}</span>
                <span className="chip rounded px-2 py-0.5 text-xs">{repo.commits} commits</span>
              </li>
            ))}
          </ol>
        </article>
      </section>

      <section className="neon-panel rounded-xl p-4 text-xs">
        <h3 className="mb-2 font-sans text-sm uppercase tracking-[0.18em] text-fuchsia-200">Debug / Status Dock</h3>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <Status label="App version" value={activeData.version} />
          <Status label="Data Mode" value={activeData.mode === "demo" ? "Demo (simulated)" : activeData.mode === "aggregated" ? "Aggregated Live Snapshots" : "Local Snapshot"} />
          <Status label="Latest Local Snapshot" value={activeData.latestLocalSnapshotTime ?? "pending Phase 4 collector"} />
          <Status label="Local Repo Count" value={activeData.mode === "demo" ? "0 (demo mode)" : `${activeData.localRepoCount}`} />
          <Status label="Dirty Repo Count" value={activeData.mode === "demo" ? "0 (demo mode)" : `${activeData.dirtyRepoCount}`} />
          <Status label="Unpushed Repo Count" value={activeData.mode === "demo" ? "0 (demo mode)" : `${activeData.unpushedRepoCount}`} />
          <Status label="Collector Status" value={activeData.mode === "demo" ? "not connected on public deploy" : activeData.collectorLastResult} />
          <Status label="Validation Status" value={activeData.validationStatus} />
          <Status label="Machine count" value={`${activeData.machineCount}`} />
          <Status label="Loaded machines" value={activeData.loadedMachineIds.length > 0 ? activeData.loadedMachineIds.join(", ") : "Demo mode"} />
          <Status label="Laptop status" value={activeData.laptopStatus === "loaded" ? "Loaded" : "Pending manual snapshot import"} />
          <Status label="Repo count" value={`${activeData.repoCount}`} />
          <Status label="Ownership filter" value={activeData.mode === "demo" ? "N/A (demo)" : "enabled"} />
          <Status label="Excluded repos" value={activeData.mode === "demo" ? "N/A (demo)" : `${activeData.excludedReposCount ?? "unknown"}`} />
          <Status label="GitHub health sync" value={githubStatusLabel(activeData.githubHealth.status)} />
          <Status label="GitHub sync freshness" value={activeData.githubHealth.freshness === "missing" ? "not synced" : activeData.githubHealth.freshness} />
          <Status label="GitHub sync age" value={activeData.githubHealth.syncAgeMinutes != null ? formatSyncAge(activeData.githubHealth.syncAgeMinutes) : "unknown"} />
          <Status label="GitHub synced repos" value={`${activeData.githubHealth.syncedRepoCount}`} />
        </div>
      </section>

      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-16 sm:items-center sm:pt-0">
          <div className="w-full max-w-md rounded-xl border border-fuchsia-400/50 bg-gradient-to-b from-[rgba(18,9,32,0.98)] to-[rgba(8,4,15,0.98)] p-5 shadow-[0_0_40px_rgba(215,23,255,0.2)]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-sans text-lg uppercase tracking-[0.08em] text-fuchsia-200">Settings</h2>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="rounded border border-fuchsia-400/50 bg-black/30 px-2 py-1 text-xs text-violet-200 hover:text-fuchsia-200"
              >
                Close
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="rounded border border-white/10 bg-black/30 px-3 py-2">
                <p className="text-violet-300">App version</p>
                <p className="text-violet-100">{activeData.version}</p>
              </div>

              <div className="rounded border border-white/10 bg-black/30 px-3 py-2">
                <p className="text-violet-300">Auth source</p>
                <p className="text-violet-100">Slimy owner email/password</p>
              </div>

              <div className="rounded border border-white/10 bg-black/30 px-3 py-2">
                <p className="text-violet-300">Signed in as</p>
                <p className="text-violet-100">{session ? session.email : "Unknown"}</p>
              </div>

              <div className="rounded border border-white/10 bg-black/30 px-3 py-2">
                <p className="text-violet-300">Role</p>
                <p className="text-violet-100">{session ? session.role : "Unknown"}</p>
              </div>

              <div className="rounded border border-white/10 bg-black/30 px-3 py-2">
                <p className="text-violet-300">Outer gate</p>
                <p className="text-violet-100">Basic Auth still enabled</p>
              </div>

              <div className="rounded border border-white/10 bg-black/30 px-3 py-2">
                <p className="text-violet-300">GitHub sync status</p>
                <p className="text-violet-100">{githubStatusLabel(activeData.githubHealth.status)} — {activeData.githubHealth.syncedRepoCount} repos synced</p>
              </div>

              <div className="rounded border border-white/10 bg-black/30 px-3 py-2">
                <p className="text-violet-300">Session status</p>
                <p className="text-violet-100">{session?.role === "owner" ? "Active (owner verified)" : "Unknown"}</p>
              </div>

              <button
                type="button"
                onClick={async () => {
                  await fetch("/api/auth/logout", { method: "POST" });
                  window.location.href = "/login";
                }}
                className="w-full rounded border border-rose-400/50 bg-rose-950/30 px-3 py-2 text-xs font-medium text-rose-200 hover:bg-rose-900/40"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Metric({ label, value, danger = false, compact = false }: { label: string; value: string; danger?: boolean; compact?: boolean }) {
  if (compact) {
    return (
      <article className="neon-panel rounded-lg p-2.5 sm:rounded-xl sm:p-4">
        <p className="text-[9px] uppercase tracking-[0.15em] text-violet-200 sm:text-xs sm:tracking-[0.18em]">{label}</p>
        <p className={`mt-1 font-sans text-lg uppercase sm:mt-2 sm:text-2xl ${danger ? "text-rose-300" : "metric-glow text-lime-300"}`}>{value}</p>
      </article>
    );
  }
  return (
    <article className="neon-panel rounded-xl p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-violet-200">{label}</p>
      <p className={`mt-2 font-sans text-2xl uppercase ${danger ? "text-rose-300" : "metric-glow text-lime-300"}`}>{value}</p>
    </article>
  );
}

function Status({ label, value }: { label: string; value: string }) {
  return (
    <p className="rounded border border-white/10 bg-black/35 px-2 py-1">
      <span className="mr-2 text-violet-300">{label}:</span>
      <span className="text-violet-100">{value}</span>
    </p>
  );
}
