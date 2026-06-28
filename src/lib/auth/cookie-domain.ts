export const SHARED_SESSION_DOMAIN = ".slimyai.xyz";
export const SESSION_COOKIE = "habitat_session";
export const SESSION_MAX_AGE_SECONDS = parseInt(
  process.env.HABITAT_SESSION_MAX_AGE_SECONDS || "86400",
  10
);

export function getSharedSessionCookieDomain(host: string | null): string | null {
  const hostname = (host || "").split(":")[0].toLowerCase();
  if (hostname === "slimyai.xyz" || hostname.endsWith(".slimyai.xyz")) {
    return SHARED_SESSION_DOMAIN;
  }
  return null;
}
