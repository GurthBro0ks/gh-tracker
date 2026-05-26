/**
 * POST /api/auth/logout
 * Clears the GH Tracker local session cookie.
 */

import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const isSecure = request.headers.get("x-forwarded-proto") === "https";
  await clearSessionCookie(isSecure);
  return NextResponse.json({ success: true });
}
