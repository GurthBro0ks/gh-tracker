import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { normalizeRepoPetSpriteStatus, repoPetSpriteAsset, repoPetSpriteStageAsset } from "../../components/repo-pet-sprite";
import { calculatePetMaturityScore, deriveRepoHealth, generateRepoPet, petStageFromMaturityScore } from "../repo-habitat";

const repoRoot = process.cwd();

describe("phase6d pixel pet sprites", () => {
  const petTypes = ["terminal-bat", "market-mantis", "repo-slime", "paper-owl", "pixel-crab", "data-frog", "gear-turtle", "unknown"] as const;
  const stages = ["egg", "hatchling", "juvenile", "adult"] as const;
  const stagedCreatureSpriteFiles = [
    ["terminal-bat/adult.svg", ["wings", "ears", "fangs"]],
    ["market-mantis/adult.svg", ["raptor-arms", "forearm-blades", "antennae"]],
    ["repo-slime/adult.svg", ["slime-body", "shine", "neon-drip"]],
    ["paper-owl/adult.svg", ["ear-tufts", "face-discs", "beak-and-feet"]],
    ["pixel-crab/adult.svg", ["claws", "eye-stalks", "front-legs"]],
    ["data-frog/adult.svg", ["hind-legs", "eye-bumps", "data-belly"]],
    ["unknown/adult.svg", ["hood", "creature-face", "antennae"]],
  ] as const;

  it("maps required known pet types to local sprite assets", () => {
    expect(repoPetSpriteAsset("Terminal Bat")).toBe("/sprites/repo-pets/terminal-bat/adult.svg");
    expect(repoPetSpriteAsset("Market Mantis")).toBe("/sprites/repo-pets/market-mantis/adult.svg");
    expect(repoPetSpriteAsset("Repo Slime")).toBe("/sprites/repo-pets/repo-slime/adult.svg");
    expect(repoPetSpriteAsset("Paper Owl")).toBe("/sprites/repo-pets/paper-owl/adult.svg");
    expect(repoPetSpriteAsset("Pixel Crab")).toBe("/sprites/repo-pets/pixel-crab/adult.svg");
    expect(repoPetSpriteAsset("Data Frog")).toBe("/sprites/repo-pets/data-frog/adult.svg");
    expect(repoPetSpriteAsset("Gear Turtle")).toBe("/sprites/repo-pets/gear-turtle/adult.svg");
    expect(repoPetSpriteStageAsset("Data Frog", "egg")).toBe("/sprites/repo-pets/data-frog/egg.svg");
    expect(repoPetSpriteStageAsset("Terminal Bat", "juvenile")).toBe("/sprites/repo-pets/terminal-bat/juvenile.svg");
  });

  it("uses fallback sprite for unknown pet types", () => {
    expect(repoPetSpriteAsset("Cyber Snail")).toBe("/sprites/repo-pets/unknown/adult.svg");
    expect(repoPetSpriteAsset(null)).toBe("/sprites/repo-pets/unknown/adult.svg");
    expect(repoPetSpriteStageAsset("Cyber Snail", "hatchling")).toBe("/sprites/repo-pets/unknown/hatchling.svg");
  });

  it("uses creature-shaped adult SVG assets instead of text glyph placeholders", () => {
    for (const [fileName, requiredParts] of stagedCreatureSpriteFiles) {
      const asset = readFileSync(join(repoRoot, "public/sprites/repo-pets", fileName), "utf8");
      expect(asset).toContain("shape-rendering=\"crispEdges\"");
      expect(asset).toMatch(/viewBox="0 0 (64|96) (64|96)"/);
      expect(asset).toContain("phase6d-creature-art");
      expect(asset).toMatch(/<(rect|path|polygon|circle|ellipse)\b/);
      expect(asset).not.toMatch(/<text\b/i);
      expect(asset).not.toMatch(/font-family|font-size/i);
      expect(asset).not.toMatch(/>\s*[@#^A-Za-z0-9?]\s*</);
      const tagNames = [...asset.matchAll(/<\/?([a-zA-Z][\w:-]*)\b/g)].map((match) => match[1]);
      expect(tagNames.every((tag) => ["svg", "g", "rect", "path", "polygon", "circle", "ellipse"].includes(tag))).toBe(true);
      for (const part of requiredParts) {
        expect(asset).toContain(part);
      }
    }
  });

  it("ships egg, hatchling, juvenile, and adult assets for every pet type", () => {
    for (const petType of petTypes) {
      for (const stage of stages) {
        const asset = readFileSync(join(repoRoot, "public/sprites/repo-pets", petType, `${stage}.svg`), "utf8");
        expect(asset).toContain("phase6d1-pet-evolution");
        expect(asset).not.toMatch(/<text\b/i);
        expect(asset).not.toMatch(/font-family|font-size/i);
        expect(asset).not.toMatch(/>\s*[@#^A-Za-z0-9?]\s*</);
      }
    }
  });

  it("calculates deterministic evolution stages from repo maturity score", () => {
    expect(petStageFromMaturityScore(0)).toBe("egg");
    expect(petStageFromMaturityScore(2)).toBe("egg");
    expect(petStageFromMaturityScore(3)).toBe("hatchling");
    expect(petStageFromMaturityScore(16)).toBe("juvenile");
    expect(petStageFromMaturityScore(61)).toBe("adult");
    expect(calculatePetMaturityScore({ commitsTotal: 0, recentActivity: 0, healthScore: 90, githubSynced: true })).toBe(0);
    expect(petStageFromMaturityScore(calculatePetMaturityScore({ commitsTotal: 1, recentActivity: 1, healthScore: 80, githubSynced: false }))).toBe("hatchling");
    expect(petStageFromMaturityScore(calculatePetMaturityScore({ commitsTotal: 12, recentActivity: 3, healthScore: 80, githubSynced: true }))).toBe("juvenile");
    expect(petStageFromMaturityScore(calculatePetMaturityScore({ commitsTotal: 54, recentActivity: 2, healthScore: 90, githubSynced: true }))).toBe("adult");
  });

  it("documents visible creature features for manual visual verification", () => {
    const proof = readFileSync(join(repoRoot, "sprite_visual_check.md"), "utf8");
    for (const petType of petTypes) {
      expect(proof).toContain(petType);
    }
    expect(proof).toContain("not a letter, number, question mark, or glyph placeholder");
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
    expect(dashboard).toContain("stage={row.pet.stage}");
    expect(habitat).toContain("<RepoPetSprite");
    expect(habitat).toContain("Species: ${model.petSpecies}");
    expect(habitat).toContain("Stage: ${model.petStage}");
    expect(renderer).toContain("repo-pet-sprite__image");
    expect(renderer).toContain("data-pet-stage");
    expect(renderer).toContain("<img");
    expect(renderer).toContain("/sprites/repo-pets/${key}/${normalizeRepoPetSpriteStage(stage)}.svg");
    expect(dashboard).not.toContain("const glyph");
    expect(habitat).not.toContain("const glyph");
    expect(dashboard).not.toMatch(/<span>\{glyph\}<\/span>/);
    expect(habitat).not.toMatch(/<span>\{glyph\}<\/span>/);
  });

  it("keeps action center, cleanup planner, heatmap, safety, and version regressions covered", () => {
    const dashboard = readFileSync(join(repoRoot, "src/components/dashboard.tsx"), "utf8");
    const habitat = readFileSync(join(repoRoot, "src/components/repo-habitat.tsx"), "utf8");
    const adapter = readFileSync(join(repoRoot, "src/lib/dashboard-adapter.ts"), "utf8");
    const globals = readFileSync(join(repoRoot, "src/app/globals.css"), "utf8");
    expect(dashboard).toContain("Maintenance Queue");
    expect(dashboard).toContain("Repo Locations");
    expect(dashboard).toContain("dashboard-shell");
    expect(dashboard).toContain("repo-locations-layout");
    expect(dashboard).toContain("repo-location-mobile-card");
    expect(dashboard).toContain("repo-location-line");
    expect(dashboard).toContain("Activity Day Inspector");
    expect(dashboard).toContain("Activity Heatmap");
    expect(dashboard).toContain("Tap a day to inspect activity.");
    expect(dashboard).toContain("HEATMAP_STATUS");
    expect(dashboard).toContain("rendered_visible");
    expect(dashboard).toContain("LOCAL_SNAPSHOT_AGE");
    expect(dashboard).toContain("LOCAL_SNAPSHOT_FRESHNESS");
    expect(dashboard).toContain("LOCAL_SNAPSHOT_STALE_WARNING");
    expect(habitat).toContain("Repo Action Center");
    expect(habitat).toContain("Evolution:");
    expect(habitat).toContain("navigator.clipboard?.writeText");
    expect(habitat).toContain("All actions are manual operator actions. This app does not execute commands.");
    expect(dashboard).toContain("MobileCompactSection");
    expect(dashboard).toContain("COMPACT_SECTIONS_ADDED");
    expect(dashboard).toContain("MOBILE_DEFAULT_COMPACT");
    expect(dashboard).toContain("EXPAND_CONTROLS_VISIBLE");
    expect(dashboard).toContain("PET_EVOLUTION_REGRESSION");
    expect(dashboard).toContain("ACTION_CENTER_REGRESSION");
    expect(dashboard).toContain("HEATMAP_REGRESSION");
    expect(dashboard).toContain("CLEANUP_PLANNER_REGRESSION");
    expect(globals).toContain("overflow-x: hidden");
    expect(globals).toContain(".repo-locations-layout");
    expect(globals).toContain("overflow-wrap: anywhere");
    expect(adapter).toContain("0.6.4-phase6d2-pet-animation-health-wording");
    expect([dashboard, habitat, adapter].join("\n").toLowerCase()).not.toContain("nousearch-hermes");
  });

  it("keeps deterministic pet distribution diverse across current canonical repos", () => {
    const aggregate = JSON.parse(readFileSync(join(repoRoot, "data/snapshots/aggregate/latest.json"), "utf8")) as {
      repos: Array<{ id: string; owner: string; name: string; canonicalRemote: string }>;
    };
    const speciesCounts = new Map<string, number>();
    for (const repo of aggregate.repos) {
      const signal = {
        machineId: "nuc1",
        dirty: false,
        stagedCount: 0,
        unstagedCount: 0,
        untrackedCount: 0,
        aheadCount: 0,
        behindCount: 0,
        commitsToday: 1,
        commitsLast7Days: 3,
        commitsLast30Days: 9,
      };
      const pet = generateRepoPet(
        {
          repoId: repo.id,
          owner: repo.owner,
          name: repo.name,
          canonicalRemote: repo.canonicalRemote,
          primaryLanguage: null,
        },
        signal,
        deriveRepoHealth(signal),
      );
      speciesCounts.set(pet.species, (speciesCounts.get(pet.species) ?? 0) + 1);
      expect(pet.species).not.toBe("Cyber Snail");
      expect(pet.species).not.toBe("Circuit Moth");
      expect(pet.species).not.toBe("Arcade Golem");
    }

    const pixelCrabCount = speciesCounts.get("Pixel Crab") ?? 0;
    expect(pixelCrabCount).toBeLessThanOrEqual(3);
    expect(speciesCounts.size).toBeGreaterThanOrEqual(5);
  });

  it("keeps stable semantic assignment for known repo names", () => {
    const baseSignal = {
      machineId: "nuc1",
      dirty: false,
      stagedCount: 0,
      unstagedCount: 0,
      untrackedCount: 0,
      aheadCount: 0,
      behindCount: 0,
      commitsToday: 2,
      commitsLast7Days: 4,
      commitsLast30Days: 12,
    };
    const health = deriveRepoHealth(baseSignal);
    expect(
      generateRepoPet(
        {
          repoId: "gurthbro0ks-apify-market-scanner",
          owner: "GurthBro0ks",
          name: "apify-market-scanner",
          canonicalRemote: "git@github.com:GurthBro0ks/apify-market-scanner.git",
          primaryLanguage: null,
        },
        baseSignal,
        health,
      ).species,
    ).toBe("Market Mantis");
    expect(
      generateRepoPet(
        {
          repoId: "gurthbro0ks-gh-tracker",
          owner: "GurthBro0ks",
          name: "gh-tracker",
          canonicalRemote: "git@github.com:GurthBro0ks/gh-tracker.git",
          primaryLanguage: null,
        },
        baseSignal,
        health,
      ).species,
    ).toBe("Data Frog");
    expect(
      generateRepoPet(
        {
          repoId: "gurthbro0ks-sbuild",
          owner: "GurthBro0ks",
          name: "sbuild",
          canonicalRemote: "git@github.com:GurthBro0ks/sbuild.git",
          primaryLanguage: null,
        },
        baseSignal,
        health,
      ).species,
    ).toBe("Gear Turtle");
  });
});
