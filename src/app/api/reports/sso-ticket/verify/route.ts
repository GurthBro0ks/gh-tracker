import { NextRequest, NextResponse } from "next/server";
import { verifyReportsSsoTicket } from "../../../../../lib/auth/reports-sso-ticket";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    ticket?: unknown;
    returnTo?: unknown;
  };
  const result = verifyReportsSsoTicket(
    typeof body.ticket === "string" ? body.ticket : null,
    typeof body.returnTo === "string" ? body.returnTo : null,
  );

  return NextResponse.json(result, {
    status: result.valid ? 200 : 401,
    headers: {
      "cache-control": "no-store",
    },
  });
}
