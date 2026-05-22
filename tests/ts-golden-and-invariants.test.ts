import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { generateTemplate, serializeTemplate } from "../src/generator";
import {
  applyConnectionStyle,
  applyGenerationPreset,
  applyPacePreset,
  createDefaultSettings,
  validateSettings
} from "../src/settings";
import { parseRmgTemplate, serializeRmgTemplate, type ConnectionStyle, type GamePacePreset, type GeneratorSettings, type MapGenerationPreset, type MapTopology } from "../src/types";
import { expectDirectAndPortalGraphConnected, expectGeneratedTemplateInvariants, expectSingleVariant } from "./template-invariants";

const settingsFixtureDir = join(process.cwd(), "tests/fixtures/settings");
const goldenFixtureDir = join(process.cwd(), "tests/fixtures/golden");
const exampleFixtureDir = join(process.cwd(), "tests/fixtures/examples");
const updateGoldens = process.env.UPDATE_GOLDENS === "1";

const goldenCases = [
  "ring-duel-balanced.json",
  "koth-city-hold.json"
];

const nonCustomPresets: MapGenerationPreset[] = ["Duel", "FreeForAll", "KingOfTheHill", "EmpireBuilder", "Arena", "Chaos", "SingleHero", "BlitzLike", "JebusLikeObjective", "AnarchyLike"];
const nonCustomPaces: GamePacePreset[] = ["Quick", "Standard", "Epic", "Competitive", "Casual", "HighResource", "LowResource"];
const connectionStyles: ConnectionStyle[] = ["Balanced", "SafeLanes", "OpenConflict", "Chokepoints", "ManyRoutes", "PortalHeavy", "RoadHeavy", "RoadLight"];
const styleTopologies: MapTopology[] = ["Default", "HubAndSpoke", "Random", "Ladder"];

describe("golden template fixtures", () => {
  it.each(goldenCases)("%s matches deterministic generated JSON", (fixtureName) => {
    const settings = loadSettingsFixture(fixtureName);
    const generated = serializeTemplate(generateTemplate(settings));
    const goldenPath = join(goldenFixtureDir, fixtureName.replace(".json", ".rmg.json"));

    if (updateGoldens) {
      mkdirSync(goldenFixtureDir, { recursive: true });
      writeFileSync(goldenPath, generated, "utf8");
    }

    expect(existsSync(goldenPath), `${goldenPath} is missing. Run UPDATE_GOLDENS=1 npm test -- --run tests/ts-golden-and-invariants.test.ts to create it.`).toBe(true);
    expect(generated).toBe(readFileSync(goldenPath, "utf8"));
    expectGeneratedTemplateInvariants(generateTemplate(settings), settings);
  });
});

describe("generator settings validation parity", () => {
  it("reports template name and hero range errors", () => {
    const settings = createDefaultSettings();
    settings.templateName = " ";
    settings.heroSettings.heroCountMin = 9;
    settings.heroSettings.heroCountMax = 4;

    const validation = validateSettings(settings);

    expect(validation.errors).toContain("Template name is required.");
    expect(validation.errors).toContain("Initial hero cap cannot be greater than max hero cap.");
  });

  it("uses advanced neutral zone totals for the zone limit", () => {
    const settings = createDefaultSettings();
    settings.playerCount = 8;
    settings.zoneCfg.advanced.enabled = true;
    settings.zoneCfg.advanced.neutralHighNoCastleCount = 25;

    expect(validateSettings(settings).errors).toContain("Generated templates support at most 32 zones.");
  });

  it("requires a city hold target outside hub and triangle layouts", () => {
    const settings = createDefaultSettings();
    settings.topology = "Default";
    settings.zoneCfg.neutralZoneCount = 0;
    settings.gameEndConditions.cityHold = true;
    settings.gameEndConditions.victoryCondition = "win_condition_5";

    expect(validateSettings(settings).errors).toContain("City Hold needs a hub, triangle center, or at least one neutral zone.");
  });

  it("requires tournament mode to stay at two players", () => {
    const settings = createDefaultSettings();
    settings.playerCount = 3;
    settings.tournamentRules.enabled = true;

    expect(validateSettings(settings).errors).toContain("Tournament mode requires exactly 2 players.");
  });
});

describe("preset and pace parity", () => {
  it.each(nonCustomPresets)("%s preset normalizes to a valid generated template", (preset) => {
    const settings = createDefaultSettings();
    settings.templateName = `${preset} Preset Test`;
    settings.preset = preset;

    const normalized = applyGenerationPreset(settings);
    const validation = validateSettings(normalized);
    const template = generateTemplate(settings);

    expect(validation.errors).toHaveLength(0);
    expect(normalized.preset).toBe(preset);
    expect(normalized.playerCount).toBeGreaterThanOrEqual(2);
    expect(normalized.playerCount).toBeLessThanOrEqual(8);
    expectSingleVariant(template);
    expectGeneratedTemplateInvariants(template, normalized);
  });

  it.each([
    ["SingleHero", { gameMode: "SingleHero", heroHireBan: true, lostStartHero: true, heroMin: 1, heroMax: 1 }],
    ["BlitzLike", { mapWidth: 120, mapHeight: 120, noDirectPlayerConnections: false, minNeutralZonesBetweenPlayers: 0, neutralStrength: 130, borderStrength: 140 }],
    ["JebusLikeObjective", { topology: "HubAndSpoke", cityHold: true, cityHoldDays: 6, hubZoneCastles: 1 }],
    ["AnarchyLike", { encounterHoles: true, randomPortals: true, guardRandomization: 0.3 }]
  ] as const)("applies expected %s identity rules", (preset, expected) => {
    const settings = createDefaultSettings();
    settings.preset = preset;

    const normalized = applyGenerationPreset(settings);

    if ("gameMode" in expected) expect(normalized.gameMode).toBe(expected.gameMode);
    if ("heroHireBan" in expected) expect(normalized.heroHireBan).toBe(expected.heroHireBan);
    if ("lostStartHero" in expected) expect(normalized.gameEndConditions.lostStartHero).toBe(expected.lostStartHero);
    if ("heroMin" in expected) expect(normalized.heroSettings.heroCountMin).toBe(expected.heroMin);
    if ("heroMax" in expected) expect(normalized.heroSettings.heroCountMax).toBe(expected.heroMax);
    if ("mapWidth" in expected) expect(normalized.mapWidth).toBe(expected.mapWidth);
    if ("mapHeight" in expected) expect(normalized.mapHeight).toBe(expected.mapHeight);
    if ("noDirectPlayerConnections" in expected) expect(normalized.noDirectPlayerConnections).toBe(expected.noDirectPlayerConnections);
    if ("minNeutralZonesBetweenPlayers" in expected) expect(normalized.minNeutralZonesBetweenPlayers).toBe(expected.minNeutralZonesBetweenPlayers);
    if ("neutralStrength" in expected) expect(normalized.zoneCfg.neutralStackStrengthPercent).toBe(expected.neutralStrength);
    if ("borderStrength" in expected) expect(normalized.zoneCfg.borderGuardStrengthPercent).toBe(expected.borderStrength);
    if ("topology" in expected) expect(normalized.topology).toBe(expected.topology);
    if ("cityHold" in expected) expect(normalized.gameEndConditions.cityHold).toBe(expected.cityHold);
    if ("cityHoldDays" in expected) expect(normalized.gameEndConditions.cityHoldDays).toBe(expected.cityHoldDays);
    if ("hubZoneCastles" in expected) expect(normalized.zoneCfg.hubZoneCastles).toBe(expected.hubZoneCastles);
    if ("encounterHoles" in expected) expect(normalized.encounterHoles).toBe(expected.encounterHoles);
    if ("randomPortals" in expected) expect(normalized.randomPortals).toBe(expected.randomPortals);
    if ("guardRandomization" in expected) expect(normalized.zoneCfg.advanced.guardRandomization).toBe(expected.guardRandomization);
  });

  it.each([
    ["Quick", 100, 85, 80, 80, 3, 6],
    ["Standard", 100, 100, 100, 100, 4, 8],
    ["Epic", 100, 130, 125, 100, 5, 12],
    ["Competitive", 100, 100, 100, 100, 4, 8],
    ["Casual", 135, 100, 75, 80, 4, 8],
    ["HighResource", 160, 125, 100, 100, 4, 8],
    ["LowResource", 70, 80, 115, 100, 4, 8]
  ] as const)("applies expected %s pacing values", (pace, resource, structure, neutralStrength, borderStrength, heroMin, heroMax) => {
    const settings = createDefaultSettings();
    settings.pacePreset = pace;

    const normalized = applyPacePreset(settings);

    expect(normalized.zoneCfg.resourceDensityPercent).toBe(resource);
    expect(normalized.zoneCfg.structureDensityPercent).toBe(structure);
    expect(normalized.zoneCfg.neutralStackStrengthPercent).toBe(neutralStrength);
    expect(normalized.zoneCfg.borderGuardStrengthPercent).toBe(borderStrength);
    expect(normalized.heroSettings.heroCountMin).toBe(heroMin);
    expect(normalized.heroSettings.heroCountMax).toBe(heroMax);
  });

  it.each(nonCustomPaces)("%s pace combines with generated templates without structural drift", (pacePreset) => {
    const settings = createDefaultSettings();
    settings.templateName = `${pacePreset} Pace Test`;
    settings.pacePreset = pacePreset;
    settings.zoneCfg.neutralZoneCount = 4;
    settings.seed = 5150;

    const normalized = applyPacePreset(settings);
    const template = generateTemplate(settings);

    expect(validateSettings(normalized).errors).toHaveLength(0);
    expectGeneratedTemplateInvariants(template, normalized);
  });
});

describe("connection styles", () => {
  it.each(connectionStyles.flatMap((style) => styleTopologies.map((topology) => [style, topology] as const)))(
    "%s style on %s topology produces a connected template",
    (connectionStyle, topology) => {
      const settings = createDefaultSettings();
      settings.templateName = `${connectionStyle} ${topology}`;
      settings.seed = 4242;
      settings.playerCount = 4;
      settings.mapWidth = 208;
      settings.mapHeight = 208;
      settings.topology = topology;
      settings.connectionStyle = connectionStyle;
      settings.zoneCfg.neutralZoneCount = 6;
      settings.zoneCfg.neutralZoneCastles = 1;

      const normalized = applyConnectionStyle(settings);
      const template = generateTemplate(settings);
      const variant = expectSingleVariant(template);
      const zones = variant.zones ?? [];
      const connections = variant.connections ?? [];
      const zoneNames = new Set(zones.map((zone) => zone.name));

      for (const connection of connections) {
        expect(zoneNames.has(connection.from)).toBe(true);
        expect(zoneNames.has(connection.to)).toBe(true);
      }
      expectDirectAndPortalGraphConnected(zones, connections);
      expectGeneratedTemplateInvariants(template, normalized);
    });
});

describe("generated template invariant matrix", () => {
  it.each(buildInvariantMatrix())("$name", ({ settings }) => {
    const validation = validateSettings(settings);
    expect(validation.errors).toHaveLength(0);

    expectGeneratedTemplateInvariants(generateTemplate(settings), settings);
  });
});

describe("bundled example compatibility", () => {
  const exampleNames = readdirSync(exampleFixtureDir).filter((name) => name.endsWith(".rmg.json")).sort();
  const knownRoadConnectionEndpointExceptions: Record<string, Set<string>> = {
    "All Around.rmg.json": new Set(["Spawn-A-Spawn-C-Side-1"]),
    "Maneuvers.rmg.json": new Set(["Green-3-Green-4"]),
    "Nuclear.rmg.json": new Set([
      "Spawn-1-Spawn-1-Side-2",
      "Spawn-2-Spawn-2-Side-2",
      "Spawn-3-Spawn-3-Side-2",
      "Spawn-4-Spawn-4-Side-2",
      "Spawn-5-Spawn-5-Side-2",
      "Spawn-6-Spawn-6-Side-2"
    ]),
    "Symphony.rmg.json": new Set(["Spawn-C-Zone-20", "Spawn-C-Zone-22"]),
    "Trinity.rmg.json": new Set(["Green-3-Green-4"])
  };
  const knownMandatoryContentReferenceExceptions: Record<string, Set<string>> = {
    "Fair'n Square.rmg.json": new Set(["mandatory_content_treasur_1"]),
    "Trinity.rmg.json": new Set(["mandatory_content_yellow"])
  };

  it.each(exampleNames)("%s parses, round-trips, and keeps references in variant scope", (exampleName) => {
    const originalJson = readFileSync(join(exampleFixtureDir, exampleName), "utf8");
    const template = parseRmgTemplate(originalJson);
    const roundTripped = parseRmgTemplate(serializeRmgTemplate(template));

    expect(template.name.trim()).not.toBe("");
    expect(template.sizeX).toBeGreaterThan(0);
    expect(template.sizeZ).toBeGreaterThan(0);
    expect(roundTripped.name).toBe(template.name);
    expect(roundTripped.sizeX).toBe(template.sizeX);
    expect(roundTripped.sizeZ).toBe(template.sizeZ);
    expect(roundTripped.variants?.length).toBe(template.variants?.length);
    expect(roundTripped.zoneLayouts?.length).toBe(template.zoneLayouts?.length);
    expect(roundTripped.mandatoryContent?.length).toBe(template.mandatoryContent?.length);

    const mandatoryContentGroups = new Set((template.mandatoryContent ?? []).map((group) => group.name));
    for (const variant of template.variants ?? []) {
      const zoneNames = new Set((variant.zones ?? []).map((zone) => zone.name));
      expect(zoneNames.size).toBeGreaterThan(0);

      for (const connection of variant.connections ?? []) {
        expect(zoneNames.has(connection.from), `${exampleName} connection ${connection.name ?? "<unnamed>"} has unknown from zone ${connection.from}.`).toBe(true);
        expect(zoneNames.has(connection.to), `${exampleName} connection ${connection.name ?? "<unnamed>"} has unknown to zone ${connection.to}.`).toBe(true);
      }

      const connectionNames = new Set((variant.connections ?? []).map((connection) => connection.name).filter(Boolean));
      for (const zone of variant.zones ?? []) {
        for (const road of zone.roads ?? []) {
          for (const endpoint of [road.from, road.to]) {
            if (endpoint?.type !== "Connection") continue;
            const connectionName = endpoint.args?.[0] ?? "";
            if (knownRoadConnectionEndpointExceptions[exampleName]?.has(connectionName)) continue;
            expect(connectionNames.has(connectionName), `${exampleName} road endpoint references missing connection ${connectionName}.`).toBe(true);
          }
        }

        for (const mandatoryContentName of zone.mandatoryContent ?? []) {
          if (knownMandatoryContentReferenceExceptions[exampleName]?.has(mandatoryContentName)) continue;
          expect(mandatoryContentGroups.has(mandatoryContentName), `${exampleName} zone ${zone.name} references missing mandatory content group ${mandatoryContentName}.`).toBe(true);
        }
      }
    }
  });
});

function loadSettingsFixture(name: string): GeneratorSettings {
  const raw = readFileSync(join(settingsFixtureDir, name), "utf8");
  return mergeSettings(createDefaultSettings(), JSON.parse(raw) as Partial<GeneratorSettings>);
}

function mergeSettings(base: GeneratorSettings, patch: Partial<GeneratorSettings>): GeneratorSettings {
  return deepMerge(base, patch) as GeneratorSettings;
}

function deepMerge<T>(base: T, patch: Partial<T>): T {
  if (!isPlainObject(base) || !isPlainObject(patch)) return patch as T;
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    const baseValue = result[key];
    result[key] = isPlainObject(baseValue) && isPlainObject(value)
      ? deepMerge(baseValue, value as Record<string, unknown>)
      : value;
  }
  return result as T;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function buildInvariantMatrix(): Array<{ name: string; settings: GeneratorSettings }> {
  return [
    matrixCase("Ring 2p no neutrals", "Default", 2, { neutralCount: 0, seed: 1001 }),
    matrixCase("Ring 4p isolated portals no roads", "Default", 4, { neutralCount: 4, portals: true, maxPortals: 3, roads: false, isolation: true, seed: 1002 }),
    matrixCase("Ring 8p high advanced neutrals", "Default", 8, { advancedNeutralCount: 24, portals: true, maxPortals: 8, seed: 1003 }),
    matrixCase("Random 2p single neutral portals", "Random", 2, { neutralCount: 1, portals: true, maxPortals: 2, seed: 2001 }),
    matrixCase("Random 4p isolated no roads", "Random", 4, { neutralCount: 4, roads: false, isolation: true, seed: 2002 }),
    matrixCase("Random 8p advanced neutrals", "Random", 8, { advancedNeutralCount: 16, seed: 2003 }),
    matrixCase("Chain 3p no neutrals", "Chain", 3, { neutralCount: 0, seed: 3001 }),
    matrixCase("Chain 4p isolated portals", "Chain", 4, { neutralCount: 4, portals: true, maxPortals: 3, isolation: true, seed: 3002 }),
    matrixCase("Chain 8p advanced no roads", "Chain", 8, { advancedNeutralCount: 16, roads: false, seed: 3003 }),
    matrixCase("Hub 2p city hold no neutrals", "HubAndSpoke", 2, { neutralCount: 0, cityHold: true, seed: 4001 }),
    matrixCase("Hub 4p portals no roads", "HubAndSpoke", 4, { neutralCount: 4, portals: true, maxPortals: 4, roads: false, isolation: true, seed: 4002 }),
    matrixCase("Hub 8p advanced neutrals", "HubAndSpoke", 8, { advancedNeutralCount: 16, seed: 4003 }),
    matrixCase("Shared Web 2p connector neutral", "SharedWeb", 2, { neutralCount: 0, seed: 5001 }),
    matrixCase("Shared Web 4p isolated portals no roads", "SharedWeb", 4, { neutralCount: 4, portals: true, maxPortals: 4, roads: false, isolation: true, seed: 5002 }),
    matrixCase("Shared Web 8p advanced neutrals", "SharedWeb", 8, { advancedNeutralCount: 16, seed: 5003 }),
    matrixCase("Ladder 3p connector neutral", "Ladder", 3, { neutralCount: 0, seed: 6001 }),
    matrixCase("Ladder 4p isolated portals no roads", "Ladder", 4, { neutralCount: 4, portals: true, maxPortals: 2, roads: false, isolation: true, seed: 6002 }),
    matrixCase("Ladder 8p advanced neutrals", "Ladder", 8, { advancedNeutralCount: 16, seed: 6003 }),
    matrixCase("Triangle city hold", "Triangle", 3, { cityHold: true, seed: 7001 }),
    matrixCase("Triangle portals no roads", "Triangle", 3, { portals: true, maxPortals: 5, roads: false, seed: 7002 })
  ];
}

function matrixCase(
  name: string,
  topology: MapTopology,
  players: number,
  options: {
    neutralCount?: number;
    advancedNeutralCount?: number;
    roads?: boolean;
    portals?: boolean;
    maxPortals?: number;
    isolation?: boolean;
    cityHold?: boolean;
    seed: number;
  }
): { name: string; settings: GeneratorSettings } {
  const settings = createDefaultSettings();
  settings.templateName = name;
  settings.seed = options.seed;
  settings.playerCount = players;
  settings.mapWidth = 240;
  settings.mapHeight = 240;
  settings.topology = topology;
  settings.randomPortals = options.portals ?? false;
  settings.maxPortalConnections = options.maxPortals ?? 32;
  settings.generateRoads = options.roads ?? true;
  settings.noDirectPlayerConnections = options.isolation ?? false;
  settings.zoneCfg.neutralZoneCount = (options.advancedNeutralCount ?? 0) > 0 ? 0 : options.neutralCount ?? 0;
  settings.zoneCfg.neutralZoneCastles = (options.neutralCount ?? 0) > 0 ? 1 : 0;
  settings.zoneCfg.hubZoneCastles = options.cityHold ? 1 : 0;
  settings.gameEndConditions.victoryCondition = options.cityHold ? "win_condition_5" : "win_condition_1";
  settings.gameEndConditions.cityHold = options.cityHold ?? false;

  if ((options.advancedNeutralCount ?? 0) > 0) {
    const neutralCount = options.advancedNeutralCount!;
    const lowNoCastle = Math.floor(neutralCount / 3);
    const mediumCastle = Math.floor(neutralCount / 3);
    const highNoCastle = neutralCount - lowNoCastle - mediumCastle;
    settings.zoneCfg.advanced.enabled = true;
    settings.zoneCfg.advanced.neutralLowNoCastleCount = lowNoCastle;
    settings.zoneCfg.advanced.neutralMediumCastleCount = mediumCastle;
    settings.zoneCfg.advanced.neutralHighNoCastleCount = highNoCastle;
  }

  return { name, settings };
}
