/**
 * GET /api/auth/me
 * Returns current GH Tracker session info.
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      id: session.sub,
      email: session.email,
      role: session.role,
    },
  });
}
