import { createHmac, timingSafeEqual } from "crypto";

const SESSION_SECRET =
  process.env.HABITAT_SESSION_SECRET ||
  process.env.GH_TRACKER_SESSION_SEED ||
  process.env.HOSTNAME ||
  "gh-tracker-habitat-session-fallback-seed";

export interface HabitatSession {
  sub: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

function base64urlEncode(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function base64urlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function signPayload(payload: string): string {
  const hmac = createHmac("sha256", SESSION_SECRET);
  hmac.update(payload);
  return hmac.digest("base64url");
}

function verifySignature(payload: string, signature: string): boolean {
  const expected = signPayload(payload);
  const expectedBuf = Buffer.from(expected, "base64url");
  const actualBuf = Buffer.from(signature, "base64url");
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}

export function createSessionToken(session: HabitatSession): string {
  const payload = base64urlEncode(JSON.stringify(session));
  const signature = signPayload(payload);
  return `${payload}.${signature}`;
}

export function verifySessionToken(token: string): HabitatSession | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  if (!verifySignature(payload, signature)) return null;
  try {
    const session: HabitatSession = JSON.parse(base64urlDecode(payload));
    if (session.exp < Math.floor(Date.now() / 1000)) return null;
    return session;
  } catch {
    return null;
  }
}
