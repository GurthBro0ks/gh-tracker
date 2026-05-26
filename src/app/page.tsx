import { redirect } from "next/navigation";
import Dashboard from "@/components/dashboard";
import { buildDemoDashboardData } from "@/lib/dashboard-adapter";
import { loadLocalSnapshotDashboardData } from "@/lib/local-snapshot";
import { getSession, requireOwner } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  try {
    requireOwner(session);
  } catch {
    redirect("/login");
  }

  const demoData = buildDemoDashboardData();
  const localData = await loadLocalSnapshotDashboardData();
  return <Dashboard demoData={demoData} localData={localData} session={{ email: session.email, role: session.role }} />;
}
