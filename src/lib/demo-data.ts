export type MachineId = "laptop" | "nuc1" | "nuc2";
export type ActivityType = "commit" | "push" | "status";

export type Machine = {
  id: MachineId;
  label: string;
  host: string;
  streak: number;
  commitsToday: number;
  pushesToday: number;
  activeRepos: number;
};

export type Repo = {
  id: string;
  name: string;
  owner: string;
  primaryLanguage: string;
};

export type RepoLocation = {
  id: string;
  repoId: string;
  machineId: MachineId;
  path: string;
  branch: string;
  dirty: boolean;
  unpushedCommits: number;
};

export type ActivityEvent = {
  id: string;
  machineId: MachineId;
  repoId: string;
  type: ActivityType;
  timestamp: string;
  message: string;
};

export const machines: Machine[] = [
  { id: "laptop", label: "Laptop", host: "slimy-laptop", streak: 11, commitsToday: 14, pushesToday: 5, activeRepos: 6 },
  { id: "nuc1", label: "NUC1", host: "nuc1-ts", streak: 9, commitsToday: 21, pushesToday: 8, activeRepos: 7 },
  { id: "nuc2", label: "NUC2", host: "nuc2-ts", streak: 13, commitsToday: 18, pushesToday: 6, activeRepos: 8 },
];

export const repos: Repo[] = [
  { id: "slimy-monorepo", name: "slimy-monorepo", owner: "GurthBro0ks", primaryLanguage: "TypeScript" },
  { id: "gh-tracker", name: "gh-tracker", owner: "GurthBro0ks", primaryLanguage: "TypeScript" },
  { id: "slimy-kb", name: "slimy-kb", owner: "GurthBro0ks", primaryLanguage: "Markdown" },
  { id: "openclaw", name: "openclaw", owner: "GurthBro0ks", primaryLanguage: "Python" },
  { id: "snail-sim", name: "snail-sim", owner: "GurthBro0ks", primaryLanguage: "TypeScript" },
  { id: "market-bot", name: "market-bot", owner: "GurthBro0ks", primaryLanguage: "Rust" },
  { id: "infra-scripts", name: "infra-scripts", owner: "GurthBro0ks", primaryLanguage: "Bash" },
  { id: "retro-ui-kit", name: "retro-ui-kit", owner: "GurthBro0ks", primaryLanguage: "CSS" },
  { id: "vision-lab", name: "vision-lab", owner: "GurthBro0ks", primaryLanguage: "Python" },
];

export const repoLocations: RepoLocation[] = [
  { id: "loc-1", repoId: "slimy-monorepo", machineId: "laptop", path: "/opt/slimy/slimy-monorepo", branch: "main", dirty: true, unpushedCommits: 3 },
  { id: "loc-2", repoId: "slimy-monorepo", machineId: "nuc2", path: "/opt/slimy/slimy-monorepo", branch: "main", dirty: false, unpushedCommits: 1 },
  { id: "loc-3", repoId: "gh-tracker", machineId: "nuc2", path: "/opt/slimy/gh-tracker", branch: "main", dirty: true, unpushedCommits: 2 },
  { id: "loc-4", repoId: "gh-tracker", machineId: "laptop", path: "/Users/slimy/dev/gh-tracker", branch: "feature/ui", dirty: true, unpushedCommits: 4 },
  { id: "loc-5", repoId: "slimy-kb", machineId: "nuc1", path: "/home/slimy/kb", branch: "main", dirty: false, unpushedCommits: 0 },
  { id: "loc-6", repoId: "openclaw", machineId: "nuc1", path: "/opt/slimy/openclaw", branch: "dev", dirty: false, unpushedCommits: 1 },
  { id: "loc-7", repoId: "snail-sim", machineId: "laptop", path: "/Users/slimy/dev/snail-sim", branch: "main", dirty: true, unpushedCommits: 2 },
  { id: "loc-8", repoId: "market-bot", machineId: "nuc1", path: "/opt/slimy/market-bot", branch: "main", dirty: false, unpushedCommits: 0 },
  { id: "loc-9", repoId: "infra-scripts", machineId: "nuc2", path: "/opt/slimy/infra-scripts", branch: "hardening", dirty: false, unpushedCommits: 1 },
  { id: "loc-10", repoId: "retro-ui-kit", machineId: "laptop", path: "/Users/slimy/dev/retro-ui-kit", branch: "main", dirty: false, unpushedCommits: 0 },
  { id: "loc-11", repoId: "vision-lab", machineId: "nuc1", path: "/opt/slimy/vision-lab", branch: "experiment", dirty: true, unpushedCommits: 5 },
  { id: "loc-12", repoId: "vision-lab", machineId: "nuc2", path: "/opt/slimy/vision-lab", branch: "main", dirty: false, unpushedCommits: 1 },
];

export const commitsPerDay = [
  { day: "May 01", total: 23, laptop: 7, nuc1: 8, nuc2: 8, additions: 560, deletions: 290 },
  { day: "May 02", total: 31, laptop: 10, nuc1: 12, nuc2: 9, additions: 780, deletions: 430 },
  { day: "May 03", total: 19, laptop: 6, nuc1: 5, nuc2: 8, additions: 460, deletions: 220 },
  { day: "May 04", total: 28, laptop: 9, nuc1: 11, nuc2: 8, additions: 680, deletions: 510 },
  { day: "May 05", total: 35, laptop: 12, nuc1: 13, nuc2: 10, additions: 920, deletions: 610 },
  { day: "May 06", total: 22, laptop: 5, nuc1: 10, nuc2: 7, additions: 510, deletions: 300 },
  { day: "May 07", total: 30, laptop: 9, nuc1: 10, nuc2: 11, additions: 840, deletions: 420 },
  { day: "May 08", total: 26, laptop: 8, nuc1: 8, nuc2: 10, additions: 630, deletions: 280 },
  { day: "May 09", total: 53, laptop: 14, nuc1: 21, nuc2: 18, additions: 1400, deletions: 760 },
];

export const repoCommitDistribution = [
  { repoId: "slimy-monorepo", commits: 42 },
  { repoId: "gh-tracker", commits: 23 },
  { repoId: "vision-lab", commits: 16 },
  { repoId: "openclaw", commits: 13 },
  { repoId: "snail-sim", commits: 11 },
  { repoId: "infra-scripts", commits: 9 },
  { repoId: "retro-ui-kit", commits: 7 },
  { repoId: "market-bot", commits: 6 },
  { repoId: "slimy-kb", commits: 5 },
];

export const activityEvents: ActivityEvent[] = [
  { id: "evt-1", machineId: "nuc2", repoId: "gh-tracker", type: "commit", timestamp: "2026-05-09T14:28:00Z", message: "feat: scaffold phase0 dashboard shell" },
  { id: "evt-2", machineId: "laptop", repoId: "slimy-monorepo", type: "push", timestamp: "2026-05-09T13:50:00Z", message: "push main with auth hotfix" },
  { id: "evt-3", machineId: "nuc1", repoId: "vision-lab", type: "status", timestamp: "2026-05-09T13:12:00Z", message: "repo dirty, 5 unpushed commits" },
  { id: "evt-4", machineId: "nuc1", repoId: "openclaw", type: "commit", timestamp: "2026-05-09T12:31:00Z", message: "refactor: queue watchdog" },
  { id: "evt-5", machineId: "nuc2", repoId: "slimy-monorepo", type: "status", timestamp: "2026-05-09T11:05:00Z", message: "working tree clean" },
  { id: "evt-6", machineId: "laptop", repoId: "snail-sim", type: "commit", timestamp: "2026-05-09T10:47:00Z", message: "feat: leaderboard animation" },
  { id: "evt-7", machineId: "laptop", repoId: "gh-tracker", type: "push", timestamp: "2026-05-09T09:34:00Z", message: "push feature/ui branch" },
  { id: "evt-8", machineId: "nuc2", repoId: "infra-scripts", type: "commit", timestamp: "2026-05-09T08:10:00Z", message: "chore: rotate backup logs" },
];

export const heatmapWeeks = [
  [1, 3, 4, 2, 5, 6, 0],
  [2, 2, 5, 3, 4, 4, 1],
  [0, 4, 5, 6, 7, 5, 2],
  [1, 3, 3, 4, 5, 7, 2],
  [2, 1, 4, 5, 6, 6, 3],
  [0, 2, 3, 3, 5, 4, 2],
];

export const lastDemoRefresh = "2026-05-09T16:00:00Z";
