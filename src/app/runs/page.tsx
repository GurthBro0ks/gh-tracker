import { redirect } from "next/navigation";
import { getSession, requireOwner } from "@/lib/auth/session";
import { RunWorkspaceIndex } from "./_components/run-workspace";
import { listRunWorkspaceFixtures } from "./_lib/fixtures";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RunsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  try {
    requireOwner(session);
  } catch {
    redirect("/login");
  }

  return <RunWorkspaceIndex fixtures={listRunWorkspaceFixtures()} />;
}
