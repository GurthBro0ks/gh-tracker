import Dashboard from "@/components/dashboard";
import { buildDemoDashboardData } from "@/lib/dashboard-adapter";
import { loadLocalSnapshotDashboardData } from "@/lib/local-snapshot";

export default async function Home() {
  const demoData = buildDemoDashboardData();
  const localData = await loadLocalSnapshotDashboardData();
  return <Dashboard demoData={demoData} localData={localData} />;
}
