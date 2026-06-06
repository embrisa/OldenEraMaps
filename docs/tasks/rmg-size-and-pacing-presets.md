# RMG Task: Size And Pacing Presets

## Goal

Encode known-safe map sizes and make size recommendations match player count and route structure.

## Desired Behavior

Recognize known-safe sizes:

- `160x160`
- `176x176`
- `208x208`

Warn on unsupported or suspicious sizes:

- Any size not divisible by 16.
- `214x214`, based on observed generation followed by load crash.

Recommend sizes by pacing:

- 2-player BattleCity-style duel: prefer `160x160` for tight contact and objective pressure.
- 2-player larger duel: allow `176x176` when more breathing room is desired.
- 3-player shared-center map: allow `208x208` because three full lanes and a shared center need more space.

When size changes:

- Warn that smaller maps create earlier contact and may require retesting guard scaling.
- Warn that larger maps can delay pressure and may require objective or reward pacing adjustments.

## Implementation Notes

- Keep size validation and size recommendation separate.
- Validation should block known invalid grid sizes.
- Recommendation should be a non-blocking diagnostic unless the size is structurally invalid.
- Surface this in generation/export flows where users choose player count and layout.

## Tests

Add focused Vitest coverage for:

- `160x160`, `176x176`, and `208x208` pass structural grid validation.
- `214x214` produces a warning or error according to the final policy.
- Non-16-grid sizes fail structural validation.
- 2-player duel recommends `160x160` or `176x176`.
- 3-player shared-center recommends `208x208`.
- Size change diagnostics mention pacing retest needs.

## Acceptance Criteria

- Known-safe sizes are documented in code and tests.
- Suspicious sizes produce actionable diagnostics.
- Preset recommendations align with player count and layout.
- `npm test` and `npm run build` pass.

## Non-goals

- Do not support phone-sized builder layouts as part of this task.
- Do not infer exact in-game travel time from map dimensions.
