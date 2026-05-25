import { readFile } from "node:fs/promises";
import path from "node:path";
import type { DashboardData, DashboardGithubHealth, DashboardGithubRepoHealth } from "@/lib/dashboard-adapter";
import { buildDashboardDataFromSnapshot, mergeGithubHealth } from "@/lib/dashboard-adapter";
import type { SnapshotEnvelope } from "@/lib/contracts";
import { snapshotEnvelopeSchema } from "@/lib/snapshot-schema";

const AGGREGATE_PATH = path.join(process.cwd(), "data", "snapshots", "aggregate", "latest.json");
const EXCLUDED_REPORT_PATH = path.join(process.cwd(), "data", "snapshots", "aggregate", "excluded_repos_report.json");
const GITHUB_HEALTH_PATH = path.join(process.cwd(), "data", "github", "remotes", "latest.json");
const GITHUB_HEALTH_SUMMARY_PATH = path.join(process.cwd(), "data", "github", "remotes", "latest-summary.json");
const NUC1_PATH = path.join(process.cwd(), "data", "snapshots", "machines", "nuc1", "latest.json");
const NUC2_PATH = path.join(process.cwd(), "data", "snapshots", "machines", "nuc2", "latest.json");

async function loadExcludedCount(): Promise<number | undefined> {
  try {
    const raw = await readFile(EXCLUDED_REPORT_PATH, "utf8");
    const parsed = JSON.parse(raw) as { excludedCount?: number };
    return typeof parsed.excludedCount === "number" ? parsed.excludedCount : undefined;
  } catch {
    return undefined;
  }
}

async function loadGithubHealth(): Promise<DashboardGithubHealth | null> {
  try {
    const [latestRaw, summaryRaw] = await Promise.all([
      readFile(GITHUB_HEALTH_PATH, "utf8"),
      readFile(GITHUB_HEALTH_SUMMARY_PATH, "utf8"),
    ]);
    const latest = JSON.parse(latestRaw) as { createdAt?: string; repos?: DashboardGithubRepoHealth[] };
    const summary = JSON.parse(summaryRaw) as {
      dashboardStatus?: DashboardGithubHealth["status"];
      successCount?: number;
      partialCount?: number;
      failedCount?: number;
      warningCount?: number;
    };

    if (!Array.isArray(latest.repos)) return null;

    const repos: DashboardGithubHealth["repos"] = {};
    for (const repo of latest.repos) {
      repos[repo.canonicalRepo] = repo;
      repos[repo.fullName.toLowerCase()] = repo;
    }

    const latestSyncAt = latest.createdAt ?? null;
    let freshness: import("@/lib/dashboard-adapter").GithubHealthFreshness = "missing";
    let syncAgeMinutes: number | null = null;
    if (latestSyncAt) {
      syncAgeMinutes = Math.max(0, Math.floor((Date.now() - Date.parse(latestSyncAt)) / 60000));
      if (syncAgeMinutes <= 120) {
        freshness = "fresh";
      } else if (syncAgeMinutes <= 1440) {
        freshness = "stale";
      } else {
        freshness = "old";
      }
    }

    return {
      status: summary.dashboardStatus ?? "partial",
      latestSyncAt,
      syncedRepoCount: summary.successCount ?? latest.repos.filter((repo) => repo.sync.status === "ok").length,
      partialRepoCount: summary.partialCount ?? latest.repos.filter((repo) => repo.sync.status === "partial").length,
      failedRepoCount: summary.failedCount ?? latest.repos.filter((repo) => repo.sync.status === "failed").length,
      warningCount: summary.warningCount ?? latest.repos.reduce((sum, repo) => sum + repo.sync.warnings.length, 0),
      repos,
      freshness,
      syncAgeMinutes,
    };
  } catch {
    return null;
  }
}

async function applyMetadata(data: DashboardData): Promise<DashboardData> {
  const [excludedCount, githubHealth] = await Promise.all([loadExcludedCount(), loadGithubHealth()]);
  let next = data;
  if (typeof excludedCount === "number") {
    next = { ...next, excludedReposCount: excludedCount };
  }
  if (githubHealth) {
    next = mergeGithubHealth(next, githubHealth);
  }
  return next;
}

export async function loadLocalSnapshotDashboardData(): Promise<DashboardData | null> {
  // Prefer aggregate if available
  try {
    const raw = await readFile(AGGREGATE_PATH, "utf8");
    const parsed = JSON.parse(raw) as SnapshotEnvelope;
    const validated = snapshotEnvelopeSchema.parse(parsed);
    const data = buildDashboardDataFromSnapshot(validated);
    return applyMetadata(data);
  } catch {
    // Fallback to single machine snapshots
  }

  // Try nuc1 first (this is NUC1 host)
  try {
    const raw = await readFile(NUC1_PATH, "utf8");
    const parsed = JSON.parse(raw) as SnapshotEnvelope;
    const validated = snapshotEnvelopeSchema.parse(parsed);
    return applyMetadata(buildDashboardDataFromSnapshot(validated));
  } catch {
    // Fallback to nuc2
  }

  try {
    const raw = await readFile(NUC2_PATH, "utf8");
    const parsed = JSON.parse(raw) as SnapshotEnvelope;
    const validated = snapshotEnvelopeSchema.parse(parsed);
    return applyMetadata(buildDashboardDataFromSnapshot(validated));
  } catch {
    return null;
  }
}
