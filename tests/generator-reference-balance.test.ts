import { describe, expect, it } from "vitest";
import { generateTemplate } from "../src/generator";
import { createDefaultSettings } from "../src/settings";
import type { GeneratorSettings, RmgTemplate, Zone } from "../src/types";

type NumericZoneField =
  | "guardCutoffValue"
  | "guardMultiplier"
  | "guardWeeklyIncrement"
  | "guardedContentValue"
  | "unguardedContentValue"
  | "resourcesValue";

function findZone(template: RmgTemplate, name: string): Zone {
  const zone = template.variants?.[0]?.zones?.find((candidate) => candidate.name === name);
  expect(zone, `Expected zone ${name} to exist.`).toBeDefined();
  return zone!;
}

function zonesByRole(template: RmgTemplate): {
  starts: Zone[];
  centers: Zone[];
  sides: Zone[];
  treasures: Zone[];
  connectors: Zone[];
} {
  const zones = template.variants?.[0]?.zones ?? [];
  return {
    starts: zones.filter((zone) => zone.name.startsWith("Spawn-")),
    centers: zones.filter((zone) => zone.name === "Hub"),
    sides: zones.filter((zone) => zone.name.startsWith("Natural-") || zone.layout === "zone_layout_sides"),
    treasures: zones.filter((zone) => zone.layout === "zone_layout_treasure_zone"),
    connectors: zones.filter((zone) => zone.name.startsWith("Connector-") || zone.name.startsWith("Corridor-"))
  };
}

function zoneNumber(zone: Zone, field: NumericZoneField): number {
  const value = zone[field];
  expect(value, `${zone.name} is missing ${field}.`).not.toBeUndefined();
  return value as number;
}

function expectEconomyLightContestZone(zone: Zone): void {
  expect(zoneNumber(zone, "guardCutoffValue")).toBe(2000);
  expect(zoneNumber(zone, "guardMultiplier")).toBeCloseTo(1.6, 5);
  expect(zoneNumber(zone, "guardWeeklyIncrement")).toBeCloseTo(0.2, 5);
  expect(zoneNumber(zone, "guardedContentValue")).toBeGreaterThanOrEqual(650000);
  expect(zoneNumber(zone, "unguardedContentValue")).toBe(0);
  expect(zoneNumber(zone, "resourcesValue")).toBe(0);
}

function expectTreasureProfile(zone: Zone): void {
  expect(zoneNumber(zone, "guardCutoffValue")).toBe(1500);
  expect(zoneNumber(zone, "guardMultiplier")).toBeCloseTo(1.6, 5);
  expect(zoneNumber(zone, "guardWeeklyIncrement")).toBeCloseTo(0.15, 5);
  expect(zoneNumber(zone, "guardedContentValue")).toBeGreaterThanOrEqual(600000);
  expect(zoneNumber(zone, "unguardedContentValue")).toBeLessThanOrEqual(15000);
  expect(zoneNumber(zone, "resourcesValue")).toBe(0);
  expect(zoneNumber(zone, "guardedContentValue")).toBeGreaterThan(zoneNumber(zone, "unguardedContentValue") * 20);
}

function expectStartProfile(zone: Zone): void {
  expect(zoneNumber(zone, "guardCutoffValue")).toBe(1500);
  expect(zoneNumber(zone, "guardMultiplier")).toBeCloseTo(1.25, 5);
  expect(zoneNumber(zone, "guardWeeklyIncrement")).toBeCloseTo(0.15, 5);
  expect(zoneNumber(zone, "guardedContentValue")).toBeGreaterThanOrEqual(300000);
  expect(zoneNumber(zone, "unguardedContentValue")).toBeGreaterThanOrEqual(45000);
  expect(zoneNumber(zone, "resourcesValue")).toBeGreaterThan(0);
  expect(zoneNumber(zone, "resourcesValue")).toBeLessThanOrEqual(30000);
}

function expectSideProfile(zone: Zone): void {
  expect(zoneNumber(zone, "guardCutoffValue")).toBe(1500);
  expect(zoneNumber(zone, "guardMultiplier")).toBeCloseTo(1.6, 5);
  expect(zoneNumber(zone, "guardWeeklyIncrement")).toBeCloseTo(0.15, 5);
  expect(zoneNumber(zone, "guardedContentValue")).toBeGreaterThanOrEqual(300000);
  expect(zoneNumber(zone, "unguardedContentValue")).toBeLessThanOrEqual(20000);
  expect(zoneNumber(zone, "resourcesValue")).toBeGreaterThan(0);
  expect(zoneNumber(zone, "resourcesValue")).toBeLessThanOrEqual(12000);
}

function expectConnectorProfile(zone: Zone): void {
  expect(zoneNumber(zone, "guardCutoffValue")).toBe(1500);
  expect(zoneNumber(zone, "guardMultiplier")).toBeCloseTo(1.4, 5);
  expect(zoneNumber(zone, "guardWeeklyIncrement")).toBeCloseTo(0.2, 5);
  expect(zoneNumber(zone, "guardedContentValue")).toBeGreaterThanOrEqual(180000);
  expect(zoneNumber(zone, "unguardedContentValue")).toBeGreaterThanOrEqual(42000);
  expect(zoneNumber(zone, "resourcesValue")).toBeGreaterThan(0);
  expect(zoneNumber(zone, "resourcesValue")).toBeLessThanOrEqual(18000);
  expect(zoneNumber(zone, "resourcesValue")).toBeLessThan(zoneNumber(zone, "unguardedContentValue"));
}

function buildRingDuelBaseline(): GeneratorSettings {
  const settings = createDefaultSettings();
  settings.templateName = "Reference Ring Duel";
  settings.seed = 60601;
  settings.playerCount = 2;
  settings.mapWidth = 160;
  settings.mapHeight = 160;
  settings.topology = "Default";
  settings.connectionStyle = "Balanced";
  settings.zoneCfg.neutralZoneCount = 0;
  settings.zoneCfg.neutralZoneCastles = 0;
  settings.zoneCfg.advanced.enabled = true;
  settings.zoneCfg.advanced.neutralLowNoCastleCount = 1;
  settings.zoneCfg.advanced.neutralHighNoCastleCount = 1;
  return settings;
}

function buildHubCityHoldBaseline(): GeneratorSettings {
  const settings = createDefaultSettings();
  settings.templateName = "Reference Hub City Hold";
  settings.seed = 60602;
  settings.playerCount = 2;
  settings.mapWidth = 160;
  settings.mapHeight = 120;
  settings.topology = "HubAndSpoke";
  settings.zoneCfg.neutralZoneCount = 0;
  settings.zoneCfg.hubZoneCastles = 1;
  settings.gameEndConditions.victoryCondition = "win_condition_5";
  settings.gameEndConditions.cityHold = true;
  return settings;
}

function buildHighTreasureNeutralBaseline(): GeneratorSettings {
  const settings = createDefaultSettings();
  settings.templateName = "Reference High Treasure Neutral";
  settings.seed = 60603;
  settings.playerCount = 2;
  settings.mapWidth = 160;
  settings.mapHeight = 120;
  settings.topology = "Default";
  settings.noDirectPlayerConnections = true;
  settings.zoneCfg.neutralZoneCount = 0;
  settings.zoneCfg.neutralZoneCastles = 0;
  settings.zoneCfg.advanced.enabled = true;
  settings.zoneCfg.advanced.neutralHighNoCastleCount = 1;
  return settings;
}

function buildConnectorBaseline(): GeneratorSettings {
  const settings = createDefaultSettings();
  settings.templateName = "Reference Connector Ring";
  settings.seed = 60604;
  settings.playerCount = 2;
  settings.mapWidth = 160;
  settings.mapHeight = 160;
  settings.topology = "Default";
  settings.connectionStyle = "Balanced";
  settings.noDirectPlayerConnections = true;
  settings.zoneCfg.neutralZoneCount = 2;
  settings.zoneCfg.neutralZoneCastles = 0;
  settings.experimentalBalancedZonePlacement = true;
  settings.minNeutralZonesBetweenPlayers = 1;
  return settings;
}

describe("generator reference balance regression", () => {
  it("keeps duel ring starts and side zones in distinct early-economy roles", () => {
    const template = generateTemplate(buildRingDuelBaseline());
    const roles = zonesByRole(template);
    const side = findZone(template, "Neutral-3");
    const treasure = findZone(template, "Neutral-4");

    expect(roles.starts).toHaveLength(2);
    expect(roles.sides).toEqual([side]);
    expect(roles.treasures).toContain(treasure);

    for (const start of roles.starts) {
      expectStartProfile(start);
      expect(zoneNumber(start, "resourcesValue")).toBeGreaterThan(zoneNumber(side, "resourcesValue"));
      expect(zoneNumber(start, "resourcesValue")).toBeLessThan(80000);
      expect(zoneNumber(start, "guardedContentValue")).toBeLessThan(zoneNumber(treasure, "guardedContentValue"));
    }

    expectSideProfile(side);
  });

  it("keeps city-hold hubs as economy-light contest centers", () => {
    const template = generateTemplate(buildHubCityHoldBaseline());
    const roles = zonesByRole(template);
    const hub = findZone(template, "Hub");

    expect(roles.centers).toEqual([hub]);
    expect(roles.starts).toHaveLength(2);

    expectEconomyLightContestZone(hub);
    for (const start of roles.starts) {
      expectStartProfile(start);
      expect(zoneNumber(hub, "guardedContentValue")).toBeGreaterThan(zoneNumber(start, "guardedContentValue"));
      expect(zoneNumber(hub, "unguardedContentValue")).toBeLessThan(zoneNumber(start, "unguardedContentValue"));
      expect(zoneNumber(hub, "resourcesValue")).toBeLessThan(zoneNumber(start, "resourcesValue"));
    }
  });

  it("keeps high treasure neutrals prize-heavy instead of raw-economy heavy", () => {
    const template = generateTemplate(buildHighTreasureNeutralBaseline());
    const treasure = findZone(template, "Neutral-3");
    const start = findZone(template, "Spawn-1");

    expectTreasureProfile(treasure);
    expectStartProfile(start);
    expect(zoneNumber(treasure, "guardedContentValue")).toBeGreaterThan(zoneNumber(start, "guardedContentValue"));
    expect(zoneNumber(treasure, "unguardedContentValue")).toBeLessThan(zoneNumber(start, "unguardedContentValue"));
    expect(zoneNumber(treasure, "resourcesValue")).toBeLessThan(zoneNumber(start, "resourcesValue"));
  });

  it("keeps weekly growth bands role-specific where the reference set differs", () => {
    const ringTemplate = generateTemplate(buildRingDuelBaseline());
    const hubTemplate = generateTemplate(buildHubCityHoldBaseline());
    const treasureTemplate = generateTemplate(buildHighTreasureNeutralBaseline());
    const start = findZone(ringTemplate, "Spawn-1");
    const side = findZone(ringTemplate, "Neutral-3");
    const treasure = findZone(treasureTemplate, "Neutral-3");
    const center = findZone(hubTemplate, "Hub");

    expect(zoneNumber(start, "guardWeeklyIncrement")).toBeCloseTo(0.15, 5);
    expect(zoneNumber(side, "guardWeeklyIncrement")).toBeCloseTo(0.15, 5);
    expect(zoneNumber(treasure, "guardWeeklyIncrement")).toBeCloseTo(0.15, 5);
    expect(zoneNumber(center, "guardWeeklyIncrement")).toBeCloseTo(0.2, 5);
  });

  it("gives connector and corridor neutrals a distinct PvP profile when isolation inserts lane zones", () => {
    const template = generateTemplate(buildConnectorBaseline());
    const neutralZones = (template.variants?.[0]?.zones ?? []).filter((zone) => zone.name.startsWith("Neutral-"));
    const connectors = neutralZones.filter((zone) =>
      zoneNumber(zone, "guardCutoffValue") === 1500
      && Math.abs(zoneNumber(zone, "guardMultiplier") - 1.4) < 1e-9
      && Math.abs(zoneNumber(zone, "guardWeeklyIncrement") - 0.2) < 1e-9
    );

    expect(neutralZones).toHaveLength(2);
    expect(connectors.length).toBeGreaterThan(0);
    for (const connector of connectors) {
      expectConnectorProfile(connector);
    }
  });
});