# RMG Task: Structural Template Validation

## Goal

Add domain validation for `.rmg.json` structures that are valid JSON but can still crash map generation or load.

## Desired Behavior

Validate generated and imported templates for known hard structural requirements:

- `sizeX` and `sizeZ` must be divisible by 16.
- Warn or reject suspicious unsupported sizes, including `214x214`.
- Every `connections.from` and `connections.to` value must name an existing zone.
- Every `connections.guardZone`, when present, must name an existing zone.
- Every road `Connection` endpoint must name an existing connection.
- Every road `MainObject` endpoint must reference an existing main-object index in the owning zone.
- Empty zones must not contain `crossroadsPosition`.
- Zones with main objects must use a valid `crossroadsPosition` if the field is present.
- Every zone `mandatoryContent` reference must exist in root `mandatoryContent`.
- Every zone `contentCountLimits` reference must exist in root `contentCountLimits`.

## Implementation Notes

- Prefer a pure validator module that can be called from tests, import paths, generation paths, and export flow.
- Return structured diagnostics with severity, code, message, and references to affected entities.
- Keep errors deterministic and stable enough for focused tests.
- Treat missing icons in game logs as troubleshooting guidance, not a validator rule.

## Tests

Add focused Vitest coverage for:

- Valid known-safe sizes: `160x160`, `176x176`, and `208x208`.
- Invalid or suspicious non-16-grid sizes.
- Missing connection zone references.
- Missing `guardZone` references.
- Road endpoints pointing at nonexistent connections.
- Road main-object endpoints pointing at nonexistent indexes.
- Empty zone with `crossroadsPosition`.
- Zone with invalid `crossroadsPosition`.
- Missing root `mandatoryContent`.
- Missing root `contentCountLimits`.

## Acceptance Criteria

- Structural crash-risk issues are reported before export.
- Tests cover both valid and invalid examples.
- `npm test` and `npm run build` pass.

## Non-goals

- Do not guarantee in-game map playability.
- Do not recursively search Steam installs for templates as part of validation.
- Do not rewrite imported templates just to make them pass validation.
