import { describe, expect, it } from "vitest";
import {
  applyBalancedRandomBoardLayout,
  buildBalancedRandomMapSettings,
  countBalancedRandomZones,
  createBalancedRandomMapDraft
} from "../src/balancedRandomMap";
import { templateToDesign } from "../src/design";
import { generateTemplate } from "../src/generator";
import { validateSettings } from "../src/settings";

describe("balanced random map settings", () => {
  it("builds balanced defaults that favor fair routes instead of chaos", () => {
    const draft = createBalancedRandomMapDraft();
    draft.playerCount = 4;
    draft.neutralZoneCount = 6;
    draft.cityHold = true;

    const settings = buildBalancedRandomMapSettings(draft);

    expect(settings.connectionStyle).toBe("Balanced");
    expect(settings.experimentalBalancedZonePlacement).toBe(true);
    expect(settings.topology).toBe("HubAndSpoke");
    expect(settings.gameEndConditions.cityHold).toBe(true);
    expect(settings.gameEndConditions.victoryCondition).toBe("win_condition_5");
    expect(countBalancedRandomZones(settings)).toBe(11);
    expect(validateSettings(settings).errors).toEqual([]);
    expect(settings.seed).toEqual(expect.any(Number));
  });

  it("keeps city-hold chain maps valid by forcing at least one neutral zone", () => {
    const draft = createBalancedRandomMapDraft();
    draft.topology = "Chain";
    draft.playerCount = 2;
    draft.neutralZoneCount = 0;
    draft.cityHold = true;
    draft.seed = "42";

    const settings = buildBalancedRandomMapSettings(draft);

    expect(settings.topology).toBe("Chain");
    expect(settings.zoneCfg.neutralZoneCount).toBe(1);
    expect(settings.seed).toBe(42);
    expect(validateSettings(settings).errors).toEqual([]);
  });

  it("applies connection-style and portal overrides after preset defaults", () => {
    const draft = createBalancedRandomMapDraft();
    draft.generationPreset = "Duel";
    draft.connectionStylePreset = "PortalHeavy";
    draft.playerCount = 2;
    draft.topology = "Default";
    draft.randomPortals = true;
    draft.maxPortalConnections = 5;
    draft.noDirectPlayerConnections = "Enabled";
    draft.minNeutralZonesBetweenPlayers = 3;

    const settings = buildBalancedRandomMapSettings(draft);

    expect(settings.randomPortals).toBe(true);
    expect(settings.maxPortalConnections).toBe(5);
    expect(settings.noDirectPlayerConnections).toBe(true);
    expect(settings.minNeutralZonesBetweenPlayers).toBe(3);
    expect(validateSettings(settings).errors).toEqual([]);
  });

  it("uses advanced neutral split counts for totals and validation", () => {
    const draft = createBalancedRandomMapDraft();
    draft.neutralZoneCount = 1;
    draft.neutralSplit.neutralLowNoCastleCount = 2;
    draft.neutralSplit.neutralMediumCastleCount = 1;
    draft.neutralSplit.neutralHighNoCastleCount = 1;

    const settings = buildBalancedRandomMapSettings(draft);

    expect(settings.zoneCfg.advanced.enabled).toBe(true);
    expect(settings.zoneCfg.neutralZoneCount).toBe(4);
    expect(countBalancedRandomZones(settings)).toBe(8);
    expect(validateSettings(settings).errors).toEqual([]);
  });

  it("applies connection-style effects while allowing balanced-random overrides to win", () => {
    const draft = createBalancedRandomMapDraft();
    draft.connectionStylePreset = "SafeLanes";
    draft.playerCount = 4;
    draft.topology = "SharedWeb";
    draft.noDirectPlayerConnections = "Disabled";
    draft.minNeutralZonesBetweenPlayers = 0;

    const settings = buildBalancedRandomMapSettings(draft);

    expect(settings.experimentalBalancedZonePlacement).toBe(true);
    expect(settings.randomPortals).toBe(false);
    expect(settings.noDirectPlayerConnections).toBe(false);
    expect(settings.minNeutralZonesBetweenPlayers).toBe(0);
  });

  it("preserves identity preset rules while explicit balanced overrides win", () => {
    const draft = createBalancedRandomMapDraft();
    draft.generationPreset = "SingleHero";
    draft.playerCount = 2;
    draft.noDirectPlayerConnections = "Disabled";
    draft.minNeutralZonesBetweenPlayers = 0;

    const settings = buildBalancedRandomMapSettings(draft);

    expect(settings.gameMode).toBe("SingleHero");
    expect(settings.heroHireBan).toBe(true);
    expect(settings.heroSettings.heroCountMin).toBe(1);
    expect(settings.heroSettings.heroCountMax).toBe(1);
    expect(settings.noDirectPlayerConnections).toBe(false);
    expect(settings.minNeutralZonesBetweenPlayers).toBe(0);
  });

  it("preserves identity preset export features for balanced-random templates", () => {
    const draft = createBalancedRandomMapDraft();
    draft.generationPreset = "BlitzLike";
    draft.playerCount = 2;
    draft.topology = "Chain";
    draft.neutralZoneCount = 2;

    const settings = buildBalancedRandomMapSettings(draft);
    const template = generateTemplate(settings);

    expect(settings.preset).toBe("Custom");
    expect(settings.identityPreset).toBe("BlitzLike");
    expect(template.valueOverrides).toEqual([
      { sid: "watchtower", variant: 0, guardValue: 25000 }
    ]);
    expect(template.globalBans).toEqual({
      items: ["voodoosh_doll_artifact", "flag_of_truce_artifact"]
    });
  });

  it("places balanced-generated player and neutral zones in clockwise rings", () => {
    const draft = createBalancedRandomMapDraft();
    draft.playerCount = 4;
    draft.neutralZoneCount = 6;
    draft.seed = "7";

    const settings = buildBalancedRandomMapSettings(draft);
    const design = applyBalancedRandomBoardLayout(templateToDesign(generateTemplate(settings)));
    const spawns = design.zones
      .filter((zone) => zone.role === "Spawn")
      .sort((left, right) => (left.player ?? 0) - (right.player ?? 0));
    const neutrals = design.zones
      .filter((zone) => zone.role === "Neutral" && !zone.name.startsWith("Natural-"))
      .sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true }));

    expect(spawns[0]?.position.x).toBeCloseTo(0.5);
    expect(spawns[0]?.position.y).toBeCloseTo(0.08);
    expect(spawns[1]?.position.x).toBeCloseTo(0.92);
    expect(spawns[1]?.position.y).toBeCloseTo(0.5);
    expect(spawns[2]?.position.x).toBeCloseTo(0.5);
    expect(spawns[2]?.position.y).toBeCloseTo(0.92);
    expect(spawns[3]?.position.x).toBeCloseTo(0.08);
    expect(spawns[3]?.position.y).toBeCloseTo(0.5);
    expect(neutrals[0]?.position.x).toBeCloseTo(0.5);
    expect(neutrals[0]?.position.y).toBeCloseTo(0.25);
    expect(spawns.every((zone) => closeTo(Math.abs(zone.position.x - 0.5), 0.42) || closeTo(Math.abs(zone.position.y - 0.5), 0.42))).toBe(true);
    expect(neutrals.every((zone) => Math.abs(zone.position.x - 0.5) <= 0.25 && Math.abs(zone.position.y - 0.5) <= 0.25)).toBe(true);
    expect(spawns.map((zone) => clockwiseAngle(zone.position))).toEqual([...spawns.map((zone) => clockwiseAngle(zone.position))].sort((left, right) => left - right));
    expect(neutrals.map((zone) => clockwiseAngle(zone.position))).toEqual([...neutrals.map((zone) => clockwiseAngle(zone.position))].sort((left, right) => left - right));
  });
});

function clockwiseAngle(position: { x: number; y: number }): number {
  return (Math.atan2(position.y - 0.5, position.x - 0.5) + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
}

function closeTo(value: number, expected: number): boolean {
  return Math.abs(value - expected) < 1e-9;
}
