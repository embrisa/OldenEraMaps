import { normalizeBoardZonePositions } from "../boardSlots.ts";
import { zoneConfigSignature, type DesignConnectionType, type DesignZoneRole, type TemplateDesign } from "../design.ts";

export const PREVIEW_RENDERER_VERSION = 1;

export interface PreviewDesignZone {
  id: string;
  name: string;
  signature: string;
  role: DesignZoneRole;
  player: number | null;
  quality: string;
  castleCount: number;
  size: number;
  terrainTheme: string;
  resourceDensityPercent: number;
  structureDensityPercent: number;
  neutralStackStrengthPercent: number;
  guardMultiplier: number;
  guardWeeklyIncrement: number;
  resourcesValue: number;
  resourcesValuePerArea: number;
  roads: boolean;
  footholds: boolean;
  holdCity: boolean;
  neutralCastlesAsRuins: boolean;
  naturalExpansion: boolean;
  zoneBiome: Record<string, unknown> | null;
  contentBiome: Record<string, unknown> | null;
  metaObjectsBiome: Record<string, unknown> | null;
  position: {
    x: number;
    y: number;
  };
}

export interface PreviewDesignConnection {
  id: string;
  fromZoneId: string;
  toZoneId: string;
  type: DesignConnectionType;
  road: boolean;
}

export interface PreviewDesign {
  version: number;
  mapWidth: number;
  mapHeight: number;
  templateName: string;
  zones: PreviewDesignZone[];
  connections: PreviewDesignConnection[];
}

type PreviewZoneFieldKey = Exclude<keyof PreviewDesignZone, "position">;
type PreviewConnectionFieldKey = keyof PreviewDesignConnection;

const previewZoneFieldDefinitions: Array<{
  key: PreviewZoneFieldKey;
  read: (zone: TemplateDesign["zones"][number]) => unknown;
  is: (value: unknown) => boolean;
}> = [
  { key: "id", read: (zone) => zone.id, is: (value) => typeof value === "string" },
  { key: "name", read: (zone) => zone.name, is: (value) => typeof value === "string" },
  { key: "signature", read: (zone) => zoneConfigSignature(zone), is: (value) => typeof value === "string" },
  { key: "role", read: (zone) => zone.role, is: isDesignZoneRole },
  { key: "player", read: (zone) => zone.player ?? null, is: (value) => value === null || isNumber(value) },
  { key: "quality", read: (zone) => zone.quality, is: (value) => typeof value === "string" },
  { key: "castleCount", read: (zone) => zone.castleCount, is: isNumber },
  { key: "size", read: (zone) => zone.size, is: isNumber },
  { key: "terrainTheme", read: (zone) => zone.terrainTheme, is: (value) => typeof value === "string" },
  { key: "resourceDensityPercent", read: (zone) => zone.resourceDensityPercent, is: isNumber },
  { key: "structureDensityPercent", read: (zone) => zone.structureDensityPercent, is: isNumber },
  { key: "neutralStackStrengthPercent", read: (zone) => zone.neutralStackStrengthPercent, is: isNumber },
  { key: "guardMultiplier", read: (zone) => zone.guardMultiplier, is: isNumber },
  { key: "guardWeeklyIncrement", read: (zone) => zone.guardWeeklyIncrement, is: isNumber },
  { key: "resourcesValue", read: (zone) => zone.resourcesValue, is: isNumber },
  { key: "resourcesValuePerArea", read: (zone) => zone.resourcesValuePerArea, is: isNumber },
  { key: "roads", read: (zone) => zone.roads, is: isBoolean },
  { key: "footholds", read: (zone) => zone.footholds, is: isBoolean },
  { key: "holdCity", read: (zone) => zone.holdCity, is: isBoolean },
  { key: "neutralCastlesAsRuins", read: (zone) => zone.neutralCastlesAsRuins, is: isBoolean },
  { key: "naturalExpansion", read: (zone) => zone.naturalExpansion, is: isBoolean },
  { key: "zoneBiome", read: (zone) => toPreviewSelector(zone.zoneBiome), is: isNullableRecord },
  { key: "contentBiome", read: (zone) => toPreviewSelector(zone.contentBiome), is: isNullableRecord },
  { key: "metaObjectsBiome", read: (zone) => toPreviewSelector(zone.metaObjectsBiome), is: isNullableRecord },
];

const previewConnectionFieldDefinitions: Array<{
  key: PreviewConnectionFieldKey;
  read: (connection: TemplateDesign["connections"][number]) => unknown;
  is: (value: unknown) => boolean;
}> = [
  { key: "id", read: (connection) => connection.id, is: (value) => typeof value === "string" },
  { key: "fromZoneId", read: (connection) => connection.from, is: (value) => typeof value === "string" },
  { key: "toZoneId", read: (connection) => connection.to, is: (value) => typeof value === "string" },
  { key: "type", read: (connection) => connection.type, is: isDesignConnectionType },
  { key: "road", read: (connection) => connection.road, is: isBoolean },
];

export function projectDesignToPreviewDesign(design: TemplateDesign): PreviewDesign {
  const zones = normalizeBoardZonePositions(design.zones);
  return {
    version: PREVIEW_RENDERER_VERSION,
    mapWidth: design.mapWidth,
    mapHeight: design.mapHeight,
    templateName: design.templateName,
    zones: zones.map(buildPreviewZone),
    connections: design.connections.map(buildPreviewConnection),
  };
}

export function parseAndNormalizePreviewDesign(raw: unknown): PreviewDesign | null {
  const data = typeof raw === "string"
    ? parseJson(raw)
    : raw;
  if (!isRecord(data)) return null;
  if (data.version !== PREVIEW_RENDERER_VERSION) return null;
  if (!isNumber(data.mapWidth) || !isNumber(data.mapHeight) || typeof data.templateName !== "string") return null;
  if (!Array.isArray(data.zones) || !Array.isArray(data.connections)) return null;

  const zones: PreviewDesignZone[] = [];
  for (const zone of data.zones) {
    const parsedZone = parsePreviewZone(zone);
    if (!parsedZone) return null;
    zones.push(parsedZone);
  }

  const connections: PreviewDesignConnection[] = [];
  for (const connection of data.connections) {
    const parsedConnection = parsePreviewConnection(connection);
    if (!parsedConnection) return null;
    connections.push(parsedConnection);
  }

  return {
    version: data.version,
    mapWidth: data.mapWidth,
    mapHeight: data.mapHeight,
    templateName: data.templateName,
    zones: normalizeBoardZonePositions(zones),
    connections,
  };
}

export function serializePreviewDesign(preview: PreviewDesign): string {
  return JSON.stringify(preview, null, 2);
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isNullableRecord(value: unknown): boolean {
  return value === null || isRecord(value);
}

function toPreviewSelector(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function buildPreviewZone(zone: TemplateDesign["zones"][number]): PreviewDesignZone {
  const fields = {} as Record<PreviewZoneFieldKey, unknown>;
  for (const definition of previewZoneFieldDefinitions) {
    fields[definition.key] = definition.read(zone);
  }

  return {
    ...(fields as Omit<PreviewDesignZone, "position">),
    position: {
      x: zone.position.x,
      y: zone.position.y,
    },
  };
}

function parsePreviewZone(value: unknown): PreviewDesignZone | null {
  if (!isRecord(value)) return null;
  if (!isRecord(value.position) || !isNumber(value.position.x) || !isNumber(value.position.y)) return null;

  const fields = {} as Record<PreviewZoneFieldKey, unknown>;
  for (const definition of previewZoneFieldDefinitions) {
    const fieldValue = value[definition.key];
    if (!definition.is(fieldValue)) return null;
    fields[definition.key] = fieldValue;
  }

  return {
    ...(fields as Omit<PreviewDesignZone, "position">),
    position: {
      x: value.position.x,
      y: value.position.y,
    },
  };
}

function buildPreviewConnection(connection: TemplateDesign["connections"][number]): PreviewDesignConnection {
  const fields = {} as Record<PreviewConnectionFieldKey, unknown>;
  for (const definition of previewConnectionFieldDefinitions) {
    fields[definition.key] = definition.read(connection);
  }
  return fields as PreviewDesignConnection;
}

function parsePreviewConnection(value: unknown): PreviewDesignConnection | null {
  if (!isRecord(value)) return null;

  const fields = {} as Record<PreviewConnectionFieldKey, unknown>;
  for (const definition of previewConnectionFieldDefinitions) {
    const fieldValue = value[definition.key];
    if (!definition.is(fieldValue)) return null;
    fields[definition.key] = fieldValue;
  }
  return fields as PreviewDesignConnection;
}

function isDesignZoneRole(value: unknown): value is DesignZoneRole {
  return value === "Spawn" || value === "Neutral" || value === "Hub";
}

function isDesignConnectionType(value: unknown): value is DesignConnectionType {
  return value === "Direct" || value === "Portal" || value === "Proximity";
}
