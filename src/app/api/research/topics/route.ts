import { NextRequest, NextResponse } from "next/server";
import { getSession, requireOwner } from "@/lib/auth/session";
import {
  sanitizeSlug,
  isValidSlug,
  validateTopicSeed,
  createTopicFile,
  type TopicSeed,
} from "@/lib/research-farm";

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

  const seed: TopicSeed = {
    title: String(body.title || ""),
    question: String(body.question || ""),
    depth: String(body.depth || "deep"),
    priority: String(body.priority || "normal"),
    tags: Array.isArray(body.tags)
      ? body.tags.map(String).filter(Boolean)
      : typeof body.tags === "string"
        ? String(body.tags).split(",").map((t) => t.trim()).filter(Boolean)
        : [],
    campaign: String(body.campaign || ""),
    assigned_critter: String(body.assigned_critter || ""),
    scope_notes: String(body.scope_notes || ""),
    constraints: String(body.constraints || ""),
    audience: String(body.audience || "technical_owner"),
    visibility: String(body.visibility || "owner"),
  };

  const validation = validateTopicSeed(seed);
  if (!validation.valid) {
    return NextResponse.json({ error: "validation failed", details: validation.errors }, { status: 400 });
  }

  const rawSlug = body.slug ? String(body.slug) : seed.title;
  const slug = sanitizeSlug(rawSlug);

  if (!isValidSlug(slug)) {
    return NextResponse.json({ error: "could not derive a valid slug from title", slug }, { status: 400 });
  }

  const result = createTopicFile(slug, seed);
  if (!result.success) {
    return NextResponse.json({ error: result.error, slug }, { status: 409 });
  }

  return NextResponse.json({
    success: true,
    slug,
    filePath: result.filePath,
    message: `Quest seed "${seed.title}" planted on the Quest Board.`,
  }, { status: 201 });
}
