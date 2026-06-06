# Aurora Task: Generated Template Fixture Pack

## Goal

Create a small regenerated fixture pack that behaves like AuroraRMG's `ReadyMaps` directory: a convenient set of exported templates that demonstrates supported formats and locks key invariants in tests.

## Output Location

Use a location that does not conflict with official/reference fixtures:

- `generated/aurora-quality-map-pack/`

If committed fixtures are desired later, create a separate discussion before moving files into `tests/fixtures`.

## Proposed Pack

Generate one template each for:

- Standard 1v1.
- Single Hero duel.
- City Hold hub.
- Four-player FFA.
- Six-player ladder or shared web.
- PvE 1v4 if that preset exists.
- Islands or Deep Water if that preset exists.
- Ascetic Survival if that preset exists.

## Script

Add a reproducible script if this pack becomes a recurring artifact:

- `scripts/generate-aurora-quality-map-pack.ts` or similar.
- Hardcode map names, seeds, and settings in a small table.
- Write into `generated/aurora-quality-map-pack/`.
- Include a README in the generated folder explaining validation limits.

## Tests

Add a Vitest file that can validate the generated pack when present:

- Parse every `.rmg.json`.
- Import into design with `templateToDesign`.
- Run `validateDesign`.
- Assert direct/portal connectivity.
- Assert expected player count and win condition.
- Assert preset-specific invariants, such as hero caps or hold city count.

## Acceptance Criteria

- Pack generation is deterministic.
- Generated files are not written into game install paths.
- Generated files do not overwrite official examples or golden fixtures.
- Tests cover generated pack invariants.
- `npm test` and `npm run build` pass.

## Non-goals

- Do not treat generated fixture validation as in-game playability validation.
- Do not add large binary preview images unless there is a separate need.
- Do not commit noisy generated churn without review.
