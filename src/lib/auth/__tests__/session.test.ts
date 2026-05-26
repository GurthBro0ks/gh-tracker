/**
 * Auth bridge unit tests — no real passwords, no real network calls.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { createSessionToken, verifySessionToken, requireOwner } from "../session";

describe("auth session", () => {
  beforeAll(() => {
    process.env.HABITAT_SESSION_SECRET = "test-secret-that-is-long-enough-for-hmac-256";
  });

  it("creates and verifies a valid session token", () => {
    const session = {
      sub: "user-123",
      email: "owner@example.com",
      role: "owner",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const token = createSessionToken(session);
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);

    const verified = verifySessionToken(token);
    expect(verified).not.toBeNull();
    expect(verified!.sub).toBe("user-123");
    expect(verified!.email).toBe("owner@example.com");
    expect(verified!.role).toBe("owner");
  });

  it("rejects an expired token", () => {
    const session = {
      sub: "user-123",
      email: "owner@example.com",
      role: "owner",
      iat: Math.floor(Date.now() / 1000) - 7200,
      exp: Math.floor(Date.now() / 1000) - 3600,
    };
    const token = createSessionToken(session);
    const verified = verifySessionToken(token);
    expect(verified).toBeNull();
  });

  it("rejects a tampered token", () => {
    const session = {
      sub: "user-123",
      email: "owner@example.com",
      role: "owner",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const token = createSessionToken(session);
    const tampered = token.slice(0, -5) + "XXXXX";
    const verified = verifySessionToken(tampered);
    expect(verified).toBeNull();
  });

  it("allows owner role through requireOwner", () => {
    const session = {
      sub: "user-123",
      email: "owner@example.com",
      role: "owner",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    expect(() => requireOwner(session)).not.toThrow();
    expect(requireOwner(session).email).toBe("owner@example.com");
  });

  it("throws for non-owner role in requireOwner", () => {
    const session = {
      sub: "user-123",
      email: "member@example.com",
      role: "member",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    expect(() => requireOwner(session)).toThrow("forbidden");
  });

  it("throws for null session in requireOwner", () => {
    expect(() => requireOwner(null)).toThrow("unauthorized");
  });
});
