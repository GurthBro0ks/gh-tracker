/**
 * POST /api/auth/logout
 * Clears the GH Tracker local session cookie.
 */

import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/session";
import { getSharedSessionCookieDomain } from "../../../../lib/auth/cookie-domain";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const isSecure = request.headers.get("x-forwarded-proto") === "https";
  const sharedDomain = isSecure
    ? getSharedSessionCookieDomain(request.headers.get("x-forwarded-host") || request.headers.get("host"))
    : null;
  await clearSessionCookie(isSecure, sharedDomain);
  return NextResponse.json({ success: true });
}
