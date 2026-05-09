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
