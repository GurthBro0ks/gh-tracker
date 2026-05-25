import type { DashboardGithubRepoHealth } from "@/lib/dashboard-adapter";
import type { RepoAttentionReason, RepoCareAction, RepoHealth, RepoPet } from "@/lib/contracts";

type HabitatRow = {
  repoId: string;
  machineId: string;
  pet: RepoPet;
  health: RepoHealth;
  github?: DashboardGithubRepoHealth | null;
};

const attentionLabels: Record<RepoAttentionReason, string> = {
  dirty_worktree: "Working tree is dirty",
  unpushed_commits: "Local commits not pushed",
  behind_remote: "Branch is behind remote",
  low_activity: "Maintenance momentum is low",
  release_unknown: "Release health not synced yet",
  ci_unknown: "CI status not synced yet",
  pr_pressure_unknown: "PR pressure not synced yet",
  issue_pressure_unknown: "Issue pressure not synced yet",
};

const careLabels: Record<RepoCareAction, string> = {
  commit_or_stash_changes: "Commit or stash local changes",
  push_local_commits: "Push local commits",
  pull_and_rebase: "Pull and rebase",
  review_release_plan: "Plan next release",
  set_up_ci_sync: "Configure CI sync",
  triage_prs: "Triage pull requests",
  triage_issues: "Triage issues",
  schedule_maintenance: "Schedule a maintenance block",
};

export function RepoHabitatGrid({ rows }: { rows: HabitatRow[] }) {
  return (
    <section className="neon-panel mb-6 rounded-xl p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 sm:mb-4">
        <div>
          <h3 className="font-sans text-base uppercase tracking-[0.08em] text-white sm:text-lg">Repo Habitat</h3>
          <p className="mt-0.5 text-[10px] text-violet-300/80 sm:text-xs">Retro virtual-pet companions driven by repo health. Pixel art is placeholder until sprite-sheet phase.</p>
        </div>
        <span className="rounded border border-fuchsia-400/30 bg-black/30 px-2 py-0.5 text-[9px] uppercase tracking-[0.1em] text-violet-300">Local + GitHub Health</span>
      </div>
      <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
        {rows.map((row) => (
          <RepoPetCard key={`${row.repoId}-${row.machineId}`} row={row} />
        ))}
      </div>
    </section>
  );
}

function RepoPetCard({ row }: { row: HabitatRow }) {
  return (
    <article className="rounded-xl border border-fuchsia-400/40 bg-black/35 p-2.5 sm:p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-base font-sans uppercase tracking-[0.06em] text-white break-words sm:text-lg">{row.repoId}</p>
          <p className="text-[10px] text-violet-300 break-words sm:text-xs">{row.pet.species} · {row.pet.stage} · {row.pet.mood}</p>
        </div>
        <div className="flex flex-col gap-1 sm:items-end">
          <RepoHealthBadge health={row.health} />
          {row.github ? <GithubHealthBadge github={row.github} /> : null}
        </div>
      </div>
      <p className="mt-1 text-xs text-lime-200 sm:text-sm">{row.pet.petName}</p>

      <div className="mt-2 flex flex-col gap-2 sm:mt-3 sm:flex-row sm:items-center sm:gap-3">
        <RepoPetSprite species={row.pet.species} state={row.pet.animationState} />
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-1.5 text-[10px] text-violet-200 sm:grid-cols-2 sm:gap-2 sm:text-xs">
          <p className="rounded border border-white/10 px-1.5 py-0.5 break-words sm:px-2 sm:py-1">Machine: {row.machineId.toUpperCase()}</p>
          <p className="rounded border border-white/10 px-1.5 py-0.5 break-words sm:px-2 sm:py-1">Energy: {row.pet.stats.energy}</p>
          <p className="rounded border border-white/10 px-1.5 py-0.5 break-words sm:px-2 sm:py-1">Cleanliness: {row.pet.stats.cleanliness}</p>
          <p className="rounded border border-white/10 px-1.5 py-0.5 break-words sm:px-2 sm:py-1">Trust: {row.pet.stats.trust}</p>
        </div>
      </div>

      <div className="mt-2 grid gap-2 sm:mt-3 md:grid-cols-2">
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-[0.14em] text-violet-300 sm:text-xs">Attention Reasons</p>
          <ul className="space-y-1 text-[10px] text-violet-100/90 sm:text-xs">
            {row.health.attentionReasons.slice(0, 4).map((reason) => (
              <li key={reason} className="rounded border border-white/10 bg-black/30 px-1.5 py-0.5 break-words sm:px-2 sm:py-1">{attentionLabels[reason]}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-[0.14em] text-violet-300 sm:text-xs">Care Actions</p>
          <CareActionList actions={row.health.careActions.slice(0, 4)} />
        </div>
      </div>

      <div className="mt-2 grid gap-1.5 text-[10px] sm:mt-3 sm:gap-2 sm:text-xs sm:grid-cols-2">
        <p className="rounded border border-cyan-300/30 bg-cyan-400/10 px-1.5 py-0.5 sm:px-2 sm:py-1">Release: {row.github ? formatRelease(row.github.latestRelease) : "not synced yet"}</p>
        <p className="rounded border border-cyan-300/30 bg-cyan-400/10 px-1.5 py-0.5 sm:px-2 sm:py-1">CI: {row.github ? formatCi(row.github.ci) : "not synced yet"}</p>
        <p className="rounded border border-cyan-300/30 bg-cyan-400/10 px-1.5 py-0.5 sm:px-2 sm:py-1">PR/issue pressure: {row.github ? `${row.github.pullRequests.open ?? "?"} PR / ${row.github.issues.open ?? "?"} issues` : "not synced yet"}</p>
        <p className="rounded border border-cyan-300/30 bg-cyan-400/10 px-1.5 py-0.5 sm:px-2 sm:py-1">GitHub sync: {row.github ? row.github.sync.status : "not configured"}</p>
      </div>
    </article>
  );
}

export function RepoHealthBadge({ health }: { health: RepoHealth }) {
  return <p className="self-start rounded border border-lime-300/50 bg-lime-400/10 px-2 py-1 text-xs uppercase tracking-[0.12em] text-lime-200 break-words">{health.score} - {health.bucket.replace("_", " ")}</p>;
}

function GithubHealthBadge({ github }: { github: DashboardGithubRepoHealth }) {
  const tone = github.health.label === "healthy" ? "border-lime-300/50 bg-lime-400/10 text-lime-200" : github.health.label === "watch" ? "border-amber-300/50 bg-amber-400/10 text-amber-200" : "border-rose-300/50 bg-rose-400/10 text-rose-200";
  return <p className={`self-start rounded border px-2 py-1 text-[10px] uppercase tracking-[0.12em] break-words ${tone}`}>GitHub {github.health.score} - {github.health.label}</p>;
}

function formatRelease(release: DashboardGithubRepoHealth["latestRelease"]) {
  if (release.status === "none") return "No release found";
  if (!release.tagName) return "unknown";
  return release.ageDays === null ? `${release.tagName} (${release.status})` : `${release.tagName} (${release.ageDays}d)`;
}

function formatCi(ci: DashboardGithubRepoHealth["ci"]) {
  if (ci.status === "none") return "No runs found";
  return ci.workflowName ? `${ci.status} (${ci.workflowName})` : ci.status;
}

export function CareActionList({ actions }: { actions: RepoCareAction[] }) {
  return (
    <ul className="space-y-1 text-xs text-violet-100/90">
      {actions.map((action) => (
        <li key={action} className="rounded border border-white/10 bg-black/30 px-2 py-1 break-words">{careLabels[action]}</li>
      ))}
    </ul>
  );
}

export function RepoPetSprite({ species, state }: { species: string; state: string }) {
  const glyph = species.includes("Snail") ? "@" : species.includes("Slime") ? "o" : species.includes("Moth") ? "^" : species.includes("Crab") ? "#" : species.includes("Frog") ? "8" : species.includes("Bat") ? "M" : species.includes("Turtle") ? "Q" : species.includes("Mantis") ? "A" : species.includes("Golem") ? "H" : "U";
  return (
    <div className={`sprite-wrap sprite-${state}`} aria-label={`${species} sprite`}>
      <div className="pixel-grid" role="img">
        <span>{glyph}</span>
      </div>
    </div>
  );
}
