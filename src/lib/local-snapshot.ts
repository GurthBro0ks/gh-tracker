import { readFile } from "node:fs/promises";
import path from "node:path";
import type { DashboardData } from "@/lib/dashboard-adapter";
import { buildDashboardDataFromSnapshot } from "@/lib/dashboard-adapter";
import type { SnapshotEnvelope } from "@/lib/contracts";
import { snapshotEnvelopeSchema } from "@/lib/snapshot-schema";

const AGGREGATE_PATH = path.join(process.cwd(), "data", "snapshots", "aggregate", "latest.json");
const NUC1_PATH = path.join(process.cwd(), "data", "snapshots", "machines", "nuc1", "latest.json");
const NUC2_PATH = path.join(process.cwd(), "data", "snapshots", "machines", "nuc2", "latest.json");

export async function loadLocalSnapshotDashboardData(): Promise<DashboardData | null> {
  // Prefer aggregate if available
  try {
    const raw = await readFile(AGGREGATE_PATH, "utf8");
    const parsed = JSON.parse(raw) as SnapshotEnvelope;
    const validated = snapshotEnvelopeSchema.parse(parsed);
    return buildDashboardDataFromSnapshot(validated);
  } catch {
    // Fallback to single machine snapshots
  }

  // Try nuc1 first (this is NUC1 host)
  try {
    const raw = await readFile(NUC1_PATH, "utf8");
    const parsed = JSON.parse(raw) as SnapshotEnvelope;
    const validated = snapshotEnvelopeSchema.parse(parsed);
    return buildDashboardDataFromSnapshot(validated);
  } catch {
    // Fallback to nuc2
  }

  try {
    const raw = await readFile(NUC2_PATH, "utf8");
    const parsed = JSON.parse(raw) as SnapshotEnvelope;
    const validated = snapshotEnvelopeSchema.parse(parsed);
    return buildDashboardDataFromSnapshot(validated);
  } catch {
    return null;
  }
}
