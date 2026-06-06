import { describe, expect, it } from "vitest";
import {
  applyBalancedRandomBoardLayout,
  borderGuardStrengthPercent,
  buildBalancedRandomMapSettings,
  countBalancedRandomZones,
  createBalancedRandomMapDraft
} from "../src/balancedRandomMap";
import { templateToDesign } from "../src/design";
import { generateTemplate } from "../src/generator";
import { validateSettings } from "../src/settings";
import { validateDesign } from "../src/design/validation";

describe("balanced random map settings", () => {
  it("builds balanced defaults that favor fair routes instead of chaos", () => {
    const draft = createBalancedRandomMapDraft();
    draft.playerCount = 4;
    draft.neutralZoneCount = 6;
    draft.victoryCondition = "CityHold";

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

  it("keeps city-hold chain maps valid by forcing neutral buffer zones", () => {
    const draft = createBalancedRandomMapDraft();
    draft.topology = "Chain";
    draft.playerCount = 2;
    draft.neutralZoneCount = 0;
    draft.victoryCondition = "CityHold";
    draft.seed = "42";

    const settings = buildBalancedRandomMapSettings(draft);

    expect(settings.topology).toBe("Chain");
    expect(settings.zoneCfg.neutralZoneCount).toBeGreaterThanOrEqual(1);
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

  it("produces stable settings and generated design for the same simple options and seed", () => {
    const draft = createBalancedRandomMapDraft();
    draft.templateName = "Stable Simple Map";
    draft.gameType = "PvE";
    draft.playerCount = 5;
    draft.mapSize = "Medium";
    draft.gameLength = "Long";
    draft.chaosLevel = "Wild";
    draft.victoryCondition = "Classic";
    draft.borderGuardLevel = "Strong";
    draft.water = true;
    draft.naturalExpansion = true;
    draft.strongerNeutrals = true;
    draft.seed = "12345";

    const leftSettings = buildBalancedRandomMapSettings(draft);
    const rightSettings = buildBalancedRandomMapSettings(structuredClone(draft));
    const leftDesign = templateToDesign(generateTemplate(leftSettings));
    const rightDesign = templateToDesign(generateTemplate(rightSettings));

    expect(leftSettings).toEqual(rightSettings);
    expect(leftDesign).toEqual(rightDesign);
    expect(validateDesign(leftDesign).errors).toEqual([]);
  });

  it("creates a numeric seed when the seed field is blank", () => {
    const settings = buildBalancedRandomMapSettings(createBalancedRandomMapDraft());

    expect(settings.seed).toEqual(expect.any(Number));
    expect(Number.isInteger(settings.seed)).toBe(true);
  });

  it("creates a valid City Hold target path from simple options", () => {
    const draft = createBalancedRandomMapDraft();
    draft.victoryCondition = "CityHold";
    draft.gameType = "Duel";
    draft.neutralZoneCount = 0;
    draft.seed = "8301";

    const settings = buildBalancedRandomMapSettings(draft);
    const design = templateToDesign(generateTemplate(settings));

    expect(settings.playerCount).toBe(2);
    expect(settings.topology).toBe("HubAndSpoke");
    expect(settings.zoneCfg.hubZoneCastles).toBe(1);
    expect(validateSettings(settings).errors).toEqual([]);
    expect(validateDesign(design).errors).toEqual([]);
    expect(design.zones.filter((zone) => zone.holdCity && zone.castleCount > 0)).toHaveLength(1);
  });

  it("forces tournament simple maps to two isolated player lanes", () => {
    const draft = createBalancedRandomMapDraft();
    draft.victoryCondition = "Tournament";
    draft.playerCount = 6;
    draft.neutralZoneCount = 6;
    draft.seed = "44";

    const settings = buildBalancedRandomMapSettings(draft);
    const design = templateToDesign(generateTemplate(settings));

    expect(settings.playerCount).toBe(2);
    expect(settings.gameMode).toBe("Tournament");
    expect(settings.gameEndConditions.victoryCondition).toBe("win_condition_6");
    expect(settings.tournamentRules.enabled).toBe(true);
    expect(validateSettings(settings).errors).toEqual([]);
    expect(validateDesign(design).errors).toEqual([]);
    expect(design.zones.filter((zone) => zone.role === "Spawn")).toHaveLength(2);
    expect(design.connections.every((connection) => connection.name.startsWith("Tourney-"))).toBe(true);
  });

  it("maps border guard labels to explicit guard strength percentages", () => {
    expect(borderGuardStrengthPercent("Weak")).toBe(70);
    expect(borderGuardStrengthPercent("Normal")).toBe(100);
    expect(borderGuardStrengthPercent("Strong")).toBe(130);
    expect(borderGuardStrengthPercent("Fortress")).toBe(165);

    const draft = createBalancedRandomMapDraft();
    draft.borderGuardLevel = "Fortress";

    expect(buildBalancedRandomMapSettings(draft).zoneCfg.borderGuardStrengthPercent).toBe(165);
  });

  it("marks Huge simple maps as experimental without creating validation errors", () => {
    const draft = createBalancedRandomMapDraft();
    draft.mapSize = "Huge";
    draft.seed = "91";

    const settings = buildBalancedRandomMapSettings(draft);
    const validation = validateSettings(settings);

    expect(settings.experimentalMapSizes).toBe(true);
    expect(settings.mapWidth).toBeGreaterThan(240);
    expect(validation.errors).toEqual([]);
    expect(validation.warnings).toContain("Official examples top out at 240x240. Larger or rectangular maps are experimental.");
  });

  it("applies simple extras for water, stronger neutrals, portals, and natural expansions", () => {
    const draft = createBalancedRandomMapDraft();
    draft.water = true;
    draft.strongerNeutrals = true;
    draft.randomPortals = true;
    draft.naturalExpansion = true;
    draft.seed = "314";

    const settings = buildBalancedRandomMapSettings(draft);
    const design = templateToDesign(generateTemplate(settings));

    expect(settings.borderWaterWidth).toBe(4);
    expect(settings.zoneCfg.neutralStackStrengthPercent).toBeGreaterThan(100);
    expect(settings.randomPortals).toBe(true);
    expect(design.border.waterWidth).toBe(4);
    expect(design.zones.filter((zone) => zone.name.startsWith("Natural-"))).toHaveLength(settings.playerCount);
    expect(validateDesign(design).errors).toEqual([]);
  });
});

function clockwiseAngle(position: { x: number; y: number }): number {
  return (Math.atan2(position.y - 0.5, position.x - 0.5) + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
}

function closeTo(value: number, expected: number): boolean {
  return Math.abs(value - expected) < 1e-9;
}
