import type { DesignZone, TemplateDesign } from "./model.ts";

export function adjacentSpawnNames(design: TemplateDesign, zone: DesignZone): string[] {
  const zonesById = new Map(design.zones.map((candidate) => [candidate.id, candidate]));
  const adjacent = new Set<string>();
  for (const connection of design.connections) {
    if (connection.type !== "Direct" && connection.type !== "Portal") continue;
    const otherId = connection.from === zone.id ? connection.to : connection.to === zone.id ? connection.from : undefined;
    if (!otherId) continue;
    const otherZone = zonesById.get(otherId);
    if (otherZone?.role === "Spawn") adjacent.add(otherZone.name);
  }
  return [...adjacent].sort();
}

export function nearestSpawnNames(design: TemplateDesign, zone: DesignZone): string[] {
  const zonesById = new Map(design.zones.map((candidate) => [candidate.id, candidate]));
  const graph = new Map(design.zones.map((candidate) => [candidate.id, [] as string[]]));
  for (const connection of design.connections) {
    if (connection.type !== "Direct" && connection.type !== "Portal") continue;
    graph.get(connection.from)?.push(connection.to);
    graph.get(connection.to)?.push(connection.from);
  }

  const queue: Array<{ id: string; distance: number }> = [{ id: zone.id, distance: 0 }];
  const visited = new Set<string>([zone.id]);
  let nearestDistance: number | undefined;
  const nearest = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (nearestDistance !== undefined && current.distance > nearestDistance) continue;
    const currentZone = zonesById.get(current.id);
    if (currentZone?.role === "Spawn") {
      nearestDistance = current.distance;
      nearest.add(currentZone.name);
      continue;
    }
    for (const next of graph.get(current.id) ?? []) {
      if (visited.has(next)) continue;
      visited.add(next);
      queue.push({ id: next, distance: current.distance + 1 });
    }
  }

  return [...nearest].sort();
}

export function uniqueNearestSpawnName(design: TemplateDesign, zone: DesignZone): string | undefined {
  const nearest = nearestSpawnNames(design, zone);
  return nearest.length === 1 ? nearest[0] : undefined;
}
