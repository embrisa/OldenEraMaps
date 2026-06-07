# RMG Template Learnings Roadmap

## Goal

Turn the BattleCity and Batthlehem debugging notes into implementable, testable work for OldenEraMaps.

The main product outcome is safer `.rmg.json` generation and export: catch known crash-risk structures, make city-hold templates semantically valid, keep generated routes coherent, and give users clearer pacing and balance presets.

## Source Notes

These tasks are based on local lessons from building and debugging:

- `BattleCity.rmg.json`: 2-player version, currently known working at `160x160`.
- `Batthlehem.rmg.json`: 3-player version, currently known working at `208x208`.

Do not treat these files as proof that generated templates are guaranteed playable in game. They are useful references for structure, naming, pacing, and validation rules.

## Task Set

- [x] [Structural template validation](rmg-structural-template-validation.md) (Implemented: `src/rmgDiagnostics.ts` - `validateTemplateStructure`)
- [x] [City Hold objective validation](rmg-city-hold-objective-validation.md) (Implemented: `src/rmgDiagnostics.ts` - `validateCityHoldObjective`)
- [x] [Route and road consistency](rmg-route-road-consistency.md) (Implemented: `src/rmgDiagnostics.ts` - `validateRouteAndRoadConsistency`)
- [x] [Branch mirroring and naming](rmg-branch-mirroring-and-naming.md) (Implemented: `src/rmgDiagnostics.ts` - `validateBranchMirroring`)
- [x] [Guard and reward scaling](rmg-guard-and-reward-scaling.md) (Implemented: `src/rmgDiagnostics.ts` - `recommendGuardRewardScaling`)
- [x] [Size and pacing presets](rmg-size-and-pacing-presets.md) (Implemented: `src/rmgDiagnostics.ts` - `recommendTemplateSizeAndPacing`)
- [x] [Fixture-backed regression pack](rmg-fixture-regression-pack.md) (Implemented: JSON validation fixtures in `tests/fixtures/rmg-validation/`)
- [x] [Export diagnostics and troubleshooting](rmg-export-diagnostics-and-troubleshooting.md) (Implemented: Export dialog warning panel integrating diagnostics in `src/components/builder/ValidationOutputPanel.tsx`)

## Suggested Order

1. Build structural validation first. It catches the known hard crash patterns and gives later tasks a shared validation surface.
2. Add city-hold validation next because invalid city-hold templates can look structurally plausible while failing the intended objective.
3. Add route and road consistency checks before deeper branch fairness work.
4. Standardize branch mirroring and naming once route validation can identify mismatches.
5. Add size and pacing presets before final guard tuning, because map size changes contact timing.
6. Tune guard and reward scaling with fixture coverage for high-reward maps.
7. Add the fixture-backed regression pack to lock down known working patterns.
8. Finish with export diagnostics and troubleshooting copy so users see actionable errors and warnings.

## Common Verification

- Add or update focused Vitest coverage for each behavior change.
- Run `npm test`.
- Run `npm run build`.
- For UI-facing export or diagnostics changes, run `npm run dev` and visually check the affected builder workflow on a desktop viewport.
- Do not overwrite bundled example templates during testing.
- Save ad hoc generated templates in a temporary location unless the user explicitly asks for game-install writes.

## Guardrails

- Prefer structured template parsing and validation over manual string inspection.
- Keep validation messages tied to concrete zones, connections, roads, objects, or reference names.
- Separate blocking crash-risk errors from balance or pacing warnings.
- Preserve the desktop-focused builder workflow.
- Do not claim in-game playability until a reliable game-level validation workflow exists.
