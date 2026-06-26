import { redirect } from "next/navigation";
import HarnessDashboard from "@/components/harness-dashboard";
import { getSession, requireOwner } from "@/lib/auth/session";
import { loadHarnessSessionIndex } from "@/lib/harness-session-index";

export const dynamic = "force-dynamic";

export default async function HarnessPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  try {
    requireOwner(session);
  } catch {
    redirect("/login");
  }

  const index = await loadHarnessSessionIndex();

  return <HarnessDashboard index={index} session={{ email: session.email, role: session.role }} />;
}
