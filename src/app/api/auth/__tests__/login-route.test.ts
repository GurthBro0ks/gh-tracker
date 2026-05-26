import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const verifySlimyCredentials = vi.fn();
const setSessionCookie = vi.fn();

vi.mock("@/lib/auth/bridge", () => ({
  verifySlimyCredentials,
}));

vi.mock("@/lib/auth/session", () => ({
  setSessionCookie,
}));

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts owner from Slimy auth bridge", async () => {
    verifySlimyCredentials.mockResolvedValue({
      ok: true,
      user: { id: "u1", email: "owner@example.com", username: "owner", role: "owner" },
    });
    const { POST } = await import("../login/route");
    const request = new NextRequest("http://127.0.0.1:5055/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "owner@example.com", password: "mock-password" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(setSessionCookie).toHaveBeenCalledTimes(1);
  });

  it("denies non-owner from Slimy auth bridge", async () => {
    verifySlimyCredentials.mockResolvedValue({
      ok: true,
      user: { id: "u2", email: "member@example.com", username: "member", role: "member" },
    });
    const { POST } = await import("../login/route");
    const request = new NextRequest("http://127.0.0.1:5055/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "member@example.com", password: "mock-password" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
    expect(setSessionCookie).not.toHaveBeenCalled();
  });

  it("returns generic error for failed login", async () => {
    verifySlimyCredentials.mockResolvedValue({
      ok: false,
      error: "upstream specific message",
      status: 401,
    });
    const { POST } = await import("../login/route");
    const request = new NextRequest("http://127.0.0.1:5055/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "wrong@example.com", password: "wrong-password" }),
    });

    const response = await POST(request);
    const payload = await response.json();
    expect(response.status).toBe(401);
    expect(payload.error).toBe("Invalid email or password");
    expect(payload.error).not.toContain("upstream");
    expect(setSessionCookie).not.toHaveBeenCalled();
  });
});
