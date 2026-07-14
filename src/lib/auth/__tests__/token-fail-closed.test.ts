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
  it.each<[string, Record<string, string | undefined>]>([
    ["development", { NODE_ENV: "development" }],
    ["unset", {}],
    ["a typo", { NODE_ENV: "prodution" }],
    ["a custom value", { NODE_ENV: "staging" }],
  ])("requires HABITAT_SESSION_SECRET when NODE_ENV is %s", (_label, env) => {
    expect(() => resolveSessionSecret(env)).toThrow(/HABITAT_SESSION_SECRET is required/);
  });

  it("falls back to a fixed test-only seed only in exact test mode", () => {
    const result = resolveSessionSecret({ NODE_ENV: "test" });
    expect(result).toBe("gh-tracker-habitat-session-test-only-seed");
  });

  it("uses a dedicated secret when set outside test mode", () => {
    const dedicated = "dev-secret";
    expect(resolveSessionSecret({ NODE_ENV: "development", HABITAT_SESSION_SECRET: dedicated })).toBe(
      dedicated,
    );
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

describe("resolveSessionSecret — normalization", () => {
  it("trims surrounding whitespace before validating production length and use", () => {
    const normalized = "a".repeat(32);
    const padded = ` \t${normalized}\r\n `;

    expect(
      resolveSessionSecret({ NODE_ENV: "production", HABITAT_SESSION_SECRET: padded }),
    ).toBe(normalized);
  });

  it("rejects a padded production secret whose normalized value is too short", () => {
    const padded = `  ${"b".repeat(31)}  `;

    expect(() =>
      resolveSessionSecret({ NODE_ENV: "production", HABITAT_SESSION_SECRET: padded }),
    ).toThrow(/got 31/);
  });

  it("preserves internal whitespace while trimming surrounding whitespace", () => {
    const normalized = `${"c".repeat(16)}  internal\tspace  ${"d".repeat(16)}`;

    expect(
      resolveSessionSecret({
        NODE_ENV: "development",
        HABITAT_SESSION_SECRET: ` \n${normalized}\t `,
      }),
    ).toBe(normalized);
  });

  it("normalizes an explicit test-mode secret instead of using the fallback", () => {
    expect(
      resolveSessionSecret({
        NODE_ENV: "test",
        HABITAT_SESSION_SECRET: "  explicit test secret  ",
      }),
    ).toBe("explicit test secret");
  });
});
