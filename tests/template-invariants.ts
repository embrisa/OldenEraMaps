import { expect } from "vitest";
import { normalizeSettings } from "../src/settings";
import type { Connection, GeneratorSettings, RmgTemplate, RoadEndpoint, Variant, Zone } from "../src/types";

export function expectGeneratedTemplateInvariants(template: RmgTemplate, sourceSettings: GeneratorSettings): void {
  const settings = normalizeSettings(sourceSettings);
  const variant = expectSingleVariant(template);
  const zones = requiredZones(variant);
  const connections = variant.connections ?? [];
  const zoneNames = zones.map((zone) => zone.name);
  const zoneNameSet = new Set(zoneNames);
  const connectionNames = connections
    .map((connection) => connection.name)
    .filter((name): name is string => Boolean(name?.trim()));
  const connectionNameSet = new Set(connectionNames);

  expect(zoneNameSet.size, `Duplicate zone names: ${findDuplicates(zoneNames).join(", ")}`).toBe(zoneNames.length);
  expect(connectionNameSet.size, `Duplicate connection names: ${findDuplicates(connectionNames).join(", ")}`).toBe(connectionNames.length);
  expect(zones.length).toBeLessThanOrEqual(32);

  for (const connection of connections) {
    expect(zoneNameSet.has(connection.from), `${connection.name ?? "<unnamed>"} has unknown from zone ${connection.from}`).toBe(true);
    expect(zoneNameSet.has(connection.to), `${connection.name ?? "<unnamed>"} has unknown to zone ${connection.to}`).toBe(true);
  }

  for (const zone of zones) {
    for (const road of zone.roads ?? []) {
      expectRoadEndpointReferencesGeneratedObject(zone, connectionNameSet, road.from);
      expectRoadEndpointReferencesGeneratedObject(zone, connectionNameSet, road.to);
    }
  }

  expectDirectAndPortalGraphConnected(zones, connections);

  const portalCount = connections.filter((connection) => connection.connectionType === "Portal").length;
  expect(portalCount).toBeLessThanOrEqual(settings.maxPortalConnections);

  if (!settings.generateRoads) {
    for (const zone of zones) expect(zone.roads ?? []).toHaveLength(0);
  }

  const expectedPlayers = settings.topology === "Triangle" ? 3 : settings.playerCount;
  const spawnZones = zones.filter((zone) => zone.name.startsWith("Spawn-"));
  expect(spawnZones).toHaveLength(expectedPlayers);
  for (const zone of spawnZones) {
    const player = playerNumberFromSpawnName(zone.name);
    expect(zone.mainObjects?.filter((object) => object.type === "Spawn"), `${zone.name} must have one spawn main object.`).toHaveLength(1);
    expect(zone.mainObjects?.find((object) => object.type === "Spawn")?.spawn, `${zone.name} must assign its matching player.`).toBe(`Player${player}`);
  }

  if (settings.gameEndConditions.cityHold || settings.gameEndConditions.victoryCondition === "win_condition_5") {
    expect(template.gameRules?.winConditions?.cityHold).toBe(true);
    const holdCityObjects = zones.flatMap((zone) =>
      (zone.mainObjects ?? [])
        .map((mainObject, index) => ({ zone, mainObject, index }))
        .filter((item) => item.mainObject.holdCityWinCon === true));

    expect(holdCityObjects, "City Hold templates must mark exactly one hold city.").toHaveLength(1);
    expect(holdCityObjects[0].mainObject.type).toBe("City");
    expect(holdCityObjects[0].index).toBeLessThan(holdCityObjects[0].zone.mainObjects?.length ?? 0);
  }
}

export function expectDirectAndPortalGraphConnected(zones: Zone[], connections: Connection[]): void {
  const graph = new Map(zones.map((zone) => [zone.name, [] as string[]]));
  for (const connection of connections.filter((candidate) => candidate.connectionType === "Direct" || candidate.connectionType === "Portal")) {
    graph.get(connection.from)?.push(connection.to);
    graph.get(connection.to)?.push(connection.from);
  }

  const start = zones[0]?.name;
  expect(start).toBeTruthy();
  const visited = new Set<string>([start]);
  const queue = [start];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of graph.get(current) ?? []) {
      if (visited.has(next)) continue;
      visited.add(next);
      queue.push(next);
    }
  }

  const unreachable = zones.map((zone) => zone.name).filter((name) => !visited.has(name));
  expect(unreachable, `Direct/portal graph was disconnected. Unreachable zones: ${unreachable.join(", ")}.`).toHaveLength(0);
}

export function expectSingleVariant(template: RmgTemplate): Variant {
  expect(template.variants).toHaveLength(1);
  return template.variants![0];
}

function requiredZones(variant: Variant): Zone[] {
  expect(variant.zones?.length ?? 0).toBeGreaterThan(0);
  return variant.zones!;
}

function playerNumberFromSpawnName(zoneName: string): number {
  const suffix = zoneName.slice("Spawn-".length);
  const player = Number(suffix);
  expect(Number.isInteger(player) && player >= 1, `${zoneName} must use a numeric player suffix.`).toBe(true);
  return player;
}

function expectRoadEndpointReferencesGeneratedObject(zone: Zone, connectionNames: Set<string>, endpoint: RoadEndpoint | undefined): void {
  expect(endpoint, `Road endpoint in zone ${zone.name} is missing.`).toBeTruthy();
  if (!endpoint) return;

  if (endpoint.type === "Connection") {
    const connectionName = endpoint.args?.[0];
    expect(connectionName, `Road endpoint in zone ${zone.name} is missing a connection name.`).toBeTruthy();
    expect(connectionNames.has(connectionName ?? ""), `Road endpoint in zone ${zone.name} references missing connection ${connectionName}.`).toBe(true);
  }

  if (endpoint.type === "MainObject") {
    const indexText = endpoint.args?.[0];
    const index = Number(indexText);
    expect(Number.isInteger(index), `Road endpoint in zone ${zone.name} has non-numeric main object index ${indexText}.`).toBe(true);
    expect(index).toBeGreaterThanOrEqual(0);
    expect(index).toBeLessThan(zone.mainObjects?.length ?? 0);
  }
}

function findDuplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates].sort();
}
