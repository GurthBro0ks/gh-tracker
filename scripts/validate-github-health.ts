import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const LATEST_PATH = path.join(process.cwd(), "data", "github", "remotes", "latest.json");
const SUMMARY_PATH = path.join(process.cwd(), "data", "github", "remotes", "latest-summary.json");
const SECRET_PATTERNS = [
  new RegExp(`ghp${"_"}[A-Za-z0-9_]+`),
  new RegExp(`github${"_"}pat${"_"}[A-Za-z0-9_]+`),
  new RegExp(`GITHUB${"_"}TOKEN`),
  new RegExp(`Authorization${":"}`, "i"),
  new RegExp("Bearer\\s+", "i"),
  new RegExp(`BEGIN OPENSSH${" PRIVATE KEY"}`),
  new RegExp(`BEGIN RSA${" PRIVATE KEY"}`),
];

const latestReleaseSchema = z.object({
  tagName: z.string().nullable(),
  name: z.string().nullable(),
  publishedAt: z.string().nullable(),
  ageDays: z.number().nullable(),
  status: z.enum(["fresh", "aging", "stale", "none", "unknown"]),
});

const remoteRepoSchema = z.object({
  canonicalRepo: z.string().min(1),
  owner: z.literal("GurthBro0ks"),
  repo: z.string().min(1),
  fullName: z.string().regex(/^GurthBro0ks\//),
  remoteUrl: z.string().min(1),
  defaultBranch: z.string().nullable(),
  visibility: z.enum(["private", "public", "unknown"]),
  isFork: z.boolean().nullable(),
  isArchived: z.boolean().nullable(),
  pushedAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  latestRelease: latestReleaseSchema,
  pullRequests: z.object({ open: z.number().nullable(), stale: z.number().nullable() }),
  issues: z.object({ open: z.number().nullable(), stale: z.number().nullable() }),
  ci: z.object({
    status: z.enum(["success", "failure", "in_progress", "none", "unknown"]),
    conclusion: z.string().nullable(),
    workflowName: z.string().nullable(),
    createdAt: z.string().nullable(),
  }),
  health: z.object({
    score: z.number().min(0).max(100),
    label: z.enum(["healthy", "watch", "attention", "unknown"]),
    reasons: z.array(z.string()),
    inputs: z.record(z.union([z.number(), z.string(), z.boolean(), z.null()])),
  }),
  sync: z.object({
    status: z.enum(["ok", "partial", "failed"]),
    warnings: z.array(z.string()),
    error: z.string().nullable(),
  }),
});

const snapshotSchema = z.object({
  schemaVersion: z.literal(1),
  createdAt: z.string().min(1),
  source: z.literal("github_cli_read_only"),
  ownerFilter: z.array(z.literal("GurthBro0ks")),
  ghAuth: z.enum(["authenticated", "not_authenticated"]),
  sourceMetadata: z.object({
    kind: z.literal("ownership_filtered_aggregate"),
    aggregatePath: z.string().min(1),
    aggregateCreatedAt: z.string().nullable(),
    excludedOwners: z.string().min(1),
  }),
  repos: z.array(remoteRepoSchema),
});

const summarySchema = z.object({
  schemaVersion: z.literal(1),
  createdAt: z.string().min(1),
  source: z.literal("github_cli_read_only"),
  ownerFilter: z.array(z.literal("GurthBro0ks")),
  ghAuth: z.enum(["authenticated", "not_authenticated"]),
  candidateCount: z.number().min(0),
  repoCount: z.number().min(0),
  successCount: z.number().min(0),
  partialCount: z.number().min(0),
  failedCount: z.number().min(0),
  warningCount: z.number().min(0),
  errorCount: z.number().min(0),
  dashboardStatus: z.enum(["synced", "partial", "pending", "failed"]),
});

function scanSecrets(label: string, raw: string) {
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(raw)) {
      throw new Error(`secret-like material found in ${label}: ${pattern.source}`);
    }
  }
}

async function main() {
  const [latestRaw, summaryRaw] = await Promise.all([
    readFile(LATEST_PATH, "utf8"),
    readFile(SUMMARY_PATH, "utf8"),
  ]);

  scanSecrets("latest", latestRaw);
  scanSecrets("summary", summaryRaw);

  if (/nousearch-hermes-agent|NousResearch\/hermes-agent|hermes-agent/i.test(latestRaw) || /nousearch-hermes-agent|NousResearch\/hermes-agent|hermes-agent/i.test(summaryRaw)) {
    throw new Error("excluded nousearch-hermes-agent appears in GitHub health data");
  }

  const snapshot = snapshotSchema.parse(JSON.parse(latestRaw));
  const summary = summarySchema.parse(JSON.parse(summaryRaw));

  const partialRepos = snapshot.repos.filter((repo) => repo.sync.status === "partial");
  const failedRepos = snapshot.repos.filter((repo) => repo.sync.status === "failed");
  const warningCount = snapshot.repos.reduce((sum, repo) => sum + repo.sync.warnings.length, 0);
  const errorCount = snapshot.repos.filter((repo) => repo.sync.error).length;

  if (summary.repoCount !== snapshot.repos.length) throw new Error("summary repoCount does not match latest repos length");
  if (summary.partialCount !== partialRepos.length) throw new Error("summary partialCount does not match repo statuses");
  if (summary.failedCount !== failedRepos.length) throw new Error("summary failedCount does not match repo statuses");
  if (summary.warningCount !== warningCount) throw new Error("summary warningCount does not match repo warnings");
  if (summary.errorCount !== errorCount) throw new Error("summary errorCount does not match repo errors");
  if (warningCount > 0 && summary.partialCount === 0) throw new Error("warnings exist but summary partialCount is zero");
  if (summary.ghAuth === "authenticated" && summary.repoCount === 0) throw new Error("authenticated GitHub sync produced zero repos");
  if (summary.candidateCount !== summary.repoCount) throw new Error("candidateCount and repoCount should match for this read-only sync");

  for (const repo of snapshot.repos) {
    if (repo.owner !== "GurthBro0ks" || !repo.fullName.startsWith("GurthBro0ks/")) {
      throw new Error(`owner filter violated: ${repo.fullName}`);
    }
    if (!repo.remoteUrl.includes("github.com") && !repo.remoteUrl.startsWith("https://github.com/")) {
      throw new Error(`repo remote is not GitHub-backed: ${repo.fullName}`);
    }
    if (repo.sync.status === "failed" && !repo.sync.error) {
      throw new Error(`failed repo missing safe error message: ${repo.fullName}`);
    }
  }

  process.stdout.write(`github_health_valid=1\n`);
  process.stdout.write(`repos=${snapshot.repos.length}\n`);
  process.stdout.write(`partial=${partialRepos.length}\n`);
  process.stdout.write(`failed=${failedRepos.length}\n`);
  process.stdout.write(`dashboard_status=${summary.dashboardStatus}\n`);
}

main().catch((error) => {
  process.stderr.write(`${(error as Error).stack || (error as Error).message}\n`);
  process.exit(1);
});
