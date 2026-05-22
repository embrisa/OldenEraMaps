import { defaultGuardRandomization, spawnLayoutName, type GenerationTuning } from "../generator/math.ts";
import { buildAllContentCountLimits, buildHubZone, buildNeutralZone, buildSpawnZone, buildZoneLayouts } from "../generator/templateContentBuilder.ts";
import { normalizeBoardZonePositions } from "../boardSlots.ts";
import { clamp } from "../math.ts";
import { createDefaultSettings } from "../settings.ts";
import type { AmbientPickupDistribution, BiomeSelector, ContentCountLimit, ContentPlacementRule, ElevationMode, GameEndConditions, GladiatorArenaRules, GlobalBans, GuardedEncounterResourceFractions, HeroSettings, JsonValue, MainObject, MandatoryContentGroup, NeutralZoneQuality, NoiseEntry, Point, TerrainTheme, TournamentRules, ValueOverride, Zone, ZoneLayout } from "../types.ts";

export type DesignZoneRole = "Spawn" | "Neutral" | "Hub";
export type DesignConnectionType = "Direct" | "Portal" | "Proximity";

export const DEFAULT_TEMPLATE_DESCRIPTION = "Built with www.OldenEraMaps.com";
export const MAX_SPAWN_ZONES = 8;

export interface TemplateDesign {
  format: "olden-era-template-design";
  version: 1;
  templateName: string;
  templateDescription: string;
  gameMode: string;
  playerCount: number;
  mapWidth: number;
  mapHeight: number;
  lockMapDimensions: boolean;
  heroSettings: HeroSettings;
  terrainTheme: TerrainTheme;
  matchAdjacentNeutralCastleFactions: boolean;
  neutralCastlesAsRuins: boolean;
  heroHireBan: boolean;
  encounterHoles: boolean;
  movementBonus: number;
  factionLawsExpPercent: number;
  astrologyExpPercent: number;
  gameEndConditions: GameEndConditions;
  gladiatorArenaRules: GladiatorArenaRules;
  tournamentRules: TournamentRules;
  orientation: DesignOrientation;
  border: DesignBorder;
  zoneLayouts: ZoneLayout[];
  useCustomMandatoryContent: boolean;
  mandatoryContent: MandatoryContentGroup[];
  contentCountLimits: ContentCountLimit[];
  contentPools: JsonValue[];
  contentLists: JsonValue[];
  valueOverrides: ValueOverride[];
  globalBans: GlobalBans;
  importedGameRulesGlobalBans?: GlobalBans;
  zones: DesignZone[];
  connections: DesignConnection[];
}

export interface DesignOrientation {
  zeroAngleZone?: string;
  baseAngleMin: number;
  baseAngleMax: number;
  randomAngleAmplitude: number;
  randomAngleStep: number;
}

export interface DesignBorder {
  cornerRadius: number;
  obstaclesWidth: number;
  obstaclesNoise: NoiseEntry[];
  waterWidth: number;
  waterNoise: NoiseEntry[];
  waterType: string;
}

export interface DesignZone {
  id: string;
  name: string;
  role: DesignZoneRole;
  player?: number;
  quality: NeutralZoneQuality;
  castleCount: number;
  size: number;
  layout: string;
  terrainTheme: TerrainTheme;
  resourceDensityPercent: number;
  structureDensityPercent: number;
  neutralStackStrengthPercent: number;
  guardRandomizationPercent: number;
  guardCutoffValue: number;
  guardMultiplier: number;
  guardWeeklyIncrement: number;
  guardReactionDistribution: number[];
  diplomacyModifier: number;
  guardedContentPool: string[];
  unguardedContentPool: string[];
  resourcesContentPool: string[];
  contentCountLimits: string[];
  guardedContentValue: number;
  guardedContentValuePerArea: number;
  unguardedContentValue: number;
  unguardedContentValuePerArea: number;
  resourcesValue: number;
  resourcesValuePerArea: number;
  mandatoryContent: string[];
  encounterHolesSettings?: {
    affectedEncounters?: number | null;
    twoHoleEncounters?: number | null;
  } | null;
  randomHireEnableWeeklyUnitIncrement?: boolean | null;
  randomHireInitialUnitIncrement?: number | null;
  useCustomMainObjects: boolean;
  customMainObjects: MainObject[];
  zoneBiome?: BiomeSelector;
  contentBiome?: BiomeSelector;
  metaObjectsBiome?: BiomeSelector;
  crossroadsPosition: number;
  footholds: boolean;
  roads: boolean;
  holdCity: boolean;
  matchAdjacentNeutralCastleFactions: boolean;
  neutralCastlesAsRuins: boolean;
  naturalExpansion: boolean;
  position: Point;
}

export interface DesignConnection {
  id: string;
  name: string;
  from: string;
  to: string;
  type: DesignConnectionType;
  guardStrength: number;
  road: boolean;
  guardRandomization?: number;
  guardWeeklyIncrement?: number;
  guardEscape?: boolean;
  simTurnSquad?: boolean;
  guardZone?: string;
  guardMatchGroup?: string;
  portalPlacementRulesFrom?: ContentPlacementRule[];
  portalPlacementRulesTo?: ContentPlacementRule[];
}

export interface DesignFile {
  format: "olden-era-template-design";
  version: 1;
  design: TemplateDesign;
}

export function createDefaultDesign(): TemplateDesign {
  const settings = createDefaultSettings();
  const orientation = defaultDesignOrientation("Spawn-1");
  return {
    format: "olden-era-template-design",
    version: 1,
    templateName: "Custom Template",
    templateDescription: DEFAULT_TEMPLATE_DESCRIPTION,
    gameMode: settings.gameMode,
    playerCount: settings.playerCount,
    mapWidth: settings.mapWidth,
    mapHeight: settings.mapHeight,
    lockMapDimensions: true,
    heroSettings: structuredClone(settings.heroSettings),
    terrainTheme: settings.terrainTheme,
    matchAdjacentNeutralCastleFactions: settings.matchAdjacentNeutralCastleFactions,
    neutralCastlesAsRuins: settings.neutralCastlesAsRuins,
    heroHireBan: settings.heroHireBan,
    encounterHoles: settings.encounterHoles,
    movementBonus: settings.movementBonus,
    factionLawsExpPercent: settings.factionLawsExpPercent,
    astrologyExpPercent: settings.astrologyExpPercent,
    gameEndConditions: structuredClone(settings.gameEndConditions),
    gladiatorArenaRules: structuredClone(settings.gladiatorArenaRules),
    tournamentRules: structuredClone(settings.tournamentRules),
    orientation,
    border: defaultDesignBorder(),
    zoneLayouts: cloneZoneLayouts(buildZoneLayouts()),
    useCustomMandatoryContent: false,
    mandatoryContent: [],
    contentCountLimits: cloneContentCountLimits(buildAllContentCountLimits()),
    contentPools: [],
    contentLists: [],
    valueOverrides: [],
    globalBans: {},
    zones: [
      createZone("zone-1", "Spawn-1", "Spawn", { player: 1, quality: "Low", castleCount: 1, position: { x: 0.18, y: 0.5 } }),
      createZone("zone-3", "Neutral-3", "Neutral", { quality: "Medium", castleCount: 1, position: { x: 0.5, y: 0.5 } }),
      createZone("zone-2", "Spawn-2", "Spawn", { player: 2, quality: "Low", castleCount: 1, position: { x: 0.82, y: 0.5 } })
    ],
    connections: [
      { id: "conn-1-3", name: "Path-1-3", from: "zone-1", to: "zone-3", type: "Direct", guardStrength: 30000, road: true },
      { id: "conn-3-2", name: "Path-3-2", from: "zone-3", to: "zone-2", type: "Direct", guardStrength: 30000, road: true }
    ]
  };
}

export function createZone(id: string, name: string, role: DesignZoneRole, overrides: Partial<DesignZone> = {}): DesignZone {
  const quality = overrides.quality ?? (role === "Hub" ? "High" : "Medium");
  const prototype = defaultZonePrototype(role, quality);
  return {
    id,
    name,
    role,
    player: role === "Spawn" ? 1 : undefined,
    quality,
    castleCount: role === "Hub" ? 0 : 1,
    size: 1,
    layout: prototype.layout ?? spawnLayoutName,
    terrainTheme: "FactionMatched",
    resourceDensityPercent: 100,
    structureDensityPercent: 100,
    neutralStackStrengthPercent: 100,
    guardRandomizationPercent: Math.round(defaultGuardRandomization * 100),
    guardCutoffValue: prototype.guardCutoffValue ?? 2000,
    guardMultiplier: prototype.guardMultiplier ?? 1,
    guardWeeklyIncrement: prototype.guardWeeklyIncrement ?? 0.2,
    guardReactionDistribution: [...(prototype.guardReactionDistribution ?? [])],
    diplomacyModifier: prototype.diplomacyModifier ?? -0.5,
    guardedContentPool: [...(prototype.guardedContentPool ?? [])],
    unguardedContentPool: [...(prototype.unguardedContentPool ?? [])],
    resourcesContentPool: [...(prototype.resourcesContentPool ?? [])],
    contentCountLimits: toStringList(prototype.contentCountLimits),
    guardedContentValue: prototype.guardedContentValue ?? 0,
    guardedContentValuePerArea: prototype.guardedContentValuePerArea ?? 0,
    unguardedContentValue: prototype.unguardedContentValue ?? 0,
    unguardedContentValuePerArea: prototype.unguardedContentValuePerArea ?? 0,
    resourcesValue: prototype.resourcesValue ?? 0,
    resourcesValuePerArea: prototype.resourcesValuePerArea ?? 0,
    mandatoryContent: toStringList(prototype.mandatoryContent),
    useCustomMainObjects: false,
    customMainObjects: [],
    zoneBiome: cloneSelector(prototype.zoneBiome),
    contentBiome: cloneSelector(prototype.contentBiome),
    metaObjectsBiome: cloneSelector(prototype.metaObjectsBiome),
    crossroadsPosition: prototype.crossroadsPosition ?? 0,
    footholds: true,
    roads: true,
    holdCity: false,
    matchAdjacentNeutralCastleFactions: false,
    neutralCastlesAsRuins: false,
    naturalExpansion: false,
    position: { x: 0.5, y: 0.5 },
    ...overrides
  };
}

export function syncZoneProfile(zone: DesignZone): void {
  const prototype = defaultZonePrototype(zone.role, zone.quality);
  zone.layout = prototype.layout ?? zone.layout;
  zone.guardCutoffValue = prototype.guardCutoffValue ?? zone.guardCutoffValue;
  zone.guardMultiplier = prototype.guardMultiplier ?? zone.guardMultiplier;
  zone.guardWeeklyIncrement = prototype.guardWeeklyIncrement ?? zone.guardWeeklyIncrement;
  zone.guardReactionDistribution = [...(prototype.guardReactionDistribution ?? zone.guardReactionDistribution)];
  zone.diplomacyModifier = prototype.diplomacyModifier ?? zone.diplomacyModifier;
  zone.guardedContentPool = [...(prototype.guardedContentPool ?? zone.guardedContentPool)];
  zone.unguardedContentPool = [...(prototype.unguardedContentPool ?? zone.unguardedContentPool)];
  zone.resourcesContentPool = [...(prototype.resourcesContentPool ?? zone.resourcesContentPool)];
  zone.contentCountLimits = toStringList(prototype.contentCountLimits);
  zone.guardedContentValue = prototype.guardedContentValue ?? zone.guardedContentValue;
  zone.guardedContentValuePerArea = prototype.guardedContentValuePerArea ?? zone.guardedContentValuePerArea;
  zone.unguardedContentValue = prototype.unguardedContentValue ?? zone.unguardedContentValue;
  zone.unguardedContentValuePerArea = prototype.unguardedContentValuePerArea ?? zone.unguardedContentValuePerArea;
  zone.resourcesValue = prototype.resourcesValue ?? zone.resourcesValue;
  zone.resourcesValuePerArea = prototype.resourcesValuePerArea ?? zone.resourcesValuePerArea;
  zone.zoneBiome = cloneSelector(prototype.zoneBiome);
  zone.contentBiome = cloneSelector(prototype.contentBiome);
  zone.metaObjectsBiome = cloneSelector(prototype.metaObjectsBiome);
  zone.crossroadsPosition = prototype.crossroadsPosition ?? zone.crossroadsPosition;
}

export function defaultDesignOrientation(zeroAngleZone?: string): DesignOrientation {
  return { zeroAngleZone, baseAngleMin: 45, baseAngleMax: 45, randomAngleAmplitude: 0, randomAngleStep: 0 };
}

export function defaultDesignBorder(): DesignBorder {
  return {
    cornerRadius: 0,
    obstaclesWidth: 3,
    obstaclesNoise: [{ amp: 1, freq: 12 }],
    waterWidth: 0,
    waterNoise: [{ amp: 1, freq: 12 }],
    waterType: "water grass"
  };
}

export function cloneJsonValueArray(values: JsonValue[] | undefined): JsonValue[] {
  return values ? structuredClone(values) : [];
}

export function cloneValueOverrides(valueOverrides: ValueOverride[] | undefined): ValueOverride[] {
  return valueOverrides ? structuredClone(valueOverrides) : [];
}

export function cloneGlobalBans(globalBans: GlobalBans | undefined): GlobalBans | undefined {
  return globalBans ? structuredClone(globalBans) : undefined;
}

export function hasGlobalBans(globalBans: GlobalBans | undefined): globalBans is GlobalBans {
  return Boolean(globalBans && Object.keys(globalBans).length > 0);
}

export function cloneMainObjects(mainObjects: MainObject[]): MainObject[] {
  return structuredClone(mainObjects);
}

export function cloneZoneLayouts(layouts: ZoneLayout[]): ZoneLayout[] {
  return structuredClone(layouts);
}

export function cloneContentCountLimits(limits: ContentCountLimit[]): ContentCountLimit[] {
  return structuredClone(limits);
}

export function cloneMandatoryContent(groups: MandatoryContentGroup[]): MandatoryContentGroup[] {
  return structuredClone(groups);
}

export function isElevationMode(value: unknown): value is ElevationMode {
  return Boolean(
    value
    && typeof value === "object"
    && isFiniteNumber((value as ElevationMode).weight)
    && isFiniteNumber((value as ElevationMode).minElevatedFraction)
    && isFiniteNumber((value as ElevationMode).maxElevatedFraction)
  );
}

export function isGuardedEncounterResourceFractions(value: unknown): value is GuardedEncounterResourceFractions {
  return Boolean(value && typeof value === "object");
}

export function isAmbientPickupDistribution(value: unknown): value is AmbientPickupDistribution {
  return Boolean(value && typeof value === "object");
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isNoiseEntry(value: unknown): value is NoiseEntry {
  return Boolean(value && typeof value === "object" && isFiniteNumber((value as NoiseEntry).amp) && isFiniteNumber((value as NoiseEntry).freq));
}

export function defaultZonePrototype(role: DesignZoneRole, quality: NeutralZoneQuality): Zone {
  const tuning: GenerationTuning = {
    contentScale: 1,
    resourceDensityMultiplier: 0.5,
    structureDensityMultiplier: 1,
    neutralStackStrengthMultiplier: 1,
    borderGuardStrengthMultiplier: 1,
    guardRandomization: defaultGuardRandomization
  };
  if (role === "Spawn") return buildSpawnZone("1", "Player1", [], 1, false, 1, true, true, tuning);
  if (role === "Hub") return buildHubZone([], tuning, false, 1, 0, true);
  return buildNeutralZone({ letter: "1", quality, role: "Standard", castleCount: 1 }, [], 1, true, true, tuning);
}

export function suffixForZone(zone: DesignZone, prefix: "Spawn" | "Neutral"): string {
  return zone.name.startsWith(`${prefix}-`) ? zone.name.slice(prefix.length + 1) : zone.id.replace(/^zone-/, "").toUpperCase();
}

export function ringPosition(index: number, count: number): Point {
  const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;
  return { x: 0.5 + Math.cos(angle) * 0.34, y: 0.5 + Math.sin(angle) * 0.34 };
}

export function squaredDistance(left: Point, right: Point): number {
  const dx = left.x - right.x;
  const dy = left.y - right.y;
  return dx * dx + dy * dy;
}

export function clampPoint(point: Point): Point {
  return { x: clamp(point.x, 0.04, 0.96), y: clamp(point.y, 0.04, 0.96) };
}

export function importOrientation(orientation: Partial<DesignOrientation> | undefined, fallbackZeroAngleZone: string | undefined): DesignOrientation {
  const defaults = defaultDesignOrientation(fallbackZeroAngleZone);
  return {
    zeroAngleZone: typeof orientation?.zeroAngleZone === "string" ? orientation.zeroAngleZone : defaults.zeroAngleZone,
    baseAngleMin: finiteOrDefault(orientation?.baseAngleMin, defaults.baseAngleMin),
    baseAngleMax: finiteOrDefault(orientation?.baseAngleMax, defaults.baseAngleMax),
    randomAngleAmplitude: finiteOrDefault(orientation?.randomAngleAmplitude, defaults.randomAngleAmplitude),
    randomAngleStep: finiteOrDefault(orientation?.randomAngleStep, defaults.randomAngleStep)
  };
}

export function importBorder(border: Partial<DesignBorder> | undefined): DesignBorder {
  const defaults = defaultDesignBorder();
  return {
    cornerRadius: finiteOrDefault(border?.cornerRadius, defaults.cornerRadius),
    obstaclesWidth: finiteOrDefault(border?.obstaclesWidth, defaults.obstaclesWidth),
    obstaclesNoise: cloneNoiseEntries(border?.obstaclesNoise, defaults.obstaclesNoise),
    waterWidth: finiteOrDefault(border?.waterWidth, defaults.waterWidth),
    waterNoise: cloneNoiseEntries(border?.waterNoise, defaults.waterNoise),
    waterType: typeof border?.waterType === "string" ? border.waterType : defaults.waterType
  };
}

export function finiteOrDefault(value: unknown, fallback: number): number {
  return isFiniteNumber(value) ? value : fallback;
}

export function cloneNoiseEntries(value: unknown, fallback: NoiseEntry[]): NoiseEntry[] {
  return Array.isArray(value) && value.every(isNoiseEntry) ? structuredClone(value) : structuredClone(fallback);
}

export function normalizeDesignLockState(design: TemplateDesign): TemplateDesign {
  const firstZoneName = design.zones[0]?.name;
  const spawnCount = design.zones.filter((zone) => zone.role === "Spawn").length;
  const normalizedZones = normalizeBoardZonePositions(design.zones.map((zone) => ({
    ...zone,
    mandatoryContent: toStringList(zone.mandatoryContent),
    useCustomMainObjects: zone.useCustomMainObjects === true,
    customMainObjects: cloneMainObjects(zone.customMainObjects ?? []),
    matchAdjacentNeutralCastleFactions: zone.matchAdjacentNeutralCastleFactions === true || (design.matchAdjacentNeutralCastleFactions === true && zone.role === "Neutral"),
    neutralCastlesAsRuins: zone.neutralCastlesAsRuins === true || (design.neutralCastlesAsRuins === true && zone.role === "Neutral")
  })));
  return {
    ...design,
    templateDescription: typeof design.templateDescription === "string" ? design.templateDescription : DEFAULT_TEMPLATE_DESCRIPTION,
    playerCount: Number.isInteger(design.playerCount) ? clamp(design.playerCount, 2, 8) : clamp(spawnCount, 2, 8),
    lockMapDimensions: design.lockMapDimensions === true && design.mapWidth === design.mapHeight,
    orientation: importOrientation(design.orientation, firstZoneName),
    border: importBorder(design.border),
    zoneLayouts: cloneZoneLayouts(Array.isArray(design.zoneLayouts) ? design.zoneLayouts.filter((layout): layout is ZoneLayout => Boolean(layout && typeof layout.name === "string")).map((layout) => ({
      ...structuredClone(layout),
      name: layout.name,
      elevationModes: Array.isArray(layout.elevationModes) ? layout.elevationModes.filter(isElevationMode).map((mode) => ({ ...mode })) : undefined,
      guardedEncounterResourceFractions: isGuardedEncounterResourceFractions(layout.guardedEncounterResourceFractions) ? structuredClone(layout.guardedEncounterResourceFractions) : undefined,
      ambientPickupDistribution: isAmbientPickupDistribution(layout.ambientPickupDistribution) ? structuredClone(layout.ambientPickupDistribution) : undefined
    })) : buildZoneLayouts()),
    useCustomMandatoryContent: design.useCustomMandatoryContent === true,
    mandatoryContent: cloneMandatoryContent(Array.isArray(design.mandatoryContent) ? design.mandatoryContent : []),
    contentCountLimits: cloneContentCountLimits(Array.isArray(design.contentCountLimits) ? design.contentCountLimits : buildAllContentCountLimits()),
    valueOverrides: cloneValueOverrides(Array.isArray(design.valueOverrides) ? design.valueOverrides : []),
    globalBans: cloneGlobalBans(design.globalBans) ?? {},
    importedGameRulesGlobalBans: cloneGlobalBans(design.importedGameRulesGlobalBans),
    zones: normalizedZones
  };
}

export function cloneSelector(selector: BiomeSelector | undefined): BiomeSelector | undefined {
  return selector ? structuredClone(selector) : undefined;
}

export function toStringList(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) return value.map((entry) => String(entry));
  return [String(value)];
}
