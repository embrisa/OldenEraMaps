# RMG Task: City Hold Objective Validation

## Goal

Ensure City Hold templates describe a real and coherent hold-city objective.

## Desired Behavior

When `gameRules.winConditions.cityHold` is enabled:

- Require at least one real `City` main object.
- Require exactly one intended hold city unless the current product explicitly supports multiple hold targets.
- Require the hold city to include `holdCityWinCon: true`.
- Reject ruins or other city-like objects as substitutes for a hold city.
- Require `displayWinCondition` to agree with City Hold, including `win_condition_5` where that is the expected game value.
- Allow a random hold-city faction using `faction: { "type": "FromList", "args": [] }`.

When City Hold is disabled:

- Warn if a city still has `holdCityWinCon: true`.
- Warn if `displayWinCondition` still points at the City Hold condition.

## Implementation Notes

- Implement as validator rules rather than UI-only checks.
- Reuse existing generator/model types for main objects and win conditions.
- Keep diagnostics specific: identify the zone and main-object index for invalid or missing hold-city data.

## Tests

Add focused Vitest coverage for:

- Valid City Hold with one real hold city.
- Valid random-faction hold city with an empty `FromList`.
- City Hold enabled without any city.
- City Hold enabled with only ruins.
- City Hold enabled with a city missing `holdCityWinCon`.
- Mismatched `displayWinCondition`.
- City Hold disabled while a hold city remains marked.

## Acceptance Criteria

- Invalid City Hold templates are blocked or clearly flagged before export.
- Valid random-faction City Hold templates pass validation.
- Existing City Hold generation behavior remains covered.
- `npm test` and `npm run build` pass.

## Non-goals

- Do not add multiple hold-city modes unless requested separately.
- Do not change target-selection fairness here; that belongs in City Hold generation tasks.
