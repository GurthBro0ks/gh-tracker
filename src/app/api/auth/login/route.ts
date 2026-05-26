/**
 * POST /api/auth/login
 * Bridge login: forwards to Slimy auth, creates local session on owner success.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifySlimyCredentials } from "@/lib/auth/bridge";
import { setSessionCookie } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const GENERIC_LOGIN_ERROR = "Invalid email or password";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    // Verify against Slimy auth
    const result = await verifySlimyCredentials(email, password);

    if (!result.ok) {
      return NextResponse.json({ error: GENERIC_LOGIN_ERROR }, { status: 401 });
    }

    // Owner-only gate
    if (result.user.role !== "owner") {
      return NextResponse.json({ error: GENERIC_LOGIN_ERROR }, { status: 401 });
    }

    // Create local session
    const now = Math.floor(Date.now() / 1000);
    const maxAge = parseInt(process.env.HABITAT_SESSION_MAX_AGE_SECONDS || "86400", 10);
    const session = {
      sub: result.user.id,
      email: result.user.email,
      role: result.user.role,
      iat: now,
      exp: now + maxAge,
    };

    const isSecure = request.headers.get("x-forwarded-proto") === "https";
    await setSessionCookie(session, isSecure);

    return NextResponse.json({
      success: true,
      user: {
        id: result.user.id,
        email: result.user.email,
        role: result.user.role,
      },
    });
  } catch (error) {
    console.error("[Auth] Login error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
