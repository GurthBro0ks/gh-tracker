import { cookies } from "next/headers";
import {
  REPORT_SESSION_COOKIE,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  SHARED_SESSION_DOMAIN,
} from "./cookie-domain";
import { createSessionToken, verifySessionToken, type HabitatSession } from "./token";

export { createSessionToken, verifySessionToken, type HabitatSession } from "./token";
export { REPORT_SESSION_COOKIE, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, SHARED_SESSION_DOMAIN };

export async function getSession(): Promise<HabitatSession | null> {
  try {
    const cookieStore = await cookies();
    const cookie = cookieStore.get(SESSION_COOKIE);
    if (!cookie?.value) return null;
    return verifySessionToken(cookie.value);
  } catch (error) {
    console.error("[Auth] Session read error:", error);
    return null;
  }
}

export async function setSessionCookie(
  session: HabitatSession,
  isSecure: boolean,
  sharedDomain?: string | null
): Promise<void> {
  const token = createSessionToken(session);
  const cookieStore = await cookies();
  const options = {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  } as const;
  cookieStore.set(SESSION_COOKIE, token, options);
  if (sharedDomain) {
    cookieStore.set(SESSION_COOKIE, token, {
      ...options,
      domain: sharedDomain,
    });
  }
}

export async function clearSessionCookie(
  isSecure: boolean,
  sharedDomain?: string | null
): Promise<void> {
  const cookieStore = await cookies();
  const options = {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
    maxAge: 0,
  } as const;
  for (const name of [SESSION_COOKIE, REPORT_SESSION_COOKIE]) {
    cookieStore.set(name, "", options);
    if (sharedDomain) {
      cookieStore.set(name, "", {
        ...options,
        domain: sharedDomain,
      });
    }
  }
}

export function requireOwner(session: HabitatSession | null): HabitatSession {
  if (!session) {
    throw new Error("unauthorized");
  }
  if (session.role !== "owner") {
    throw new Error("forbidden: owner access required");
  }
  return session;
}
