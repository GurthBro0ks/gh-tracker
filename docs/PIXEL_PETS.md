# Pixel Pets

Phase 6D replaces placeholder glyph pets with original local SVG pixel creature sprites. The assets are intentionally built from blocky SVG shapes for recognizable silhouettes rather than letters, initials, numbers, or symbols.

## Sprite Assets
- `public/sprites/repo-pets/terminal-bat.svg`
- `public/sprites/repo-pets/market-mantis.svg`
- `public/sprites/repo-pets/repo-slime.svg`
- `public/sprites/repo-pets/paper-owl.svg`
- `public/sprites/repo-pets/pixel-crab.svg`
- `public/sprites/repo-pets/data-frog.svg`
- `public/sprites/repo-pets/unknown.svg`

## Supported Pet Types
- Terminal Bat
- Market Mantis
- Repo Slime
- Paper Owl
- Pixel Crab
- Data Frog

Species names are normalized to lowercase kebab-case before lookup, so `Terminal Bat` maps to `terminal-bat.svg`.

## Fallback Behavior
Unknown, missing, or not-yet-sprited species render `unknown.svg`. This covers optional taxonomy entries such as Cyber Snail, Circuit Moth, Gear Turtle, and Arcade Golem until dedicated art is added.

## Status Styling
- `healthy` and `focused`: lime/cyan neon glow.
- `needs-care` and `dirty`: warning magenta/rose treatment.
- `unpushed` and `alert`: amber alert treatment.
- `idle`: neutral cyan/lime panel.
- `unknown`: muted fallback panel.

Animations stay lightweight and reuse the existing small CSS idle/wobble states. Reduced-motion users get animation disabled.

## Asset Policy
All sprites are original simple SVG pixel art committed in this repository. No external URLs, fetched images, copyrighted game sprites, text glyphs, repo initials, or large binary sprite sheets are used.

## Adding A New Sprite Safely
1. Add a small original SVG under `public/sprites/repo-pets/`.
2. Keep the file transparent or dark-compatible and readable at compact size.
3. Add the kebab-case species key to `SPRITE_ASSETS` in `src/components/repo-pet-sprite.tsx`.
4. Add or update tests for the new mapping and fallback behavior.
5. Run `pnpm -r test`, `pnpm -r lint`, `pnpm -r typecheck`, and `pnpm -r build`.

## QA Checklist
- Habitat Quick View renders image sprites, not glyph-only placeholders.
- Repo Habitat cards render image sprites, not glyph-only placeholders.
- Unknown species render `unknown.svg`.
- Dirty/needs-care and unpushed/alert states visibly differ from healthy/focused states.
- Action Center, Cleanup Planner, and Heatmap inspector still render.
- Dangerous commands remain absent and commands stay copy-only.
