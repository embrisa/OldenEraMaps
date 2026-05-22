import { findOpenBoardSlotPosition } from "../boardSlots.ts";
import { clamp } from "../math.ts";
import { zoneSuffixes } from "../generator/math.ts";
import type { Point } from "../types.ts";
import { createZone, MAX_SPAWN_ZONES, type DesignZone, type DesignZoneRole, type TemplateDesign } from "./model.ts";

export function addZone(design: TemplateDesign, role: DesignZoneRole): TemplateDesign {
  const next = structuredClone(design);
  if (next.zones.length >= zoneSuffixes.length) return next;
  const suffix = nextUnusedSuffix(next);
  const id = `zone-${suffix}`;
  const name = role === "Hub" ? uniqueName(next.zones.map((zone) => zone.name), "Hub") : `${role}-${suffix}`;
  const spawnCount = next.zones.filter((zone) => zone.role === "Spawn").length;
  if (role === "Spawn" && spawnCount >= MAX_SPAWN_ZONES) return next;
  next.zones.push(createZone(id, name, role, {
    player: role === "Spawn" ? nextAvailableSpawnPlayer(next) ?? spawnCount + 1 : undefined,
    quality: role === "Neutral" ? "Medium" : role === "Hub" ? "High" : "Low",
    castleCount: role === "Hub" ? 0 : 1,
    position: findOpenBoardSlotPosition(next.zones.map((zone) => zone.position))
  }));
  if (role === "Spawn") next.playerCount = clamp(spawnCount + 1, 2, 8);
  return next;
}

export function duplicateZone(design: TemplateDesign, zoneId: string): TemplateDesign {
  const source = design.zones.find((zone) => zone.id === zoneId);
  if (!source) return design;
  const next = structuredClone(design);
  if (next.zones.length >= zoneSuffixes.length) return next;
  const sourceCopy = next.zones.find((zone) => zone.id === zoneId);
  if (!sourceCopy) return design;
  const duplicate = structuredClone(sourceCopy);
  if (duplicate.role === "Spawn" && next.zones.filter((zone) => zone.role === "Spawn").length >= MAX_SPAWN_ZONES) return next;
  duplicate.id = uniqueId(next.zones.map((zone) => zone.id), `${sourceCopy.id}-copy`);
  duplicate.name = uniqueName(next.zones.map((zone) => zone.name), `${sourceCopy.name} Copy`);
  duplicate.position = findOpenBoardSlotPosition(next.zones.map((zone) => zone.position));
  if (duplicate.role === "Spawn") duplicate.player = nextAvailableSpawnPlayer(next) ?? duplicate.player;
  next.zones.push(duplicate);
  if (duplicate.role === "Spawn") next.playerCount = clamp(next.zones.filter((zone) => zone.role === "Spawn").length, 2, 8);
  return next;
}

export function transferZoneSettings(design: TemplateDesign, sourceZoneId: string, targetZoneId: string): TemplateDesign {
  if (sourceZoneId === targetZoneId) return design;
  const next = structuredClone(design);
  const source = next.zones.find((zone) => zone.id === sourceZoneId);
  const target = next.zones.find((zone) => zone.id === targetZoneId);
  if (!source || !target) return design;
  if (source.role === "Spawn" && target.role !== "Spawn" && next.zones.filter((zone) => zone.role === "Spawn").length >= MAX_SPAWN_ZONES) return next;

  const { id, name, player, position } = target;
  const transferred = structuredClone(source);
  Object.assign(target, transferred, { id, name, position });
  target.player = target.role === "Spawn" ? player ?? nextAvailableSpawnPlayer(next) ?? source.player : undefined;
  next.playerCount = clamp(next.zones.filter((zone) => zone.role === "Spawn").length, 2, 8);
  return next;
}

export function deleteZone(design: TemplateDesign, zoneId: string): TemplateDesign {
  const next = structuredClone(design);
  next.zones = next.zones.filter((zone) => zone.id !== zoneId);
  next.connections = next.connections.filter((connection) => connection.from !== zoneId && connection.to !== zoneId);
  return next;
}

export function setDesignPlayerCount(design: TemplateDesign, playerCount: number): TemplateDesign {
  const next = structuredClone(design);
  const fallbackPlayerCount = Number.isInteger(next.playerCount) ? next.playerCount : 2;
  const targetPlayerCount = Number.isFinite(playerCount) ? clamp(Math.trunc(playerCount), 2, 8) : fallbackPlayerCount;
  next.playerCount = targetPlayerCount;

  const spawnZones = next.zones.filter((zone) => zone.role === "Spawn");
  const usedPlayers = new Set<number>();
  const activeSpawnIds = new Set<string>();
  const reusableSpawns: DesignZone[] = [];

  for (const zone of spawnZones) {
    if (Number.isInteger(zone.player) && zone.player! >= 1 && zone.player! <= targetPlayerCount && !usedPlayers.has(zone.player!)) {
      usedPlayers.add(zone.player!);
      activeSpawnIds.add(zone.id);
      continue;
    }
    reusableSpawns.push(zone);
  }

  for (let player = 1; player <= targetPlayerCount; player++) {
    if (spawnZones.some((zone) => zone.player === player && activeSpawnIds.has(zone.id))) continue;
    const reusable = reusableSpawns.shift();
    const zone = reusable ?? createPlayerSpawnZone(next, player);
    zone.role = "Spawn";
    zone.player = player;
    zone.quality = "Low";
    zone.name = uniqueNameExcluding(next.zones.map((candidate) => candidate.name), zone.name, `Spawn-${player}`);
    if (!reusable) next.zones.push(zone);
    activeSpawnIds.add(zone.id);
    ensureSpawnZoneConnected(next, zone);
  }

  const removedSpawnIds = new Set(reusableSpawns.map((zone) => zone.id));
  next.zones = next.zones.filter((zone) => !removedSpawnIds.has(zone.id));
  next.connections = next.connections.filter((connection) => !removedSpawnIds.has(connection.from) && !removedSpawnIds.has(connection.to));
  return next;
}

export function zoneConfigSignature(zone: DesignZone): string {
  const { id: _id, name: _name, player: _player, position: _position, ...config } = zone;
  return JSON.stringify(config);
}

export function addConnection(design: TemplateDesign): TemplateDesign {
  const next = structuredClone(design);
  const [from, to] = next.zones.slice(0, 2);
  if (!from || !to) return next;
  return addConnectionToDesign(next, from, to);
}

export function addConnectionBetween(design: TemplateDesign, fromId: string, toId: string): TemplateDesign {
  if (fromId === toId) return design;
  const next = structuredClone(design);
  const from = next.zones.find((zone) => zone.id === fromId);
  const to = next.zones.find((zone) => zone.id === toId);
  if (!from || !to) return design;
  const alreadyConnected = next.connections.some((connection) =>
    (connection.from === from.id && connection.to === to.id) ||
    (connection.from === to.id && connection.to === from.id)
  );
  if (alreadyConnected) return design;
  return addConnectionToDesign(next, from, to);
}

function addConnectionToDesign(design: TemplateDesign, from: DesignZone, to: DesignZone): TemplateDesign {
  const id = nextConnectionId(design);
  design.connections.push({
    id,
    name: uniqueName(design.connections.map((connection) => connection.name), `Path-${from.name}-${to.name}`),
    from: from.id,
    to: to.id,
    type: "Direct",
    guardStrength: 30000,
    road: true
  });
  return design;
}

function nextUnusedSuffix(design: TemplateDesign): string {
  const used = new Set(design.zones.map((zone) => zone.name.split("-").at(-1)));
  return zoneSuffixes.find((suffix) => !used.has(suffix)) ?? String(design.zones.length + 1);
}

function uniqueName(existing: string[], base: string): string {
  return uniqueString(existing, base);
}

function uniqueId(existing: string[], base: string): string {
  return uniqueString(existing, base);
}

function uniqueNameExcluding(existing: string[], current: string, base: string): string {
  const used = existing.filter((name) => name !== current);
  return uniqueString(used, base);
}

function uniqueString(existing: string[], base: string): string {
  const used = new Set(existing);
  if (!used.has(base)) return base;
  for (let i = 2; ; i++) {
    const candidate = `${base}-${i}`;
    if (!used.has(candidate)) return candidate;
  }
}

function nextAvailableSpawnPlayer(design: TemplateDesign): number | undefined {
  const used = new Set(design.zones.filter((zone) => zone.role === "Spawn").map((zone) => zone.player));
  for (let player = 1; player <= 8; player++) {
    if (!used.has(player)) return player;
  }
  return undefined;
}

function nextConnectionId(design: TemplateDesign): string {
  const used = new Set(design.connections.map((connection) => connection.id));
  for (let i = 1; ; i++) {
    const candidate = `conn-${i}`;
    if (!used.has(candidate)) return candidate;
  }
}

function createPlayerSpawnZone(design: TemplateDesign, player: number): DesignZone {
  return createZone(uniqueId(design.zones.map((zone) => zone.id), `zone-spawn-${player}`), `Spawn-${player}`, "Spawn", {
    player,
    quality: "Low",
    castleCount: 1,
    position: findOpenBoardSlotPosition(design.zones.map((zone) => zone.position))
  });
}

function ensureSpawnZoneConnected(design: TemplateDesign, spawn: DesignZone): void {
  if (design.connections.some((connection) => connection.from === spawn.id || connection.to === spawn.id)) return;
  const anchor = nearestConnectionAnchor(design, spawn);
  if (!anchor) return;
  addConnectionToDesign(design, spawn, anchor);
}

function nearestConnectionAnchor(design: TemplateDesign, spawn: DesignZone): DesignZone | undefined {
  return design.zones
    .filter((zone) => zone.id !== spawn.id)
    .sort((left, right) => {
      const roleScore = (zone: DesignZone) => zone.role === "Neutral" ? 0 : zone.role === "Hub" ? 1 : 2;
      return roleScore(left) - roleScore(right) || squaredDistance(spawn.position, left.position) - squaredDistance(spawn.position, right.position);
    })[0];
}

function squaredDistance(left: Point, right: Point): number {
  const dx = left.x - right.x;
  const dy = left.y - right.y;
  return dx * dx + dy * dy;
}
