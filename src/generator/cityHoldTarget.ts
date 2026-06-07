import type { Variant, Zone } from "../types";
import type { NeutralZonePlan } from "./neutralZonePlanner";

export function pickGraphAwareHoldCityNeutralLetter(neutralZones: NeutralZonePlan[], variant: Variant): string | undefined {
  const zones = variant.zones ?? [];
  const connections = variant.connections ?? [];
  const graph = buildGraph(zones.map((zone) => zone.name), connections);
  const spawnZoneNames = zones
    .filter((zone) => (zone.mainObjects ?? []).some((object) => object.type === "Spawn"))
    .map((zone) => zone.name)
    .sort();
  if (spawnZoneNames.length < 2) return fallbackHoldCityNeutralLetter(neutralZones);

  const candidates = neutralZones
    .filter((plan) => plan.castleCount > 0)
    .map((plan) => {
      const zoneName = `Neutral-${plan.letter}`;
      const zone = zones.find((candidate) => candidate.name === zoneName);
      const distances = spawnZoneNames.map((spawnZoneName) => shortestDistance(spawnZoneName, zoneName, graph));
      const reachableDistances = distances.filter((value): value is number => value !== null);
      const minimumDistance = reachableDistances.length > 0 ? Math.min(...reachableDistances) : -1;
      const distanceSpread = reachableDistances.length > 1 ? Math.max(...reachableDistances) - Math.min(...reachableDistances) : 0;
      return {
        plan,
        zone,
        minimumDistance,
        distanceSpread,
        reachableByAllPlayers: reachableDistances.length === spawnZoneNames.length
      };
    })
    .filter((candidate) => candidate.zone && (candidate.zone.mainObjects ?? []).some((object) => object.type === "City"));

  if (candidates.length === 0) return fallbackHoldCityNeutralLetter(neutralZones);

  candidates.sort((left, right) =>
    Number(right.reachableByAllPlayers) - Number(left.reachableByAllPlayers)
    || right.minimumDistance - left.minimumDistance
    || left.distanceSpread - right.distanceSpread
    || qualityScore(right.plan.quality) - qualityScore(left.plan.quality)
    || right.plan.castleCount - left.plan.castleCount
    || left.plan.letter.localeCompare(right.plan.letter)
  );

  return candidates[0]?.plan.letter ?? fallbackHoldCityNeutralLetter(neutralZones);
}

export function applyHoldCityTargetToVariant(variant: Variant, letter: string | undefined): void {
  if (!letter) return;
  const targetZoneName = `Neutral-${letter}`;
  for (const zone of variant.zones ?? []) {
    clearHoldCityMarkers(zone);
  }

  const targetZone = variant.zones?.find((zone) => zone.name === targetZoneName);
  if (!targetZone) return;

  let city = targetZone.mainObjects?.find((object) => object.type === "City" || object.type === "Ruins");
  if (!city) {
    city = { type: "City", guardChance: 1, guardValue: 0, guardWeeklyIncrement: 0 };
    targetZone.mainObjects = [...(targetZone.mainObjects ?? []), city];
  }

  city.type = "City";
  city.holdCityWinCon = true;
  city.guardValue = Math.max(city.guardValue ?? 0, 60000);
  city.guardWeeklyIncrement = Math.max(city.guardWeeklyIncrement ?? 0, 0.1);
  city.buildingsConstructionSid = "ultra_rich_buildings_construction";
  city.faction = { type: "FromList", args: [] };
  city.placement = "Center";
  city.placementArgs = [];
}

function clearHoldCityMarkers(zone: Zone): void {
  for (const object of zone.mainObjects ?? []) {
    if (object.holdCityWinCon === true) delete object.holdCityWinCon;
  }
}

function buildGraph(zoneNames: string[], connections: Array<{ from: string; to: string; connectionType?: string }>): Map<string, string[]> {
  const graph = new Map(zoneNames.map((zoneName) => [zoneName, [] as string[]]));
  for (const connection of connections) {
    if (connection.connectionType !== "Direct" && connection.connectionType !== "Portal") continue;
    if (!graph.has(connection.from) || !graph.has(connection.to)) continue;
    graph.get(connection.from)?.push(connection.to);
    graph.get(connection.to)?.push(connection.from);
  }
  return graph;
}

function shortestDistance(from: string, to: string, graph: Map<string, string[]>): number | null {
  if (from === to) return 0;
  const visited = new Set<string>([from]);
  const queue: Array<{ zoneName: string; distance: number }> = [{ zoneName: from, distance: 0 }];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of graph.get(current.zoneName) ?? []) {
      if (visited.has(next)) continue;
      if (next === to) return current.distance + 1;
      visited.add(next);
      queue.push({ zoneName: next, distance: current.distance + 1 });
    }
  }

  return null;
}

function qualityScore(quality: NeutralZonePlan["quality"]): number {
  if (quality === "High") return 3;
  if (quality === "Medium") return 2;
  return 1;
}

function fallbackHoldCityNeutralLetter(neutralZones: NeutralZonePlan[]): string | undefined {
  const castleZones = neutralZones.filter((plan) => plan.castleCount > 0);
  const pool = castleZones.length > 0 ? castleZones : neutralZones;
  return [...pool].sort((left, right) =>
    qualityScore(right.quality) - qualityScore(left.quality)
    || right.castleCount - left.castleCount
    || left.letter.localeCompare(right.letter)
  )[0]?.letter;
}
