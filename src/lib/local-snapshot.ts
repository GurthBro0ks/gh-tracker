import { readFile } from "node:fs/promises";
import path from "node:path";
import type { DashboardData } from "@/lib/dashboard-adapter";
import { buildDashboardDataFromSnapshot } from "@/lib/dashboard-adapter";
import type { SnapshotEnvelope } from "@/lib/contracts";
import { snapshotEnvelopeSchema } from "@/lib/snapshot-schema";

const SNAPSHOT_PATH = path.join(process.cwd(), "data", "snapshots", "nuc2", "latest.json");

export async function loadLocalSnapshotDashboardData(): Promise<DashboardData | null> {
  try {
    const raw = await readFile(SNAPSHOT_PATH, "utf8");
    const parsed = JSON.parse(raw) as SnapshotEnvelope;
    const validated = snapshotEnvelopeSchema.parse(parsed);
    return buildDashboardDataFromSnapshot(validated);
  } catch {
    return null;
  }
}
