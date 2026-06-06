# RMG Task: Export Diagnostics And Troubleshooting

## Goal

Run the new validation checks before export and present users with clear, actionable feedback.

## Desired Behavior

Before creating a `.rmg.json` export:

- Run structural validation.
- Run City Hold objective validation.
- Run route and road consistency validation.
- Run branch mirroring validation when the selected topology is intended to be symmetric.
- Run size and pacing recommendations.
- Run high-reward guard-scaling recommendations.

Separate diagnostics by severity:

- Error: likely crash-risk or objectively invalid template structure.
- Warning: likely balance, pacing, or route clarity issue.
- Info: troubleshooting or manual in-game validation guidance.

Errors should identify concrete affected data:

- zone name
- connection name
- road endpoint
- main-object index
- mandatory content key
- content count limit key

## Troubleshooting Copy

Add a short troubleshooting guide in the app or docs:

- If generation logs crash before checksum output, the template likely generated invalid data.
- If logs reach `Generated map, checksum...` and then crash, generation likely succeeded and the failure is probably load or conversion related.
- Missing icon spam in `Player.log` is usually noise unless it concerns a custom object being added.

## Implementation Notes

- Reuse structured validator diagnostics rather than duplicating checks in the UI.
- Keep export blocking behavior limited to errors.
- If an override/export-anyway flow already exists, require explicit user action and keep the warning copy specific.
- UI changes should stay desktop-focused for the builder.

## Tests

Add focused coverage for:

- Export blocked by structural errors.
- Export blocked by invalid City Hold.
- Export allowed with warnings only.
- Diagnostics preserve entity references.
- High-reward low-guard warning appears without blocking export.
- Troubleshooting text is reachable from the export or validation flow if implemented in UI.

## Visual Verification

For UI-facing work:

- Run `npm run dev`.
- Open the builder on a desktop viewport.
- Trigger at least one blocking error and one warning.
- Confirm the messages are readable and do not break the export workflow layout.
- Confirm a valid configured map can still create a `.rmg.json` file.

## Acceptance Criteria

- Known crash-risk errors are visible before export.
- Warnings do not block export unless policy explicitly says they should.
- Users can understand what to fix without reading raw JSON.
- `npm test` and `npm run build` pass.

## Non-goals

- Do not parse full game logs automatically in this task.
- Do not claim exported templates are guaranteed playable in game.
