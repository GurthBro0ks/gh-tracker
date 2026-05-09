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
import {
  activityEvents,
  commitsPerDay,
  heatmapWeeks,
  lastDemoRefresh,
  machines,
  repoCommitDistribution,
  repoLocations,
  repos,
  type ActivityType,
  type MachineId,
} from "@/lib/demo-data";

const APP_VERSION = "0.1.0-phase0";
const PIE_COLORS = ["#d717ff", "#97ff4c", "#53b4ff", "#ff74ae", "#ffc44d", "#a98dff"];

function formatAgo(timestamp: string) {
  const minutes = Math.max(1, Math.floor((Date.now() - Date.parse(timestamp)) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function Dashboard() {
  const [dateRange, setDateRange] = useState("14d");
  const [machineFilter, setMachineFilter] = useState<MachineId | "all">("all");
  const [repoFilter, setRepoFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"combined" | "split">("combined");
  const [activityFilter, setActivityFilter] = useState<ActivityType | "all">("all");

  const activeLocations = useMemo(
    () =>
      repoLocations.filter(
        (location) =>
          (machineFilter === "all" || location.machineId === machineFilter) &&
          (repoFilter === "all" || location.repoId === repoFilter),
      ),
    [machineFilter, repoFilter],
  );

  const events = useMemo(
    () =>
      activityEvents.filter(
        (event) =>
          (machineFilter === "all" || event.machineId === machineFilter) &&
          (repoFilter === "all" || event.repoId === repoFilter) &&
          (activityFilter === "all" || event.type === activityFilter),
      ),
    [machineFilter, repoFilter, activityFilter],
  );

  const dailySlice = dateRange === "7d" ? commitsPerDay.slice(-7) : dateRange === "30d" ? commitsPerDay : commitsPerDay;
  const machineTotals = machines.reduce(
    (acc, machine) => {
      acc.commits += machine.commitsToday;
      acc.pushes += machine.pushesToday;
      acc.repos += machine.activeRepos;
      return acc;
    },
    { commits: 0, pushes: 0, repos: 0 },
  );

  const mostActiveRepo = [...repoCommitDistribution].sort((a, b) => b.commits - a.commits)[0];
  const mostActiveMachine = [...machines].sort((a, b) => b.commitsToday - a.commitsToday)[0];

  return (
    <main className="mx-auto w-full max-w-[1500px] px-4 py-6 md:px-8">
      <header className="neon-panel mb-6 rounded-xl px-5 py-4">
        <p className="text-xs uppercase tracking-[0.25em] text-fuchsia-200/80">Slimy.ai telemetry deck</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-sans text-3xl uppercase tracking-[0.08em] text-white md:text-4xl">gh-tracker dashboard</h1>
            <p className="mt-1 text-sm text-violet-100/80">Local-first Git/GitHub activity view for Laptop, NUC1, and NUC2</p>
          </div>
          <span className="chip rounded-full px-3 py-1 font-mono text-xs uppercase tracking-[0.2em]">demo mode</span>
        </div>
      </header>

      <section className="neon-panel mb-6 rounded-xl p-4">
        <h2 className="mb-3 font-sans text-lg uppercase tracking-[0.08em]">Filters</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
            <select value={machineFilter} onChange={(e) => setMachineFilter(e.target.value as MachineId | "all")} className="mt-2 w-full rounded border border-fuchsia-400/50 bg-black/40 px-2 py-2 text-sm">
              <option value="all">All machines</option>
              {machines.map((machine) => (
                <option key={machine.id} value={machine.id}>{machine.label}</option>
              ))}
            </select>
          </label>
          <label className="text-xs uppercase tracking-[0.15em] text-violet-200">
            Repo
            <select value={repoFilter} onChange={(e) => setRepoFilter(e.target.value)} className="mt-2 w-full rounded border border-fuchsia-400/50 bg-black/40 px-2 py-2 text-sm">
              <option value="all">All repos</option>
              {repos.map((repo) => (
                <option key={repo.id} value={repo.id}>{repo.name}</option>
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
            <select value={activityFilter} onChange={(e) => setActivityFilter(e.target.value as ActivityType | "all")} className="mt-2 w-full rounded border border-fuchsia-400/50 bg-black/40 px-2 py-2 text-sm">
              <option value="all">All events</option>
              <option value="commit">Commits</option>
              <option value="push">Pushes</option>
              <option value="status">Status checks</option>
            </select>
          </label>
        </div>
      </section>

      <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Total commits today" value={`${machineTotals.commits}`} />
        <Metric label="Pushes today" value={`${machineTotals.pushes}`} />
        <Metric label="Active repos" value={`${new Set(activeLocations.map((entry) => entry.repoId)).size}`} />
        <Metric label="Active machines" value={`${new Set(activeLocations.map((entry) => entry.machineId)).size || machines.length}`} />
        <Metric label="Coding streak" value={`${Math.max(...machines.map((m) => m.streak))} days`} />
        <Metric label="Most active repo" value={mostActiveRepo.repoId} />
        <Metric label="Most active machine" value={mostActiveMachine.label} />
        <Metric label="Dirty locations" value={`${activeLocations.filter((location) => location.dirty).length}`} danger />
      </section>

      <section className="mb-6 grid gap-4 lg:grid-cols-3">
        {machines.map((machine) => (
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

      <section className="mb-6 grid gap-4 xl:grid-cols-2">
        <article className="neon-panel rounded-xl p-4">
          <h3 className="mb-3 font-sans text-sm uppercase tracking-[0.18em] text-fuchsia-200">Commits Per Day</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailySlice}>
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
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailySlice}>
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
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={repoCommitDistribution.slice(0, 6)} dataKey="commits" nameKey="repoId" cx="50%" cy="50%" outerRadius={90} label>
                  {repoCommitDistribution.slice(0, 6).map((item, index) => (
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
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailySlice}>
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
            {heatmapWeeks.map((week, weekIndex) => (
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
            {events.map((event) => (
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
            {repoCommitDistribution.slice(0, 8).map((repo, index) => (
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
          <Status label="App version" value={APP_VERSION} />
          <Status label="Data mode" value="demo" />
          <Status label="Collector status" value="not installed" />
          <Status label="GitHub sync status" value="not configured" />
          <Status label="Machine count" value={`${machines.length}`} />
          <Status label="Repo count" value={`${repos.length}`} />
          <Status label="Tracked locations" value={`${repoLocations.length}`} />
          <Status label="Last demo refresh" value={lastDemoRefresh} />
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
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
