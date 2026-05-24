# Pixel Pet System

Phase 2 uses original placeholder pixel creatures rendered with CSS/HTML components.

Core components:
- `RepoPetSprite`
- `RepoPetCard`
- `RepoHabitatGrid`
- `RepoHealthBadge`
- `CareActionList`

Pet model:
- Species examples: Cyber Snail, Repo Slime, Circuit Moth, Pixel Crab, Data Frog, Terminal Bat, Gear Turtle, Market Mantis, Arcade Golem, Paper Owl.
- Stages: unknown, egg, hatchling, juvenile, mature, guardian, legendary.
- Moods: curious, happy, focused, sleepy, stressed, sick, legendary.
- Animation states: idle, wobble, hatch, happy, stressed, sleep, sick, evolve.

Identity and fairness:
- Persistent identity is deterministic from stable repo seed data.
- No runtime randomness for core pet identity.
- Care progression rewards clean/synced/maintained repos instead of raw commit volume.

Future sprite-sheet plan:
- Keep current component API and map each species/state to sprite-sheet frames.
- Add low-frame retro animations (2-6 frames per state).
- Keep placeholder fallback mode for environments without image assets.

IP policy:
- Retro virtual-pet inspired only.
- All pets and pixel art are original Slimy.ai assets.
- No official Tamagotchi character, sprite, or layout copying.
