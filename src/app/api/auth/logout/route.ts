/**
 * POST /api/auth/logout
 * Clears the GH Tracker local session cookie.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionCookieClearTargets, serializeClearSessionCookie } from "../../../../lib/auth/session";
import { getSecureSharedSessionCookieDomain } from "../../../../lib/auth/cookie-domain";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const isSecure = request.headers.get("x-forwarded-proto") === "https";
  const sharedDomain = isSecure
    ? getSecureSharedSessionCookieDomain(request.headers.get("x-forwarded-host") || request.headers.get("host"))
    : null;
  const response = NextResponse.json({ success: true });
  for (const target of getSessionCookieClearTargets(sharedDomain)) {
    response.headers.append("Set-Cookie", serializeClearSessionCookie(target.name, isSecure, target.domain));
  }
  return response;
}
