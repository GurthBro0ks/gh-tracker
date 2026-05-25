import { readFile } from "node:fs/promises";
import path from "node:path";
import { buildDashboardDataFromSnapshot } from "../src/lib/dashboard-adapter";
import type { SnapshotEnvelope } from "../src/lib/contracts";
import { snapshotEnvelopeSchema } from "../src/lib/snapshot-schema";

const SNAPSHOT_PATH = path.join(process.cwd(), "data", "snapshots", "machines", "nuc1", "latest.json");
const CREDENTIAL_IN_URL = /(https?:\/\/)[^\/@\s]+@/i;
const UNSAFE_QUERY_VALUE = /([?&][^=]{1,40}=)(?!<redacted>)[^&\s]+/i;

async function main() {
  const args = process.argv.slice(2);
  const explicitPath = args.find((arg) => !arg.startsWith("--"));
  const snapshotPath = explicitPath ? path.resolve(explicitPath) : SNAPSHOT_PATH;
  const allowEmpty = args.includes("--allow-empty") || process.env.GH_TRACKER_ALLOW_EMPTY_SNAPSHOT === "1";

  let raw = "";
  try {
    raw = await readFile(snapshotPath, "utf8");
  } catch {
    throw new Error(`latest snapshot missing: ${snapshotPath}`);
  }

  const parsed = JSON.parse(raw) as SnapshotEnvelope;
  const snapshot = snapshotEnvelopeSchema.parse(parsed);

  if (!snapshot.machine) throw new Error("snapshot missing machine");
  if (!snapshot.collectorRun) throw new Error("snapshot missing collectorRun");
  if (!Array.isArray(snapshot.repoLocations)) throw new Error("snapshot repoLocations is not array");

  for (const location of snapshot.repoLocations) {
    if (!location.machineId || !location.path || !location.currentBranch || typeof location.dirty !== "boolean") {
      throw new Error(`invalid repoLocation shape: ${location.id}`);
    }
    if (CREDENTIAL_IN_URL.test(location.remoteUrlRedacted)) {
      throw new Error(`credential segment not redacted in remote URL: ${location.id}`);
    }
    if (UNSAFE_QUERY_VALUE.test(location.remoteUrlRedacted)) {
      throw new Error(`unredacted secret-like token in remote URL: ${location.id}`);
    }
  }

  const dashboardData = buildDashboardDataFromSnapshot(snapshot);
  if (!dashboardData.repoRows) {
    throw new Error("dashboard adapter parse failed");
  }

  if (snapshot.repoLocations.length === 0 && !allowEmpty) {
    process.stdout.write(`snapshot_invalid=1\n`);
    process.stdout.write(`reason=no_repo_locations\n`);
    process.stdout.write(`machine=${snapshot.machine.id}\n`);
    throw new Error(`snapshot has zero repo locations for real machine ${snapshot.machine.id}. Use --allow-empty or GH_TRACKER_ALLOW_EMPTY_SNAPSHOT=1 for testing/discovery.`);
  }

  process.stdout.write(`snapshot_valid=1\n`);
  process.stdout.write(`repo_locations=${snapshot.repoLocations.length}\n`);
  process.stdout.write(`machine=${snapshot.machine.id}\n`);
}

main().catch((error) => {
  process.stderr.write(`${(error as Error).stack || (error as Error).message}\n`);
  process.exit(1);
});
