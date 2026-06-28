import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const repoRoot = process.cwd();

describe("auth hardening static checks", () => {
  it("uses current app version in dashboard adapter", () => {
    const dashboardAdapter = readFileSync(join(repoRoot, "src/lib/dashboard-adapter.ts"), "utf8");
    const appVersion = readFileSync(join(repoRoot, "src/lib/app-version.ts"), "utf8");
    const versionMatch = appVersion.match(/APP_VERSION\s*=\s*"([^"]+)"/);
    expect(versionMatch).not.toBeNull();
    expect(dashboardAdapter).toContain(`version: APP_VERSION`);
    expect(dashboardAdapter).toContain(`import { APP_VERSION } from "@/lib/app-version"`);
  });

  it("keeps forgot/reset link pointed to Slimy auth flow", () => {
    const loginPage = readFileSync(join(repoRoot, "src/app/login/page.tsx"), "utf8");
    expect(loginPage).toContain("https://slimyai.xyz/auth/forgot-password");
  });

  it("does not add fake local reset flow", () => {
    const proxyFile = readFileSync(join(repoRoot, "proxy.ts"), "utf8");
    expect(proxyFile).not.toContain("/api/auth/reset-password");
    expect(proxyFile).not.toContain("/reset-password");
  });

  it("settings keeps auth source and owner login gate wording", () => {
    const dashboard = readFileSync(join(repoRoot, "src/components/dashboard.tsx"), "utf8");
    expect(dashboard).toContain("Auth source");
    expect(dashboard).toContain("Slimy owner email/password");
    expect(dashboard).toContain("Access gate");
    expect(dashboard).toContain("Owner Login active");
  });

  it("routes sign out through Harness Reports logout to clear report session cookies", () => {
    const dashboard = readFileSync(join(repoRoot, "src/components/dashboard.tsx"), "utf8");
    expect(dashboard).toContain("REPORTS_LOGOUT_URL");
    expect(dashboard).toContain("https://harness.slimyai.xyz/api/session/logout");
    expect(dashboard).toContain("returnTo=https%3A%2F%2Fhabitat.slimyai.xyz%2Flogin");
    expect(dashboard).toContain("window.location.href = REPORTS_LOGOUT_URL");
  });

  it("issues and clears the shared Habitat owner cookie for Reports SSO", () => {
    const cookieDomain = readFileSync(join(repoRoot, "src/lib/auth/cookie-domain.ts"), "utf8");
    const session = readFileSync(join(repoRoot, "src/lib/auth/session.ts"), "utf8");
    const loginRoute = readFileSync(join(repoRoot, "src/app/api/auth/login/route.ts"), "utf8");
    const logoutRoute = readFileSync(join(repoRoot, "src/app/api/auth/logout/route.ts"), "utf8");
    const proxyFile = readFileSync(join(repoRoot, "proxy.ts"), "utf8");

    expect(cookieDomain).toContain('SESSION_COOKIE = "habitat_session"');
    expect(cookieDomain).toContain('REPORT_SESSION_COOKIE = "slimy_session"');
    expect(cookieDomain).toContain('SHARED_SESSION_DOMAIN = ".slimyai.xyz"');
    expect(cookieDomain).toContain("getSecureSharedSessionCookieDomain");
    expect(session).toContain("domain: sharedDomain");
    expect(session).toContain("REPORT_SESSION_COOKIE");
    expect(loginRoute).toContain("getSecureSharedSessionCookieDomain");
    expect(logoutRoute).toContain("getSecureSharedSessionCookieDomain");
    expect(logoutRoute).toContain("getSessionCookieClearTargets(sharedDomain)");
    expect(logoutRoute).toContain('response.headers.append("Set-Cookie"');
    expect(proxyFile).toContain("verifySessionToken(token)");
    expect(proxyFile).toContain("response.cookies.set(SESSION_COOKIE, token");
    expect(proxyFile).toContain("domain: sharedDomain");
  });

  it("keeps Harness report links same-tab from the Habitat dashboard", () => {
    const harnessDashboard = readFileSync(join(repoRoot, "src/components/harness-dashboard.tsx"), "utf8");
    expect(harnessDashboard).toContain("Mission-Control Reports");
    expect(harnessDashboard).not.toContain('target="_blank"');
    expect(harnessDashboard).not.toContain("rel=\"noreferrer\"");
  });

  it("does not include nousearch hermes marker", () => {
    const files = [
      readFileSync(join(repoRoot, "src/components/dashboard.tsx"), "utf8"),
      readFileSync(join(repoRoot, "src/app/login/page.tsx"), "utf8"),
      readFileSync(join(repoRoot, "src/lib/dashboard-adapter.ts"), "utf8"),
    ].join("\n");
    expect(files.toLowerCase()).not.toContain("nousearch-hermes-agent");
  });
});
