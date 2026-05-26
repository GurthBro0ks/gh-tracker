import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { createSessionToken } from "../session";
import { proxy } from "../../../../proxy";

describe("proxy auth route protection", () => {
  it("redirects unauthenticated dashboard request to /login", () => {
    const request = new NextRequest("http://127.0.0.1:5055/");
    const response = proxy(request);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")?.endsWith("/login")).toBe(true);
  });

  it("allows login route without session", () => {
    const request = new NextRequest("http://127.0.0.1:5055/login");
    const response = proxy(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("redirects protected API route without session", () => {
    const request = new NextRequest("http://127.0.0.1:5055/api/aggregate");
    const response = proxy(request);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")?.endsWith("/login")).toBe(true);
  });

  it("redirects when session cookie signature is invalid", () => {
    const request = new NextRequest("http://127.0.0.1:5055/", {
      headers: {
        cookie: "habitat_session=invalid.token",
      },
    });
    const response = proxy(request);
    expect(response.status).toBe(307);
  });

  it("allows request with valid owner session cookie", () => {
    const now = Math.floor(Date.now() / 1000);
    const token = createSessionToken({
      sub: "owner-1",
      email: "owner@example.com",
      role: "owner",
      iat: now,
      exp: now + 3600,
    });
    const request = new NextRequest("http://127.0.0.1:5055/", {
      headers: {
        cookie: `habitat_session=${token}`,
      },
    });
    const response = proxy(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });
});
