import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../route";
import { createSessionToken } from "../../../../lib/auth/session";
import { verifyReportsSsoTicket, clearReportsSsoTicketsForTests } from "../../../../lib/auth/reports-sso-ticket";

function ownerToken() {
  const now = Math.floor(Date.now() / 1000);
  return createSessionToken({
    sub: "owner-1",
    email: "owner@example.com",
    role: "owner",
    iat: now,
    exp: now + 3600,
  });
}

describe("GET /reports/sso-bridge", () => {
  afterEach(() => {
    clearReportsSsoTicketsForTests();
  });

  it("redirects logged-out requests to Habitat login", async () => {
    const request = new NextRequest("https://habitat.slimyai.xyz/reports/sso-bridge?returnTo=https%3A%2F%2Fharness.slimyai.xyz%2Freports");

    const response = await GET(request);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("https://habitat.slimyai.xyz/login");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("issues a one-time Reports SSO ticket before redirecting to Mission-Control consume", async () => {
    const token = ownerToken();
    const request = new NextRequest("https://habitat.slimyai.xyz/reports/sso-bridge?returnTo=https%3A%2F%2Fharness.slimyai.xyz%2Freports%2Fsessions", {
      headers: {
        cookie: `habitat_session=${token}`,
        "x-forwarded-proto": "https",
        "x-forwarded-host": "habitat.slimyai.xyz",
      },
    });

    const response = await GET(request);
    const location = response.headers.get("location") || "";
    const consumeUrl = new URL(location);

    expect(response.status).toBe(302);
    expect(consumeUrl.origin).toBe("https://harness.slimyai.xyz");
    expect(consumeUrl.pathname).toBe("/api/session/consume-sso");
    expect(consumeUrl.searchParams.get("returnTo")).toBe("https://harness.slimyai.xyz/reports/sessions");
    expect(consumeUrl.searchParams.get("ticket")).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(response.headers.get("set-cookie")).toBeNull();

    const verification = verifyReportsSsoTicket(
      consumeUrl.searchParams.get("ticket"),
      consumeUrl.searchParams.get("returnTo"),
    );
    expect(verification).toEqual({
      valid: true,
      owner: true,
      expired: false,
      redeemed: false,
      returnToAllowed: true,
    });
    expect(verifyReportsSsoTicket(consumeUrl.searchParams.get("ticket"), consumeUrl.searchParams.get("returnTo")).redeemed).toBe(true);
  });

  it("allows Harness report descendants as return targets", async () => {
    const token = ownerToken();
    const request = new NextRequest("https://habitat.slimyai.xyz/reports/sso-bridge?returnTo=https%3A%2F%2Fharness.slimyai.xyz%2Freports%2Fsessions%2Freport-proof-sample.json%3Fview%3Dfull", {
      headers: {
        cookie: `habitat_session=${token}`,
        "x-forwarded-proto": "https",
        "x-forwarded-host": "habitat.slimyai.xyz",
      },
    });

    const response = await GET(request);
    const location = new URL(response.headers.get("location") || "");

    expect(response.status).toBe(302);
    expect(location.pathname).toBe("/api/session/consume-sso");
    expect(location.searchParams.get("returnTo")).toBe("https://harness.slimyai.xyz/reports/sessions/report-proof-sample.json?view=full");
  });

  it("falls back to the reports index for unsafe return targets", async () => {
    const token = ownerToken();
    const request = new NextRequest("https://habitat.slimyai.xyz/reports/sso-bridge?returnTo=https%3A%2F%2Fevil.example%2Freports", {
      headers: {
        cookie: `habitat_session=${token}`,
        "x-forwarded-proto": "https",
      },
    });

    const response = await GET(request);
    const location = new URL(response.headers.get("location") || "");

    expect(location.pathname).toBe("/api/session/consume-sso");
    expect(location.searchParams.get("returnTo")).toBe("https://harness.slimyai.xyz/reports");
  });

  it("falls back to the reports index for non-report Harness targets", async () => {
    const token = ownerToken();
    const request = new NextRequest("https://habitat.slimyai.xyz/reports/sso-bridge?returnTo=https%3A%2F%2Fharness.slimyai.xyz%2Flogin", {
      headers: {
        cookie: `habitat_session=${token}`,
        "x-forwarded-proto": "https",
      },
    });

    const response = await GET(request);
    const location = new URL(response.headers.get("location") || "");

    expect(location.pathname).toBe("/api/session/consume-sso");
    expect(location.searchParams.get("returnTo")).toBe("https://harness.slimyai.xyz/reports");
  });
});
