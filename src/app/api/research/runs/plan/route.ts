import { NextRequest, NextResponse } from "next/server";
import { getSession, requireOwner } from "@/lib/auth/session";
import { planRunFromTopic } from "@/lib/research-farm";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await getSession();
  try {
    requireOwner(session);
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const slug = String(body.slug || "").trim();

  if (!slug) {
    return NextResponse.json({ error: "slug is required" }, { status: 400 });
  }

  if (slug.includes("..") || slug.includes("/") || slug.includes("\\")) {
    return NextResponse.json({ error: "invalid slug" }, { status: 400 });
  }

  const result = await planRunFromTopic(slug);

  if (!result.success) {
    const status = result.error?.includes("not found") ? 404
      : result.error?.includes("already exists") ? 409
      : 500;
    return NextResponse.json({ error: result.error, slug }, { status });
  }

  return NextResponse.json({
    success: true,
    runId: result.runId,
    slug,
    message: `Planned run created for "${slug}". View it in the Research Farm.`,
    link: `/research/runs/${result.runId}`,
  }, { status: 201 });
}
