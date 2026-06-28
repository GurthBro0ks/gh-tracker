import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "../../../lib/auth/cookie-domain";
import { issueReportsSsoTicket, normalizeReportsReturnTo } from "../../../lib/auth/reports-sso-ticket";
import { requireOwner, verifySessionToken } from "../../../lib/auth/session";

export const dynamic = "force-dynamic";

const REPORTS_ORIGIN = "https://harness.slimyai.xyz";
const HABITAT_ORIGIN = "https://habitat.slimyai.xyz";

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
  const rawReturnTo = request.nextUrl.searchParams.get("returnTo");
  let ownerSession: ReturnType<typeof requireOwner>;

  try {
    ownerSession = requireOwner(session);
  } catch {
    const loginUrl = new URL("/login", getHabitatPublicOrigin(request));
    loginUrl.searchParams.set("returnTo", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl, { status: 302 });
  }

  const issued = issueReportsSsoTicket(ownerSession, normalizeReportsReturnTo(rawReturnTo));
  const consumeUrl = new URL("/api/session/consume-sso", REPORTS_ORIGIN);
  consumeUrl.searchParams.set("ticket", issued.ticket);
  consumeUrl.searchParams.set("returnTo", issued.returnTo);
  return NextResponse.redirect(consumeUrl, { status: 302 });
}
