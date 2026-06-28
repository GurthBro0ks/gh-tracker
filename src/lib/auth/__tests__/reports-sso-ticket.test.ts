import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearReportsSsoTicketsForTests,
  issueReportsSsoTicket,
  normalizeReportsReturnTo,
  REPORTS_SSO_TICKET_TTL_SECONDS,
  verifyReportsSsoTicket,
} from "../reports-sso-ticket";
import type { HabitatSession } from "../token";

const ownerSession: HabitatSession = {
  sub: "owner-1",
  email: "owner@example.com",
  role: "owner",
  iat: 100,
  exp: 999999,
};

describe("Reports SSO tickets", () => {
  afterEach(() => {
    clearReportsSsoTicketsForTests();
    vi.restoreAllMocks();
  });

  it("normalizes return targets to Harness Reports descendants only", () => {
    expect(normalizeReportsReturnTo("https://harness.slimyai.xyz/reports/sessions/a.json")).toBe(
      "https://harness.slimyai.xyz/reports/sessions/a.json",
    );
    expect(normalizeReportsReturnTo("/reports/sessions/a.json")).toBe(
      "https://harness.slimyai.xyz/reports/sessions/a.json",
    );
    expect(normalizeReportsReturnTo("https://evil.example/reports")).toBe(
      "https://harness.slimyai.xyz/reports",
    );
    expect(normalizeReportsReturnTo("https://harness.slimyai.xyz/login")).toBe(
      "https://harness.slimyai.xyz/reports",
    );
  });

  it("issues unguessable one-time owner tickets", () => {
    const issued = issueReportsSsoTicket(ownerSession, "https://harness.slimyai.xyz/reports/sessions", 1_000);
    expect(issued.ticket).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(issued.returnTo).toBe("https://harness.slimyai.xyz/reports/sessions");

    expect(verifyReportsSsoTicket(issued.ticket, issued.returnTo, 1_500)).toEqual({
      valid: true,
      owner: true,
      expired: false,
      redeemed: false,
      returnToAllowed: true,
    });
    expect(verifyReportsSsoTicket(issued.ticket, issued.returnTo, 1_600)).toEqual({
      valid: false,
      owner: false,
      expired: false,
      redeemed: true,
      returnToAllowed: true,
    });
  });

  it("enforces the configured ticket TTL", () => {
    const issued = issueReportsSsoTicket(ownerSession, "/reports", 10_000);
    const expiredAt = 10_000 + REPORTS_SSO_TICKET_TTL_SECONDS * 1000 + 1;

    expect(REPORTS_SSO_TICKET_TTL_SECONDS).toBeLessThanOrEqual(60);
    expect(verifyReportsSsoTicket(issued.ticket, issued.returnTo, expiredAt)).toEqual({
      valid: false,
      owner: false,
      expired: true,
      redeemed: false,
      returnToAllowed: true,
    });
  });

  it("does not redeem a ticket when the return target is changed", () => {
    const issued = issueReportsSsoTicket(ownerSession, "https://harness.slimyai.xyz/reports/sessions/a.json", 2_000);

    expect(verifyReportsSsoTicket(issued.ticket, "https://harness.slimyai.xyz/reports/sessions/b.json", 2_500)).toEqual({
      valid: false,
      owner: true,
      expired: false,
      redeemed: false,
      returnToAllowed: false,
    });
    expect(verifyReportsSsoTicket(issued.ticket, issued.returnTo, 2_600).valid).toBe(true);
  });

  it("does not log raw ticket values during normal issue and verify", () => {
    const logSpy = vi.spyOn(console, "log");
    const warnSpy = vi.spyOn(console, "warn");
    const errorSpy = vi.spyOn(console, "error");
    const issued = issueReportsSsoTicket(ownerSession, "/reports", 3_000);
    verifyReportsSsoTicket(issued.ticket, issued.returnTo, 3_100);

    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
