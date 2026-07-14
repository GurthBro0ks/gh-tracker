import { createHmac, timingSafeEqual } from "crypto";

const MIN_PRODUCTION_SECRET_LENGTH = 32;
const TEST_ONLY_SECRET = "gh-tracker-habitat-session-test-only-seed";

export function resolveSessionSecret(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const dedicated = env.HABITAT_SESSION_SECRET;

  if (env.NODE_ENV === "production") {
    if (!dedicated || dedicated.trim().length === 0) {
      throw new Error(
        "HABITAT_SESSION_SECRET is required in production and must not be blank. " +
          "Refusing to sign or verify session tokens with an insecure fallback.",
      );
    }
    if (dedicated.length < MIN_PRODUCTION_SECRET_LENGTH) {
      throw new Error(
        `HABITAT_SESSION_SECRET must be at least ${MIN_PRODUCTION_SECRET_LENGTH} characters ` +
          `in production (got ${dedicated.length}). Refusing to sign or verify session tokens ` +
          "with a weak secret.",
      );
    }
    return dedicated;
  }

  // Non-production (test/development): use a dedicated secret if one is set,
  // otherwise a fixed, clearly-labeled test-only seed. Never reachable when
  // NODE_ENV=production -- there is no machine-identity or static-default
  // fallback left in that path.
  return dedicated && dedicated.trim().length > 0 ? dedicated : TEST_ONLY_SECRET;
}

// Resolved lazily, on first actual sign/verify call, not at module import
// time -- Next.js's build-time page-data collection imports route modules
// (which transitively import this one) without invoking their functions, so
// an eager top-level throw here would make `next build` itself require
// HABITAT_SESSION_SECRET. The real fail-closed boundary is the running
// server: every authenticated request calls verifySessionToken via
// proxy.ts, so a missing/weak secret still blocks all traffic immediately
// once the process is actually serving requests.
let cachedSecret: string | undefined;
function getSessionSecret(): string {
  if (cachedSecret === undefined) {
    cachedSecret = resolveSessionSecret();
  }
  return cachedSecret;
}

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
  const hmac = createHmac("sha256", getSessionSecret());
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
