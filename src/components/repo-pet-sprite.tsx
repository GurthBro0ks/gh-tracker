export type RepoPetSpriteStatus = "healthy" | "focused" | "needs-care" | "dirty" | "unpushed" | "alert" | "idle" | "unknown";

const UNKNOWN_SPRITE = "/sprites/repo-pets/unknown.svg";

const SPRITE_ASSETS: Record<string, string> = {
  "terminal-bat": "/sprites/repo-pets/terminal-bat.svg",
  "market-mantis": "/sprites/repo-pets/market-mantis.svg",
  "repo-slime": "/sprites/repo-pets/repo-slime.svg",
  "paper-owl": "/sprites/repo-pets/paper-owl.svg",
  "pixel-crab": "/sprites/repo-pets/pixel-crab.svg",
  "data-frog": "/sprites/repo-pets/data-frog.svg",
};

function speciesKey(species: string | null | undefined) {
  return (species ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function repoPetSpriteAsset(species: string | null | undefined) {
  return SPRITE_ASSETS[speciesKey(species)] ?? UNKNOWN_SPRITE;
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
}: {
  species: string | null | undefined;
  state?: string;
  status?: RepoPetSpriteStatus;
  mode?: "full" | "compact";
  className?: string;
}) {
  const asset = repoPetSpriteAsset(species);
  const normalizedStatus = normalizeRepoPetSpriteStatus(asset === UNKNOWN_SPRITE ? "unknown" : status);
  const displayName = species?.trim() ? species.trim() : "Unknown repo pet";

  return (
    <div className={`repo-pet-sprite repo-pet-sprite--${mode} repo-pet-sprite--${normalizedStatus} sprite-${state} ${className}`.trim()} data-pet-sprite={speciesKey(species) || "unknown"}>
      <img className="repo-pet-sprite__image" src={asset} alt={`${displayName} pixel pet sprite`} draggable={false} />
    </div>
  );
}
