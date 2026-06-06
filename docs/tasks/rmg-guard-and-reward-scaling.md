# RMG Task: Guard And Reward Scaling

## Goal

Preserve high-reward map fantasies while making late-game zones and center objectives stay dangerous longer.

## Desired Behavior

Add or tune high-reward guard-scaling presets that can increase:

- zone `guardedContentValue`
- zone `guardMultiplier`
- zone `guardWeeklyIncrement`
- connection `guardValue`
- connection `guardWeeklyIncrement`
- main-object city `guardValue`
- main-object city `guardWeeklyIncrement`

For BattleCity-style pacing:

- N1 can be slightly harder but should not become an early wall.
- N2 should grow meaningfully over time.
- N3 should be very hard.
- The center should be the hardest point on the map.
- The N3-to-center gate should have very high weekly growth.

Use the known BattleCity tuning as a starting reference, not an immutable rule:

- N2 weekly guard growth: `0.36`
- N3 weekly guard growth: `0.52`
- Center weekly guard growth: `0.65`
- N3-to-center gate weekly growth: `0.70`

Reward helpers should support:

- Increasing legendary item frequency by duplicating known-safe pool entries such as `classic_template_pool_random_t5_item`.
- Adding guaranteed legendary items through mandatory content:

```json
{ "sid": "random_item_legendary", "soloEncounter": true }
```

## Implementation Notes

- Treat reward reduction as a separate design choice, not the default balance fix.
- If high-tier reward density increases, emit a warning or recommendation when guard scaling is not also increased.
- Keep scaling presets data-driven enough to test without a browser.

## Tests

Add focused Vitest coverage for:

- Late zones scale harder than early zones.
- Center guard growth exceeds branch guard growth.
- N3-to-center gate growth exceeds earlier gates.
- High-reward preset preserves reward-rich content.
- Legendary frequency helper only duplicates known-safe pool entries.
- Guaranteed legendary mandatory content serializes as expected.
- High-tier reward increases trigger guard-scaling warnings when guards stay low.

## Acceptance Criteria

- High-reward maps can become harder without removing their core rewards.
- Late-game guard growth is encoded and tested.
- Reward-safety helpers avoid unknown object IDs.
- `npm test` and `npm run build` pass.

## Non-goals

- Do not solve full combat balance or autoresolve quality.
- Do not claim Month 3 tuning is final without in-game validation.
