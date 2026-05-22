import {
  applyConnectionStyle,
  applyContentPreset,
  applyGenerationPreset,
  applyPacePreset,
  createDefaultSettings
} from "./settings";
import type { TemplateDesign } from "./design";
import type {
  ConnectionStyle,
  ContentPreset,
  GamePacePreset,
  GeneratorSettings,
  MapGenerationPreset,
  MapTopology,
  Point,
  TerrainTheme
} from "./types";

export type BalancedRandomMapSize = "Small" | "Medium" | "Large" | "XL";
export type BalancedRandomTopology = "Auto" | Exclude<MapTopology, "Random">;
export type BalancedRandomToggleOverride = "Auto" | "Enabled" | "Disabled";

export interface BalancedRandomNeutralSplitDraft {
  neutralLowNoCastleCount: number;
  neutralLowCastleCount: number;
  neutralMediumNoCastleCount: number;
  neutralMediumCastleCount: number;
  neutralHighNoCastleCount: number;
  neutralHighCastleCount: number;
}

export interface BalancedRandomMapDraft {
  templateName: string;
  playerCount: number;
  neutralZoneCount: number;
  mapSize: BalancedRandomMapSize;
  topology: BalancedRandomTopology;
  generationPreset: MapGenerationPreset;
  pacePreset: GamePacePreset;
  connectionStylePreset: ConnectionStyle;
  contentPreset: ContentPreset;
  terrainTheme: TerrainTheme;
  naturalExpansion: boolean;
  cityHold: boolean;
  randomPortals: boolean;
  neutralSplit: BalancedRandomNeutralSplitDraft;
  maxPortalConnections?: number;
  noDirectPlayerConnections: BalancedRandomToggleOverride;
  minNeutralZonesBetweenPlayers?: number;
  matchPlayerCastleFactions: BalancedRandomToggleOverride;
  seed: string;
}

export const balancedRandomMapSizeOptions: Array<{ value: BalancedRandomMapSize; label: string }> = [
  { value: "Small", label: "Small" },
  { value: "Medium", label: "Medium" },
  { value: "Large", label: "Large" },
  { value: "XL", label: "XL" }
];

export const balancedRandomTopologyOptions: Array<{ value: BalancedRandomTopology; label: string }> = [
  { value: "Auto", label: "Auto" },
  { value: "Default", label: "Ring" },
  { value: "HubAndSpoke", label: "Hub" },
  { value: "SharedWeb", label: "Shared Web" },
  { value: "Ladder", label: "Ladder" },
  { value: "Chain", label: "Chain" },
  { value: "Triangle", label: "Triangle" }
];

export function createBalancedRandomMapDraft(): BalancedRandomMapDraft {
  return {
    templateName: "Balanced Random Map",
    playerCount: 4,
    neutralZoneCount: 6,
    mapSize: "Large",
    topology: "Auto",
    generationPreset: "Custom",
    pacePreset: "Competitive",
    connectionStylePreset: "Balanced",
    contentPreset: "Default",
    terrainTheme: "Mixed",
    naturalExpansion: false,
    cityHold: false,
    randomPortals: false,
    neutralSplit: {
      neutralLowNoCastleCount: 0,
      neutralLowCastleCount: 0,
      neutralMediumNoCastleCount: 0,
      neutralMediumCastleCount: 0,
      neutralHighNoCastleCount: 0,
      neutralHighCastleCount: 0
    },
    maxPortalConnections: undefined,
    noDirectPlayerConnections: "Auto",
    minNeutralZonesBetweenPlayers: undefined,
    matchPlayerCastleFactions: "Auto",
    seed: ""
  };
}

export function buildBalancedRandomMapSettings(draft: BalancedRandomMapDraft): GeneratorSettings {
  let settings = createDefaultSettings();
  settings.preset = draft.generationPreset;
  settings.pacePreset = draft.pacePreset;
  settings.connectionStyle = draft.connectionStylePreset;
  settings.contentPreset = draft.contentPreset;
  settings = applyGenerationPreset(settings);
  settings = applyPacePreset(settings);
  settings = applyConnectionStyle(settings);
  settings = applyContentPreset(settings);

  const playerCount = clampRounded(draft.playerCount, 2, 8);
  const topology = resolveBalancedTopology(draft.topology, playerCount, draft.cityHold, draft.naturalExpansion);
  const requestedNeutralZones = Math.max(0, Math.round(draft.neutralZoneCount));
  const simpleNeutralZoneCount = draft.cityHold && topology !== "HubAndSpoke" && topology !== "Triangle"
    ? Math.max(1, requestedNeutralZones)
    : requestedNeutralZones;
  const advancedNeutralZoneCount = countNeutralSplitZones(draft.neutralSplit);
  const useAdvancedNeutralSplit = advancedNeutralZoneCount > 0;
  const neutralZoneCount = useAdvancedNeutralSplit ? advancedNeutralZoneCount : simpleNeutralZoneCount;
  const totalZones = countBalancedRandomZones({
    ...settings,
    playerCount,
    topology,
    naturalExpansionZone: draft.naturalExpansion,
    zoneCfg: {
      ...settings.zoneCfg,
      neutralZoneCount,
      advanced: {
        ...settings.zoneCfg.advanced,
        ...draft.neutralSplit,
        enabled: useAdvancedNeutralSplit
      }
    }
  });
  const mapSide = balancedMapSideForSize(draft.mapSize, totalZones);

  settings.identityPreset = draft.generationPreset === "Custom" ? undefined : draft.generationPreset;
  settings.preset = "Custom";
  settings.pacePreset = "Custom";
  settings.connectionStyle = draft.connectionStylePreset;
  settings.contentPreset = "Default";
  settings.templateName = draft.templateName.trim() || "Balanced Random Map";
  settings.playerCount = playerCount;
  settings.mapWidth = mapSide;
  settings.mapHeight = mapSide;
  settings.seed = parseSeed(draft.seed) ?? randomSeed();
  settings.terrainTheme = draft.terrainTheme;
  settings.topology = topology;
  settings.noDirectPlayerConnections = topology === "Chain" || topology === "HubAndSpoke" || topology === "Triangle" || playerCount >= 4;
  settings.randomPortals = draft.randomPortals;
  settings.maxPortalConnections = draft.randomPortals ? Math.min(16, Math.max(4, Math.ceil(totalZones / 2))) : 0;
  settings.experimentalBalancedZonePlacement = true;
  settings.matchAdjacentNeutralCastleFactions = neutralZoneCount > 0;
  settings.naturalExpansionZone = draft.naturalExpansion;
  settings.minNeutralZonesBetweenPlayers = topology === "HubAndSpoke" || topology === "Triangle"
    ? 0
    : neutralZoneCount === 0
      ? 0
      : playerCount >= 6
        ? 2
        : 1;
  settings.zoneCfg.neutralZoneCount = neutralZoneCount;
  settings.zoneCfg.playerZoneCastles = 1;
  settings.zoneCfg.neutralZoneCastles = draft.contentPreset === "TownFocused" ? 2 : 1;
  settings.zoneCfg.hubZoneSize = draft.cityHold ? 1.5 : 1.2;
  settings.zoneCfg.hubZoneCastles = draft.cityHold ? 1 : 0;
  settings.zoneCfg.advanced.enabled = useAdvancedNeutralSplit;
  settings.zoneCfg.advanced.neutralLowNoCastleCount = draft.neutralSplit.neutralLowNoCastleCount;
  settings.zoneCfg.advanced.neutralLowCastleCount = draft.neutralSplit.neutralLowCastleCount;
  settings.zoneCfg.advanced.neutralMediumNoCastleCount = draft.neutralSplit.neutralMediumNoCastleCount;
  settings.zoneCfg.advanced.neutralMediumCastleCount = draft.neutralSplit.neutralMediumCastleCount;
  settings.zoneCfg.advanced.neutralHighNoCastleCount = draft.neutralSplit.neutralHighNoCastleCount;
  settings.zoneCfg.advanced.neutralHighCastleCount = draft.neutralSplit.neutralHighCastleCount;
  settings.gameEndConditions.victoryCondition = draft.cityHold ? "win_condition_5" : "win_condition_1";
  settings.gameEndConditions.cityHold = draft.cityHold;
  settings.gameEndConditions.cityHoldDays = draft.cityHold ? 7 : settings.gameEndConditions.cityHoldDays;

  if (draft.maxPortalConnections !== undefined) {
    settings.maxPortalConnections = Math.max(0, Math.round(draft.maxPortalConnections));
  }
  if (draft.noDirectPlayerConnections !== "Auto") {
    settings.noDirectPlayerConnections = draft.noDirectPlayerConnections === "Enabled";
  }
  if (draft.minNeutralZonesBetweenPlayers !== undefined) {
    settings.minNeutralZonesBetweenPlayers = Math.max(0, Math.round(draft.minNeutralZonesBetweenPlayers));
  }
  if (draft.matchPlayerCastleFactions !== "Auto") {
    settings.matchPlayerCastleFactions = draft.matchPlayerCastleFactions === "Enabled";
  }

  applyHiddenIdentityPresetRules(settings, draft.generationPreset, draft.cityHold);

  return settings;
}

function applyHiddenIdentityPresetRules(settings: GeneratorSettings, preset: MapGenerationPreset, cityHoldEnabled: boolean): void {
  switch (preset) {
    case "SingleHero":
      settings.gameMode = "SingleHero";
      settings.heroSettings.heroCountMin = 1;
      settings.heroSettings.heroCountMax = 1;
      settings.heroSettings.heroCountIncrement = 0;
      settings.heroHireBan = true;
      settings.gameEndConditions.lostStartHero = true;
      settings.gameEndConditions.lostStartCity = false;
      break;
    case "BlitzLike":
      settings.heroSettings.heroCountMin = 2;
      settings.heroSettings.heroCountMax = 4;
      settings.heroSettings.heroCountIncrement = 0;
      break;
    case "JebusLikeObjective":
      if (cityHoldEnabled) settings.gameEndConditions.cityHoldDays = 6;
      break;
    case "AnarchyLike":
      settings.encounterHoles = true;
      break;
    case "Custom":
    case "Duel":
    case "FreeForAll":
    case "KingOfTheHill":
    case "EmpireBuilder":
    case "Arena":
    case "Chaos":
      break;
  }
}

export function countBalancedRandomZones(settings: Pick<GeneratorSettings, "playerCount" | "topology" | "naturalExpansionZone" | "zoneCfg">): number {
  const playerCount = settings.topology === "Triangle" ? 3 : settings.playerCount;
  const neutralZoneCount = settings.zoneCfg.advanced.enabled
    ? countNeutralSplitZones(settings.zoneCfg.advanced)
    : settings.zoneCfg.neutralZoneCount;
  return playerCount
    + neutralZoneCount
    + (settings.naturalExpansionZone ? playerCount : 0)
    + (settings.topology === "HubAndSpoke" || settings.topology === "Triangle" ? 1 : 0);
}

export function applyBalancedRandomBoardLayout(design: TemplateDesign): TemplateDesign {
  const next = structuredClone(design);
  const playerZones = next.zones
    .filter((zone) => zone.role === "Spawn")
    .sort((left, right) => comparePlayerZones(left.player ?? 0, right.player ?? 0, left.name, right.name));
  const hubZones = next.zones.filter((zone) => zone.role === "Hub");
  const naturalZones = next.zones
    .filter((zone) => zone.role === "Neutral" && zone.name.startsWith("Natural-"))
    .sort((left, right) => compareZoneSequence(left.name, right.name));
  const regularNeutralZones = next.zones
    .filter((zone) => zone.role === "Neutral" && !zone.name.startsWith("Natural-"))
    .sort((left, right) => compareZoneSequence(left.name, right.name));

  playerZones.forEach((zone, index) => {
    zone.position = clockwisePoint(index, playerZones.length, 0.42);
  });

  naturalZones.forEach((zone, index) => {
    const spawnIndex = playerZones.findIndex((candidate) => sameSuffix(candidate.name, zone.name));
    zone.position = clockwisePoint(spawnIndex >= 0 ? spawnIndex : index, Math.max(playerZones.length, naturalZones.length), 0.31);
  });

  assignClockwiseRings(regularNeutralZones, [
    { radius: 0.25, capacity: 8 },
    { radius: 0.18, capacity: 8 },
    { radius: 0.11, capacity: Number.POSITIVE_INFINITY }
  ]);
  hubZones.forEach((zone) => {
    zone.position = { x: 0.5, y: 0.5 };
  });

  return next;
}

function resolveBalancedTopology(
  topology: BalancedRandomTopology,
  playerCount: number,
  cityHold: boolean,
  naturalExpansion: boolean
): Exclude<MapTopology, "Random"> {
  if (topology !== "Auto") return topology;
  if (playerCount === 3 && (cityHold || naturalExpansion)) return "Triangle";
  if (cityHold) return "HubAndSpoke";
  if (playerCount <= 2) return "Default";
  if (playerCount <= 4) return "SharedWeb";
  return "Ladder";
}

function balancedMapSideForSize(size: BalancedRandomMapSize, totalZones: number): number {
  const base = size === "Small"
    ? 128
    : size === "Medium"
      ? 160
      : size === "Large"
        ? 192
        : 240;
  const target = base + Math.max(0, totalZones - 8) * 4;

  for (const candidate of [128, 144, 160, 176, 192, 208, 240]) {
    if (candidate >= target) return candidate;
  }

  return 240;
}

function clampRounded(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function countNeutralSplitZones(neutralSplit: BalancedRandomNeutralSplitDraft): number {
  return neutralSplit.neutralLowNoCastleCount
    + neutralSplit.neutralLowCastleCount
    + neutralSplit.neutralMediumNoCastleCount
    + neutralSplit.neutralMediumCastleCount
    + neutralSplit.neutralHighNoCastleCount
    + neutralSplit.neutralHighCastleCount;
}

function parseSeed(seed: string): number | undefined {
  const trimmed = seed.trim();
  if (trimmed === "") return undefined;
  const value = Number(trimmed);
  return Number.isInteger(value) && value >= 0 ? value : undefined;
}

function randomSeed(): number {
  return Math.floor(Math.random() * 2_147_483_647);
}

function assignClockwiseRings(
  zones: Array<{ position: Point; name: string }>,
  rings: Array<{ radius: number; capacity: number }>
): void {
  let cursor = 0;
  for (let ring = 0; ring < rings.length && cursor < zones.length; ring++) {
    const remaining = zones.length - cursor;
    const count = Math.min(remaining, rings[ring].capacity);
    for (let index = 0; index < count && cursor < zones.length; index++, cursor++) {
      zones[cursor].position = clockwisePoint(index, count, rings[ring].radius);
    }
  }
}

function clockwisePoint(index: number, count: number, radius: number): Point {
  const safeCount = Math.max(count, 1);
  const angle = -Math.PI / 2 + (index / safeCount) * Math.PI * 2;
  return {
    x: 0.5 + Math.cos(angle) * radius,
    y: 0.5 + Math.sin(angle) * radius
  };
}

function comparePlayerZones(leftPlayer: number, rightPlayer: number, leftName: string, rightName: string): number {
  return leftPlayer - rightPlayer || compareZoneSequence(leftName, rightName);
}

function compareZoneSequence(left: string, right: string): number {
  return suffixOrder(left) - suffixOrder(right) || left.localeCompare(right);
}

function suffixOrder(name: string): number {
  const suffix = name.split("-").at(-1) ?? name;
  if (/^\d+$/.test(suffix)) return Number(suffix);
  if (/^[A-Z]$/i.test(suffix)) return suffix.toUpperCase().charCodeAt(0) - 64;
  return Number.MAX_SAFE_INTEGER;
}

function sameSuffix(left: string, right: string): boolean {
  return (left.split("-").at(-1) ?? left) === (right.split("-").at(-1) ?? right);
}
