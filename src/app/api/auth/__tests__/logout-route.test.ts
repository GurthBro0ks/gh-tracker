import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const clearSessionCookie = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  clearSessionCookie,
}));

describe("POST /api/auth/logout", () => {
  it("clears session cookie", async () => {
    const { POST } = await import("../logout/route");
    const request = new NextRequest("http://127.0.0.1:5055/api/auth/logout", {
      method: "POST",
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(clearSessionCookie).toHaveBeenCalledTimes(1);
  });
});
