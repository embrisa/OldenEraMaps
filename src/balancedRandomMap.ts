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

export type BalancedRandomGameType = "Duel" | "FreeForAll" | "PvE";
export type BalancedRandomMapSize = "Small" | "Medium" | "Large" | "Huge";
export type BalancedRandomGameLength = "Short" | "Medium" | "Long";
export type BalancedRandomChaosLevel = "Tame" | "Normal" | "Wild";
export type BalancedRandomVictoryCondition = "Classic" | "CityHold" | "Tournament";
export type BalancedRandomBorderGuardLevel = "Weak" | "Normal" | "Strong" | "Fortress";
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
  gameType: BalancedRandomGameType;
  playerCount: number;
  neutralZoneCount: number;
  mapSize: BalancedRandomMapSize;
  gameLength: BalancedRandomGameLength;
  chaosLevel: BalancedRandomChaosLevel;
  victoryCondition: BalancedRandomVictoryCondition;
  borderGuardLevel: BalancedRandomBorderGuardLevel;
  topology: BalancedRandomTopology;
  generationPreset: MapGenerationPreset;
  pacePreset: GamePacePreset;
  connectionStylePreset: ConnectionStyle;
  contentPreset: ContentPreset;
  terrainTheme: TerrainTheme;
  water: boolean;
  strongerNeutrals: boolean;
  naturalExpansion: boolean;
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
  { value: "Huge", label: "Huge (experimental)" }
];

export const balancedRandomGameTypeOptions: Array<{ value: BalancedRandomGameType; label: string }> = [
  { value: "Duel", label: "Duel" },
  { value: "FreeForAll", label: "Free-for-all" },
  { value: "PvE", label: "PvE" }
];

export const balancedRandomGameLengthOptions: Array<{ value: BalancedRandomGameLength; label: string }> = [
  { value: "Short", label: "Short" },
  { value: "Medium", label: "Medium" },
  { value: "Long", label: "Long" }
];

export const balancedRandomChaosLevelOptions: Array<{ value: BalancedRandomChaosLevel; label: string }> = [
  { value: "Tame", label: "Tame" },
  { value: "Normal", label: "Normal" },
  { value: "Wild", label: "Wild" }
];

export const balancedRandomVictoryConditionOptions: Array<{ value: BalancedRandomVictoryCondition; label: string }> = [
  { value: "Classic", label: "Classic" },
  { value: "CityHold", label: "City Hold" },
  { value: "Tournament", label: "Tournament" }
];

export const balancedRandomBorderGuardOptions: Array<{ value: BalancedRandomBorderGuardLevel; label: string }> = [
  { value: "Weak", label: "Weak" },
  { value: "Normal", label: "Normal" },
  { value: "Strong", label: "Strong" },
  { value: "Fortress", label: "Fortress" }
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
    gameType: "FreeForAll",
    playerCount: 4,
    neutralZoneCount: 6,
    mapSize: "Large",
    gameLength: "Medium",
    chaosLevel: "Normal",
    victoryCondition: "Classic",
    borderGuardLevel: "Normal",
    topology: "Auto",
    generationPreset: "Custom",
    pacePreset: "Custom",
    connectionStylePreset: "Balanced",
    contentPreset: "Default",
    terrainTheme: "Mixed",
    water: false,
    strongerNeutrals: false,
    naturalExpansion: false,
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
  const effectivePacePreset = draft.pacePreset === "Custom" ? pacePresetForGameLength(draft.gameLength) : draft.pacePreset;
  settings.preset = draft.generationPreset;
  settings.pacePreset = effectivePacePreset;
  settings.connectionStyle = draft.connectionStylePreset;
  settings.contentPreset = draft.contentPreset;
  settings = applyGenerationPreset(settings);
  settings = applyPacePreset(settings);
  settings = applyConnectionStyle(settings);
  settings = applyContentPreset(settings);

  const victoryCondition = draft.victoryCondition;
  const cityHold = victoryCondition === "CityHold";
  const tournament = victoryCondition === "Tournament";
  const playerCount = resolveBalancedPlayerCount(draft);
  const topology = resolveBalancedTopology(draft.topology, playerCount, cityHold, draft.naturalExpansion, draft.gameType, victoryCondition);
  const simpleNeutralZoneCount = resolveSimpleNeutralZoneCount(draft, playerCount, topology, cityHold, tournament);
  const advancedNeutralZoneCount = countNeutralSplitZones(draft.neutralSplit);
  const useAdvancedNeutralSplit = advancedNeutralZoneCount > 0;
  const neutralZoneCount = useAdvancedNeutralSplit ? advancedNeutralZoneCount : simpleNeutralZoneCount;
  const naturalExpansionZone = draft.naturalExpansion;
  const totalZones = countBalancedRandomZones({
    ...settings,
    playerCount,
    topology,
    naturalExpansionZone,
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
  const effectiveMapSize = mapSizeForSimpleFlow(draft.mapSize, draft.gameType);
  const mapSide = balancedMapSideForSize(effectiveMapSize, totalZones);

  settings.identityPreset = draft.generationPreset === "Custom" ? undefined : draft.generationPreset;
  settings.preset = "Custom";
  settings.pacePreset = "Custom";
  settings.connectionStyle = draft.connectionStylePreset;
  settings.contentPreset = "Default";
  settings.templateName = draft.templateName.trim() || "Balanced Random Map";
  settings.gameMode = tournament ? "Tournament" : settings.gameMode;
  settings.playerCount = playerCount;
  settings.mapWidth = mapSide;
  settings.mapHeight = mapSide;
  settings.experimentalMapSizes = effectiveMapSize === "Huge";
  settings.borderWaterWidth = draft.water ? 4 : 0;
  settings.seed = parseSeed(draft.seed) ?? randomSeed();
  settings.terrainTheme = draft.terrainTheme;
  settings.topology = topology;
  settings.noDirectPlayerConnections = tournament || draft.gameType === "Duel" || topology === "Chain" || topology === "HubAndSpoke" || topology === "Triangle" || playerCount >= 4;
  settings.randomPortals = draft.randomPortals || draft.chaosLevel === "Wild";
  settings.maxPortalConnections = settings.randomPortals ? Math.min(16, Math.max(4, Math.ceil(totalZones / 2))) : 0;
  settings.experimentalBalancedZonePlacement = true;
  settings.matchAdjacentNeutralCastleFactions = neutralZoneCount > 0;
  settings.naturalExpansionZone = naturalExpansionZone;
  settings.minNeutralZonesBetweenPlayers = tournament
    ? 2
    : topology === "HubAndSpoke" || topology === "Triangle"
    ? 0
    : neutralZoneCount === 0
      ? 0
      : draft.gameType === "Duel" || playerCount >= 6
        ? 2
        : 1;
  settings.zoneCfg.neutralZoneCount = neutralZoneCount;
  settings.zoneCfg.playerZoneCastles = 1;
  settings.zoneCfg.neutralZoneCastles = draft.contentPreset === "TownFocused" ? 2 : 1;
  settings.zoneCfg.hubZoneSize = cityHold ? 1.5 : 1.2;
  settings.zoneCfg.hubZoneCastles = cityHold ? 1 : 0;
  settings.zoneCfg.borderGuardStrengthPercent = borderGuardStrengthPercent(draft.borderGuardLevel);
  settings.zoneCfg.neutralStackStrengthPercent = adjustedNeutralStrength(settings.zoneCfg.neutralStackStrengthPercent, draft);
  settings.zoneCfg.advanced.enabled = useAdvancedNeutralSplit;
  settings.zoneCfg.advanced.neutralLowNoCastleCount = draft.neutralSplit.neutralLowNoCastleCount;
  settings.zoneCfg.advanced.neutralLowCastleCount = draft.neutralSplit.neutralLowCastleCount;
  settings.zoneCfg.advanced.neutralMediumNoCastleCount = draft.neutralSplit.neutralMediumNoCastleCount;
  settings.zoneCfg.advanced.neutralMediumCastleCount = draft.neutralSplit.neutralMediumCastleCount;
  settings.zoneCfg.advanced.neutralHighNoCastleCount = draft.neutralSplit.neutralHighNoCastleCount;
  settings.zoneCfg.advanced.neutralHighCastleCount = draft.neutralSplit.neutralHighCastleCount;
  settings.zoneCfg.advanced.guardRandomization = guardRandomizationForChaos(draft.chaosLevel);
  settings.gameEndConditions.victoryCondition = victoryConditionSid(victoryCondition);
  settings.gameEndConditions.cityHold = cityHold;
  settings.gameEndConditions.cityHoldDays = cityHold ? cityHoldDaysForGameLength(draft.gameLength) : settings.gameEndConditions.cityHoldDays;
  settings.tournamentRules.enabled = tournament;
  if (tournament) applyTournamentLength(settings, draft.gameLength);

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

  applyHiddenIdentityPresetRules(settings, draft.generationPreset, cityHold);

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

function resolveBalancedPlayerCount(draft: BalancedRandomMapDraft): number {
  if (draft.victoryCondition === "Tournament" || draft.gameType === "Duel") return 2;
  const playerCount = clampRounded(draft.playerCount, 2, 8);
  return draft.gameType === "PvE" ? Math.max(4, playerCount) : playerCount;
}

function resolveSimpleNeutralZoneCount(
  draft: BalancedRandomMapDraft,
  playerCount: number,
  topology: Exclude<MapTopology, "Random">,
  cityHold: boolean,
  tournament: boolean
): number {
  const requestedNeutralZones = Math.max(0, Math.round(draft.neutralZoneCount));
  let neutralZoneCount = requestedNeutralZones;

  if (draft.gameType === "Duel") neutralZoneCount = Math.max(neutralZoneCount, 4);
  if (draft.gameType === "FreeForAll") neutralZoneCount = Math.max(neutralZoneCount, playerCount + 2);
  if (draft.gameType === "PvE") neutralZoneCount = Math.max(neutralZoneCount, playerCount + 4);
  if (draft.gameLength === "Short") neutralZoneCount = Math.max(2, neutralZoneCount - 2);
  if (draft.gameLength === "Long") neutralZoneCount += 2;
  if (draft.chaosLevel === "Tame") neutralZoneCount = Math.max(1, neutralZoneCount - 1);
  if (draft.chaosLevel === "Wild") neutralZoneCount += 2;
  if (tournament) neutralZoneCount = Math.max(4, neutralZoneCount);
  if (cityHold && topology !== "HubAndSpoke" && topology !== "Triangle") neutralZoneCount = Math.max(1, neutralZoneCount);

  const reservedZones = playerCount
    + (draft.naturalExpansion ? playerCount : 0)
    + (topology === "HubAndSpoke" || topology === "Triangle" ? 1 : 0);
  return clampRounded(neutralZoneCount, 0, Math.max(0, 32 - reservedZones));
}

function pacePresetForGameLength(gameLength: BalancedRandomGameLength): GamePacePreset {
  switch (gameLength) {
    case "Short": return "Quick";
    case "Long": return "Epic";
    case "Medium": return "Competitive";
  }
}

function cityHoldDaysForGameLength(gameLength: BalancedRandomGameLength): number {
  switch (gameLength) {
    case "Short": return 5;
    case "Long": return 10;
    case "Medium": return 7;
  }
}

function applyTournamentLength(settings: GeneratorSettings, gameLength: BalancedRandomGameLength): void {
  switch (gameLength) {
    case "Short":
      settings.tournamentRules.firstTournamentDay = 10;
      settings.tournamentRules.interval = 5;
      settings.tournamentRules.pointsToWin = 2;
      break;
    case "Long":
      settings.tournamentRules.firstTournamentDay = 21;
      settings.tournamentRules.interval = 7;
      settings.tournamentRules.pointsToWin = 3;
      break;
    case "Medium":
      settings.tournamentRules.firstTournamentDay = 14;
      settings.tournamentRules.interval = 7;
      settings.tournamentRules.pointsToWin = 2;
      break;
  }
}

function victoryConditionSid(victoryCondition: BalancedRandomVictoryCondition): string {
  switch (victoryCondition) {
    case "CityHold": return "win_condition_5";
    case "Tournament": return "win_condition_6";
    case "Classic": return "win_condition_1";
  }
}

export function borderGuardStrengthPercent(borderGuardLevel: BalancedRandomBorderGuardLevel): number {
  switch (borderGuardLevel) {
    case "Weak": return 70;
    case "Strong": return 130;
    case "Fortress": return 165;
    case "Normal": return 100;
  }
}

function adjustedNeutralStrength(baseStrength: number, draft: BalancedRandomMapDraft): number {
  const chaosAdjustment = draft.chaosLevel === "Tame" ? -10 : draft.chaosLevel === "Wild" ? 15 : 0;
  const strongerNeutralAdjustment = draft.strongerNeutrals ? 25 : 0;
  return clampRounded(baseStrength + chaosAdjustment + strongerNeutralAdjustment, 50, 250);
}

function guardRandomizationForChaos(chaosLevel: BalancedRandomChaosLevel): number {
  switch (chaosLevel) {
    case "Tame": return 0.02;
    case "Wild": return 0.22;
    case "Normal": return 0.05;
  }
}

function mapSizeForSimpleFlow(mapSize: BalancedRandomMapSize, gameType: BalancedRandomGameType): BalancedRandomMapSize {
  if (gameType !== "PvE") return mapSize;
  if (mapSize === "Small") return "Medium";
  if (mapSize === "Medium") return "Large";
  if (mapSize === "Large") return "Huge";
  return "Huge";
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
  naturalExpansion: boolean,
  gameType: BalancedRandomGameType,
  victoryCondition: BalancedRandomVictoryCondition
): Exclude<MapTopology, "Random"> {
  if (topology !== "Auto") return topology;
  if (victoryCondition === "Tournament") return "Chain";
  if (gameType === "Duel") return cityHold ? "HubAndSpoke" : "Default";
  if (playerCount === 3 && (cityHold || naturalExpansion)) return "Triangle";
  if (cityHold) return "HubAndSpoke";
  if (gameType === "PvE") return playerCount <= 4 ? "SharedWeb" : "Ladder";
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
        ? 208
        : 256;
  const target = base + Math.max(0, totalZones - 8) * 4;

  const candidates = size === "Huge"
    ? [256, 272, 288, 304, 320, 336, 352]
    : [128, 144, 160, 176, 192, 208, 224, 240];
  for (const candidate of candidates) {
    if (candidate >= target) return candidate;
  }

  return candidates.at(-1) ?? 240;
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
