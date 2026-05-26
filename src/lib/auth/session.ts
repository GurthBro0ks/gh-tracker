import { cookies } from "next/headers";
import { createSessionToken, verifySessionToken, type HabitatSession } from "./token";

export { createSessionToken, verifySessionToken, type HabitatSession } from "./token";

const SESSION_COOKIE = "habitat_session";
const SESSION_MAX_AGE_SECONDS = parseInt(
  process.env.HABITAT_SESSION_MAX_AGE_SECONDS || "86400",
  10
);

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
  isSecure: boolean
): Promise<void> {
  const token = createSessionToken(session);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(isSecure: boolean): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
    maxAge: 0,
  });
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
