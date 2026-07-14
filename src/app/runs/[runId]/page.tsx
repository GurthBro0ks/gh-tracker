import { redirect } from "next/navigation";
import { getSession, requireOwner } from "@/lib/auth/session";
import { RunWorkspaceDetail, RunWorkspaceUnavailable } from "../_components/run-workspace";
import { getRunWorkspaceFixture } from "../_lib/fixtures";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RunDetailPage({ params }: { params: Promise<{ runId: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  try {
    requireOwner(session);
  } catch {
    redirect("/login");
  }

  const { runId } = await params;
  const fixture = getRunWorkspaceFixture(runId);
  return fixture.kind === "valid"
    ? <RunWorkspaceDetail fixture={fixture} />
    : <RunWorkspaceUnavailable result={fixture} />;
}
