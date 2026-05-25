import { readFile } from "node:fs/promises";
import path from "node:path";
import { snapshotEnvelopeSchema } from "../src/lib/snapshot-schema";
import { buildDashboardDataFromSnapshot } from "../src/lib/dashboard-adapter";

const AGGREGATE_LATEST = path.join(process.cwd(), "data", "snapshots", "aggregate", "latest.json");
const CREDENTIAL_IN_URL = /(https?:\/\/)[^\/@\s]+@/i;
const UNSAFE_QUERY_VALUE = /([?&][^=]{1,40}=)(?!<redacted>)[^&\s]+/i;

async function main() {
  let raw = "";
  try {
    raw = await readFile(AGGREGATE_LATEST, "utf8");
  } catch {
    throw new Error(`aggregate latest missing: ${AGGREGATE_LATEST}`);
  }

  const parsed = JSON.parse(raw) as unknown;
  const snapshot = snapshotEnvelopeSchema.parse(parsed);

  if (!snapshot.machine) throw new Error("aggregate missing machine");
  if (!snapshot.collectorRun) throw new Error("aggregate missing collectorRun");
  if (!Array.isArray(snapshot.repoLocations)) throw new Error("aggregate repoLocations is not array");

  const machineIds = new Set<string>();
  for (const location of snapshot.repoLocations) {
    if (!location.machineId || !location.path || !location.currentBranch || typeof location.dirty !== "boolean") {
      throw new Error(`invalid repoLocation shape: ${location.id}`);
    }
    if (CREDENTIAL_IN_URL.test(location.remoteUrlRedacted)) {
      throw new Error(`credential segment not redacted: ${location.id}`);
    }
    if (UNSAFE_QUERY_VALUE.test(location.remoteUrlRedacted)) {
      throw new Error(`unredacted secret-like token in remote: ${location.id}`);
    }
    machineIds.add(location.machineId);
  }

  if (machineIds.size === 0) {
    throw new Error("no machine ids found in aggregate");
  }

  // Check for duplicate machine ids in locations (same machine id should be fine, but let's ensure no weirdness)
  const machineIdCounts = new Map<string, number>();
  for (const mid of machineIds) {
    machineIdCounts.set(mid, 0);
  }
  for (const loc of snapshot.repoLocations) {
    machineIdCounts.set(loc.machineId, (machineIdCounts.get(loc.machineId) ?? 0) + 1);
  }

  const dashboardData = buildDashboardDataFromSnapshot(snapshot);
  if (!dashboardData.repoRows) {
    throw new Error("dashboard adapter parse failed");
  }

  process.stdout.write(`aggregate_valid=1\n`);
  process.stdout.write(`repo_locations=${snapshot.repoLocations.length}\n`);
  process.stdout.write(`machines=${machineIds.size}\n`);
  process.stdout.write(`machine_ids=${Array.from(machineIds).join(",")}\n`);
}

main().catch((error) => {
  process.stderr.write(`${(error as Error).stack || (error as Error).message}\n`);
  process.exit(1);
});
