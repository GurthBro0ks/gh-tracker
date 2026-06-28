import { createHash, randomBytes } from "crypto";
import type { HabitatSession } from "./token";

const REPORTS_ORIGIN = "https://harness.slimyai.xyz";
const DEFAULT_TICKET_TTL_SECONDS = 60;

function configuredTicketTtlSeconds(): number {
  const parsed = Number.parseInt(process.env.REPORTS_SSO_TICKET_TTL_SECONDS || String(DEFAULT_TICKET_TTL_SECONDS), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_TICKET_TTL_SECONDS;
  return Math.min(parsed, DEFAULT_TICKET_TTL_SECONDS);
}

export const REPORTS_SSO_TICKET_TTL_SECONDS = configuredTicketTtlSeconds();

type ReportsSsoTicketRecord = {
  returnTo: string;
  owner: boolean;
  issuedAtMs: number;
  expiresAtMs: number;
};

export type ReportsSsoTicketVerification = {
  valid: boolean;
  owner: boolean;
  expired: boolean;
  redeemed: boolean;
  returnToAllowed: boolean;
};

const issuedTickets = new Map<string, ReportsSsoTicketRecord>();
const redeemedTickets = new Map<string, number>();

function hashTicket(ticket: string): string {
  return createHash("sha256").update(ticket).digest("base64url");
}

function pruneTickets(nowMs: number): void {
  for (const [hash, record] of issuedTickets.entries()) {
    if (record.expiresAtMs <= nowMs) issuedTickets.delete(hash);
  }
  for (const [hash, expiresAtMs] of redeemedTickets.entries()) {
    if (expiresAtMs <= nowMs) redeemedTickets.delete(hash);
  }
}

export function normalizeReportsReturnTo(raw: string | null | undefined): string {
  if (!raw) return new URL("/reports", REPORTS_ORIGIN).toString();

  if (raw.startsWith("/") && !raw.startsWith("//")) {
    return raw.startsWith("/reports")
      ? new URL(raw, REPORTS_ORIGIN).toString()
      : new URL("/reports", REPORTS_ORIGIN).toString();
  }

  try {
    const parsed = new URL(raw);
    if (parsed.origin === REPORTS_ORIGIN && parsed.pathname.startsWith("/reports")) {
      return parsed.toString();
    }
  } catch {
    return new URL("/reports", REPORTS_ORIGIN).toString();
  }

  return new URL("/reports", REPORTS_ORIGIN).toString();
}

export function issueReportsSsoTicket(
  session: HabitatSession,
  rawReturnTo: string | null | undefined,
  nowMs = Date.now(),
): { ticket: string; returnTo: string; expiresAtMs: number } {
  pruneTickets(nowMs);
  const ticket = randomBytes(32).toString("base64url");
  const returnTo = normalizeReportsReturnTo(rawReturnTo);
  const expiresAtMs = nowMs + REPORTS_SSO_TICKET_TTL_SECONDS * 1000;
  issuedTickets.set(hashTicket(ticket), {
    returnTo,
    owner: session.role === "owner",
    issuedAtMs: nowMs,
    expiresAtMs,
  });
  return { ticket, returnTo, expiresAtMs };
}

export function verifyReportsSsoTicket(
  ticket: string | null | undefined,
  rawReturnTo: string | null | undefined,
  nowMs = Date.now(),
): ReportsSsoTicketVerification {
  const normalizedReturnTo = normalizeReportsReturnTo(rawReturnTo);
  if (!ticket) {
    pruneTickets(nowMs);
    return { valid: false, owner: false, expired: false, redeemed: false, returnToAllowed: false };
  }

  const hash = hashTicket(ticket);
  const redeemedExpiresAtMs = redeemedTickets.get(hash);
  if (redeemedExpiresAtMs && redeemedExpiresAtMs > nowMs) {
    return { valid: false, owner: false, expired: false, redeemed: true, returnToAllowed: true };
  }
  if (redeemedExpiresAtMs) redeemedTickets.delete(hash);

  const record = issuedTickets.get(hash);
  if (!record) {
    pruneTickets(nowMs);
    return { valid: false, owner: false, expired: false, redeemed: false, returnToAllowed: false };
  }

  if (record.expiresAtMs <= nowMs) {
    issuedTickets.delete(hash);
    return {
      valid: false,
      owner: false,
      expired: true,
      redeemed: false,
      returnToAllowed: record.returnTo === normalizedReturnTo,
    };
  }

  pruneTickets(nowMs);

  const returnToAllowed = record.returnTo === normalizedReturnTo;
  if (!returnToAllowed || !record.owner) {
    return {
      valid: false,
      owner: record.owner,
      expired: false,
      redeemed: false,
      returnToAllowed,
    };
  }

  issuedTickets.delete(hash);
  redeemedTickets.set(hash, record.expiresAtMs + REPORTS_SSO_TICKET_TTL_SECONDS * 1000);
  return {
    valid: true,
    owner: true,
    expired: false,
    redeemed: false,
    returnToAllowed: true,
  };
}

export function clearReportsSsoTicketsForTests(): void {
  issuedTickets.clear();
  redeemedTickets.clear();
}
