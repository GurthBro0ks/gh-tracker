export type ActivityType = "commit" | "push" | "status";

export type Machine = {
  id: string;
  label: string;
  host: string;
  platform: string;
};

export type Repo = {
  id: string;
  name: string;
  owner: string;
  canonicalRemote: string;
  remoteKey: string;
};

export type RepoLocation = {
  id: string;
  repoId: string;
  machineId: string;
  path: string;
  remoteUrlRedacted: string;
  upstreamBranch: string | null;
  currentBranch: string;
  headSha: string;
  dirty: boolean;
  stagedCount: number;
  unstagedCount: number;
  untrackedCount: number;
  aheadCount: number;
  behindCount: number;
  latestCommitAt: string | null;
  commitsToday: number;
  commitsLast7Days: number;
  commitsLast30Days: number;
  additionsToday: number;
  deletionsToday: number;
  additionsLast7Days: number;
  deletionsLast7Days: number;
  localBranchCount: number;
  remoteBranchCount: number;
};

export type ActivityEvent = {
  id: string;
  machineId: string;
  repoId: string;
  repoLocationId: string;
  type: ActivityType;
  timestamp: string;
  message: string;
};

export type DailyRepoStats = {
  date: string;
  machineId: string;
  repoId: string;
  commits: number;
  pushes: number;
  additions: number;
  deletions: number;
};

export type DailyMachineStats = {
  date: string;
  machineId: string;
  commits: number;
  pushes: number;
  additions: number;
  deletions: number;
  activeRepos: number;
  dirtyRepos: number;
  unpushedRepos: number;
};

export type CollectorRun = {
  id: string;
  machineId: string;
  collectorVersion: string;
  mode: "local";
  result: "ok" | "partial" | "error";
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  rootsScanned: string[];
  depthLimit: number;
  reposFound: number;
  errors: string[];
};

export type SnapshotEnvelope = {
  schemaVersion: string;
  createdAt: string;
  machine: Machine;
  collectorRun: CollectorRun;
  repos: Repo[];
  repoLocations: RepoLocation[];
  activityEvents: ActivityEvent[];
  dailyRepoStats: DailyRepoStats[];
  dailyMachineStats: DailyMachineStats[];
};

export type RepoHealthBucket = "legendary" | "healthy" | "needs_care" | "stressed" | "sick";

export type ReleaseHealth = {
  freshnessDays: number | null;
  commitsSinceRelease: number | null;
  status: "fresh" | "aging" | "stale" | "not_synced";
};

export type SyncHealth = {
  score: number;
  aheadCount: number;
  behindCount: number;
  githubSyncConfigured: boolean;
};

export type LocalCleanliness = {
  score: number;
  dirty: boolean;
  stagedCount: number;
  unstagedCount: number;
  untrackedCount: number;
};

export type ActivityMomentum = {
  score: number;
  commitsToday: number;
  commitsLast7Days: number;
  commitsLast30Days: number;
};

export type CiHealth = {
  status: "passing" | "failing" | "unknown" | "not_synced";
  lastRunAt: string | null;
};

export type RepoAttentionReason =
  | "dirty_worktree"
  | "unpushed_commits"
  | "behind_remote"
  | "low_activity"
  | "release_unknown"
  | "ci_unknown"
  | "pr_pressure_unknown"
  | "issue_pressure_unknown";

export type RepoCareAction =
  | "commit_or_stash_changes"
  | "push_local_commits"
  | "pull_and_rebase"
  | "review_release_plan"
  | "set_up_ci_sync"
  | "triage_prs"
  | "triage_issues"
  | "schedule_maintenance";

export type RepoHealth = {
  score: number;
  bucket: RepoHealthBucket;
  release: ReleaseHealth;
  sync: SyncHealth;
  local: LocalCleanliness;
  activity: ActivityMomentum;
  ci: CiHealth;
  prPressure: number | null;
  issuePressure: number | null;
  attentionReasons: RepoAttentionReason[];
  careActions: RepoCareAction[];
};

export type PetSpecies =
  | "Cyber Snail"
  | "Repo Slime"
  | "Circuit Moth"
  | "Pixel Crab"
  | "Data Frog"
  | "Terminal Bat"
  | "Gear Turtle"
  | "Market Mantis"
  | "Arcade Golem"
  | "Paper Owl";

export type PetStage = "unknown" | "egg" | "hatchling" | "juvenile" | "adult";

export type PetMood = "curious" | "happy" | "focused" | "sleepy" | "stressed" | "sick" | "legendary";

export type PetAnimationState = "idle" | "wobble" | "hatch" | "happy" | "stressed" | "sleep" | "sick" | "evolve";

export type PetStats = {
  energy: number;
  cleanliness: number;
  focus: number;
  trust: number;
  maturity: number;
  glow: number;
};

export type EvolutionProgress = {
  currentStage: PetStage;
  nextStage: PetStage | null;
  progressPct: number;
};

export type PetCareAction = "code_cleanup" | "sync_repo" | "ship_release" | "reduce_backlog" | "stabilize_ci" | "rest_cycle";

export type RepoPet = {
  id: string;
  repoId: string;
  petName: string;
  species: PetSpecies;
  stage: PetStage;
  mood: PetMood;
  animationState: PetAnimationState;
  stats: PetStats;
  evolution: EvolutionProgress;
  careActions: PetCareAction[];
};
