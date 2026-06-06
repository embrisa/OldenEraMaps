# Aurora Task: Post-generation Map Analysis

## Goal

Add a pure analysis layer that summarizes generated or imported templates after export compilation. This should give users immediate feedback comparable to AuroraRMG's balance score and "what's inside" report.

## User Value

Users should be able to see whether a map looks fair enough to test in game before exporting or sharing. The analysis should explain likely issues in plain terms without blocking valid exports.

## Scope

Create a new pure module, likely `src/analysis/templateAnalysis.ts`, that accepts an `RmgTemplate` and returns:

- Balance applicability.
- Balance score from 0 to 100.
- Per-player start metrics.
- Findings ordered by severity.
- Content summary totals.
- Per-zone role rows.

Candidate UI target:

- `src/components/builder/ValidationOutputPanel.tsx`
- Or a small child component such as `MapAnalysisPanel`.

## Balance Metrics

Start with a pragmatic model inspired by AuroraRMG:

- Player spawn zones: zones containing a `Spawn` main object.
- Start wealth: `guardedContentValue + unguardedContentValue + resourcesValue`.
- Expansion value: neutral-zone value divided by graph hop distance from the spawn.
- Nearest opponent distance: shortest graph distance to another spawn.
- Castle access: shortest graph distance to a neutral city.

Suggested score weighting:

- 45% start wealth equality.
- 35% expansion value equality.
- 20% nearest-opponent distance equality.

Warnings to emit:

- Poorer start when start wealth spread is at least 12%.
- Uneven neutral castle access when some players cannot reach a neutral city or hop spread is large.
- Too-close starts in 3+ player maps.
- Positive "well balanced" finding when score is high and no warnings exist.

## Content Summary

Classify zones as:

- Player: contains `Spawn`.
- Neutral castle: contains `City` and no `Spawn`.
- Hub: layout/name/role signals central hub where available.
- Neutral: everything else.

Report:

- Zone count.
- Player zone count.
- Neutral zone count.
- Neutral castle zone count.
- Connection count.
- Total treasure.
- Total resources.
- Per-zone connection degree.

## Tests

Add focused tests, likely `tests/template-analysis.test.ts`:

- Symmetric two-player map scores 100 and reports well-balanced.
- Lopsided start lowers score and names the poorer player.
- Uneven castle access is flagged.
- Single-player or malformed templates are not applicable and do not throw.
- Generated Balanced Random maps produce reports within expected ranges.

## Acceptance Criteria

- Analysis is pure and has no DOM or storage dependency.
- UI shows balance score, key findings, and compact content totals.
- Export is not blocked by analysis warnings.
- Tests cover both hand-built templates and at least one generated template.
- `npm test` and `npm run build` pass.

## Non-goals

- Do not claim in-game playability.
- Do not create a full strategy/balance simulator.
- Do not add player-facing recommendations that require unverified game mechanics.
