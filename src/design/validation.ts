import { createDefaultSettings, validateSettings } from "../settings.ts";
import type { AmbientPickupDistribution, GuardedEncounterResourceFractions, ValidationResult } from "../types.ts";
import { type DesignBorder, type DesignOrientation, type DesignZone, type TemplateDesign, isFiniteNumber, isNoiseEntry } from "./model.ts";

export function validateDesign(design: TemplateDesign): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const names = design.zones.map((zone) => zone.name.trim()).filter(Boolean);
  const connectionNames = design.connections.map((connection) => connection.name.trim()).filter(Boolean);
  const zoneIds = new Set(design.zones.map((zone) => zone.id));
  const spawnZones = design.zones.filter((zone) => zone.role === "Spawn");
  const spawnCount = spawnZones.length;
  const spawnPlayers = spawnZones.map((zone) => zone.player);
  const expectedPlayers = Number.isInteger(design.playerCount) ? design.playerCount : 0;
  const holdZones = design.zones.filter((zone) => zone.holdCity);

  if (!design.templateName.trim()) errors.push("Template name is required.");
  if (!Number.isInteger(design.playerCount) || design.playerCount < 2 || design.playerCount > 8) errors.push("Player count must be an integer from 2 to 8.");
  if (spawnCount < 2 || spawnCount > 8) errors.push("Designs need 2 to 8 player start zones.");
  if (expectedPlayers >= 2 && expectedPlayers <= 8 && spawnCount !== expectedPlayers) errors.push(`Player count is ${expectedPlayers}, so the design must have exactly ${expectedPlayers} spawn zones.`);
  if (design.zones.length > 48) errors.push("Templates support at most 48 zones.");
  if (new Set(names).size !== names.length) errors.push("Zone names must be unique.");
  if (new Set(connectionNames).size !== connectionNames.length) errors.push("Connection names must be unique.");
  if (names.length !== design.zones.length) errors.push("Every zone needs a name.");
  if (connectionNames.length !== design.connections.length) errors.push("Every connection needs a name.");
  if (!isFiniteNumber(design.mapWidth) || !isFiniteNumber(design.mapHeight)) errors.push("Map dimensions are required.");
  if (spawnPlayers.some((player) => player === undefined || !Number.isInteger(player) || player < 1 || player > 8)) errors.push("Spawn player numbers must be integers from 1 to 8.");
  if (expectedPlayers >= 2 && expectedPlayers <= 8 && spawnPlayers.some((player) => typeof player === "number" && player > expectedPlayers)) errors.push(`Spawn player numbers must be between 1 and the player count (${expectedPlayers}).`);
  if (new Set(spawnPlayers).size !== spawnPlayers.length) errors.push("Spawn player numbers must be unique.");
  if (expectedPlayers >= 2 && expectedPlayers <= 8) {
    const missingPlayers = Array.from({ length: expectedPlayers }, (_, index) => index + 1).filter((player) => !spawnPlayers.includes(player));
    if (missingPlayers.length > 0) errors.push(`Every player must have one spawn zone. Missing player ${missingPlayers.join(", ")}.`);
  }
  if (!isFiniteNumber(design.heroSettings.heroCountMin) || !isFiniteNumber(design.heroSettings.heroCountMax) || !isFiniteNumber(design.heroSettings.heroCountIncrement)) errors.push("Hero cap settings are required.");
  if (!isFiniteNumber(design.gameEndConditions.cityHoldDays)) errors.push("City Hold days is required.");
  if (!orientationNumberFields.every((field) => isFiniteNumber(design.orientation[field]))) errors.push("Map orientation has incomplete numeric settings.");
  if (!borderNumberFields.every((field) => isFiniteNumber(design.border[field]))) errors.push("Map border has incomplete numeric settings.");
  if (!Array.isArray(design.border.obstaclesNoise) || !design.border.obstaclesNoise.every(isNoiseEntry)) errors.push("Obstacle noise must be a JSON array of objects with numeric amp and freq values.");
  if (!Array.isArray(design.border.waterNoise) || !design.border.waterNoise.every(isNoiseEntry)) errors.push("Water noise must be a JSON array of objects with numeric amp and freq values.");
  if (typeof design.border.waterType !== "string") errors.push("Water type is required.");
  if (!Array.isArray(design.zoneLayouts)) errors.push("Zone layouts must be a list.");
  const zoneLayoutNames = (Array.isArray(design.zoneLayouts) ? design.zoneLayouts : []).map((layout) => layout.name?.trim()).filter(Boolean);
  if (new Set(zoneLayoutNames).size !== zoneLayoutNames.length) errors.push("Zone layout names must be unique.");
  for (const layout of Array.isArray(design.zoneLayouts) ? design.zoneLayouts : []) {
    if (!layout.name?.trim()) errors.push("Every zone layout needs a name.");
    if (layout.obstaclesFill !== undefined && !isFiniteNumber(layout.obstaclesFill)) errors.push(`${layout.name || "<unnamed>"} obstaclesFill must be numeric.`);
    if (layout.obstaclesFillVoid !== undefined && !isFiniteNumber(layout.obstaclesFillVoid)) errors.push(`${layout.name || "<unnamed>"} obstaclesFillVoid must be numeric.`);
    if (layout.lakesFill !== undefined && !isFiniteNumber(layout.lakesFill)) errors.push(`${layout.name || "<unnamed>"} lakesFill must be numeric.`);
    if (layout.minLakeArea !== undefined && !isFiniteNumber(layout.minLakeArea)) errors.push(`${layout.name || "<unnamed>"} minLakeArea must be numeric.`);
    if (layout.elevationClusterScale !== undefined && !isFiniteNumber(layout.elevationClusterScale)) errors.push(`${layout.name || "<unnamed>"} elevationClusterScale must be numeric.`);
    if (layout.elevationModes !== undefined && !Array.isArray(layout.elevationModes)) errors.push(`${layout.name || "<unnamed>"} elevationModes must be a JSON array.`);
    if (layout.roadClusterArea !== undefined && !isFiniteNumber(layout.roadClusterArea)) errors.push(`${layout.name || "<unnamed>"} roadClusterArea must be numeric.`);
    if (layout.guardedEncounterResourceFractions !== undefined && !isGuardedEncounterResourceFractions(layout.guardedEncounterResourceFractions)) errors.push(`${layout.name || "<unnamed>"} guardedEncounterResourceFractions must be a JSON object.`);
    if (layout.ambientPickupDistribution !== undefined && !isAmbientPickupDistribution(layout.ambientPickupDistribution)) errors.push(`${layout.name || "<unnamed>"} ambientPickupDistribution must be a JSON object.`);
  }
  if (!Array.isArray(design.contentCountLimits)) errors.push("Content count limits must be a list.");
  const contentLimitNames = (Array.isArray(design.contentCountLimits) ? design.contentCountLimits : []).map((limit) => limit.name?.trim()).filter(Boolean);
  if (new Set(contentLimitNames).size !== contentLimitNames.length) errors.push("Content count limit names must be unique.");
  for (const limit of Array.isArray(design.contentCountLimits) ? design.contentCountLimits : []) {
    if (!limit.name?.trim()) errors.push("Every content count limit needs a name.");
    if (limit.playerMin !== undefined && !isFiniteNumber(limit.playerMin)) errors.push(`${limit.name || "<unnamed>"} player minimum must be numeric.`);
    if (limit.playerMax !== undefined && !isFiniteNumber(limit.playerMax)) errors.push(`${limit.name || "<unnamed>"} player maximum must be numeric.`);
    for (const sidLimit of limit.limits ?? []) {
      if (!sidLimit.sid?.trim() && !hasContentLimitTarget(sidLimit)) errors.push(`${limit.name || "<unnamed>"} has a content SID limit without a SID.`);
      if (sidLimit.variant !== undefined && !isFiniteNumber(sidLimit.variant)) errors.push(`${limit.name || "<unnamed>"} has a non-numeric SID variant.`);
      if (sidLimit.maxCount !== undefined && !isFiniteNumber(sidLimit.maxCount)) errors.push(`${limit.name || "<unnamed>"} has a non-numeric max count.`);
    }
  }
  if (!Array.isArray(design.mandatoryContent)) errors.push("Mandatory content must be a list.");
  const mandatoryContentNames = (Array.isArray(design.mandatoryContent) ? design.mandatoryContent : []).map((group) => group.name?.trim()).filter(Boolean);
  if (new Set(mandatoryContentNames).size !== mandatoryContentNames.length) errors.push("Mandatory content group names must be unique.");
  for (const group of Array.isArray(design.mandatoryContent) ? design.mandatoryContent : []) {
    if (!group.name?.trim()) errors.push("Every mandatory content group needs a name.");
    if (group.content !== undefined && !Array.isArray(group.content)) errors.push(`${group.name || "<unnamed>"} content must be a list.`);
    for (const item of group.content ?? []) {
      if (item.variant !== undefined && !isFiniteNumber(item.variant)) errors.push(`${group.name || "<unnamed>"} has a content item with a non-numeric variant.`);
      if (item.guardValue !== undefined && !isFiniteNumber(item.guardValue)) errors.push(`${group.name || "<unnamed>"} has a content item with a non-numeric guard value.`);
      if (item.rules !== undefined && !Array.isArray(item.rules)) errors.push(`${group.name || "<unnamed>"} has a content item whose rules are not a list.`);
      if (item.includeLists !== undefined && !Array.isArray(item.includeLists)) errors.push(`${group.name || "<unnamed>"} has a content item whose include lists are not a list.`);
      if (item.content !== undefined && !Array.isArray(item.content)) errors.push(`${group.name || "<unnamed>"} has nested content that is not a list.`);
    }
  }
  for (const connection of design.connections) {
    if (!zoneIds.has(connection.from) || !zoneIds.has(connection.to)) errors.push(`Connection ${connection.name || "<unnamed>"} references a missing zone.`);
    if (connection.from === connection.to) errors.push(`Connection ${connection.name || "<unnamed>"} cannot connect a zone to itself.`);
    if (!isFiniteNumber(connection.guardStrength)) errors.push(`Connection ${connection.name || "<unnamed>"} guard value is required.`);
  }
  for (const zone of design.zones) {
    if (!zoneNumberFields.every((field) => isFiniteNumber(zone[field]))) errors.push(`${zone.name || "<unnamed>"} has incomplete numeric settings.`);
    if (zone.layout.trim() && !zoneLayoutNames.includes(zone.layout.trim())) errors.push(`${zone.name || "<unnamed>"} references a missing zone layout profile.`);
  }
  if (design.gameEndConditions.cityHold || design.gameEndConditions.victoryCondition === "win_condition_5") {
    if (holdZones.length !== 1) errors.push("City Hold requires exactly one hold-city zone.");
    if (holdZones.some((zone) => zone.castleCount < 1)) errors.push("The hold-city zone must contain at least one city.");
  }
  for (const zone of design.zones.filter((candidate) => candidate.naturalExpansion)) {
    if (zone.role !== "Neutral") errors.push(`${zone.name} must be a neutral zone to be marked as a natural expansion.`);
    if (zone.castleCount < 1) errors.push(`${zone.name} must contain at least one castle to be marked as a natural expansion.`);
    if (adjacentSpawnNames(design, zone).length !== 1) errors.push(`${zone.name} natural expansion must connect to exactly one spawn zone.`);
  }
  if (isTournamentDesign(design)) {
    if (!hasValidTournamentLaneGraph(design)) errors.push("Tournament direct and portal connections must keep every zone attached to a player lane.");
  } else if (!isGraphConnected(design)) {
    errors.push("Direct and portal connections must connect every zone.");
  }
  if (design.mapWidth < 80 || design.mapHeight < 80) errors.push("Map dimensions must be at least 80x80.");
  if (design.mapWidth > 240 || design.mapHeight > 240) warnings.push("Official examples top out at 240x240. Larger or rectangular maps are experimental.");

  return { errors, warnings };
}

const zoneNumberFields: Array<keyof DesignZone> = [
  "castleCount",
  "size",
  "resourceDensityPercent",
  "structureDensityPercent",
  "neutralStackStrengthPercent",
  "guardRandomizationPercent",
  "guardCutoffValue",
  "guardMultiplier",
  "guardWeeklyIncrement",
  "diplomacyModifier",
  "guardedContentValue",
  "guardedContentValuePerArea",
  "unguardedContentValue",
  "unguardedContentValuePerArea",
  "resourcesValue",
  "resourcesValuePerArea",
  "crossroadsPosition"
];

const orientationNumberFields: Array<keyof DesignOrientation> = [
  "baseAngleMin",
  "baseAngleMax",
  "randomAngleAmplitude",
  "randomAngleStep"
];

const borderNumberFields: Array<keyof DesignBorder> = [
  "cornerRadius",
  "obstaclesWidth",
  "waterWidth"
];

function isGuardedEncounterResourceFractions(value: unknown): value is GuardedEncounterResourceFractions {
  return Boolean(value && typeof value === "object");
}

function isAmbientPickupDistribution(value: unknown): value is AmbientPickupDistribution {
  return Boolean(value && typeof value === "object");
}

function isGraphConnected(design: TemplateDesign): boolean {
  return connectionComponents(design, ["Direct", "Portal", "Proximity"]).length === 1;
}

function hasValidTournamentLaneGraph(design: TemplateDesign): boolean {
  const spawnIds = new Set(design.zones.filter((zone) => zone.role === "Spawn").map((zone) => zone.id));
  return connectionComponents(design, ["Direct", "Portal"]).every((component) => component.some((zoneId) => spawnIds.has(zoneId)));
}

function isTournamentDesign(design: TemplateDesign): boolean {
  return design.tournamentRules.enabled || design.gameEndConditions.victoryCondition === "win_condition_6" || design.gameMode === "Tournament";
}

function connectionComponents(design: TemplateDesign, connectionTypes: Array<TemplateDesign["connections"][number]["type"]>): string[][] {
  if (design.zones.length === 0) return [];
  const includedTypes = new Set(connectionTypes);
  const zoneIds = new Set(design.zones.map((zone) => zone.id));
  const includedConnections = design.connections.filter((candidate) =>
    includedTypes.has(candidate.type) && zoneIds.has(candidate.from) && zoneIds.has(candidate.to)
  );
  const connectedZoneIds = new Set<string>();
  for (const connection of includedConnections) {
    connectedZoneIds.add(connection.from);
    connectedZoneIds.add(connection.to);
  }
  if (connectedZoneIds.size === 0) {
    return design.zones.length > 1 ? design.zones.map((zone) => [zone.id]) : [design.zones.map((zone) => zone.id)];
  }
  const graph = new Map(design.zones.filter((zone) => connectedZoneIds.has(zone.id)).map((zone) => [zone.id, [] as string[]]));
  for (const connection of includedConnections) {
    graph.get(connection.from)?.push(connection.to);
    graph.get(connection.to)?.push(connection.from);
  }
  const visited = new Set<string>();
  const components: string[][] = [];
  for (const zone of design.zones.filter((candidate) => connectedZoneIds.has(candidate.id))) {
    if (visited.has(zone.id)) continue;
    const component: string[] = [];
    const queue = [zone.id];
    visited.add(zone.id);
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

function hasContentLimitTarget(limit: { includeLists?: unknown; content?: unknown }): boolean {
  return (Array.isArray(limit.includeLists) && limit.includeLists.length > 0)
    || (Array.isArray(limit.content) && limit.content.length > 0);
}

function adjacentSpawnNames(design: TemplateDesign, zone: DesignZone): string[] {
  const zonesById = new Map(design.zones.map((candidate) => [candidate.id, candidate]));
  const adjacent = new Set<string>();
  for (const connection of design.connections) {
    if (connection.type !== "Direct" && connection.type !== "Portal") continue;
    const otherId = connection.from === zone.id ? connection.to : connection.to === zone.id ? connection.from : undefined;
    if (!otherId) continue;
    const otherZone = zonesById.get(otherId);
    if (otherZone?.role === "Spawn") adjacent.add(otherZone.name);
  }
  return [...adjacent];
}

export function designValidationAsSettingsValidation(design: TemplateDesign): ValidationResult {
  const settings = createDefaultSettings();
  settings.templateName = design.templateName;
  settings.mapWidth = design.mapWidth;
  settings.mapHeight = design.mapHeight;
  settings.heroSettings = structuredClone(design.heroSettings);
  settings.gameEndConditions = structuredClone(design.gameEndConditions);
  return mergeValidation(validateSettings(settings), validateDesign(design));
}

function mergeValidation(left: ValidationResult, right: ValidationResult): ValidationResult {
  return { errors: [...new Set([...left.errors, ...right.errors])], warnings: [...new Set([...left.warnings, ...right.warnings])] };
}
