# Aurora Task: Preset Library Expansion

## Goal

Expand the current generator preset library toward AuroraRMG's breadth while keeping our presets curated, tested, and understandable.

## Current Starting Point

Current preset code lives in:

- `src/settings.ts`
- `src/configHelp.ts`
- `src/balancedRandomMap.ts`
- Generator tests in `tests/generator.test.ts` and related files.

Current presets include Custom, Duel, Free For All, King of the Hill, Empire Builder, Arena, Chaos, Single Hero, Blitz-Like, Jebus-Like Objective, and Anarchy-Like.

## Proposed Presets

Add a small first wave rather than copying every AuroraRMG preset:

- `PvE1v2`
- `PvE1v4`
- `PvE1v7`
- `Islands`
- `DeepWater`
- `PeacefulEconomy`
- `AsceticSurvival`
- `TwoTowns`
- `HubTreasury`

## Preset Design Rules

- Presets should be stable, named, and documented in config help.
- Each preset should set a coherent topology, player count, size, zone mix, economy, guard pressure, terrain/water, and win condition.
- Presets may be used as identity presets inside Balanced Random without overwriting user-selected simple-mode inputs unexpectedly.
- PvE presets should not imply game-level AI behavior beyond template structure.

## Implementation Notes

Likely changes:

- Extend `MapGenerationPreset` in `src/types.ts`.
- Add labels in `src/settings.ts`.
- Add preset logic in `applyGenerationPreset`.
- Add descriptions in `src/configHelp.ts`.
- Update Balanced Random's hidden identity handling in `src/balancedRandomMap.ts`.
- Add tests for generated invariants.

## Tests

For every new preset, assert:

- It generates without validation errors.
- Player count is correct.
- Zone count is within limits.
- Graph is connected.
- City Hold presets have exactly one hold city.
- Single-hero or special hero limits are correct where relevant.
- Water/island presets emit expected water/portal settings where applicable.
- TwoTowns emits two player-zone cities and matching faction behavior if enabled.

## Acceptance Criteria

- First-wave presets are visible in the UI.
- Each preset has help copy.
- Each preset has focused invariant tests.
- `npm test` and `npm run build` pass.

## Non-goals

- Do not add all 43 AuroraRMG presets in one change.
- Do not import AuroraRMG generated JSON as product presets without adapting it to our generator model.
- Do not make presets that require unverified in-game mechanics.
