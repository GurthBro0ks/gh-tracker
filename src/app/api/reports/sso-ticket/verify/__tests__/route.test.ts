import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";
import {
  clearReportsSsoTicketsForTests,
  issueReportsSsoTicket,
} from "../../../../../../lib/auth/reports-sso-ticket";
import type { HabitatSession } from "../../../../../../lib/auth/token";

const ownerSession: HabitatSession = {
  sub: "owner-1",
  email: "owner@example.com",
  role: "owner",
  iat: 100,
  exp: 999999,
};

function request(body: unknown) {
  return new NextRequest("https://habitat.slimyai.xyz/api/reports/sso-ticket/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/reports/sso-ticket/verify", () => {
  afterEach(() => {
    clearReportsSsoTicketsForTests();
  });

  it("verifies valid owner tickets and returns only safe booleans", async () => {
    const issued = issueReportsSsoTicket(ownerSession, "https://harness.slimyai.xyz/reports/sessions");

    const response = await POST(request({ ticket: issued.ticket, returnTo: issued.returnTo }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      valid: true,
      owner: true,
      expired: false,
      redeemed: false,
      returnToAllowed: true,
    });
    expect(JSON.stringify(body)).not.toContain(issued.ticket);
  });

  it("rejects replayed tickets", async () => {
    const issued = issueReportsSsoTicket(ownerSession, "/reports");
    await POST(request({ ticket: issued.ticket, returnTo: issued.returnTo }));

    const response = await POST(request({ ticket: issued.ticket, returnTo: issued.returnTo }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.valid).toBe(false);
    expect(body.redeemed).toBe(true);
  });

  it("rejects missing and return-target-mismatched tickets", async () => {
    const issued = issueReportsSsoTicket(ownerSession, "https://harness.slimyai.xyz/reports/sessions/a.json");

    const missing = await POST(request({ returnTo: issued.returnTo }));
    expect(missing.status).toBe(401);
    expect((await missing.json()).valid).toBe(false);

    const mismatched = await POST(request({
      ticket: issued.ticket,
      returnTo: "https://harness.slimyai.xyz/reports/sessions/b.json",
    }));
    const body = await mismatched.json();
    expect(mismatched.status).toBe(401);
    expect(body.valid).toBe(false);
    expect(body.returnToAllowed).toBe(false);
  });
});
