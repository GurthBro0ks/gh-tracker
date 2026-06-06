import { NextRequest, NextResponse } from "next/server";
import { getSession, requireOwner } from "@/lib/auth/session";
import { readArtifactFile } from "@/lib/research-farm";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const session = await getSession();
  try {
    requireOwner(session);
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { path: segments } = await params;
  const userPath = segments.join("/");

  const result = await readArtifactFile(userPath);
  if (!result) {
    return NextResponse.json({ error: "not found or invalid path" }, { status: 404 });
  }

  const body = new Uint8Array(result.data);
  const ext = userPath.split(".").pop()?.toLowerCase();

  if (ext === "pdf") {
    return new NextResponse(body, {
      status: 200,
      headers: {
        "content-type": result.contentType,
        "content-disposition": `inline; filename="${userPath.split("/").pop()}"`,
        "cache-control": "private, no-store",
      },
    });
  }

  if (ext === "html") {
    return new NextResponse(body, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  }

  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": result.contentType,
      "cache-control": "private, no-store",
    },
  });
}
