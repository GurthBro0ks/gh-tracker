/**
 * Fail-closed session-secret regression tests.
 * No real secrets; only synthetic values.
 */

import { describe, it, expect } from "vitest";
import { resolveSessionSecret } from "../token";

describe("resolveSessionSecret — production", () => {
  it("throws when HABITAT_SESSION_SECRET is missing", () => {
    expect(() => resolveSessionSecret({ NODE_ENV: "production" })).toThrow(
      /HABITAT_SESSION_SECRET is required in production/,
    );
  });

  it("throws when HABITAT_SESSION_SECRET is blank", () => {
    expect(() =>
      resolveSessionSecret({ NODE_ENV: "production", HABITAT_SESSION_SECRET: "" }),
    ).toThrow(/HABITAT_SESSION_SECRET is required in production/);
  });

  it("throws when HABITAT_SESSION_SECRET is only whitespace", () => {
    expect(() =>
      resolveSessionSecret({ NODE_ENV: "production", HABITAT_SESSION_SECRET: "   " }),
    ).toThrow(/HABITAT_SESSION_SECRET is required in production/);
  });

  it("throws when HABITAT_SESSION_SECRET is too short (weak)", () => {
    expect(() =>
      resolveSessionSecret({ NODE_ENV: "production", HABITAT_SESSION_SECRET: "short" }),
    ).toThrow(/must be at least 32 characters/);
  });

  it("does not fall back to GH_TRACKER_SESSION_SEED in production", () => {
    expect(() =>
      resolveSessionSecret({
        NODE_ENV: "production",
        GH_TRACKER_SESSION_SEED: "some-seed-value-that-is-long-enough-1234",
      }),
    ).toThrow(/HABITAT_SESSION_SECRET is required in production/);
  });

  it("does not fall back to HOSTNAME in production", () => {
    expect(() =>
      resolveSessionSecret({ NODE_ENV: "production", HOSTNAME: "127.0.0.1" }),
    ).toThrow(/HABITAT_SESSION_SECRET is required in production/);
  });

  it("does not fall back to the hardcoded static default in production", () => {
    // Regression guard: the old fallback literal must never be silently
    // accepted as a real production secret, even if someone reintroduces it.
    expect(() =>
      resolveSessionSecret({
        NODE_ENV: "production",
        HABITAT_SESSION_SECRET: undefined,
        HOSTNAME: undefined,
        GH_TRACKER_SESSION_SEED: undefined,
      }),
    ).toThrow();
  });

  it("accepts a strong dedicated secret in production", () => {
    const strong = "a".repeat(32);
    expect(resolveSessionSecret({ NODE_ENV: "production", HABITAT_SESSION_SECRET: strong })).toBe(
      strong,
    );
  });

  it("accepts a secret at exactly the minimum length boundary", () => {
    const boundary = "b".repeat(32);
    expect(
      resolveSessionSecret({ NODE_ENV: "production", HABITAT_SESSION_SECRET: boundary }),
    ).toBe(boundary);
  });

  it("rejects a secret one character below the minimum length boundary", () => {
    const belowBoundary = "c".repeat(31);
    expect(() =>
      resolveSessionSecret({ NODE_ENV: "production", HABITAT_SESSION_SECRET: belowBoundary }),
    ).toThrow(/must be at least 32 characters/);
  });
});

describe("resolveSessionSecret — non-production", () => {
  it("uses a dedicated secret when set outside production", () => {
    const dedicated = "dev-secret";
    expect(resolveSessionSecret({ NODE_ENV: "development", HABITAT_SESSION_SECRET: dedicated })).toBe(
      dedicated,
    );
  });

  it("falls back to a fixed test-only seed when nothing is set outside production", () => {
    const result = resolveSessionSecret({ NODE_ENV: "test" });
    expect(result).toBe("gh-tracker-habitat-session-test-only-seed");
  });

  it("never selects GH_TRACKER_SESSION_SEED or HOSTNAME outside production either", () => {
    // The seed/hostname fallbacks are removed entirely, not just gated by env --
    // confirm the test-only path ignores them rather than reading them.
    const result = resolveSessionSecret({
      NODE_ENV: "test",
      GH_TRACKER_SESSION_SEED: "should-be-ignored",
      HOSTNAME: "should-also-be-ignored",
    });
    expect(result).toBe("gh-tracker-habitat-session-test-only-seed");
  });
});
