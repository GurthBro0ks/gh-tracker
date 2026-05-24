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
import type { DashboardData, DashboardDataMode } from "@/lib/dashboard-adapter";
import { generateRepoPet, deriveRepoHealth } from "@/lib/repo-habitat";
import { RepoHabitatGrid } from "@/components/repo-habitat";

const PIE_COLORS = ["#d717ff", "#97ff4c", "#53b4ff", "#ff74ae", "#ffc44d", "#a98dff"];

function formatAgo(timestamp: string) {
  const minutes = Math.max(1, Math.floor((Date.now() - Date.parse(timestamp)) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

type DashboardProps = {
  demoData: DashboardData;
  localData: DashboardData | null;
};

export default function Dashboard({ demoData, localData }: DashboardProps) {
  const [mode, setMode] = useState<DashboardDataMode>("demo");
  const [dateRange, setDateRange] = useState("14d");
  const [machineFilter, setMachineFilter] = useState<string>("all");
  const [repoFilter, setRepoFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"combined" | "split">("combined");
  const [activityFilter, setActivityFilter] = useState<"all" | "commit" | "push" | "status">("all");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const activeData = mode === "local_snapshot" && localData ? localData : demoData;

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

  const trend = useMemo(() => {
    if (dateRange === "7d") return activeData.commitTrend.slice(-7);
    if (dateRange === "30d") return activeData.commitTrend.slice(-30);
    return activeData.commitTrend;
  }, [activeData.commitTrend, dateRange]);

  const habitatRows = useMemo(() => {
    const repoCommitLookup = new Map(activeData.repoDistribution.map((row) => [row.repoId, row.commits]));
    return activeLocations.slice(0, 8).map((location) => {
      const repoMeta = activeData.repoCatalog.find((entry) => entry.repoId === location.repoId);
      const commitsLast30Days = repoCommitLookup.get(location.repoId) ?? 0;
      const signal = {
        machineId: location.machineId,
        dirty: location.dirty,
        stagedCount: location.dirty ? 1 : 0,
        unstagedCount: location.dirty ? 1 : 0,
        untrackedCount: location.dirty ? 1 : 0,
        aheadCount: location.unpushedCommits,
        behindCount: 0,
        commitsToday: Math.min(4, commitsLast30Days),
        commitsLast7Days: Math.max(1, Math.floor(commitsLast30Days / 4)),
        commitsLast30Days,
      };
      const health = deriveRepoHealth(signal);
      const pet = generateRepoPet(
        {
          repoId: location.repoId,
          owner: repoMeta?.owner ?? "unknown",
          name: repoMeta?.name ?? location.repoId,
          canonicalRemote: repoMeta?.canonicalRemote ?? `git@github.com:unknown/${location.repoId}.git`,
          primaryLanguage: repoMeta?.primaryLanguage ?? null,
        },
        signal,
        health,
      );

      return {
        repoId: location.repoId,
        machineId: location.machineId,
        health,
        pet,
      };
    });
  }, [activeData.repoCatalog, activeData.repoDistribution, activeLocations]);

  const activeRepoCount = new Set(activeLocations.map((entry) => entry.repoId)).size;
  const activeMachineCount = new Set(activeLocations.map((entry) => entry.machineId)).size || activeData.machineCount;
  const dirtyCount = activeLocations.filter((location) => location.dirty).length;

  return (
    <main className="mx-auto w-full max-w-[1500px] px-3 pb-6 sm:px-4 md:px-8" style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}>
      <header className="neon-panel mb-4 rounded-xl px-3 py-3 sm:mb-6 sm:px-5 sm:py-4">
        <p className="text-[10px] uppercase tracking-[0.25em] text-fuchsia-200/80 sm:text-xs">Slimy.ai telemetry deck</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3 sm:mt-2 sm:gap-4">
          <div>
            <h1 className="font-sans text-xl uppercase tracking-[0.08em] text-white sm:text-3xl md:text-4xl">gh-tracker dashboard</h1>
            <p className="mt-0.5 text-xs text-violet-100/80 sm:mt-1 sm:text-sm">Local-first Git/GitHub activity view for Laptop, NUC1, and NUC2</p>
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
              {mode === "local_snapshot" ? "● NUC2 Snapshot" : "NUC2 Snapshot"}
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

      {habitatRows.length > 0 && (
        <section className="neon-panel mb-4 rounded-xl p-3 sm:mb-6 sm:hidden">
          <h3 className="mb-2 font-sans text-xs uppercase tracking-[0.12em] text-fuchsia-200">Habitat Quick View</h3>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {habitatRows.slice(0, 4).map((row) => (
              <div key={`${row.repoId}-${row.machineId}`} className="flex min-w-[140px] flex-shrink-0 items-center gap-2 rounded-lg border border-fuchsia-400/30 bg-black/35 p-2">
                <RepoPetSpriteCompact species={row.pet.species} state={row.pet.animationState} />
                <div className="min-w-0">
                  <p className="truncate text-[10px] uppercase tracking-[0.1em] text-violet-200">{row.repoId}</p>
                  <p className="text-xs text-lime-200">{row.pet.petName}</p>
                  <p className="text-[10px] text-violet-300">{row.health.score} pts</p>
                </div>
              </div>
            ))}
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

      <RepoHabitatGrid rows={habitatRows} />

      <section className="mb-6 grid gap-4 xl:grid-cols-2">
        <article className="neon-panel rounded-xl p-4">
          <h3 className="mb-3 font-sans text-sm uppercase tracking-[0.18em] text-fuchsia-200">Commits Per Day</h3>
          <div className="h-64 min-h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid stroke="rgba(255,255,255,0.1)" strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fill: "#d2c1f0", fontSize: 12 }} />
                <YAxis tick={{ fill: "#d2c1f0", fontSize: 12 }} />
                <Tooltip />
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
                <Tooltip />
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
                <Tooltip />
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
                <YAxis tick={{ fill: "#d2c1f0", fontSize: 12 }} />
                <Tooltip />
                <Area type="monotone" dataKey="additions" stackId="1" stroke="#97ff4c" fill="#97ff4c66" />
                <Area type="monotone" dataKey="deletions" stackId="2" stroke="#ff74ae" fill="#ff74ae66" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>

      <section className="mb-6 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="neon-panel rounded-xl p-4">
          <h3 className="mb-3 font-sans text-sm uppercase tracking-[0.18em] text-fuchsia-200">Repo Locations</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="text-violet-200">
                <tr>
                  <th className="pb-2">Repo</th>
                  <th className="pb-2">Machine</th>
                  <th className="pb-2">Path</th>
                  <th className="pb-2">Branch</th>
                  <th className="pb-2">Dirty</th>
                  <th className="pb-2">Unpushed</th>
                </tr>
              </thead>
              <tbody>
                {activeLocations.map((location) => (
                  <tr key={location.id} className="border-t border-white/10">
                    <td className="py-2">{location.repoId}</td>
                    <td className="py-2 uppercase">{location.machineId}</td>
                    <td className="py-2 text-xs text-violet-200/80">{location.path}</td>
                    <td className="py-2">{location.branch}</td>
                    <td className="py-2">{location.dirty ? <span className="text-rose-300">dirty</span> : <span className="text-lime-300">clean</span>}</td>
                    <td className="py-2">{location.unpushedCommits > 0 ? <span className="text-amber-200">{location.unpushedCommits}</span> : <span className="text-violet-200/70">0</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="neon-panel rounded-xl p-4">
          <h3 className="mb-3 font-sans text-sm uppercase tracking-[0.18em] text-fuchsia-200">Activity Heatmap</h3>
          <div className="space-y-1">
            {activeData.heatmap.map((week, weekIndex) => (
              <div key={`week-${weekIndex}`} className="grid grid-cols-7 gap-1">
                {week.map((value, dayIndex) => (
                  <div
                    key={`cell-${weekIndex}-${dayIndex}`}
                    className="h-6 rounded"
                    style={{
                      background: `rgba(151,255,76,${0.1 + value * 0.11})`,
                      border: "1px solid rgba(215,23,255,0.25)",
                    }}
                    title={`Activity level ${value}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="mb-6 grid gap-4 xl:grid-cols-2">
        <article className="neon-panel rounded-xl p-4">
          <h3 className="mb-3 font-sans text-sm uppercase tracking-[0.18em] text-fuchsia-200">Recent Activity Timeline</h3>
          <ul className="space-y-2 text-sm">
            {events.slice().reverse().slice(0, 20).map((event) => (
              <li key={event.id} className="rounded border border-white/10 bg-black/30 p-2">
                <p className="text-xs uppercase tracking-[0.16em] text-violet-200">{event.type} - {event.machineId} - {event.repoId}</p>
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
          <Status label="Data Mode" value={activeData.mode === "demo" ? "Demo" : "Local Snapshot"} />
          <Status label="Latest Local Snapshot Time" value={activeData.latestLocalSnapshotTime ?? "not available"} />
          <Status label="Local Repo Count" value={`${activeData.localRepoCount}`} />
          <Status label="Dirty Repo Count" value={`${activeData.dirtyRepoCount}`} />
          <Status label="Unpushed Repo Count" value={`${activeData.unpushedRepoCount}`} />
          <Status label="Collector Last Result" value={activeData.collectorLastResult} />
          <Status label="Validation Status" value={activeData.validationStatus} />
          <Status label="Machine count" value={`${activeData.machineCount}`} />
          <Status label="Repo count" value={`${activeData.repoCount}`} />
          <Status label="Source timestamp" value={activeData.sourceTimestamp} />
        </div>
      </section>
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

function RepoPetSpriteCompact({ species, state }: { species: string; state: string }) {
  const glyph = species.includes("Snail") ? "@" : species.includes("Slime") ? "o" : species.includes("Moth") ? "^" : species.includes("Crab") ? "#" : species.includes("Frog") ? "8" : species.includes("Bat") ? "M" : species.includes("Turtle") ? "Q" : species.includes("Mantis") ? "A" : species.includes("Golem") ? "H" : "U";
  return (
    <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md border border-fuchsia-400/40 bg-gradient-to-b from-[rgba(39,20,63,0.9)] to-[rgba(10,6,19,0.95)] sprite-${state}`} aria-label={`${species} sprite`}>
      <div className="flex h-7 w-7 items-center justify-center rounded border border-white/10 bg-[length:8px_8px] font-sans text-lg text-[#99ff60]" style={{ backgroundImage: "linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)" }}>
        <span>{glyph}</span>
      </div>
    </div>
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
