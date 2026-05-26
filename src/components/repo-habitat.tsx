import type { CanonicalRepoView, DashboardGithubRepoHealth } from "@/lib/dashboard-adapter";
import type { CleanupPlannerEntry } from "@/lib/cleanup-planner";
import type { RepoAttentionReason, RepoCareAction, RepoHealth, RepoPet } from "@/lib/contracts";
import { RepoPetSprite, type RepoPetSpriteStatus } from "@/components/repo-pet-sprite";
import * as React from "react";

type HabitatRow = {
  repoId: string;
  machineId: string;
  pet: RepoPet;
  health: RepoHealth;
  github?: DashboardGithubRepoHealth | null;
  canonicalRepo?: CanonicalRepoView;
};

type ActionCenterModel = {
  canonicalRepo: string;
  displayName: string;
  machines: string[];
  locations: Array<{ machineId: string; path: string; branch: string; dirty: boolean; unpushedCommits: number; headSha: string }>;
  dirtyStatus: "clean" | "dirty" | "mixed" | "unknown";
  dirtyLocations: string[];
  unpushedTotal: number;
  aheadBehindSummary: string;
  branches: string[];
  githubHealthSummary: string;
  prCount: number | null;
  issueCount: number | null;
  ciStatus: string;
  releaseStatus: string;
  attentionReasons: string[];
  careActions: string[];
  safeCommandGroups: Array<{ machineId: string; path: string; runLabel: string; commands: string[] }>;
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

export function RepoHabitatGrid({
  rows,
  expandedRepos,
  onToggleExpand,
  actionCenterRepoId,
  onActionCenterChange,
  cleanupPriorityMap,
}: {
  rows: HabitatRow[];
  expandedRepos: Set<string>;
  onToggleExpand: (repoId: string) => void;
  actionCenterRepoId?: string | null;
  onActionCenterChange?: (repoId: string | null) => void;
  cleanupPriorityMap?: Map<string, CleanupPlannerEntry>;
}) {
  const [localActionCenterRepoId, setLocalActionCenterRepoId] = React.useState<string | null>(null);
  const selectedRepoId = actionCenterRepoId !== undefined ? actionCenterRepoId : localActionCenterRepoId;
  const setSelectedRepoId = onActionCenterChange ?? setLocalActionCenterRepoId;
  const actionCenterFor = selectedRepoId ? rows.find((row) => row.repoId === selectedRepoId) ?? null : null;

  return (
    <section className="neon-panel mb-6 rounded-xl p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 sm:mb-4">
        <div>
          <h3 className="font-sans text-base uppercase tracking-[0.08em] text-white sm:text-lg">Repo Habitat</h3>
          <p className="mt-0.5 text-[10px] text-violet-300/80 sm:text-xs">Grouped by canonical repo. Tap a card to expand machine details.</p>
        </div>
        <span className="rounded border border-fuchsia-400/30 bg-black/30 px-2 py-0.5 text-[9px] uppercase tracking-[0.1em] text-violet-300">Local + GitHub Health</span>
      </div>
      <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
        {rows.map((row) => (
          <RepoPetCard
            key={row.repoId}
            row={row}
            expanded={expandedRepos.has(row.repoId)}
            onToggleExpand={() => onToggleExpand(row.repoId)}
            onOpenActionCenter={() => setSelectedRepoId(row.repoId)}
          />
        ))}
      </div>
      {actionCenterFor ? <ActionCenterDrawer row={actionCenterFor} planner={cleanupPriorityMap?.get(actionCenterFor.repoId) ?? null} onClose={() => setSelectedRepoId(null)} /> : null}
    </section>
  );
}

function RepoPetCard({ row, expanded, onToggleExpand, onOpenActionCenter }: { row: HabitatRow; expanded: boolean; onToggleExpand: () => void; onOpenActionCenter: () => void }) {
  const canonical = row.canonicalRepo;
  const hasDetails = canonical && canonical.perMachineDetails.length > 1;
  const spriteStatus = getPetSpriteStatus(row);

  return (
    <article
      className="overflow-hidden rounded-xl border border-fuchsia-400/40 bg-black/35 p-2.5 sm:p-3 cursor-pointer transition-colors hover:bg-black/45"
      onClick={onToggleExpand}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onToggleExpand(); }}
    >
      <div className="mb-2">
        <button
          type="button"
          className="w-full rounded border border-cyan-300/50 bg-cyan-400/15 px-3 py-2 text-xs font-medium uppercase tracking-[0.12em] text-cyan-100"
          onClick={(e) => {
            e.stopPropagation();
            onOpenActionCenter();
          }}
        >
          Open Action Center
        </button>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-base font-sans uppercase tracking-[0.06em] text-white break-words sm:text-lg">{row.repoId}</p>
          <p className="text-[10px] text-violet-300 break-words sm:text-xs">
            {row.pet.species} · {row.pet.stage} · {row.pet.mood}
            {canonical && (
              <span className="ml-1 text-cyan-200/80">· {canonical.locationCount} location{canonical.locationCount !== 1 ? "s" : ""} · {canonical.machines.join(", ").toUpperCase()}</span>
            )}
          </p>
        </div>
        <div className="flex flex-col gap-1 sm:items-end">
          <RepoHealthBadge health={row.health} />
          {row.github ? <GithubHealthBadge github={row.github} /> : null}
        </div>
      </div>
      <p className="mt-1 text-xs text-lime-200 sm:text-sm">{row.pet.petName}</p>

      <div className="mt-2 flex flex-col gap-2 sm:mt-3 sm:flex-row sm:items-center sm:gap-3">
        <RepoPetSprite species={row.pet.species} state={row.pet.animationState} status={spriteStatus} />
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-1.5 text-[10px] text-violet-200 sm:grid-cols-2 sm:gap-2 sm:text-xs">
          <p className="rounded border border-white/10 px-1.5 py-0.5 break-words sm:px-2 sm:py-1">
            Dirty: {canonical ? (
              <span className={canonical.dirtyState === "clean" ? "text-lime-300" : canonical.dirtyState === "mixed" ? "text-amber-300" : "text-rose-300"}>
                {canonical.dirtyState}
              </span>
            ) : row.health.local.dirty ? <span className="text-rose-300">yes</span> : <span className="text-lime-300">no</span>}
          </p>
          <p className="rounded border border-white/10 px-1.5 py-0.5 break-words sm:px-2 sm:py-1">Unpushed: <span className="text-amber-200">{canonical?.unpushedTotal ?? row.health.sync.aheadCount}</span></p>
          <p className="rounded border border-white/10 px-1.5 py-0.5 break-words sm:px-2 sm:py-1">Energy: {row.pet.stats.energy}</p>
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

      {hasDetails && expanded && (
        <div className="mt-3 rounded border border-fuchsia-400/20 bg-black/20 p-2 sm:p-3">
          <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-fuchsia-200 sm:text-xs">Per-Machine Details</p>
          <div className="space-y-2">
            {canonical.perMachineDetails.map((machine) => (
              <div key={machine.machineId} className="rounded border border-white/10 bg-black/30 p-2 text-[10px] sm:text-xs">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <span className="font-sans uppercase tracking-[0.08em] text-violet-100">{machine.machineId.toUpperCase()}</span>
                  <span className={machine.dirty ? "text-rose-300" : "text-lime-300"}>{machine.dirty ? "dirty" : "clean"}</span>
                </div>
                <div className="mt-1 grid grid-cols-2 gap-1 text-violet-200/80 sm:grid-cols-4">
                  <span>Commits: {machine.commits}</span>
                  <span>Unpushed: {machine.unpushedCommits}</span>
                  <span>Branch: {machine.branch || "unknown"}</span>
                  <span>Pushes: {machine.pushes}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] uppercase tracking-[0.12em] text-violet-300/70 sm:text-xs">Per-Location Details</p>
          <div className="mt-1 space-y-1">
            {canonical.perLocationDetails.map((loc) => (
              <div key={loc.id} className="flex flex-wrap items-center justify-between gap-1 rounded border border-white/10 bg-black/30 p-1.5 text-[10px] text-violet-200/80 sm:text-xs">
                <span className="break-all">{loc.path}</span>
                <span className={loc.dirty ? "text-rose-300" : "text-lime-300"}>{loc.branch} · {loc.dirty ? "dirty" : "clean"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasDetails && !expanded && (
        <div className="mt-2 text-center text-[10px] text-violet-300/60 sm:text-xs">
          Tap to expand {canonical.perMachineDetails.length} machine{canonical.perMachineDetails.length !== 1 ? "s" : ""}
        </div>
      )}
    </article>
  );
}

function getPetSpriteStatus(row: HabitatRow): RepoPetSpriteStatus {
  const dirty = row.canonicalRepo ? row.canonicalRepo.dirtyState !== "clean" : row.health.local.dirty;
  const unpushed = row.canonicalRepo?.unpushedTotal ?? row.health.sync.aheadCount;
  if (unpushed > 0) return "alert";
  if (dirty || row.health.bucket === "needs_care" || row.health.bucket === "stressed" || row.health.bucket === "sick") return "needs-care";
  if (row.pet.mood === "focused") return "focused";
  return "healthy";
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

function ActionCenterDrawer({ row, planner, onClose }: { row: HabitatRow; planner: CleanupPlannerEntry | null; onClose: () => void }) {
  const model = buildActionCenterModel(row);
  return (
    <div className="fixed inset-0 z-50 bg-black/75 p-2 sm:p-6" role="dialog" aria-modal="true" aria-label="Repo Action Center">
      <div className="mx-auto max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-xl border border-fuchsia-400/40 bg-[rgba(10,6,18,0.98)] p-3 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] text-fuchsia-200">Repo Action Center</p>
            <h4 className="text-base font-sans uppercase tracking-[0.08em] text-white sm:text-lg">{model.displayName}</h4>
          </div>
          <button type="button" className="rounded border border-white/20 bg-black/30 px-3 py-1 text-xs text-violet-100" onClick={onClose}>Close</button>
        </div>

        <Section title="Overview" lines={[
          `Repo: ${model.canonicalRepo}`,
          `Dirty state: ${model.dirtyStatus}`,
          `Unpushed commits: ${model.unpushedTotal}`,
          `Ahead/behind: ${model.aheadBehindSummary}`,
          ...(planner ? [`Cleanup priority: ${planner.priorityBand} (${planner.priorityScore})`] : []),
        ]} />
        <Section title="Machines & Locations" lines={model.locations.map((loc) => `${loc.machineId.toUpperCase()} · ${loc.path} · ${loc.branch} · ${loc.dirty ? "dirty" : "clean"}`)} />
        <Section title="Local Git State" lines={[
          `Branches: ${model.branches.join(", ") || "unknown"}`,
          `Dirty locations: ${model.dirtyLocations.length > 0 ? model.dirtyLocations.join("; ") : "none"}`,
        ]} />
        <Section title="GitHub Remote Health" lines={[
          model.githubHealthSummary,
          `PRs open: ${model.prCount ?? "unknown"}`,
          `Issues open: ${model.issueCount ?? "unknown"}`,
          `CI: ${model.ciStatus}`,
          `Release: ${model.releaseStatus}`,
        ]} />
        <Section title="Care Plan" lines={[
          ...(planner ? planner.reasons.map((reason) => `Priority reason: ${reason}`) : []),
          ...model.attentionReasons.map((r) => `Needs care: ${r}`),
          ...model.careActions.map((a) => `Action: ${a}`),
          "All actions are manual operator actions. This app does not execute commands.",
        ]} />
        <div className="mt-3 rounded border border-cyan-300/30 bg-black/30 p-2.5 sm:p-3">
          <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-cyan-200 sm:text-xs">Copy Commands</p>
          <div className="space-y-2">
            {model.safeCommandGroups.map((group) => (
              <div key={`${group.machineId}:${group.path}`} className="rounded border border-white/10 bg-black/25 p-2 text-[10px] sm:text-xs">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-violet-200 break-all">{group.machineId.toUpperCase()} · {group.runLabel} · {group.path}</p>
                  <button
                    type="button"
                    className="rounded border border-cyan-300/40 bg-cyan-400/10 px-2 py-1 text-[10px] uppercase tracking-[0.1em] text-cyan-100"
                    onClick={() => {
                      void navigator.clipboard?.writeText(group.commands.join("\n"));
                    }}
                  >
                    Copy
                  </button>
                </div>
                <pre className="overflow-x-auto whitespace-pre text-lime-200">{group.commands.join("\n")}</pre>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="mt-3 rounded border border-fuchsia-400/20 bg-black/25 p-2.5 sm:p-3">
      <p className="mb-1 text-[10px] uppercase tracking-[0.14em] text-violet-300 sm:text-xs">{title}</p>
      <ul className="space-y-1 text-[10px] text-violet-100/90 sm:text-xs">
        {lines.map((line, idx) => <li key={`${title}:${idx}`} className="rounded border border-white/10 bg-black/30 px-2 py-1 break-words">{line}</li>)}
      </ul>
    </div>
  );
}

function buildActionCenterModel(row: HabitatRow): ActionCenterModel {
  const canonical = row.canonicalRepo;
  const locations = canonical?.perLocationDetails ?? [];
  const dirtyLocations = locations.filter((loc) => loc.dirty).map((loc) => `${loc.machineId}:${loc.path}`);
  const branches = Array.from(new Set(locations.map((loc) => loc.branch).filter(Boolean)));
  const github = row.github;
  const safeCommandGroups = locations.map((loc) => {
    const remote = machineRemotePrefix(loc.machineId);
    const commands = [
      ...(remote ? [remote] : []),
      `cd ${loc.path}`,
      "git status --branch --short",
      "git diff --stat",
      "git log --oneline -5",
      "git branch --show-current",
    ];
    return {
      machineId: loc.machineId,
      path: loc.path,
      runLabel: loc.machineId === "laptop" ? "Run on laptop" : "Run on machine",
      commands,
    };
  });

  return {
    canonicalRepo: row.repoId,
    displayName: canonical?.displayName ?? row.repoId,
    machines: canonical?.machines ?? [row.machineId],
    locations: locations.map((loc) => ({ machineId: loc.machineId, path: loc.path, branch: loc.branch, dirty: loc.dirty, unpushedCommits: loc.unpushedCommits, headSha: loc.headSha })),
    dirtyStatus: canonical?.dirtyState ?? "unknown",
    dirtyLocations,
    unpushedTotal: canonical?.unpushedTotal ?? row.health.sync.aheadCount,
    aheadBehindSummary: `ahead ${canonical?.unpushedTotal ?? row.health.sync.aheadCount}, behind unknown`,
    branches,
    githubHealthSummary: github ? `GitHub health ${github.health.score} (${github.health.label}) · sync ${github.sync.status}` : "GitHub health not synced yet",
    prCount: github?.pullRequests.open ?? null,
    issueCount: github?.issues.open ?? null,
    ciStatus: github?.ci.status ?? "unknown",
    releaseStatus: github?.latestRelease.status ?? "unknown",
    attentionReasons: row.health.attentionReasons.map((r) => attentionLabels[r]),
    careActions: row.health.careActions.map((a) => careLabels[a]),
    safeCommandGroups,
  };
}

function machineRemotePrefix(machineId: string): string | null {
  if (machineId === "nuc1") return "ssh nuc1";
  if (machineId === "nuc2") return "ssh nuc2";
  if (machineId === "laptop") return null;
  return "SSH alias unknown";
}
