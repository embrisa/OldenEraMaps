import { describe, expect, it } from "vitest";
import { generateTemplate } from "../src/generator";
import type { GenerationTuning } from "../src/generator/math";
import { buildHubZone, buildNaturalExpansionZone, buildNeutralZone, buildSpawnZone } from "../src/generator/templateContentBuilder";
import { createDefaultSettings } from "../src/settings";
import { parseRmgTemplate, serializeRmgTemplate } from "../src/types";
import { expectDirectAndPortalGraphConnected } from "./template-invariants";

const baselineTuning = {
  contentScale: 1,
  resourceDensityMultiplier: 1,
  structureDensityMultiplier: 1,
  neutralStackStrengthMultiplier: 1,
  borderGuardStrengthMultiplier: 1,
  guardRandomization: 0.05
} satisfies GenerationTuning;

describe("generateTemplate", () => {
  it("generates a parseable rmg template with spawn zones and connections", () => {
    const settings = createDefaultSettings();
    settings.templateName = "Vitest Template";
    settings.zoneCfg.neutralZoneCount = 2;
    settings.seed = 1234;

    const template = generateTemplate(settings);

    expect(template.name).toBe("Vitest Template");
    expect(template.variants?.[0].zones?.map((zone) => zone.name)).toContain("Spawn-1");
    expect(template.variants?.[0].zones?.map((zone) => zone.name)).toContain("Neutral-3");
    expect(template.variants?.[0].connections?.length).toBeGreaterThan(0);
    expect(JSON.parse(JSON.stringify(template)).name).toBe("Vitest Template");
  });

  it("marks a hold city for hub city hold templates", () => {
    const settings = createDefaultSettings();
    settings.topology = "HubAndSpoke";
    settings.gameEndConditions.cityHold = true;

    const template = generateTemplate(settings);
    const hub = template.variants?.[0].zones?.find((zone) => zone.name === "Hub");
    const holdCity = hub?.mainObjects?.find((object) => object.holdCityWinCon);

    expect(hub?.mainObjects?.some((object) => object.holdCityWinCon)).toBe(true);
    expect(holdCity?.guardValue).toBe(60000);
    expect(template.gameRules?.winConditions?.cityHold).toBe(true);
  });

  it("does not emit marquee blockers for non-city-hold neutral cities", () => {
    const settings = createDefaultSettings();
    settings.topology = "Chain";
    settings.zoneCfg.neutralZoneCount = 1;
    settings.zoneCfg.neutralZoneCastles = 1;

    const template = generateTemplate(settings);
    const neutral = template.variants?.[0].zones?.find((zone) => zone.name.startsWith("Neutral-"));
    const allMainObjectGuards = (template.variants?.[0].zones ?? [])
      .flatMap((zone) => zone.mainObjects ?? [])
      .map((object) => object.guardValue ?? 0);

    expect(neutral?.mainObjects?.[0]?.holdCityWinCon).not.toBe(true);
    expect(neutral?.mainObjects?.[0]?.guardValue).toBe(8000);
    expect(Math.max(...allMainObjectGuards)).toBeLessThan(60000);
  });

  it("adds marquee high-treasure objective blockers and scales them with neutral strength", () => {
    const settings = createDefaultSettings();
    settings.topology = "Triangle";

    const template = generateTemplate(settings);
    const highNeutralZone = template.variants?.[0].zones?.find((zone) => zone.name === "Neutral-4");
    const highNeutralGroup = template.mandatoryContent?.find((group) => group.name === "mandatory_content_neutral_4");
    const marqueeObjectives = (highNeutralGroup?.content ?? []).filter((item) =>
      item.guardValue !== undefined
      && (item.includeLists?.includes("content_list_building_utopia") || item.includeLists?.includes("content_list_building_epic_guarded_resource_banks"))
    );

    expect(highNeutralZone?.mainObjects?.[0]?.guardValue).toBe(25000);
    expect(marqueeObjectives).toHaveLength(2);
    expect(marqueeObjectives.every((item) => item.guardValue === 60000)).toBe(true);

    const scaledTemplate = generateTemplate({
      ...settings,
      zoneCfg: {
        ...settings.zoneCfg,
        neutralStackStrengthPercent: 150
      }
    });
    const scaledGroup = scaledTemplate.mandatoryContent?.find((group) => group.name === "mandatory_content_neutral_4");
    const scaledZone = scaledTemplate.variants?.[0].zones?.find((zone) => zone.name === "Neutral-4");
    const scaledObjectives = (scaledGroup?.content ?? []).filter((item) => item.guardValue !== undefined);

    expect(scaledZone?.mainObjects?.[0]?.guardValue).toBe(37500);
    expect(scaledObjectives.filter((item) => item.guardValue === 90000)).toHaveLength(2);
  });

  it("honors triangle topology as a three-player layout", () => {
    const settings = createDefaultSettings();
    settings.topology = "Triangle";
    settings.playerCount = 8;

    const template = generateTemplate(settings);
    const zones = template.variants?.[0].zones ?? [];
    const spawns = zones.filter((zone) => zone.name.startsWith("Spawn-"));
    const neutralNames = zones.filter((zone) => zone.name.startsWith("Neutral-")).map((zone) => zone.name);

    expect(spawns).toHaveLength(3);
    expect(neutralNames).toEqual(["Neutral-4", "Neutral-5", "Neutral-6"]);
    expect(zones.filter((zone) => ["Neutral-4", "Neutral-5", "Neutral-6"].includes(zone.name)).every((zone) => zone.layout === "zone_layout_treasure_zone")).toBe(true);
  });

  it("assigns each three-player triangle spawn to a distinct player", () => {
    const settings = createDefaultSettings();
    settings.topology = "Triangle";
    settings.playerCount = 3;

    const template = generateTemplate(settings);
    const spawnAssignments = (template.variants?.[0].zones ?? [])
      .filter((zone) => zone.name.startsWith("Spawn-"))
      .map((zone) => ({ name: zone.name, spawn: zone.mainObjects?.find((object) => object.type === "Spawn")?.spawn }))
      .sort((left, right) => left.name.localeCompare(right.name));

    expect(spawnAssignments).toEqual([
      { name: "Spawn-1", spawn: "Player1" },
      { name: "Spawn-2", spawn: "Player2" },
      { name: "Spawn-3", spawn: "Player3" }
    ]);
  });

  it("builds a natural-expansion triangle around a central hold castle", () => {
    const settings = createDefaultSettings();
    settings.topology = "Triangle";
    settings.naturalExpansionZone = true;
    settings.connectionStyle = "RoadHeavy";
    settings.gameEndConditions.victoryCondition = "win_condition_5";
    settings.gameEndConditions.cityHold = true;
    settings.gameEndConditions.cityHoldDays = 14;
    settings.zoneCfg.hubZoneSize = 1.8;
    settings.zoneCfg.neutralStackStrengthPercent = 150;
    settings.zoneCfg.structureDensityPercent = 140;

    const template = generateTemplate(settings);
    const variant = template.variants?.[0];
    const zones = variant?.zones ?? [];
    const zoneNames = zones.map((zone) => zone.name);
    const connections = variant?.connections ?? [];
    const hub = zones.find((zone) => zone.name === "Hub");

    expect(zones.filter((zone) => zone.name.startsWith("Spawn-"))).toHaveLength(3);
    expect(zoneNames.filter((name) => name.startsWith("Natural-")).sort()).toEqual(["Natural-1", "Natural-2", "Natural-3"]);
    expect(zoneNames.some((name) => name.startsWith("Neutral-"))).toBe(false);
    expect(hub?.size).toBe(1.8);
    expect(hub?.mainObjects?.[0]).toMatchObject({
      type: "City",
      holdCityWinCon: true,
      buildingsConstructionSid: "ultra_rich_buildings_construction",
      faction: { type: "FromList", args: [] }
    });
    expect(template.gameRules?.winConditions?.cityHoldDays).toBe(14);

    for (const player of ["1", "2", "3"]) {
      const natural = zones.find((zone) => zone.name === `Natural-${player}`);
      expect(natural?.mainObjects?.[0].faction).toEqual({ type: "Match", args: ["0", `Spawn-${player}`] });
      expect(connections.some((connection) => connection.from === `Spawn-${player}` && connection.to === `Natural-${player}`)).toBe(true);
      expect(connections.some((connection) => connection.from === `Natural-${player}` && connection.to === "Hub")).toBe(true);
      expect(natural?.roads?.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("can match neutral castle factions to a single adjacent player spawn", () => {
    const settings = createDefaultSettings();
    settings.topology = "Chain";
    settings.zoneCfg.neutralZoneCount = 2;
    settings.zoneCfg.neutralZoneCastles = 2;
    settings.minNeutralZonesBetweenPlayers = 2;
    settings.matchAdjacentNeutralCastleFactions = true;

    const template = generateTemplate(settings);
    const variant = template.variants?.[0];
    const zones = variant?.zones ?? [];
    const connections = variant?.connections ?? [];

    for (const neutral of zones.filter((zone) => zone.name.startsWith("Neutral-"))) {
      const adjacentSpawns = connections
        .filter((connection) => connection.connectionType === "Direct" && (connection.from === neutral.name || connection.to === neutral.name))
        .map((connection) => connection.from === neutral.name ? connection.to : connection.from)
        .filter((name) => name.startsWith("Spawn-"));

      expect(adjacentSpawns).toHaveLength(1);
      expect(neutral.mainObjects?.[0].faction).toEqual({ type: "Match", args: ["0", adjacentSpawns[0]] });
      expect(neutral.mainObjects?.[1].faction).toEqual({ type: "Match", args: ["0"] });
    }
  });

  it("keeps shared neutral castle factions random when multiple spawns are adjacent", () => {
    const settings = createDefaultSettings();
    settings.topology = "Chain";
    settings.zoneCfg.neutralZoneCount = 1;
    settings.minNeutralZonesBetweenPlayers = 1;
    settings.matchAdjacentNeutralCastleFactions = true;

    const template = generateTemplate(settings);
    const neutral = template.variants?.[0].zones?.find((zone) => zone.name.startsWith("Neutral-"));

    expect(neutral?.mainObjects?.[0].faction).toEqual({ type: "FromList", args: [] });
  });

  it("emits connector corridor neutrals for ring gaps with enforced separation", () => {
    const settings = createDefaultSettings();
    settings.topology = "Default";
    settings.playerCount = 2;
    settings.zoneCfg.neutralZoneCount = 4;
    settings.zoneCfg.neutralZoneCastles = 0;
    settings.minNeutralZonesBetweenPlayers = 1;
    settings.experimentalBalancedZonePlacement = true;
    settings.seed = 4242;

    const template = generateTemplate(settings);
    const variant = template.variants?.[0];
    const zones = variant?.zones ?? [];
    const connections = variant?.connections ?? [];
    const neutralZones = zones.filter((zone) => zone.name.startsWith("Neutral-"));
    const connectors = neutralZones.filter((zone) => zone.guardCutoffValue === 1500 && zone.guardWeeklyIncrement === 0.2 && zone.guardMultiplier === 1.4);

    expect(connectors).toHaveLength(2);

    for (const connector of connectors) {
      expect(connector.layout).toBe("zone_layout_sides");
      expect(connector.guardMultiplier).toBe(1.4);
      expect(connector.guardWeeklyIncrement).toBe(0.2);

      const roadConnectionNames = new Set((connector.roads ?? [])
        .flatMap((road) => [road.from, road.to])
        .filter((endpoint) => endpoint?.type === "Connection")
        .map((endpoint) => endpoint?.args?.[0])
        .filter((name): name is string => Boolean(name)));

      expect(roadConnectionNames.size).toBeGreaterThanOrEqual(2);
    }

    expectDirectAndPortalGraphConnected(zones, connections);
  });

  it("can emit neutral castle slots as rebuildable ruins", () => {
    const settings = createDefaultSettings();
    settings.topology = "Chain";
    settings.zoneCfg.neutralZoneCount = 1;
    settings.zoneCfg.neutralZoneCastles = 2;
    settings.neutralCastlesAsRuins = true;

    const template = generateTemplate(settings);
    const neutral = template.variants?.[0].zones?.find((zone) => zone.name.startsWith("Neutral-"));
    const spawn = template.variants?.[0].zones?.find((zone) => zone.name.startsWith("Spawn-"));

    expect(neutral?.mainObjects?.map((object) => object.type)).toEqual(["Ruins", "Ruins"]);
    expect(neutral?.mainObjects?.[0].factions).toEqual({ type: "FromList", args: [] });
    expect(neutral?.mainObjects?.[0].faction).toBeUndefined();
    expect(spawn?.mainObjects?.[0].type).toBe("Spawn");
  });

  it("keeps neutral city-hold targets as cities when neutral ruins are enabled", () => {
    const settings = createDefaultSettings();
    settings.topology = "Chain";
    settings.zoneCfg.neutralZoneCount = 1;
    settings.zoneCfg.neutralZoneCastles = 1;
    settings.gameEndConditions.cityHold = true;
    settings.gameEndConditions.victoryCondition = "win_condition_5";
    settings.neutralCastlesAsRuins = true;

    const template = generateTemplate(settings);
    const neutral = template.variants?.[0].zones?.find((zone) => zone.name.startsWith("Neutral-"));

    expect(neutral?.mainObjects?.[0]).toMatchObject({ type: "City", holdCityWinCon: true });
  });

  it("honors tournament save-army settings in generated game rules", () => {
    const settings = createDefaultSettings();
    settings.gameEndConditions.victoryCondition = "win_condition_6";
    settings.tournamentRules.enabled = true;
    settings.tournamentRules.saveArmy = false;

    const template = generateTemplate(settings);

    expect(template.gameRules?.winConditions?.tournament).toBe(true);
    expect(template.gameRules?.winConditions?.tournamentSaveArmy).toBe(false);
  });

  it("preserves default global rule output compatibility", () => {
    const settings = createDefaultSettings();

    const template = generateTemplate(settings);

    expect(template.valueOverrides).toBeUndefined();
    expect(template.globalBans).toBeUndefined();
    expect(template.gameRules?.heroHireBan).toBe(false);
    expect(template.gameRules?.encounterHoles).toBe(false);
    expect(template.gameRules?.bonuses).toEqual([
      {
        sid: "add_bonus_hero_stat",
        receiverSide: -1,
        receiverFilter: "all_heroes",
        parameters: ["movementBonus", "0"]
      }
    ]);
  });

  it("exports non-default global rule controls into game rules", () => {
    const settings = createDefaultSettings();
    settings.heroHireBan = true;
    settings.encounterHoles = true;
    settings.movementBonus = 7;

    const template = generateTemplate(settings);

    expect(template.gameRules?.heroHireBan).toBe(true);
    expect(template.gameRules?.encounterHoles).toBe(true);
    expect(Array.isArray(template.gameRules?.bonuses) ? template.gameRules.bonuses[0]?.parameters : undefined).toEqual(["movementBonus", "7"]);
  });

  it("emits single-hero preset rules and identity copy", () => {
    const settings = createDefaultSettings();
    settings.preset = "SingleHero";

    const template = generateTemplate(settings);

    expect(template.gameMode).toBe("SingleHero");
    expect(template.gameRules?.heroHireBan).toBe(true);
    expect(template.gameRules?.winConditions?.lostStartHero).toBe(true);
    expect(template.gameRules?.heroCountMin).toBe(1);
    expect(template.gameRules?.heroCountMax).toBe(1);
    expect(template.description).toContain("identity: single-hero duel");
    expect(template.description).toContain("start-hero elimination");
  });

  it("emits Jebus-like objective hub rules and anarchy warning copy", () => {
    const jebusTemplate = generateTemplate({
      ...createDefaultSettings(),
      preset: "JebusLikeObjective"
    });
    const anarchyTemplate = generateTemplate({
      ...createDefaultSettings(),
      preset: "AnarchyLike"
    });

    expect(jebusTemplate.displayWinCondition).toBe("win_condition_5");
    expect(jebusTemplate.gameRules?.winConditions?.cityHold).toBe(true);
    expect(jebusTemplate.gameRules?.winConditions?.cityHoldDays).toBe(6);
    expect(jebusTemplate.variants?.[0].zones?.find((zone) => zone.name === "Hub")?.mainObjects?.some((object) => object.holdCityWinCon)).toBe(true);
    expect(jebusTemplate.description).toContain("jackpot-center city-hold objective");

    expect(anarchyTemplate.gameRules?.encounterHoles).toBe(true);
    expect(anarchyTemplate.description).toContain("chaotic encounter-hole format");
    expect(anarchyTemplate.description).toContain("specialized format, validate in game");
  });

  it("emits reference landmark value overrides for the Anarchy-like preset", () => {
    const settings = createDefaultSettings();
    settings.preset = "AnarchyLike";

    const template = generateTemplate(settings);

    expect(template.valueOverrides).toEqual([
      { sid: "boreal_call", variant: -1, guardValue: 6000 },
      { sid: "jousting_range", variant: -1, guardValue: 6000 },
      { sid: "petrified_memorial", variant: -1, guardValue: 6000 },
      { sid: "point_of_balance", variant: -1, guardValue: 7500 },
      { sid: "the_gorge", variant: -1, guardValue: 6000 },
      { sid: "unforgotten_grave", variant: -1, guardValue: 6000 },
      { sid: "ritual_pyre", variant: -1, guardValue: 6000 }
    ]);
    expect(template.globalBans).toBeUndefined();
  });

  it("emits reference overrides and item bans for the Blitz-like preset", () => {
    const settings = createDefaultSettings();
    settings.preset = "BlitzLike";

    const template = generateTemplate(settings);

    expect(template.valueOverrides).toEqual([
      { sid: "watchtower", variant: 0, guardValue: 25000 }
    ]);
    expect(template.globalBans).toEqual({
      items: ["voodoosh_doll_artifact", "flag_of_truce_artifact"]
    });
  });

  it("round-trips generated preset overrides and bans through serialization", () => {
    const settings = createDefaultSettings();
    settings.preset = "BlitzLike";

    const template = generateTemplate(settings);
    const roundTripped = parseRmgTemplate(serializeRmgTemplate(template));

    expect(roundTripped.valueOverrides).toEqual(template.valueOverrides);
    expect(roundTripped.globalBans).toEqual(template.globalBans);
  });
});

describe("zone role profiles", () => {
  it("gives spawn zones a start-like cutoff, growth, and reward mix before scaling", () => {
    const spawn = buildSpawnZone("1", "Player1", [], 1, false, 1, false, false, baselineTuning);

    expect(spawn.guardCutoffValue).toBe(1500);
    expect(spawn.guardMultiplier).toBe(1.25);
    expect(spawn.guardWeeklyIncrement).toBe(0.15);
    expect(spawn.guardedContentValue).toBe(300000);
    expect(spawn.unguardedContentValue).toBe(45000);
    expect(spawn.resourcesValue).toBe(30000);
  });

  it("makes hub zones jackpot-positive and economy-light", () => {
    const hub = buildHubZone([], baselineTuning);

    expect(hub.guardCutoffValue).toBe(2000);
    expect(hub.guardMultiplier).toBe(1.6);
    expect(hub.guardWeeklyIncrement).toBe(0.2);
    expect(hub.guardedContentValue).toBe(650000);
    expect(hub.unguardedContentValue).toBe(0);
    expect(hub.resourcesValue).toBe(0);
  });

  it("makes high neutral treasure zones guarded-value heavy and resource-light", () => {
    const highTreasure = buildNeutralZone({ letter: "4", quality: "High", role: "Standard", castleCount: 1 }, [], 1, false, false, baselineTuning);

    expect(highTreasure.guardCutoffValue).toBe(1500);
    expect(highTreasure.guardMultiplier).toBe(1.6);
    expect(highTreasure.guardWeeklyIncrement).toBe(0.15);
    expect(highTreasure.guardedContentValue).toBe(600000);
    expect(highTreasure.unguardedContentValue).toBe(15000);
    expect(highTreasure.resourcesValue).toBe(0);
  });

  it("keeps side neutrals below treasure zones and gives natural expansions their own profile", () => {
    const side = buildNeutralZone({ letter: "4", quality: "Low", role: "Standard", castleCount: 1 }, [], 1, false, false, baselineTuning);
    const treasure = buildNeutralZone({ letter: "5", quality: "Medium", role: "Standard", castleCount: 1 }, [], 1, false, false, baselineTuning);
    const natural = buildNaturalExpansionZone("1", [], 1, false, false, baselineTuning);

    expect(side.guardCutoffValue).toBe(1500);
    expect(side.guardWeeklyIncrement).toBe(0.15);
    expect(side.guardedContentValue).toBe(300000);
    expect(side.unguardedContentValue).toBe(20000);
    expect(side.resourcesValue).toBe(12000);
    expect(side.guardedContentValue ?? 0).toBeLessThan(treasure.guardedContentValue ?? Number.POSITIVE_INFINITY);
    expect(side.resourcesValue ?? 0).toBeGreaterThan(treasure.resourcesValue ?? Number.NEGATIVE_INFINITY);
    expect(natural.guardedContentValue).toBe(250000);
    expect(natural.unguardedContentValue).toBe(25000);
    expect(natural.resourcesValue).toBe(18000);
    expect(natural.mainObjects?.[0].faction).toEqual({ type: "Match", args: ["0", "Spawn-1"] });
  });
});
