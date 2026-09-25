import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildBalancedRandomMapSettings,
  createBalancedRandomMapDraft,
  type BalancedRandomMapDraft
} from "../src/balancedRandomMap";
import {
  addZone,
  applyRmgJsonToDesign,
  createDefaultDesign,
  deleteZone,
  designToTemplate,
  templateToDesign,
  validateDesign,
  type DwellingSettings,
  type TemplateDesign
} from "../src/design";
import { generateTemplate } from "../src/generator";
import { directConnection, ensurePlayerZonesConnected } from "../src/generator/connectionBuilder";
import { defaultGuardRandomization, type GenerationTuning } from "../src/generator/math";
import { buildAllContentCountLimits, buildHubZone, countDwellingContentItems } from "../src/generator/templateContentBuilder";
import { collectRmgDiagnostics } from "../src/rmgDiagnostics";
import { applyConnectionStyle, createDefaultSettings, normalizeSettings, validateSettings } from "../src/settings";
import {
  parseRmgTemplate,
  serializeRmgTemplate,
  type Connection,
  type ConnectionStyle,
  type GeneratorSettings,
  type MapTopology,
  type RmgTemplate,
  type Zone
} from "../src/types";
import { zoneHints } from "../src/zoneHints";

const officialTemplateDir = join(process.cwd(), "docs/reference/olden-era-rmg-templates");

function officialTemplate(name: string): RmgTemplate {
  return parseRmgTemplate(readFileSync(join(officialTemplateDir, `${name}.rmg.json`), "utf8"));
}

function officialTemplateNames(): string[] {
  return readdirSync(officialTemplateDir)
    .filter((fileName) => fileName.endsWith(".rmg.json"))
    .sort((left, right) => left.localeCompare(right))
    .map((fileName) => fileName.slice(0, -".rmg.json".length));
}

const unitTuning: GenerationTuning = {
  contentScale: 1,
  resourceDensityMultiplier: 0.5,
  structureDensityMultiplier: 1,
  neutralStackStrengthMultiplier: 1,
  borderGuardStrengthMultiplier: 1,
  guardRandomization: defaultGuardRandomization
};

function variantZones(template: RmgTemplate): Zone[] {
  return template.variants?.[0]?.zones ?? [];
}

function variantConnections(template: RmgTemplate): Connection[] {
  return template.variants?.[0]?.connections ?? [];
}

function zonesByName(template: RmgTemplate): Map<string, Zone> {
  return new Map(variantZones(template).map((zone) => [zone.name, zone]));
}

function walkableComponents(zones: Zone[], connections: Connection[]): string[][] {
  const graph = new Map(zones.map((zone) => [zone.name, [] as string[]]));
  for (const connection of connections) {
    if (connection.connectionType !== "Direct" && connection.connectionType !== "Portal") continue;
    graph.get(connection.from)?.push(connection.to);
    graph.get(connection.to)?.push(connection.from);
  }
  const visited = new Set<string>();
  const components: string[][] = [];
  for (const zone of zones) {
    if (visited.has(zone.name)) continue;
    const component: string[] = [];
    const queue = [zone.name];
    visited.add(zone.name);
    while (queue.length > 0) {
      const current = queue.shift()!;
      component.push(current);
      for (const next of graph.get(current) ?? []) {
        if (visited.has(next)) continue;
        visited.add(next);
        queue.push(next);
      }
    }
    components.push(component);
  }
  return components;
}

function templateComponents(template: RmgTemplate): string[][] {
  return walkableComponents(variantZones(template), variantConnections(template));
}

function dwellingsPerZone(template: RmgTemplate): Record<string, number> {
  const groups = new Map((template.mandatoryContent ?? []).map((group) => [group.name, group]));
  return Object.fromEntries(variantZones(template).map((zone) => [
    zone.name,
    (zone.mandatoryContent ?? []).reduce((sum, name) => sum + countDwellingContentItems(groups.get(name)?.content), 0)
  ]));
}

function roadConnectionReferences(template: RmgTemplate): string[] {
  return variantZones(template).flatMap((zone) => (zone.roads ?? []).flatMap((road) => [road.from, road.to]))
    .filter((endpoint) => endpoint?.type === "Connection")
    .map((endpoint) => String(endpoint?.args?.[0]));
}

function battleDays(template: RmgTemplate): number[] {
  const winConditions = template.gameRules?.winConditions;
  const announceDays = winConditions?.tournamentAnnounceDays ?? [];
  return (winConditions?.tournamentDays ?? []).map((days, index) => (announceDays[index] ?? 0) + days);
}

function balancedDraft(patch: Partial<BalancedRandomMapDraft>): BalancedRandomMapDraft {
  return { ...createBalancedRandomMapDraft(), seed: "42", ...patch };
}

function portalCount(template: RmgTemplate): number {
  return variantConnections(template).filter((connection) => connection.connectionType === "Portal").length;
}

function setGeneratedDwellings(design: TemplateDesign, zoneName: string, settings: DwellingSettings): void {
  const zone = design.zones.find((candidate) => candidate.name === zoneName)!;
  zone.dwellingSettings = settings;
  zone.dwellingCount = settings.lowTierCount + settings.highTierCount;
  zone.dwellingCountCustomized = true;
}

describe("adding zones keeps zone ids unique", () => {
  it("does not reuse an existing zone id after importing an official template", () => {
    const imported = templateToDesign(officialTemplate("Jebus Cross"));
    const existingIds = new Set(imported.zones.map((zone) => zone.id));

    const next = addZone(imported, "Neutral");
    const added = next.zones.at(-1)!;

    expect(existingIds.has(added.id)).toBe(false);
    expect(new Set(next.zones.map((zone) => zone.id)).size).toBe(next.zones.length);
    expect(new Set(next.zones.map((zone) => zone.name)).size).toBe(next.zones.length);

    const exported = designToTemplate(next, { skipValidation: true });
    const centerConnections = variantConnections(exported).filter((connection) => connection.from === "Center" || connection.to === "Center");
    expect(centerConnections).toHaveLength(imported.connections.filter((connection) => connection.from === "zone-1" || connection.to === "zone-1").length);
    expect(variantConnections(exported).some((connection) => connection.from === added.name || connection.to === added.name)).toBe(false);

    const afterDelete = deleteZone(next, added.id);
    expect(afterDelete.zones.map((zone) => zone.name)).toEqual(imported.zones.map((zone) => zone.name));
    expect(afterDelete.connections).toHaveLength(imported.connections.length);
  });

  it("does not reuse the id of a renamed zone", () => {
    const design = createDefaultDesign();
    design.zones.find((zone) => zone.id === "zone-3")!.name = "Center";

    const next = addZone(design, "Neutral");

    expect(next.zones.filter((zone) => zone.id === "zone-3").map((zone) => zone.name)).toEqual(["Center"]);
    expect(new Set(next.zones.map((zone) => zone.id)).size).toBe(next.zones.length);
    expect(new Set(next.zones.map((zone) => zone.name)).size).toBe(next.zones.length);
  });

  it("rejects designs whose zones share an id", () => {
    const design = createDefaultDesign();
    design.zones[2].id = design.zones[1].id;

    expect(validateDesign(design).errors).toContain("Zone ids must be unique.");
  });
});

describe("balanced random connection style", () => {
  const styles: ConnectionStyle[] = ["Balanced", "SafeLanes", "OpenConflict", "Chokepoints", "ManyRoutes", "PortalHeavy", "RoadHeavy", "RoadLight"];
  const connectionFields = (settings: GeneratorSettings) => ({
    noDirectPlayerConnections: settings.noDirectPlayerConnections,
    randomPortals: settings.randomPortals,
    maxPortalConnections: settings.maxPortalConnections,
    minNeutralZonesBetweenPlayers: settings.minNeutralZonesBetweenPlayers,
    experimentalBalancedZonePlacement: settings.experimentalBalancedZonePlacement,
    generateRoads: settings.generateRoads,
    spawnRemoteFootholds: settings.spawnRemoteFootholds
  });

  it("keeps an explicit max portal count when the ManyRoutes style enables portals", () => {
    const settings = buildBalancedRandomMapSettings(balancedDraft({ connectionStylePreset: "ManyRoutes", maxPortalConnections: 2, playerCount: 4, neutralZoneCount: 8 }));
    const template = generateTemplate(settings);

    expect(normalizeSettings(settings).maxPortalConnections).toBe(2);
    expect(portalCount(template)).toBeGreaterThan(0);
    expect(portalCount(template)).toBeLessThanOrEqual(2);
    expect(variantConnections(template).some((connection) => connection.name?.startsWith("AltRoute-"))).toBe(true);
  });

  it("lets explicit direct-route and random-portal choices beat the SafeLanes style", () => {
    const settings = buildBalancedRandomMapSettings(balancedDraft({ connectionStylePreset: "SafeLanes", noDirectPlayerConnections: "Disabled", randomPortals: true, playerCount: 3, topology: "Default" }));
    const normalized = normalizeSettings(settings);

    expect(normalized.noDirectPlayerConnections).toBe(false);
    expect(normalized.randomPortals).toBe(true);
    expect(portalCount(generateTemplate(settings))).toBeGreaterThan(0);
  });

  it("keeps an explicit zero neutral buffer with the Balanced style", () => {
    const settings = buildBalancedRandomMapSettings(balancedDraft({ minNeutralZonesBetweenPlayers: 0, playerCount: 2, gameType: "FreeForAll", topology: "Default" }));

    expect(settings.minNeutralZonesBetweenPlayers).toBe(0);
    expect(normalizeSettings(settings).minNeutralZonesBetweenPlayers).toBe(0);
  });

  it.each(styles)("still applies the %s style when no explicit override is set", (style) => {
    const settings = buildBalancedRandomMapSettings(balancedDraft({ connectionStylePreset: style }));

    expect(settings.connectionStyle).toBe(style);
    expect(connectionFields(normalizeSettings(settings))).toEqual(connectionFields(applyConnectionStyle(settings)));
  });
});

describe("generated connection graphs stay connected", () => {
  it("attaches an isolated spawn to an already-connected spawn instead of another isolated spawn", () => {
    const zones: Zone[] = ["Spawn-1", "Spawn-2", "Spawn-3", "Neutral-5", "Spawn-4"].map((name) => ({
      name,
      mainObjects: name.startsWith("Spawn-") ? [{ type: "Spawn" }] : [{ type: "City" }],
      roads: []
    }));
    const connections = [
      directConnection("Ring-3-5", "Spawn-3", "Neutral-5", "Spawn-3", 30000, "ring_3_5", unitTuning),
      directConnection("Ring-5-4", "Neutral-5", "Spawn-4", "Neutral-5", 30000, "ring_5_4", unitTuning)
    ];

    ensurePlayerZonesConnected(["1", "2", "3", "4"], zones, connections, unitTuning, true);

    expect(walkableComponents(zones, connections)).toHaveLength(1);
    expect(connections.some((connection) => connection.from === "Spawn-1" && connection.to === "Spawn-2")).toBe(false);
  });

  it("bridges isolated player lanes that each already have connections", () => {
    const zones: Zone[] = ["Spawn-1", "Spawn-2", "Neutral-5", "Spawn-3", "Spawn-4", "Neutral-6"].map((name) => ({
      name,
      mainObjects: name.startsWith("Spawn-") ? [{ type: "Spawn" }] : [{ type: "City" }],
      roads: []
    }));
    const connections = [
      directConnection("Ring-2-5", "Spawn-2", "Neutral-5", "Spawn-2", 30000, "ring_2_5", unitTuning),
      directConnection("Ring-5-3", "Neutral-5", "Spawn-3", "Neutral-5", 30000, "ring_5_3", unitTuning),
      directConnection("Ring-4-6", "Spawn-4", "Neutral-6", "Spawn-4", 30000, "ring_4_6", unitTuning),
      directConnection("Ring-6-1", "Neutral-6", "Spawn-1", "Neutral-6", 30000, "ring_6_1", unitTuning)
    ];

    ensurePlayerZonesConnected(["1", "2", "3", "4"], zones, connections, unitTuning, true);

    expect(walkableComponents(zones, connections)).toHaveLength(1);
    const added = connections.slice(4);
    expect(added.every((connection) => !(connection.from.startsWith("Spawn-") && connection.to.startsWith("Spawn-")))).toBe(true);
    for (const connection of added) {
      for (const zoneName of [connection.from, connection.to]) {
        const zone = zones.find((candidate) => candidate.name === zoneName)!;
        expect(zone.roads?.some((road) => road.to?.type === "Connection" && road.to.args?.[0] === connection.name)).toBe(true);
      }
    }
  });

  it("connects the balanced Ring map with four players and a single neutral zone", () => {
    const draft = balancedDraft({ seed: "7", topology: "Default", playerCount: 4, connectionStylePreset: "Custom" });
    draft.neutralSplit = { ...draft.neutralSplit, neutralMediumCastleCount: 1 };

    const template = generateTemplate(buildBalancedRandomMapSettings(draft));

    expect(templateComponents(template)).toHaveLength(1);
    expect(validateDesign(templateToDesign(template)).errors).toEqual([]);
  });

  const topologies: MapTopology[] = ["Default", "Chain", "Random", "HubAndSpoke", "SharedWeb", "Ladder", "Triangle"];
  it.each(topologies)("keeps %s generator templates connected across seeds, players, portals, and isolation", (topology) => {
    const failures: string[] = [];
    let checked = 0;
    for (const playerCount of [2, 3, 4, 6, 8]) {
      for (const neutralZoneCount of [0, 1, 2, 4]) {
        for (const isolate of [true, false]) {
          for (const randomPortals of [false, true]) {
            for (const balancedPlacement of [false, true]) {
              for (const minNeutral of [0, 1, 2]) {
                for (const seed of [1, 2, 3]) {
                  const settings = createDefaultSettings();
                  settings.templateName = `${topology} sweep`;
                  settings.topology = topology;
                  settings.playerCount = playerCount;
                  settings.mapWidth = 240;
                  settings.mapHeight = 240;
                  settings.zoneCfg.neutralZoneCount = neutralZoneCount;
                  settings.noDirectPlayerConnections = isolate;
                  settings.randomPortals = randomPortals;
                  settings.maxPortalConnections = 4;
                  settings.experimentalBalancedZonePlacement = balancedPlacement;
                  settings.minNeutralZonesBetweenPlayers = minNeutral;
                  settings.seed = seed;
                  if (validateSettings(settings).errors.length > 0) continue;
                  checked++;
                  const components = templateComponents(generateTemplate(settings));
                  if (components.length > 1) {
                    failures.push(`players=${playerCount} neutrals=${neutralZoneCount} isolate=${isolate} portals=${randomPortals} balanced=${balancedPlacement} min=${minNeutral} seed=${seed}: ${JSON.stringify(components)}`);
                  }
                }
              }
            }
          }
        }
      }
    }

    expect(checked).toBeGreaterThan(0);
    expect(failures.slice(0, 5), `${failures.length} disconnected ${topology} templates`).toEqual([]);
  });

  const balancedTopologies: BalancedRandomMapDraft["topology"][] = ["Auto", "Default", "HubAndSpoke", "SharedWeb", "Ladder", "Chain", "Triangle"];
  it.each(balancedTopologies)("keeps balanced-random %s templates connected (tournaments keep one lane per player)", (topology) => {
    const failures: string[] = [];
    let checked = 0;
    for (const gameType of ["Duel", "FreeForAll", "PvE"] as const) {
      for (const playerCount of [2, 4, 6]) {
        for (const neutralZoneCount of [0, 1, 2, 6]) {
          for (const splitNeutrals of [0, 1]) {
            for (const randomPortals of [false, true]) {
              for (const victoryCondition of ["Classic", "CityHold", "Tournament"] as const) {
                for (const seed of ["1", "2"]) {
                  const draft = balancedDraft({ topology, gameType, playerCount, neutralZoneCount, randomPortals, victoryCondition, seed });
                  draft.neutralSplit = { ...draft.neutralSplit, neutralMediumCastleCount: splitNeutrals };
                  const settings = buildBalancedRandomMapSettings(draft);
                  if (validateSettings(settings).errors.length > 0) continue;
                  checked++;
                  const template = generateTemplate(settings);
                  const components = templateComponents(template);
                  const label = `${gameType} players=${playerCount} neutrals=${neutralZoneCount} split=${splitNeutrals} portals=${randomPortals} ${victoryCondition} seed=${seed}`;
                  if (victoryCondition === "Tournament") {
                    if (!components.every((component) => component.some((name) => name.startsWith("Spawn-")))) failures.push(`${label}: ${JSON.stringify(components)}`);
                  } else if (components.length > 1) {
                    failures.push(`${label}: ${JSON.stringify(components)}`);
                  }
                }
              }
            }
          }
        }
      }
    }

    expect(checked).toBeGreaterThan(0);
    expect(failures.slice(0, 5), `${failures.length} disconnected balanced ${topology} templates`).toEqual([]);
  });
});

describe("zone Resources % and Structures %", () => {
  const budgetFields = ["guardedContentValue", "guardedContentValuePerArea", "unguardedContentValue", "unguardedContentValuePerArea", "resourcesValue", "resourcesValuePerArea"] as const;
  const budgets = (zone: Zone | undefined) => Object.fromEntries(budgetFields.map((field) => [field, zone?.[field]]));

  it("exports the raw zone budgets at 100%", () => {
    const design = createDefaultDesign();
    const exported = zonesByName(designToTemplate(design));

    for (const zone of design.zones) {
      expect(budgets(exported.get(zone.name)), zone.name).toEqual(Object.fromEntries(budgetFields.map((field) => [field, zone[field]])));
    }
  });

  it("scales exported budgets by each zone's percentages", () => {
    const design = createDefaultDesign();
    const baseline = zonesByName(designToTemplate(design));
    for (const zone of design.zones) {
      zone.resourceDensityPercent = 200;
      zone.structureDensityPercent = 50;
    }
    const tuned = zonesByName(designToTemplate(design));

    for (const zone of design.zones) {
      const base = baseline.get(zone.name)!;
      const out = tuned.get(zone.name)!;
      expect(out.resourcesValue, zone.name).toBe(base.resourcesValue! * 2);
      expect(out.resourcesValuePerArea, zone.name).toBe(base.resourcesValuePerArea! * 2);
      expect(out.guardedContentValue, zone.name).toBe(base.guardedContentValue! / 2);
      expect(out.guardedContentValuePerArea, zone.name).toBe(base.guardedContentValuePerArea! / 2);
      expect(out.unguardedContentValue, zone.name).toBe(base.unguardedContentValue! / 2);
      expect(out.unguardedContentValuePerArea, zone.name).toBe(base.unguardedContentValuePerArea! / 2);
    }
  });

  it("does not compound percentages when exported JSON is applied back onto the design", () => {
    const previous = createDefaultDesign();
    const neutral = previous.zones.find((zone) => zone.name === "Neutral-3")!;
    neutral.resourceDensityPercent = 180;
    neutral.structureDensityPercent = 60;
    neutral.unguardedContentValuePerArea = 187;
    const first = designToTemplate(previous);

    const result = applyRmgJsonToDesign(serializeRmgTemplate(first), previous);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.design.zones.find((zone) => zone.name === "Neutral-3")?.resourceDensityPercent).toBe(180);
    expect(result.design.zones.find((zone) => zone.name === "Neutral-3")?.structureDensityPercent).toBe(60);
    const second = designToTemplate(result.design);
    expect(budgets(zonesByName(second).get("Neutral-3"))).toEqual(budgets(zonesByName(first).get("Neutral-3")));
  });
});

describe("tournament rules import", () => {
  it.each(["Chosen One", "Exodus Classic", "Exodus", "Massacre", "Sprint"])("round-trips %s battle days", (name) => {
    const source = officialTemplate(name);

    const exported = designToTemplate(templateToDesign(source));

    expect(battleDays(exported)).toEqual(battleDays(source));
  });

  it("uses announce days when inferring the first tournament day and interval", () => {
    const design = templateToDesign(officialTemplate("Massacre"));

    expect(design.tournamentRules.firstTournamentDay).toBe(15);
    expect(design.tournamentRules.interval).toBe(7);
  });

  it("keeps generated tournament rules stable through export and import", () => {
    const design = createDefaultDesign();
    design.tournamentRules = { enabled: true, firstTournamentDay: 18, interval: 5, pointsToWin: 3, saveArmy: false };

    expect(templateToDesign(designToTemplate(design)).tournamentRules).toEqual(design.tournamentRules);
  });
});

describe("dwelling counts", () => {
  it.each(["Jebus Cross", "Pyramid"])("replaces the imported %s spawn dwellings instead of adding to them", (name) => {
    const source = officialTemplate(name);
    const sourceDwellings = dwellingsPerZone(source);
    const design = templateToDesign(source);
    const spawn = design.zones.find((zone) => zone.role === "Spawn")!;
    setGeneratedDwellings(design, spawn.name, { mode: "Generated", lowTierCount: 2, highTierCount: 0, specific: [] });

    const exported = designToTemplate(design);
    const exportedDwellings = dwellingsPerZone(exported);

    expect(exportedDwellings[spawn.name]).toBe(2);
    for (const zone of design.zones.filter((candidate) => candidate.name !== spawn.name)) {
      expect(exportedDwellings[zone.name], zone.name).toBe(sourceDwellings[zone.name]);
    }
    expect(templateToDesign(exported).zones.find((zone) => zone.name === spawn.name)?.dwellingCount).toBe(2);
  });

  it("removes imported dwellings when a zone's dwelling count is set to zero", () => {
    const design = templateToDesign(officialTemplate("Jebus Cross"));
    const spawn = design.zones.find((zone) => zone.role === "Spawn")!;
    setGeneratedDwellings(design, spawn.name, { mode: "Generated", lowTierCount: 0, highTierCount: 0, specific: [] });

    expect(dwellingsPerZone(designToTemplate(design))[spawn.name]).toBe(0);
  });

  it("keeps generated dwelling settings when zones are renamed", () => {
    const design = createDefaultDesign();
    design.zones.find((zone) => zone.id === "zone-1")!.name = "North";
    design.zones.find((zone) => zone.id === "zone-3")!.name = "Center";
    setGeneratedDwellings(design, "North", { mode: "Generated", lowTierCount: 3, highTierCount: 0, specific: [] });
    setGeneratedDwellings(design, "Center", { mode: "Generated", lowTierCount: 0, highTierCount: 4, specific: [] });

    const dwellings = dwellingsPerZone(designToTemplate(design));

    expect(dwellings).toEqual({ North: 3, Center: 4, "Spawn-2": 1 });
  });
});

describe("content count limits", () => {
  it("gives every generated content limit group its own sid limit entries", () => {
    const limits = buildAllContentCountLimits();
    limits[0].limits![0].maxCount = 99;
    limits[2].limits!.push({ sid: "black_tower", maxCount: 3 });

    expect(limits[1].limits![0].maxCount).not.toBe(99);
    expect(limits[1].limits).toHaveLength(12);
    expect(new Set(limits.map((limit) => limit.limits)).size).toBe(limits.length);
  });

  it("exports an edit to one design content limit group without touching the others", () => {
    const design = structuredClone(createDefaultDesign());
    const edited = design.contentCountLimits.find((limit) => limit.name === "content_limits_side_1_2")!;
    edited.limits!.find((limit) => limit.sid === "market")!.maxCount = 5;

    const exported = designToTemplate(design).contentCountLimits ?? [];

    expect(exported.find((limit) => limit.name === "content_limits_side_1_2")?.limits?.find((limit) => limit.sid === "market")?.maxCount).toBe(5);
    expect(exported.filter((limit) => limit.limits?.find((entry) => entry.sid === "market")?.maxCount === 5)).toHaveLength(1);
  });

  it("does not share sid limit arrays in designs created from generated templates", () => {
    const design = templateToDesign(generateTemplate(createDefaultSettings()));

    expect(new Set(design.contentCountLimits.map((limit) => limit.limits)).size).toBe(design.contentCountLimits.length);
  });
});

describe("connection roads", () => {
  it("exports and re-imports a disabled road on a direct connection", () => {
    const design = createDefaultDesign();
    design.connections[0].road = false;

    const exported = designToTemplate(design);

    expect(variantConnections(exported)[0].road).toBe(false);
    expect(templateToDesign(exported).connections[0].road).toBe(false);
    expect(collectRmgDiagnostics(exported).warnings.map((warning) => warning.code)).not.toContain("route_missing_visible_road");
  });

  it("exports road: true on enabled direct connections", () => {
    const exported = designToTemplate(createDefaultDesign());

    expect(variantConnections(exported).map((connection) => connection.road)).toEqual([true, true]);
  });
});

describe("proximity connections", () => {
  it("does not count proximity links toward design connectivity", () => {
    const design = createDefaultDesign();
    design.connections[1].type = "Proximity";

    expect(validateDesign(design).errors).toContain("Direct and portal connections must connect every zone.");
  });

  it("does not draw zone roads to proximity links", () => {
    const design = createDefaultDesign();
    design.connections[1].type = "Proximity";

    const exported = designToTemplate(design, { skipValidation: true });

    expect(roadConnectionReferences(exported)).not.toContain("Path-3-2");
    expect(roadConnectionReferences(exported)).toContain("Path-1-3");
  });

  it("imports proximity links without roads and does not add roads to them on round trip", () => {
    const source = officialTemplate("Jebus Cross");
    const proximityNames = new Set(variantConnections(source).filter((connection) => connection.connectionType === "Proximity").map((connection) => connection.name));
    const design = templateToDesign(source);

    expect(proximityNames.size).toBeGreaterThan(0);
    expect(design.connections.filter((connection) => connection.type === "Proximity").every((connection) => !connection.road)).toBe(true);
    expect(roadConnectionReferences(designToTemplate(design)).filter((name) => proximityNames.has(name))).toEqual([]);
  });
});

describe("hub guard randomization", () => {
  it("uses the tuned guard randomization for hub zones", () => {
    expect(buildHubZone([], { ...unitTuning, guardRandomization: 0.3 }).guardRandomization).toBe(0.3);
  });

  it("round-trips a builder hub zone's guard randomization", () => {
    let design = addZone(createDefaultDesign(), "Hub");
    const hub = design.zones.find((zone) => zone.role === "Hub")!;
    hub.guardRandomizationPercent = 30;
    design = { ...design, connections: [...design.connections, { id: "conn-hub", name: "Path-Hub", from: hub.id, to: "zone-3", type: "Direct", guardStrength: 30000, road: true }] };

    const exported = designToTemplate(design);

    expect(zonesByName(exported).get(hub.name)?.guardRandomization).toBe(0.3);
    expect(templateToDesign(exported).zones.find((zone) => zone.role === "Hub")?.guardRandomizationPercent).toBe(30);
  });

  it("uses the generator's advanced guard randomization for generated hubs", () => {
    const settings = createDefaultSettings();
    settings.topology = "HubAndSpoke";
    settings.zoneCfg.neutralZoneCount = 2;
    settings.zoneCfg.advanced.enabled = true;
    settings.zoneCfg.advanced.neutralMediumCastleCount = 2;
    settings.zoneCfg.advanced.guardRandomization = 0.2;
    settings.seed = 11;

    expect(zonesByName(generateTemplate(settings)).get("Hub")?.guardRandomization).toBe(0.2);
  });
});

describe("road graph diagnostics", () => {
  it("does not warn about a road through a castle-less zone whose connections both touch it", () => {
    const design = createDefaultDesign();
    design.zones.find((zone) => zone.name === "Neutral-3")!.castleCount = 0;

    const warnings = collectRmgDiagnostics(designToTemplate(design)).warnings.map((warning) => warning.code);

    expect(warnings).not.toContain("route_road_without_graph_path");
  });

  it("does not flag official template roads", () => {
    const flagged = officialTemplateNames().flatMap((name) =>
      collectRmgDiagnostics(officialTemplate(name)).warnings
        .filter((warning) => warning.code === "route_road_without_graph_path")
        .map((warning) => `${name}: ${warning.message}`));

    expect(flagged).toEqual([]);
  });

  it("warns when a zone road joins a connection that does not touch the zone", () => {
    const template = designToTemplate(createDefaultDesign());
    const spawn = variantZones(template).find((zone) => zone.name === "Spawn-1")!;
    spawn.roads = [...(spawn.roads ?? []), { from: { type: "Connection", args: ["Path-1-3"] }, to: { type: "Connection", args: ["Path-3-2"] } }];

    const warnings = collectRmgDiagnostics(template).warnings.filter((warning) => warning.code === "route_road_without_graph_path");

    expect(warnings.map((warning) => warning.zoneName)).toEqual(["Spawn-1"]);
  });
});

describe("zone resource hints", () => {
  it("rates the default builder zones as normal resources", () => {
    for (const zone of createDefaultDesign().zones) {
      expect(zoneHints(zone).find((hint) => hint.id === "resources")?.label, zone.name).toBe("Normal resources");
    }
  });

  it("scores a new spawn zone's resource budget at the 100 index", () => {
    const [spawn] = createDefaultDesign().zones;

    expect(zoneHints(spawn).find((hint) => hint.id === "resources")?.detail).toContain("(100 index)");
  });

  it("separates rich and poor resource budgets", () => {
    const [spawn] = createDefaultDesign().zones;

    expect(zoneHints({ ...spawn, resourcesValue: 45000, resourcesValuePerArea: 360, resourceDensityPercent: 180 }).find((hint) => hint.id === "resources")?.label).toBe("Resource heavy");
    expect(zoneHints({ ...spawn, resourcesValue: 4500, resourcesValuePerArea: 30, resourceDensityPercent: 45 }).find((hint) => hint.id === "resources")?.label).toBe("Resource light");
  });
});

describe("spawn foothold rules", () => {
  it("only targets main objects that each spawn actually has", () => {
    const design = createDefaultDesign();
    design.zones.find((zone) => zone.name === "Spawn-1")!.castleCount = 2;

    const template = designToTemplate(design);

    for (const zone of variantZones(template).filter((candidate) => candidate.name.startsWith("Spawn-"))) {
      const group = template.mandatoryContent?.find((candidate) => candidate.name === zone.mandatoryContent?.[0]);
      const foothold = group?.content?.find((item) => item.sid === "remote_foothold");
      const targetedIndexes = (foothold?.rules ?? []).filter((rule) => rule.type === "MainObject").map((rule) => Number((rule.args as string[])[0]));
      expect(Math.max(...targetedIndexes), zone.name).toBeLessThan(zone.mainObjects?.length ?? 0);
    }
  });
});

describe("orientation anchor", () => {
  it("exports a zero-angle zone that exists after the anchor zone is renamed", () => {
    const design = createDefaultDesign();
    design.zones[0].name = "North";

    const exported = designToTemplate(design);

    expect(exported.variants?.[0]?.orientation?.zeroAngleZone).toBe("North");
  });

  it("keeps a zero-angle zone that still exists", () => {
    const design = createDefaultDesign();
    design.orientation.zeroAngleZone = "Spawn-2";

    expect(designToTemplate(design).variants?.[0]?.orientation?.zeroAngleZone).toBe("Spawn-2");
  });
});

describe("connection round trips", () => {
  it.each([
    ["Helltide", "GladiatorArena"],
    ["Anarchy", "Default"]
  ])("preserves %s %s connection types", (name, connectionType) => {
    const source = officialTemplate(name);
    const sourceNames = variantConnections(source).filter((connection) => connection.connectionType === connectionType).map((connection) => connection.name);

    const exported = designToTemplate(templateToDesign(source), { skipValidation: true });

    expect(sourceNames.length).toBeGreaterThan(0);
    expect(variantConnections(exported).filter((connection) => connection.connectionType === connectionType).map((connection) => connection.name)).toEqual(sourceNames);
  });

  it("keeps imported Default connections walkable for validation", () => {
    expect(validateDesign(templateToDesign(officialTemplate("Anarchy"))).errors).toEqual([]);
  });

  it("preserves portal simTurnSquad", () => {
    const source = officialTemplate("Crossroads");
    const sourcePortals = variantConnections(source).filter((connection) => connection.connectionType === "Portal" && connection.simTurnSquad !== undefined);

    const exported = designToTemplate(templateToDesign(source), { skipValidation: true });

    expect(sourcePortals.length).toBeGreaterThan(0);
    for (const portal of sourcePortals) {
      expect(variantConnections(exported).find((connection) => connection.name === portal.name)?.simTurnSquad, portal.name).toBe(portal.simTurnSquad);
    }
  });
});
