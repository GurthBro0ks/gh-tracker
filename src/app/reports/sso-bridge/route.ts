import { NextRequest, NextResponse } from "next/server";
import {
  getSecureSharedSessionCookieDomain,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from "../../../lib/auth/cookie-domain";
import { requireOwner, verifySessionToken } from "../../../lib/auth/session";

export const dynamic = "force-dynamic";

const REPORTS_ORIGIN = "https://harness.slimyai.xyz";
const HABITAT_ORIGIN = "https://habitat.slimyai.xyz";

function safeReportsReturnUrl(request: NextRequest): URL {
  const raw = request.nextUrl.searchParams.get("returnTo");
  if (!raw) return new URL("/reports", REPORTS_ORIGIN);

  if (raw.startsWith("/") && !raw.startsWith("//")) {
    return raw.startsWith("/reports")
      ? new URL(raw, REPORTS_ORIGIN)
      : new URL("/reports", REPORTS_ORIGIN);
  }

  try {
    const parsed = new URL(raw);
    if (parsed.origin === REPORTS_ORIGIN && parsed.pathname.startsWith("/reports")) {
      return parsed;
    }
  } catch {
    return new URL("/reports", REPORTS_ORIGIN);
  }

  return new URL("/reports", REPORTS_ORIGIN);
}

function isSecureRequest(request: NextRequest): boolean {
  return request.headers.get("x-forwarded-proto") === "https" || request.nextUrl.protocol === "https:";
}

function getHabitatPublicOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost && forwardedHost.includes("slimyai.xyz")) {
    const proto = request.headers.get("x-forwarded-proto") === "https" ? "https" : "http";
    return `${proto}://${forwardedHost}`;
  }

  const host = request.headers.get("host");
  if (host && host.includes("slimyai.xyz")) {
    return `${request.nextUrl.protocol}//${host}`;
  }

  return HABITAT_ORIGIN;
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? verifySessionToken(token) : null;

  try {
    requireOwner(session);
  } catch {
    const loginUrl = new URL("/login", getHabitatPublicOrigin(request));
    loginUrl.searchParams.set("returnTo", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl, { status: 302 });
  }

  const response = NextResponse.redirect(safeReportsReturnUrl(request), { status: 302 });
  const isSecure = isSecureRequest(request);
  if (isSecure && token) {
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      domain: getSecureSharedSessionCookieDomain(request.headers.get("x-forwarded-host") || request.headers.get("host")),
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
  }
  return response;
}
