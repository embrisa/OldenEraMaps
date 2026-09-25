import type { Connection, Road, RoadEndpoint, Zone } from "../types.ts";
import type { GenerationTuning, RandomSource } from "./math.ts";
import { scaleBorderGuardValue, zoneSuffixPair } from "./math.ts";

export function directConnection(name: string, from: string, to: string, guardZone: string, guardValue: number, group: string, tuning: GenerationTuning): Connection {
  return {
    name,
    from,
    to,
    connectionType: "Direct",
    guardZone,
    guardEscape: false,
    simTurnSquad: true,
    guardValue: scaleBorderGuardValue(guardValue, tuning),
    guardWeeklyIncrement: 0.15,
    guardMatchGroup: group
  };
}

export function buildRingConnections(playerLetters: string[], orderedLetters: string[], tuning: GenerationTuning, isolatePlayers = false): Connection[] {
  const connections: Connection[] = [];
  const pairs = new Set<string>();
  const count = orderedLetters.length;
  if (count < 2) return connections;
  for (let i = 0; i < count; i++) {
    const next = (i + 1) % count;
    const fromLetter = orderedLetters[i];
    const toLetter = orderedLetters[next];
    if (isolatePlayers && playerLetters.includes(fromLetter) && playerLetters.includes(toLetter)) continue;
    const key = pairKey(zoneName(playerLetters, fromLetter), zoneName(playerLetters, toLetter));
    if (pairs.has(key)) continue;
    pairs.add(key);
    const connectionName = count === 2
      ? `Ring-${zoneSuffixPair(fromLetter, toLetter)}`
      : `Ring-${fromLetter}-${toLetter}`;
    connections.push(directConnection(
      connectionName,
      zoneName(playerLetters, fromLetter),
      zoneName(playerLetters, toLetter),
      zoneName(playerLetters, fromLetter),
      30000,
      `ring_guard_${fromLetter}_${toLetter}`,
      tuning));
  }
  return connections;
}

export function buildRandomPortalConnections(playerLetters: string[], orderedLetters: string[], tuning: GenerationTuning, rng: RandomSource, maxCount = 32): Connection[] {
  const count = orderedLetters.length;
  if (count < 2) return [];
  const dest = buildNonAdjacentDerangement(count, rng);
  const indices = [...Array(count).keys()].sort(() => rng.nextDouble() - 0.5);
  const connections: Connection[] = [];
  const pairs = new Set<string>();
  for (let i = 0; i < indices.length && connections.length < maxCount; i++) {
    const idx = indices[i];
    const fromLetter = orderedLetters[idx];
    const toLetter = orderedLetters[dest[idx]];
    const key = pairKey(zoneName(playerLetters, fromLetter), zoneName(playerLetters, toLetter));
    if (pairs.has(key)) continue;
    pairs.add(key);
    connections.push({
      name: `Portal-${fromLetter}-${toLetter}`,
      from: zoneName(playerLetters, fromLetter),
      to: zoneName(playerLetters, toLetter),
      connectionType: "Portal",
      portalPlacementRulesFrom: [{ type: "Crossroads", args: [], targetMin: 0.1, targetMax: 0.3, weight: 2 }],
      portalPlacementRulesTo: [{ type: "Crossroads", args: [], targetMin: 0.1, targetMax: 0.3, weight: 2 }],
      road: true,
      guardEscape: false,
      guardValue: scaleBorderGuardValue(25000, tuning),
      guardWeeklyIncrement: 0.15
    });
  }
  return connections;
}

function buildNonAdjacentDerangement(count: number, rng: RandomSource): number[] {
  for (let attempts = 0; attempts < 100; attempts++) {
    const dest = Array<number>(count);
    const candidates = [...Array(count).keys()].sort(() => rng.nextDouble() - 0.5);
    let valid = true;
    for (let i = 0; i < count; i++) {
      let found = candidates.findIndex((candidate) => candidate !== i && candidate !== (i + 1) % count && candidate !== (i - 1 + count) % count);
      if (found < 0) found = candidates.findIndex((candidate) => candidate !== i);
      if (found < 0) { valid = false; break; }
      dest[i] = candidates.splice(found, 1)[0];
    }
    if (valid) return dest;
  }
  const shift = Math.max(1, Math.floor(count / 2));
  return [...Array(count).keys()].map((i) => (i + shift) % count);
}

export function ensurePlayerZonesConnected(playerLetters: string[], zones: Zone[], connections: Connection[], tuning: GenerationTuning, generateRoads: boolean): void {
  if (playerLetters.length < 2) return;
  const names = new Set(connections.map((connection) => connection.name).filter(Boolean));
  const hasConnection = (letter: string) => connections.some((connection) => connection.from === `Spawn-${letter}` || connection.to === `Spawn-${letter}`);
  for (const letter of playerLetters) {
    const zone = zones.find((candidate) => candidate.name === `Spawn-${letter}`);
    if (!zone) continue;
    if (connections.some((connection) => connection.from === zone.name || connection.to === zone.name)) continue;
    // Prefer a partner that is already attached to the graph, so two isolated spawns do not pair up into an island.
    const partner = playerLetters.filter((candidate) => candidate !== letter)
      .sort((a, b) => Number(hasConnection(b)) - Number(hasConnection(a)))[0];
    if (!partner) continue;
    const pair = zoneSuffixPair(letter, partner);
    const fallbackName = `Fallback-${pair}`;
    if (names.has(fallbackName)) continue;
    connections.push(directConnection(fallbackName, `Spawn-${letter}`, `Spawn-${partner}`, `Spawn-${letter}`, 30000, `fallback_guard_${fallbackName}`, tuning));
    names.add(fallbackName);
    if (generateRoads) {
      for (const zoneName of [`Spawn-${letter}`, `Spawn-${partner}`]) {
        const roadZone = zones.find((candidate) => candidate.name === zoneName);
        roadZone?.roads?.push(plainRoad(mainObjectEndpoint("0"), connectionEndpoint(fallbackName)));
      }
    }
  }
  bridgeDisconnectedComponents(zones, connections, tuning, generateRoads);
}

// Skipping player-to-player links can still split a ring or chain into separate runs, and random portals can pair
// spawns off before the fallback above runs. Join any remaining direct/portal components, preferring links that
// avoid player-to-player routes.
function bridgeDisconnectedComponents(zones: Zone[], connections: Connection[], tuning: GenerationTuning, generateRoads: boolean): void {
  const names = new Set(connections.map((connection) => connection.name).filter(Boolean));
  const indexByName = new Map(zones.map((zone, index) => [zone.name, index]));
  for (;;) {
    const components = walkableComponents(zones, connections);
    if (components.length <= 1) return;
    let best: { from: Zone; to: Zone; spawnEnds: number; distance: number } | undefined;
    for (const from of components[0]) {
      for (const component of components.slice(1)) {
        for (const to of component) {
          const spawnEnds = Number(from.name.startsWith("Spawn-")) + Number(to.name.startsWith("Spawn-"));
          const distance = zoneDistance(from, to, indexByName, zones.length);
          if (!best || spawnEnds < best.spawnEnds || (spawnEnds === best.spawnEnds && distance < best.distance)) best = { from, to, spawnEnds, distance };
        }
      }
    }
    if (!best) return;
    const pair = zoneSuffixPair(zoneSuffix(best.from.name), zoneSuffix(best.to.name));
    let name = `Bridge-${pair}`;
    for (let copy = 2; names.has(name); copy++) name = `Bridge-${pair}-${copy}`;
    names.add(name);
    connections.push(directConnection(name, best.from.name, best.to.name, best.from.name, 30000, `bridge_guard_${pair}`, tuning));
    if (generateRoads) {
      addRoadEndpoint(zones, best.from.name, name);
      addRoadEndpoint(zones, best.to.name, name);
    }
  }
}

function walkableComponents(zones: Zone[], connections: Connection[]): Zone[][] {
  const zonesByName = new Map(zones.map((zone) => [zone.name, zone]));
  const graph = new Map(zones.map((zone) => [zone.name, [] as string[]]));
  for (const connection of connections) {
    if (connection.connectionType !== "Direct" && connection.connectionType !== "Portal") continue;
    graph.get(connection.from)?.push(connection.to);
    graph.get(connection.to)?.push(connection.from);
  }
  const visited = new Set<string>();
  const components: Zone[][] = [];
  for (const zone of zones) {
    if (visited.has(zone.name)) continue;
    const component: Zone[] = [];
    const queue = [zone.name];
    visited.add(zone.name);
    while (queue.length > 0) {
      const current = queue.shift()!;
      component.push(zonesByName.get(current)!);
      for (const next of graph.get(current) ?? []) {
        if (visited.has(next) || !zonesByName.has(next)) continue;
        visited.add(next);
        queue.push(next);
      }
    }
    components.push(component);
  }
  return components;
}

function zoneDistance(left: Zone, right: Zone, indexByName: Map<string, number>, zoneCount: number): number {
  if (left.generatorPosition && right.generatorPosition) {
    return (left.generatorPosition.x - right.generatorPosition.x) ** 2 + (left.generatorPosition.y - right.generatorPosition.y) ** 2;
  }
  const gap = Math.abs((indexByName.get(left.name) ?? 0) - (indexByName.get(right.name) ?? 0));
  return Math.min(gap, zoneCount - gap) / Math.max(1, zoneCount);
}

function zoneSuffix(zoneName: string): string {
  const index = zoneName.indexOf("-");
  return index >= 0 ? zoneName.slice(index + 1) : zoneName;
}

export function addAlternateNeutralRoutes(playerLetters: string[], orderedLetters: string[], zones: Zone[], connections: Connection[], tuning: GenerationTuning, generateRoads: boolean, maxCount = 8): void {
  if (maxCount <= 0) return;
  const neutralLetters = [...new Set(orderedLetters.filter((letter) => !playerLetters.includes(letter)))];
  if (neutralLetters.length < 2) return;
  const pairKeys = new Set(connections.filter((connection) => connection.connectionType === "Direct" || connection.connectionType === "Portal").map((connection) => pairKey(connection.from, connection.to)));
  const names = new Set(connections.map((connection) => connection.name).filter(Boolean));
  let added = 0;
  for (let stride = 2; stride <= Math.max(2, Math.floor(neutralLetters.length / 2) + 1) && added < maxCount; stride++) {
    for (let i = 0; i < neutralLetters.length && added < maxCount; i++) {
      const fromLetter = neutralLetters[i];
      const toLetter = neutralLetters[(i + stride) % neutralLetters.length];
      if (fromLetter === toLetter) continue;
      const key = pairKey(`Neutral-${fromLetter}`, `Neutral-${toLetter}`);
      if (pairKeys.has(key)) continue;
      const pair = zoneSuffixPair(fromLetter, toLetter);
      const name = `AltRoute-${pair}`;
      if (names.has(name)) continue;
      pairKeys.add(key);
      names.add(name);
      connections.push(directConnection(name, `Neutral-${fromLetter}`, `Neutral-${toLetter}`, `Neutral-${fromLetter}`, 26000, `alt_route_guard_${pair}`, tuning));
      if (generateRoads) {
        addRoadEndpoint(zones, `Neutral-${fromLetter}`, name);
        addRoadEndpoint(zones, `Neutral-${toLetter}`, name);
      }
      added++;
    }
  }
}

function addRoadEndpoint(zones: Zone[], zoneName: string, connectionName: string): void {
  const zone = zones.find((candidate) => candidate.name === zoneName);
  if (!zone) return;
  zone.roads ??= [];
  if ((zone.mainObjects?.length ?? 0) > 0) {
    zone.roads.push(plainRoad(mainObjectEndpoint("0"), connectionEndpoint(connectionName)));
    return;
  }
  const existing = zone.roads.map((road) => road.from?.type === "Connection" ? road.from.args?.[0] : road.to?.type === "Connection" ? road.to.args?.[0] : undefined).find(Boolean);
  zone.roads.push(existing ? plainRoad(connectionEndpoint(existing), connectionEndpoint(connectionName)) : plainRoad(connectionEndpoint(connectionName), connectionEndpoint(connectionName)));
}

export function buildOuterZoneRoads(ringConns: string[], castleCount: number, includeFoothold: boolean, generateRoads: boolean): Road[] {
  const roads: Road[] = [];
  if (!generateRoads || castleCount === 0) return roads;
  for (let i = 1; i < castleCount; i++) roads.push(plainRoad(mainObjectEndpoint("0"), mainObjectEndpoint(String(i))));
  if (includeFoothold) roads.push(plainRoad(mainObjectEndpoint("0"), mandatoryContentEndpoint("name_remote_foothold_1")));
  for (const connection of ringConns.filter(Boolean)) roads.push(plainRoad(mainObjectEndpoint("0"), connectionEndpoint(connection)));
  return roads;
}

export function buildConnectorZoneRoads(connectionNames: string[], generateRoads: boolean): Road[] {
  if (!generateRoads) return [];
  const distinct = [...new Set(connectionNames.filter(Boolean))];
  if (distinct.length === 1) return [plainRoad(connectionEndpoint(distinct[0]), connectionEndpoint(distinct[0]))];
  const anchor = distinct[0];
  return anchor ? distinct.slice(1).map((connection) => plainRoad(connectionEndpoint(anchor), connectionEndpoint(connection))) : [];
}

export function plainRoad(from: RoadEndpoint, to: RoadEndpoint): Road {
  return { from, to };
}

export const mainObjectEndpoint = (index: string): RoadEndpoint => ({ type: "MainObject", args: [index] });
export const connectionEndpoint = (name: string): RoadEndpoint => ({ type: "Connection", args: [name] });
export const mandatoryContentEndpoint = (name: string): RoadEndpoint => ({ type: "MandatoryContent", args: [name] });

export function zoneName(playerLetters: string[], letter: string): string {
  return playerLetters.includes(letter) ? `Spawn-${letter}` : `Neutral-${letter}`;
}

function pairKey(from: string, to: string): string {
  return from < to ? `${from}|${to}` : `${to}|${from}`;
}
