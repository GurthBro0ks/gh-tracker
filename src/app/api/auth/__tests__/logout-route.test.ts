import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

describe("POST /api/auth/logout", () => {
  it("clears session cookie", async () => {
    const { POST } = await import("../logout/route");
    const request = new NextRequest("http://127.0.0.1:5055/api/auth/logout", {
      method: "POST",
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("habitat_session=");
  });

  it("clears the shared parent-domain cookies for secure proxied requests", async () => {
    const { POST } = await import("../logout/route");
    const request = new NextRequest("http://127.0.0.1:5055/api/auth/logout", {
      method: "POST",
      headers: {
        "x-forwarded-proto": "https",
      },
    });

    const response = await POST(request);
    const setCookie = response.headers.get("set-cookie") || "";
    expect(response.status).toBe(200);
    expect(setCookie).toContain("habitat_session=");
    expect(setCookie).toContain("slimy_session=");
    expect(setCookie).toContain("Domain=.slimyai.xyz");
    expect(setCookie).toContain("Max-Age=0");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toMatch(/SameSite=Lax/i);
  });
});
