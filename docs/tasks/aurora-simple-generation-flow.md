# Aurora Task: Simple Generation Flow

## Goal

Upgrade the existing Balanced Random workflow into a clearer simple generation flow that can create a complete map from a small set of player-facing choices, similar to AuroraRMG's Simple Mode.

## Current Starting Point

The project already has:

- `src/balancedRandomMap.ts`
- `src/components/builder/BalancedRandomMapDialog.tsx`
- Seed support.
- Auto topology selection.
- Validation before applying the generated map.

## Proposed User Inputs

Keep the flow compact:

- Players: 2-8.
- Game type: Duel, Free-for-all, PvE, Team placeholder only if we can support it cleanly.
- Map size: Small, Medium, Large, Huge.
- Game length: Short, Medium, Long.
- Chaos level: Tame, Normal, Wild.
- Victory condition: Classic, City Hold, Tournament where valid.
- Border guards: Weak, Normal, Strong, Fortress.
- Extras: water, portals, stronger neutrals, natural expansions.
- Seed: optional number with randomize/copy affordances.

## Generator Mapping

Implement mappings in `src/balancedRandomMap.ts` or a new adjacent module:

- Same options + same seed should produce the same settings and generated design.
- Duel should default to 2 players and avoid early direct player contact.
- PvE should increase AI/player count safely and bias toward larger maps.
- Tournament should force exactly 2 players and isolated lanes.
- City Hold should ensure a valid hub, triangle center, or neutral castle target.
- Huge sizes should be clearly marked experimental and capped by our current validation limits.
- Border guard labels should map to `zoneCfg.borderGuardStrengthPercent`.

## UI Changes

Modify `BalancedRandomMapDialog`:

- Rename or visually present it as the simple generation path if that fits product language.
- Keep advanced neutral split controls behind `details`.
- Show generated summary: map size, total zones, topology, seed, border guard level, victory condition.
- Show validation errors/warnings before the Generate button.

## Tests

Update or add tests around `buildBalancedRandomMapSettings`:

- Same seed and options produce stable settings.
- Blank seed produces a numeric seed.
- City Hold always creates a valid target path.
- Tournament forces 2 players and tournament rules.
- Border guard labels map to expected numeric ranges.
- Huge maps produce experimental-size warnings but not errors.

## Acceptance Criteria

- A new user can generate a reasonable map without opening Advanced.
- Advanced overrides remain available.
- The generated map imports into the board and validates.
- Focused tests, `npm test`, and `npm run build` pass.

## Non-goals

- Do not add a separate landing page.
- Do not support phone-sized map-builder layouts.
- Do not guarantee generated maps are playable in game.
