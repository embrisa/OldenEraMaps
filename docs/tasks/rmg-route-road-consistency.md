# RMG Task: Route And Road Consistency

## Goal

Validate that the real zone graph and the visual road paths describe the same intended map routes.

## Background

In `.rmg.json` templates, `connections` define the real zone graph. `roads` define how paths are drawn within and between zones. A template can load while still drawing misleading or broken routes if these structures drift apart.

## Desired Behavior

- Build a derived graph from root `connections`.
- Validate that intended route chains exist for generated templates.
- For BattleCity-style branches, verify chains like:
  - `Spawn-1 -> P1-N1 -> P1-N2 -> P1-N3 -> Center`
  - `Spawn-2 -> P2-N1 -> P2-N2 -> P2-N3 -> Center`
  - `Spawn-3 -> P3-N1 -> P3-N2 -> P3-N3 -> Center`, when a third player exists.
- Detect roads that point to removed mandatory route content, such as obsolete remote foothold content.
- Warn when roads imply a path that does not exist in the connection graph.
- Warn when a required connection has no corresponding visible road segment, unless intentionally roadless.
- Allow empty transit zones that use a local `Crossroads` road point.
- Allow multiple decoy road arms to point to the same local `Crossroads`.
- Do not invent or require separate fake crossroads names in a zone.

## Implementation Notes

- Keep generic graph validation separate from topology-specific route-chain validation.
- Prefer explicit generated metadata where it exists. If metadata does not exist, infer route chains from stable naming only for known generated patterns.
- Diagnostics should identify both the road endpoint and the missing or mismatched connection.

## Tests

Add focused Vitest coverage for:

- Valid 2-player BattleCity-style branch chain.
- Valid 3-player shared-center branch chain.
- Road endpoint referencing a missing connection.
- Connection exists but visible road is missing.
- Road path exists but no matching connection exists.
- Empty transit zone with a local `Crossroads`.
- Multiple decoy arms sharing one local `Crossroads`.
- Road pointing to removed remote foothold content.

## Acceptance Criteria

- Generated route chains can be validated explicitly.
- Road/connection mismatches produce actionable diagnostics.
- Decoy road arms remain possible without adding fake graph edges.
- `npm test` and `npm run build` pass.

## Non-goals

- Do not remove intentional visual deception from map designs.
- Do not guarantee that the in-game road renderer draws exactly as expected.
