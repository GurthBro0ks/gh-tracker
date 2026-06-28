import { NextRequest, NextResponse } from "next/server";
import { logReportsSsoBreadcrumb } from "../../../../../lib/auth/reports-sso-breadcrumb";
import { verifyReportsSsoTicket } from "../../../../../lib/auth/reports-sso-ticket";

export const dynamic = "force-dynamic";

function verificationReason(
  ticketSeen: boolean,
  result: ReturnType<typeof verifyReportsSsoTicket>,
): "ok" | "missing" | "expired" | "replayed" | "return_to_mismatch" | "not_found" {
  if (result.valid) return "ok";
  if (!ticketSeen) return "missing";
  if (result.expired) return "expired";
  if (result.redeemed) return "replayed";
  if (!result.returnToAllowed && result.owner) return "return_to_mismatch";
  return "not_found";
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    ticket?: unknown;
    returnTo?: unknown;
  };
  const ticketSeen = typeof body.ticket === "string" && body.ticket.length > 0;
  const result = verifyReportsSsoTicket(
    ticketSeen ? (body.ticket as string) : null,
    typeof body.returnTo === "string" ? body.returnTo : null,
  );
  logReportsSsoBreadcrumb("verify", {
    verify_endpoint_hit: "yes",
    verify_ticket_seen: ticketSeen ? "yes" : "no",
    verify_ticket_valid: result.valid ? "yes" : "no",
    verify_reason: verificationReason(ticketSeen, result),
    verify_owner: result.owner ? "yes" : "no",
    verify_return_to_allowed: result.returnToAllowed ? "yes" : "no",
  });

  return NextResponse.json(result, {
    status: result.valid ? 200 : 401,
    headers: {
      "cache-control": "no-store",
    },
  });
}
