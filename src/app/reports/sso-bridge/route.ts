import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "../../../lib/auth/cookie-domain";
import { logReportsSsoBreadcrumb } from "../../../lib/auth/reports-sso-breadcrumb";
import {
  issueReportsSsoTicket,
  normalizeReportsReturnTo,
  REPORTS_SSO_TICKET_TTL_SECONDS,
} from "../../../lib/auth/reports-sso-ticket";
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
  const normalizedReturnTo = normalizeReportsReturnTo(rawReturnTo);
  let ownerSession: ReturnType<typeof requireOwner>;

  try {
    ownerSession = requireOwner(session);
  } catch {
    logReportsSsoBreadcrumb("bridge", {
      bridge_route_hit: "yes",
      bridge_owner_verified: "no",
      bridge_ticket_issued: "no",
      bridge_redirect_target_class: "habitat_login",
      return_to_class: "reports_allowlisted",
    });
    const loginUrl = new URL("/login", getHabitatPublicOrigin(request));
    loginUrl.searchParams.set("returnTo", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl, { status: 302 });
  }

  const issued = issueReportsSsoTicket(ownerSession, normalizedReturnTo);
  const consumeUrl = new URL("/api/session/consume-sso", REPORTS_ORIGIN);
  consumeUrl.searchParams.set("ticket", issued.ticket);
  consumeUrl.searchParams.set("returnTo", issued.returnTo);
  logReportsSsoBreadcrumb("bridge", {
    bridge_route_hit: "yes",
    bridge_owner_verified: "yes",
    bridge_ticket_issued: "yes",
    bridge_redirect_target_class: "reports_allowlisted",
    ticket_ttl_seconds: REPORTS_SSO_TICKET_TTL_SECONDS,
  });
  return NextResponse.redirect(consumeUrl, { status: 302 });
}
