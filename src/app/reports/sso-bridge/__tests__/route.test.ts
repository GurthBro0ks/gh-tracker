import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../route";
import { createSessionToken } from "../../../../lib/auth/session";

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
  it("redirects logged-out requests to Habitat login", async () => {
    const request = new NextRequest("https://habitat.slimyai.xyz/reports/sso-bridge?returnTo=%2Freports");

    const response = await GET(request);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("https://habitat.slimyai.xyz/login");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("refreshes the shared parent-domain Habitat session cookie before redirecting to reports", async () => {
    const token = ownerToken();
    const request = new NextRequest("https://habitat.slimyai.xyz/reports/sso-bridge?returnTo=%2Freports%2Fsessions", {
      headers: {
        cookie: `habitat_session=${token}`,
        "x-forwarded-proto": "https",
        "x-forwarded-host": "habitat.slimyai.xyz",
      },
    });

    const response = await GET(request);
    const setCookie = response.headers.get("set-cookie") || "";

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://harness.slimyai.xyz/reports/sessions");
    expect(setCookie).toContain("habitat_session=");
    expect(setCookie).toContain("Domain=.slimyai.xyz");
    expect(setCookie).toContain("Path=/");
    expect(setCookie).toContain("Max-Age=");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toMatch(/SameSite=Lax/i);
    expect(setCookie).not.toContain("slimy_session=");
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

    expect(response.headers.get("location")).toBe("https://harness.slimyai.xyz/reports");
  });
});
