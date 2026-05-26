export type RepoPetSpriteStatus = "healthy" | "focused" | "needs-care" | "dirty" | "unpushed" | "alert" | "idle" | "unknown";
export type RepoPetSpriteStage = "egg" | "hatchling" | "juvenile" | "adult";

const UNKNOWN_SPECIES = "unknown";

const STAGED_SPECIES = new Set(["terminal-bat", "market-mantis", "repo-slime", "paper-owl", "pixel-crab", "data-frog"]);

function speciesKey(species: string | null | undefined) {
  return (species ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function repoPetSpriteAsset(species: string | null | undefined) {
  const key = STAGED_SPECIES.has(speciesKey(species)) ? speciesKey(species) : UNKNOWN_SPECIES;
  return `/sprites/repo-pets/${key}/adult.svg`;
}

export function normalizeRepoPetSpriteStage(stage: string | null | undefined): RepoPetSpriteStage {
  if (stage === "egg" || stage === "hatchling" || stage === "juvenile" || stage === "adult") return stage;
  return "adult";
}

export function repoPetSpriteStageAsset(species: string | null | undefined, stage: string | null | undefined) {
  const key = STAGED_SPECIES.has(speciesKey(species)) ? speciesKey(species) : UNKNOWN_SPECIES;
  return `/sprites/repo-pets/${key}/${normalizeRepoPetSpriteStage(stage)}.svg`;
}

export function normalizeRepoPetSpriteStatus(status: RepoPetSpriteStatus | null | undefined): RepoPetSpriteStatus {
  return status ?? "idle";
}

export function RepoPetSprite({
  species,
  state = "idle",
  status = "idle",
  mode = "full",
  className = "",
  stage = "adult",
}: {
  species: string | null | undefined;
  state?: string;
  status?: RepoPetSpriteStatus;
  mode?: "full" | "compact";
  className?: string;
  stage?: string | null;
}) {
  const speciesSlug = speciesKey(species);
  const asset = repoPetSpriteStageAsset(species, stage);
  const normalizedStage = normalizeRepoPetSpriteStage(stage);
  const normalizedStatus = normalizeRepoPetSpriteStatus(STAGED_SPECIES.has(speciesSlug) ? status : "unknown");
  const displayName = species?.trim() ? species.trim() : "Unknown repo pet";

  return (
    <div className={`repo-pet-sprite repo-pet-sprite--${mode} repo-pet-sprite--${normalizedStatus} repo-pet-sprite--stage-${normalizedStage} sprite-${state} ${className}`.trim()} data-pet-sprite={speciesSlug || "unknown"} data-pet-stage={normalizedStage}>
      <img className="repo-pet-sprite__image" src={asset} alt={`${displayName} ${normalizedStage} pixel pet sprite`} draggable={false} />
    </div>
  );
}
