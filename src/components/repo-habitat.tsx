import type { RepoAttentionReason, RepoCareAction, RepoHealth, RepoPet } from "@/lib/contracts";

type HabitatRow = {
  repoId: string;
  machineId: string;
  pet: RepoPet;
  health: RepoHealth;
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
      <h3 className="font-sans text-base uppercase tracking-[0.08em] text-white sm:text-lg">Repo Habitat</h3>
      <p className="mb-3 mt-1 text-xs text-violet-100/80 sm:mb-4 sm:text-sm">Original retro virtual-pet inspired companions driven by repo health. GitHub release/CI/PR sync is placeholder only in Phase 2.</p>
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
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[10px] uppercase tracking-[0.15em] text-violet-200 sm:text-xs">{row.repoId}</p>
          <p className="text-base text-lime-200 sm:text-lg">{row.pet.petName}</p>
          <p className="text-[10px] text-violet-300 sm:text-xs">{row.pet.species} - {row.pet.stage} - {row.pet.mood}</p>
        </div>
        <RepoHealthBadge health={row.health} />
      </div>

      <div className="mt-2 flex items-center gap-2 sm:mt-3 sm:gap-3">
        <RepoPetSprite species={row.pet.species} state={row.pet.animationState} />
        <div className="grid flex-1 grid-cols-2 gap-1.5 text-[10px] text-violet-200 sm:gap-2 sm:text-xs">
          <p className="rounded border border-white/10 px-1.5 py-0.5 sm:px-2 sm:py-1">Machine: {row.machineId.toUpperCase()}</p>
          <p className="rounded border border-white/10 px-1.5 py-0.5 sm:px-2 sm:py-1">Energy: {row.pet.stats.energy}</p>
          <p className="rounded border border-white/10 px-1.5 py-0.5 sm:px-2 sm:py-1">Cleanliness: {row.pet.stats.cleanliness}</p>
          <p className="rounded border border-white/10 px-1.5 py-0.5 sm:px-2 sm:py-1">Trust: {row.pet.stats.trust}</p>
        </div>
      </div>

      <div className="mt-2 grid gap-2 sm:mt-3 md:grid-cols-2">
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-[0.14em] text-violet-300 sm:text-xs">Attention Reasons</p>
          <ul className="space-y-1 text-[10px] text-violet-100/90 sm:text-xs">
            {row.health.attentionReasons.slice(0, 4).map((reason) => (
              <li key={reason} className="rounded border border-white/10 bg-black/30 px-1.5 py-0.5 sm:px-2 sm:py-1">{attentionLabels[reason]}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-[0.14em] text-violet-300 sm:text-xs">Care Actions</p>
          <CareActionList actions={row.health.careActions.slice(0, 4)} />
        </div>
      </div>

      <div className="mt-2 grid gap-1.5 text-[10px] sm:mt-3 sm:gap-2 sm:text-xs sm:grid-cols-2">
        <p className="rounded border border-cyan-300/30 bg-cyan-400/10 px-1.5 py-0.5 sm:px-2 sm:py-1">Release health: not synced yet</p>
        <p className="rounded border border-cyan-300/30 bg-cyan-400/10 px-1.5 py-0.5 sm:px-2 sm:py-1">CI: not synced yet</p>
        <p className="rounded border border-cyan-300/30 bg-cyan-400/10 px-1.5 py-0.5 sm:px-2 sm:py-1">PR/issue pressure: not synced yet</p>
        <p className="rounded border border-cyan-300/30 bg-cyan-400/10 px-1.5 py-0.5 sm:px-2 sm:py-1">GitHub health sync: not configured</p>
      </div>
    </article>
  );
}

export function RepoHealthBadge({ health }: { health: RepoHealth }) {
  return <p className="rounded border border-lime-300/50 bg-lime-400/10 px-2 py-1 text-xs uppercase tracking-[0.12em] text-lime-200">{health.score} - {health.bucket.replace("_", " ")}</p>;
}

export function CareActionList({ actions }: { actions: RepoCareAction[] }) {
  return (
    <ul className="space-y-1 text-xs text-violet-100/90">
      {actions.map((action) => (
        <li key={action} className="rounded border border-white/10 bg-black/30 px-2 py-1">{careLabels[action]}</li>
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
