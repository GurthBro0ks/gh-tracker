import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const repoRoot = process.cwd();

describe("auth hardening static checks", () => {
  it("uses current app version in dashboard adapter", () => {
    const dashboardAdapter = readFileSync(join(repoRoot, "src/lib/dashboard-adapter.ts"), "utf8");
    expect(dashboardAdapter).toContain('version: "0.6.0-phase6a-action-center"');
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

  it("settings keeps auth source and outer gate wording", () => {
    const dashboard = readFileSync(join(repoRoot, "src/components/dashboard.tsx"), "utf8");
    expect(dashboard).toContain("Auth source");
    expect(dashboard).toContain("Slimy owner email/password");
    expect(dashboard).toContain("Outer gate");
    expect(dashboard).toContain("Basic Auth still enabled");
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
