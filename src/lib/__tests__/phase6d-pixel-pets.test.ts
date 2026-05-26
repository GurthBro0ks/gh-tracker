import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { normalizeRepoPetSpriteStatus, repoPetSpriteAsset } from "../../components/repo-pet-sprite";

const repoRoot = process.cwd();

describe("phase6d pixel pet sprites", () => {
  it("maps required known pet types to local sprite assets", () => {
    expect(repoPetSpriteAsset("Terminal Bat")).toBe("/sprites/repo-pets/terminal-bat.svg");
    expect(repoPetSpriteAsset("Market Mantis")).toBe("/sprites/repo-pets/market-mantis.svg");
    expect(repoPetSpriteAsset("Repo Slime")).toBe("/sprites/repo-pets/repo-slime.svg");
    expect(repoPetSpriteAsset("Paper Owl")).toBe("/sprites/repo-pets/paper-owl.svg");
    expect(repoPetSpriteAsset("Pixel Crab")).toBe("/sprites/repo-pets/pixel-crab.svg");
    expect(repoPetSpriteAsset("Data Frog")).toBe("/sprites/repo-pets/data-frog.svg");
  });

  it("uses fallback sprite for unknown pet types", () => {
    expect(repoPetSpriteAsset("Cyber Snail")).toBe("/sprites/repo-pets/unknown.svg");
    expect(repoPetSpriteAsset(null)).toBe("/sprites/repo-pets/unknown.svg");
  });

  it("supports required status treatments", () => {
    expect(normalizeRepoPetSpriteStatus("healthy")).toBe("healthy");
    expect(normalizeRepoPetSpriteStatus("focused")).toBe("focused");
    expect(normalizeRepoPetSpriteStatus("needs-care")).toBe("needs-care");
    expect(normalizeRepoPetSpriteStatus("dirty")).toBe("dirty");
    expect(normalizeRepoPetSpriteStatus("unpushed")).toBe("unpushed");
    expect(normalizeRepoPetSpriteStatus("alert")).toBe("alert");
    expect(normalizeRepoPetSpriteStatus(undefined)).toBe("idle");
  });

  it("renders shared sprite images in quick view and habitat cards", () => {
    const dashboard = readFileSync(join(repoRoot, "src/components/dashboard.tsx"), "utf8");
    const habitat = readFileSync(join(repoRoot, "src/components/repo-habitat.tsx"), "utf8");
    const renderer = readFileSync(join(repoRoot, "src/components/repo-pet-sprite.tsx"), "utf8");
    expect(dashboard).toContain('mode="compact"');
    expect(habitat).toContain("<RepoPetSprite");
    expect(renderer).toContain("repo-pet-sprite__image");
    expect(renderer).toContain("<img");
    expect(dashboard).not.toContain("const glyph");
    expect(habitat).not.toContain("const glyph");
  });

  it("keeps action center, cleanup planner, heatmap, safety, and version regressions covered", () => {
    const dashboard = readFileSync(join(repoRoot, "src/components/dashboard.tsx"), "utf8");
    const habitat = readFileSync(join(repoRoot, "src/components/repo-habitat.tsx"), "utf8");
    const adapter = readFileSync(join(repoRoot, "src/lib/dashboard-adapter.ts"), "utf8");
    expect(dashboard).toContain("Repo Cleanup Planner");
    expect(dashboard).toContain("Activity Day Inspector");
    expect(habitat).toContain("Repo Action Center");
    expect(habitat).toContain("navigator.clipboard?.writeText");
    expect(habitat).toContain("All actions are manual operator actions. This app does not execute commands.");
    expect(adapter).toContain("0.6.2-phase6d-pixel-pets");
    expect([dashboard, habitat, adapter].join("\n").toLowerCase()).not.toContain("nousearch-hermes");
  });
});
