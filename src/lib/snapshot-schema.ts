import { z } from "zod";

const isoDate = z.string().datetime({ offset: true });
const dayDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const machineSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  host: z.string().min(1),
  platform: z.string().min(1),
});

export const repoSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  owner: z.string().min(1),
  canonicalRemote: z.string().min(1),
  remoteKey: z.string().min(1),
});

export const repoLocationSchema = z.object({
  id: z.string().min(1),
  repoId: z.string().min(1),
  machineId: z.string().min(1),
  path: z.string().min(1),
  remoteUrlRedacted: z.string().min(1),
  upstreamBranch: z.string().nullable(),
  currentBranch: z.string().min(1),
  headSha: z.string().min(1),
  dirty: z.boolean(),
  stagedCount: z.number().int().nonnegative(),
  unstagedCount: z.number().int().nonnegative(),
  untrackedCount: z.number().int().nonnegative(),
  aheadCount: z.number().int().nonnegative(),
  behindCount: z.number().int().nonnegative(),
  latestCommitAt: isoDate.nullable(),
  commitsToday: z.number().int().nonnegative(),
  commitsLast7Days: z.number().int().nonnegative(),
  commitsLast30Days: z.number().int().nonnegative(),
  additionsToday: z.number().int().nonnegative(),
  deletionsToday: z.number().int().nonnegative(),
  additionsLast7Days: z.number().int().nonnegative(),
  deletionsLast7Days: z.number().int().nonnegative(),
  localBranchCount: z.number().int().nonnegative(),
  remoteBranchCount: z.number().int().nonnegative(),
});

export const activityEventSchema = z.object({
  id: z.string().min(1),
  machineId: z.string().min(1),
  repoId: z.string().min(1),
  repoLocationId: z.string().min(1),
  type: z.enum(["commit", "push", "status"]),
  timestamp: isoDate,
  message: z.string().min(1),
});

export const dailyRepoStatsSchema = z.object({
  date: dayDate,
  machineId: z.string().min(1),
  repoId: z.string().min(1),
  commits: z.number().int().nonnegative(),
  pushes: z.number().int().nonnegative(),
  additions: z.number().int().nonnegative(),
  deletions: z.number().int().nonnegative(),
});

export const dailyMachineStatsSchema = z.object({
  date: dayDate,
  machineId: z.string().min(1),
  commits: z.number().int().nonnegative(),
  pushes: z.number().int().nonnegative(),
  additions: z.number().int().nonnegative(),
  deletions: z.number().int().nonnegative(),
  activeRepos: z.number().int().nonnegative(),
  dirtyRepos: z.number().int().nonnegative(),
  unpushedRepos: z.number().int().nonnegative(),
});

export const collectorRunSchema = z.object({
  id: z.string().min(1),
  machineId: z.string().min(1),
  collectorVersion: z.string().min(1),
  mode: z.literal("local"),
  result: z.enum(["ok", "partial", "error"]),
  startedAt: isoDate,
  finishedAt: isoDate,
  durationMs: z.number().int().nonnegative(),
  rootsScanned: z.array(z.string().min(1)).min(1),
  depthLimit: z.number().int().positive(),
  reposFound: z.number().int().nonnegative(),
  errors: z.array(z.string()),
});

export const snapshotEnvelopeSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  createdAt: isoDate,
  machine: machineSchema,
  collectorRun: collectorRunSchema,
  repos: z.array(repoSchema),
  repoLocations: z.array(repoLocationSchema),
  activityEvents: z.array(activityEventSchema),
  dailyRepoStats: z.array(dailyRepoStatsSchema),
  dailyMachineStats: z.array(dailyMachineStatsSchema),
});

export type SnapshotEnvelopeParsed = z.infer<typeof snapshotEnvelopeSchema>;
