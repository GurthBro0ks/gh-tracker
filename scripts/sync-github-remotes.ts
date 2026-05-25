import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const AGGREGATE_LATEST = path.join(process.cwd(), "data", "snapshots", "aggregate", "latest.json");
const GITHUB_REMOTE_DIR = path.join(process.cwd(), "data", "github", "remotes");
const LATEST_PATH = path.join(GITHUB_REMOTE_DIR, "latest.json");
const SUMMARY_PATH = path.join(GITHUB_REMOTE_DIR, "latest-summary.json");
const OWNER_FILTER = ["GurthBro0ks"];
const STALE_DAYS = 30;

type AggregateRepo = {
  id: string;
  name: string;
  owner: string;
  canonicalRemote: string;
  remoteKey: string;
};

type AggregateSnapshot = {
  createdAt: string;
  repos: AggregateRepo[];
};

type Candidate = {
  canonicalRepo: string;
  owner: string;
  repo: string;
  fullName: string;
  remoteUrl: string;
};

type LatestRelease = {
  tagName: string | null;
  name: string | null;
  publishedAt: string | null;
  ageDays: number | null;
  status: "fresh" | "aging" | "stale" | "none" | "unknown";
};

type RemoteRepoHealth = Candidate & {
  defaultBranch: string | null;
  visibility: "private" | "public" | "unknown";
  isFork: boolean | null;
  isArchived: boolean | null;
  pushedAt: string | null;
  updatedAt: string | null;
  latestRelease: LatestRelease;
  pullRequests: {
    open: number | null;
    stale: number | null;
  };
  issues: {
    open: number | null;
    stale: number | null;
  };
  ci: {
    status: "success" | "failure" | "in_progress" | "none" | "unknown";
    conclusion: string | null;
    workflowName: string | null;
    createdAt: string | null;
  };
  health: {
    score: number;
    label: "healthy" | "watch" | "attention" | "unknown";
    reasons: string[];
    inputs: Record<string, number | string | boolean | null>;
  };
  sync: {
    status: "ok" | "partial" | "failed";
    warnings: string[];
    error: string | null;
  };
};

type GithubHealthSnapshot = {
  schemaVersion: 1;
  createdAt: string;
  source: "github_cli_read_only";
  ownerFilter: string[];
  ghAuth: "authenticated" | "not_authenticated";
  sourceMetadata: {
    kind: "ownership_filtered_aggregate";
    aggregatePath: string;
    aggregateCreatedAt: string | null;
    excludedOwners: string;
  };
  repos: RemoteRepoHealth[];
};

type GithubHealthSummary = {
  schemaVersion: 1;
  createdAt: string;
  source: "github_cli_read_only";
  ownerFilter: string[];
  ghAuth: "authenticated" | "not_authenticated";
  candidateCount: number;
  repoCount: number;
  successCount: number;
  partialCount: number;
  failedCount: number;
  warningCount: number;
  errorCount: number;
  dashboardStatus: "synced" | "partial" | "pending" | "failed";
  sourceMetadata: GithubHealthSnapshot["sourceMetadata"];
};

function sanitizeError(value: unknown): string {
  const message = value instanceof Error ? value.message : String(value);
  const classicToken = new RegExp(`ghp${"_"}[A-Za-z0-9_]+`, "g");
  const fineGrainedToken = new RegExp(`github${"_"}pat${"_"}[A-Za-z0-9_]+`, "g");
  const bearerHeader = new RegExp(`Bearer\\s+[^\\s]+`, "gi");
  const authHeader = new RegExp(`Authorization${":"}\\s*[^\\n\\r]+`, "gi");
  return message
    .replace(classicToken, "<redacted>")
    .replace(fineGrainedToken, "<redacted>")
    .replace(bearerHeader, `Bearer${" <redacted>"}`)
    .replace(authHeader, `Authorization${": <redacted>"}`)
    .slice(0, 500);
}

async function runGhJson<T>(args: string[]): Promise<T> {
  const { stdout } = await execFileAsync("gh", args, {
    maxBuffer: 1024 * 1024 * 10,
    env: process.env,
  });
  return JSON.parse(stdout) as T;
}

async function ghAuthenticated(): Promise<boolean> {
  try {
    await execFileAsync("gh", ["auth", "status"], { maxBuffer: 1024 * 1024 });
    return true;
  } catch {
    return false;
  }
}

function parseCandidates(snapshot: AggregateSnapshot): Candidate[] {
  const seen = new Set<string>();
  const candidates: Candidate[] = [];

  for (const repo of snapshot.repos) {
    if (repo.owner !== "GurthBro0ks") continue;
    if (!repo.remoteKey.startsWith("GurthBro0ks/")) continue;
    if (!repo.canonicalRemote.includes("github.com")) continue;
    if (/nousearch-hermes-agent|hermes-agent/i.test(`${repo.id} ${repo.name} ${repo.remoteKey} ${repo.canonicalRemote}`)) continue;

    const fullName = repo.remoteKey.replace(/\.git$/i, "");
    if (seen.has(fullName.toLowerCase())) continue;
    seen.add(fullName.toLowerCase());
    const [owner, name] = fullName.split("/");
    if (owner !== "GurthBro0ks" || !name) continue;

    candidates.push({
      canonicalRepo: repo.id,
      owner,
      repo: name,
      fullName,
      remoteUrl: repo.canonicalRemote,
    });
  }

  return candidates.sort((a, b) => a.fullName.localeCompare(b.fullName));
}

function ageDays(timestamp: string | null): number | null {
  if (!timestamp) return null;
  const parsed = Date.parse(timestamp);
  if (Number.isNaN(parsed)) return null;
  return Math.max(0, Math.floor((Date.now() - parsed) / 86400000));
}

function releaseStatus(days: number | null, hasRelease: boolean): LatestRelease["status"] {
  if (!hasRelease) return "none";
  if (days === null) return "unknown";
  if (days <= 30) return "fresh";
  if (days <= 90) return "aging";
  return "stale";
}

function staleCount(items: Array<{ updatedAt?: string | null }>): number {
  return items.filter((item) => {
    const days = ageDays(item.updatedAt ?? null);
    return days !== null && days >= STALE_DAYS;
  }).length;
}

function mapCiStatus(run: { status?: string | null; conclusion?: string | null } | null): RemoteRepoHealth["ci"]["status"] {
  if (!run) return "none";
  if (run.status && run.status !== "completed") return "in_progress";
  if (!run.conclusion) return "unknown";
  if (run.conclusion === "success") return "success";
  return "failure";
}

function computeHealth(repo: Pick<RemoteRepoHealth, "isArchived" | "latestRelease" | "pullRequests" | "issues" | "ci">): RemoteRepoHealth["health"] {
  let score = 100;
  const reasons: string[] = [];

  if (repo.isArchived) {
    score -= 40;
    reasons.push("archived");
  }
  if (repo.latestRelease.status === "none") {
    score -= 8;
    reasons.push("no_release_found");
  } else if (repo.latestRelease.status === "stale") {
    score -= 18;
    reasons.push("release_stale");
  } else if (repo.latestRelease.status === "aging") {
    score -= 8;
    reasons.push("release_aging");
  }

  const openPrs = repo.pullRequests.open ?? 0;
  const stalePrs = repo.pullRequests.stale ?? 0;
  const openIssues = repo.issues.open ?? 0;
  const staleIssues = repo.issues.stale ?? 0;

  if (openPrs >= 5) {
    score -= 8;
    reasons.push("pr_pressure");
  }
  if (stalePrs > 0) {
    score -= Math.min(12, stalePrs * 3);
    reasons.push("stale_prs");
  }
  if (openIssues >= 10) {
    score -= 8;
    reasons.push("issue_pressure");
  }
  if (staleIssues > 0) {
    score -= Math.min(12, staleIssues * 2);
    reasons.push("stale_issues");
  }
  if (repo.ci.status === "failure") {
    score -= 25;
    reasons.push("ci_failure");
  } else if (repo.ci.status === "in_progress") {
    score -= 3;
    reasons.push("ci_in_progress");
  } else if (repo.ci.status === "none") {
    score -= 5;
    reasons.push("no_ci_runs_found");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const label = score >= 80 ? "healthy" : score >= 60 ? "watch" : "attention";

  return {
    score,
    label,
    reasons,
    inputs: {
      releaseStatus: repo.latestRelease.status,
      releaseAgeDays: repo.latestRelease.ageDays,
      openPrs,
      stalePrs,
      openIssues,
      staleIssues,
      ciStatus: repo.ci.status,
      archived: repo.isArchived,
    },
  };
}

async function syncCandidate(candidate: Candidate): Promise<RemoteRepoHealth> {
  const warnings: string[] = [];

  const base: RemoteRepoHealth = {
    ...candidate,
    defaultBranch: null,
    visibility: "unknown",
    isFork: null,
    isArchived: null,
    pushedAt: null,
    updatedAt: null,
    latestRelease: { tagName: null, name: null, publishedAt: null, ageDays: null, status: "unknown" },
    pullRequests: { open: null, stale: null },
    issues: { open: null, stale: null },
    ci: { status: "unknown", conclusion: null, workflowName: null, createdAt: null },
    health: { score: 0, label: "unknown", reasons: [], inputs: {} },
    sync: { status: "ok", warnings, error: null },
  };

  try {
    const repo = await runGhJson<{
      nameWithOwner: string;
      url: string;
      defaultBranchRef?: { name?: string | null } | null;
      visibility?: string | null;
      isPrivate?: boolean | null;
      isFork?: boolean | null;
      isArchived?: boolean | null;
      pushedAt?: string | null;
      updatedAt?: string | null;
    }>([
      "repo",
      "view",
      candidate.fullName,
      "--json",
      "nameWithOwner,url,defaultBranchRef,visibility,isPrivate,isFork,isArchived,pushedAt,updatedAt",
    ]);

    base.defaultBranch = repo.defaultBranchRef?.name ?? null;
    base.visibility = repo.visibility === "PRIVATE" || repo.isPrivate ? "private" : repo.visibility === "PUBLIC" ? "public" : "unknown";
    base.isFork = typeof repo.isFork === "boolean" ? repo.isFork : null;
    base.isArchived = typeof repo.isArchived === "boolean" ? repo.isArchived : null;
    base.pushedAt = repo.pushedAt ?? null;
    base.updatedAt = repo.updatedAt ?? null;
    base.remoteUrl = repo.url || base.remoteUrl;
  } catch (error) {
    base.sync.status = "failed";
    base.sync.error = sanitizeError(error);
    return base;
  }

  try {
    const release = await runGhJson<{ tagName?: string | null; name?: string | null; publishedAt?: string | null }>([
      "release",
      "view",
      "--repo",
      candidate.fullName,
      "--json",
      "tagName,name,publishedAt",
    ]);
    const days = ageDays(release.publishedAt ?? null);
    base.latestRelease = {
      tagName: release.tagName ?? null,
      name: release.name ?? null,
      publishedAt: release.publishedAt ?? null,
      ageDays: days,
      status: releaseStatus(days, Boolean(release.tagName || release.publishedAt)),
    };
  } catch {
    base.latestRelease = { tagName: null, name: null, publishedAt: null, ageDays: null, status: "none" };
  }

  try {
    const prs = await runGhJson<Array<{ updatedAt?: string | null }>>([
      "pr",
      "list",
      "--repo",
      candidate.fullName,
      "--state",
      "open",
      "--limit",
      "100",
      "--json",
      "number,updatedAt",
    ]);
    base.pullRequests = { open: prs.length, stale: staleCount(prs) };
  } catch (error) {
    warnings.push(`pull_requests_unavailable: ${sanitizeError(error)}`);
  }

  try {
    const issues = await runGhJson<Array<{ updatedAt?: string | null }>>([
      "issue",
      "list",
      "--repo",
      candidate.fullName,
      "--state",
      "open",
      "--limit",
      "100",
      "--json",
      "number,updatedAt",
    ]);
    base.issues = { open: issues.length, stale: staleCount(issues) };
  } catch (error) {
    warnings.push(`issues_unavailable: ${sanitizeError(error)}`);
  }

  if (base.defaultBranch) {
    try {
      const runs = await runGhJson<Array<{ status?: string | null; conclusion?: string | null; workflowName?: string | null; createdAt?: string | null }>>([
        "run",
        "list",
        "--repo",
        candidate.fullName,
        "--branch",
        base.defaultBranch,
        "--limit",
        "1",
        "--json",
        "status,conclusion,workflowName,createdAt",
      ]);
      const run = runs[0] ?? null;
      base.ci = {
        status: mapCiStatus(run),
        conclusion: run?.conclusion ?? null,
        workflowName: run?.workflowName ?? null,
        createdAt: run?.createdAt ?? null,
      };
    } catch (error) {
      warnings.push(`ci_unavailable: ${sanitizeError(error)}`);
    }
  } else {
    warnings.push("default_branch_unavailable");
  }

  base.sync.status = warnings.length > 0 ? "partial" : "ok";
  base.health = computeHealth(base);
  return base;
}

function buildSummary(snapshot: GithubHealthSnapshot, candidateCount: number): GithubHealthSummary {
  const successCount = snapshot.repos.filter((repo) => repo.sync.status === "ok").length;
  const partialCount = snapshot.repos.filter((repo) => repo.sync.status === "partial").length;
  const failedCount = snapshot.repos.filter((repo) => repo.sync.status === "failed").length;
  const warningCount = snapshot.repos.reduce((sum, repo) => sum + repo.sync.warnings.length, 0);
  const errorCount = snapshot.repos.filter((repo) => repo.sync.error).length;
  const dashboardStatus = snapshot.ghAuth === "not_authenticated"
    ? "pending"
    : failedCount === snapshot.repos.length && snapshot.repos.length > 0
      ? "failed"
      : partialCount > 0 || failedCount > 0 || warningCount > 0
        ? "partial"
        : "synced";

  return {
    schemaVersion: 1,
    createdAt: snapshot.createdAt,
    source: snapshot.source,
    ownerFilter: snapshot.ownerFilter,
    ghAuth: snapshot.ghAuth,
    candidateCount,
    repoCount: snapshot.repos.length,
    successCount,
    partialCount,
    failedCount,
    warningCount,
    errorCount,
    dashboardStatus,
    sourceMetadata: snapshot.sourceMetadata,
  };
}

async function main() {
  const authenticated = await ghAuthenticated();
  if (!authenticated) {
    throw new Error("NEED_GITHUB_AUTH: gh auth status did not succeed");
  }

  const aggregateRaw = await readFile(AGGREGATE_LATEST, "utf8");
  const aggregate = JSON.parse(aggregateRaw) as AggregateSnapshot;
  const candidates = parseCandidates(aggregate);
  const repos: RemoteRepoHealth[] = [];

  for (const candidate of candidates) {
    repos.push(await syncCandidate(candidate));
  }

  const snapshot: GithubHealthSnapshot = {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    source: "github_cli_read_only",
    ownerFilter: OWNER_FILTER,
    ghAuth: "authenticated",
    sourceMetadata: {
      kind: "ownership_filtered_aggregate",
      aggregatePath: path.relative(process.cwd(), AGGREGATE_LATEST),
      aggregateCreatedAt: aggregate.createdAt ?? null,
      excludedOwners: "excluded_repos_report.json owner_not_allowed entries are not synced",
    },
    repos,
  };
  const summary = buildSummary(snapshot, candidates.length);

  await mkdir(GITHUB_REMOTE_DIR, { recursive: true });
  await writeFile(LATEST_PATH, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  await writeFile(SUMMARY_PATH, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  process.stdout.write(`github_sync=1\n`);
  process.stdout.write(`candidate_count=${candidates.length}\n`);
  process.stdout.write(`repo_count=${summary.repoCount}\n`);
  process.stdout.write(`success_count=${summary.successCount}\n`);
  process.stdout.write(`partial_count=${summary.partialCount}\n`);
  process.stdout.write(`failed_count=${summary.failedCount}\n`);
  process.stdout.write(`dashboard_status=${summary.dashboardStatus}\n`);
}

main().catch((error) => {
  process.stderr.write(`${sanitizeError(error)}\n`);
  process.exit(1);
});
