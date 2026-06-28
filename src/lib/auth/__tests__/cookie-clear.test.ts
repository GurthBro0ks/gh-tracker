import { beforeEach, describe, expect, it, vi } from "vitest";

const setCookie = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    set: setCookie,
  })),
}));

describe("auth cookie clearing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("clears Habitat and Reports cookies as host-only and shared parent-domain cookies", async () => {
    const { clearSessionCookie } = await import("../session");

    await clearSessionCookie(true, ".slimyai.xyz");

    expect(setCookie).toHaveBeenCalledTimes(4);
    expect(setCookie).toHaveBeenCalledWith(
      "habitat_session",
      "",
      expect.objectContaining({ httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 }),
    );
    expect(setCookie).toHaveBeenCalledWith(
      "habitat_session",
      "",
      expect.objectContaining({ domain: ".slimyai.xyz", httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 }),
    );
    expect(setCookie).toHaveBeenCalledWith(
      "slimy_session",
      "",
      expect.objectContaining({ httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 }),
    );
    expect(setCookie).toHaveBeenCalledWith(
      "slimy_session",
      "",
      expect.objectContaining({ domain: ".slimyai.xyz", httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 }),
    );
  });
});
