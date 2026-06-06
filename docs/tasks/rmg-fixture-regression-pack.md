# RMG Task: Fixture-Backed Regression Pack

## Goal

Create a compact fixture pack that locks down known working and known invalid RMG patterns from the BattleCity and Batthlehem learnings.

## Fixture Scope

Add or update fixtures for:

- Valid 2-player BattleCity-style map at `160x160`.
- Valid 3-player Batthlehem-style shared-center map at `208x208`.
- Invalid empty zone with `crossroadsPosition`.
- Invalid City Hold with no real city.
- Invalid City Hold with only ruins.
- Invalid missing `mandatoryContent` reference.
- Invalid missing `contentCountLimits` reference.
- Invalid road endpoint pointing to a missing connection.
- Invalid branch with third-player mandatory content not cloned.
- Invalid branch with faction matching pointed at the wrong spawn.

## Output Location

Use existing fixture conventions under:

- `tests/fixtures`

If large generated examples are needed for manual testing, put them under a generated or temporary path first and discuss before committing them as long-term fixtures.

## Implementation Notes

- Keep invalid fixtures as small as possible while preserving the specific failure.
- Prefer fixture names that describe the invariant being tested.
- Do not overwrite official reference templates.
- If BattleCity or Batthlehem source files are not already in the repo, create minimal representative fixtures rather than relying on external local files.

## Tests

Add Vitest coverage that:

- Parses every new fixture.
- Runs structural validation on every fixture.
- Asserts valid fixtures produce no blocking diagnostics.
- Asserts each invalid fixture produces the intended diagnostic code.
- Imports valid generated-style fixtures into the app model if supported by existing helpers.

## Acceptance Criteria

- Known valid patterns are protected from regression.
- Known invalid patterns fail for the intended reason.
- Fixture names and diagnostics make failures easy to understand.
- `npm test` and `npm run build` pass.

## Non-goals

- Do not use fixture validation as proof of in-game playability.
- Do not add noisy generated fixture churn without review.
