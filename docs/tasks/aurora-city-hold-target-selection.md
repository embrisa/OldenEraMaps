# Aurora Task: City Hold Target Selection

## Goal

Improve non-hub City Hold target selection so the target city is fairer and more strategically central.

## Current Starting Point

Generation currently picks a hold-city neutral mainly by quality, castle count, and stable ordering in:

- `src/generator/templateGenerator.ts`
- `src/generator/topologyVariantBuilder.ts`

This can choose a rich target that is not equally reachable from all players.

## Desired Behavior

When City Hold is enabled and the topology does not use a hub/triangle center target:

1. Build the same zone adjacency that the generator will use.
2. Compute BFS hop distances from every spawn candidate to each neutral zone.
3. Select the neutral zone that:
   - maximizes minimum distance to any player,
   - minimizes distance variance across players,
   - prefers higher neutral quality,
   - prefers a zone that already has a castle,
   - uses stable letter/name ordering as the final tie-breaker.

If no suitable neutral target exists, validation should already prevent generation or the generator should fail with a clear error.

## Implementation Notes

Best approach:

- Add a pure helper in `src/generator/templateGenerator.ts` or a new `src/generator/cityHoldTarget.ts`.
- Reuse topology ordering helpers from `src/generator/neutralZonePlanner.ts`.
- For topologies where exact generated graph is expensive or random, use the actual generated connections if available, or a documented structural proxy.
- Keep hub and triangle behavior unchanged.

## Tests

Add focused tests:

- In a lopsided graph, the far/equidistant neutral is selected over a richer but closer neutral.
- Quality wins only after distance fairness.
- Castle presence wins only after distance fairness and quality.
- Hub City Hold still uses the hub.
- Triangle City Hold still uses the center.
- Generated templates contain exactly one `holdCityWinCon` city.

## Acceptance Criteria

- Non-hub City Hold target selection is graph-aware.
- Existing City Hold tests still pass.
- New tests cover the tie-break order.
- `npm test` and `npm run build` pass.

## Non-goals

- Do not redesign all topology generation.
- Do not add multiple hold cities.
- Do not infer turn timing or path length beyond graph hops.
