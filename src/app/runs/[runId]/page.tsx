import { notFound, redirect } from "next/navigation";
import { getSession, requireOwner } from "@/lib/auth/session";
import { RunWorkspaceDetail } from "../_components/run-workspace";
import { getRunWorkspaceFixture, isCanonicalRunId } from "../_lib/fixtures";

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
  if (!isCanonicalRunId(runId)) notFound();

  const fixture = getRunWorkspaceFixture(runId);
  if (fixture.kind !== "valid") notFound();

  return <RunWorkspaceDetail fixture={fixture} />;
}
