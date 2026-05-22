import type {
  ConnectionStyle,
  ContentPreset,
  GamePacePreset,
  GeneratorSettings,
  MapGenerationPreset,
  MapTopology,
  TerrainTheme,
  ValidationResult
} from "./types.ts";
import { clamp } from "./math.ts";

export const presetOptions: Array<{ value: MapGenerationPreset; label: string }> = [
  { value: "Custom", label: "Custom" },
  { value: "Duel", label: "Duel" },
  { value: "FreeForAll", label: "Free For All" },
  { value: "KingOfTheHill", label: "King of the Hill" },
  { value: "EmpireBuilder", label: "Empire Builder" },
  { value: "Arena", label: "Arena" },
  { value: "Chaos", label: "Chaos" },
  { value: "SingleHero", label: "Single Hero" },
  { value: "BlitzLike", label: "Blitz-Like" },
  { value: "JebusLikeObjective", label: "Jebus-Like Objective" },
  { value: "AnarchyLike", label: "Anarchy-Like" }
];

export const paceOptions: Array<{ value: GamePacePreset; label: string }> = [
  { value: "Custom", label: "Custom" },
  { value: "Quick", label: "Quick" },
  { value: "Standard", label: "Standard" },
  { value: "Epic", label: "Epic" },
  { value: "Competitive", label: "Competitive" },
  { value: "Casual", label: "Casual" },
  { value: "HighResource", label: "High Resource" },
  { value: "LowResource", label: "Low Resource" }
];

export const topologyOptions: Array<{ value: MapTopology; label: string }> = [
  { value: "Random", label: "Random" },
  { value: "Default", label: "Ring" },
  { value: "HubAndSpoke", label: "Hub" },
  { value: "Chain", label: "Chain" },
  { value: "SharedWeb", label: "Shared Web" },
  { value: "Ladder", label: "Ladder" },
  { value: "Triangle", label: "Triangle" }
];

export const connectionStyleOptions: Array<{ value: ConnectionStyle; label: string }> = [
  { value: "Custom", label: "Custom" },
  { value: "Balanced", label: "Balanced" },
  { value: "SafeLanes", label: "Safe Lanes" },
  { value: "OpenConflict", label: "Open Conflict" },
  { value: "Chokepoints", label: "Chokepoints" },
  { value: "ManyRoutes", label: "Many Routes" },
  { value: "PortalHeavy", label: "Portal Heavy" },
  { value: "RoadHeavy", label: "Road Heavy" },
  { value: "RoadLight", label: "Road Light" }
];

export const contentPresetOptions: Array<{ value: ContentPreset; label: string }> = [
  { value: "Default", label: "Default" },
  { value: "ArtifactRich", label: "Artifact Rich" },
  { value: "ResourceRich", label: "Resource Rich" },
  { value: "CreatureHeavy", label: "Creature Heavy" },
  { value: "TownFocused", label: "Town Focused" },
  { value: "TreasureSparse", label: "Treasure Sparse" },
  { value: "HighRiskHighReward", label: "High Risk High Reward" }
];

export const terrainOptions: Array<{ value: TerrainTheme; label: string }> = [
  { value: "FactionMatched", label: "Faction Matched" },
  { value: "Random", label: "Random" },
  { value: "Grass", label: "Grass" },
  { value: "Snow", label: "Snow" },
  { value: "Desert", label: "Desert" },
  { value: "Lava", label: "Lava" },
  { value: "Swamp", label: "Swamp" },
  { value: "Mixed", label: "Mixed" }
];

export const gameModeOptions = [
  { value: "Classic", label: "Classic" },
  { value: "SingleHero", label: "Single Hero" },
  { value: "Arena", label: "Arena" },
  { value: "Tournament", label: "Tournament" }
];

export const victoryOptions = [
  { value: "win_condition_1", label: "Classic" },
  { value: "win_condition_2", label: "Defeat all enemies" },
  { value: "win_condition_3", label: "Capture town" },
  { value: "win_condition_4", label: "Gladiator Arena" },
  { value: "win_condition_5", label: "City Hold" }
];

export function createDefaultSettings(): GeneratorSettings {
  return {
    preset: "Custom",
    pacePreset: "Custom",
    connectionStyle: "Custom",
    contentPreset: "Default",
    templateName: "Custom Template",
    gameMode: "Classic",
    playerCount: 2,
    mapWidth: 160,
    mapHeight: 160,
    experimentalMapSizes: false,
    heroSettings: {
      heroCountMin: 4,
      heroCountMax: 8,
      heroCountIncrement: 1
    },
    noDirectPlayerConnections: false,
    randomPortals: false,
    maxPortalConnections: 32,
    spawnRemoteFootholds: true,
    generateRoads: true,
    experimentalBalancedZonePlacement: false,
    matchPlayerCastleFactions: false,
    matchAdjacentNeutralCastleFactions: false,
    neutralCastlesAsRuins: false,
    naturalExpansionZone: false,
    terrainTheme: "FactionMatched",
    minNeutralZonesBetweenPlayers: 0,
    topology: "Random",
    zoneCfg: {
      neutralZoneCount: 0,
      playerZoneCastles: 1,
      neutralZoneCastles: 1,
      resourceDensityPercent: 100,
      structureDensityPercent: 100,
      neutralStackStrengthPercent: 100,
      borderGuardStrengthPercent: 100,
      hubZoneSize: 1,
      hubZoneCastles: 0,
      advanced: {
        enabled: false,
        neutralLowNoCastleCount: 0,
        neutralLowCastleCount: 0,
        neutralMediumNoCastleCount: 0,
        neutralMediumCastleCount: 0,
        neutralHighNoCastleCount: 0,
        neutralHighCastleCount: 0,
        playerZoneSize: 1,
        neutralZoneSize: 1,
        guardRandomization: 0.05
      }
    },
    heroHireBan: false,
    encounterHoles: false,
    movementBonus: 0,
    factionLawsExpPercent: 100,
    astrologyExpPercent: 100,
    gameEndConditions: {
      victoryCondition: "win_condition_1",
      lostStartCity: false,
      lostStartCityDay: 3,
      lostStartHero: false,
      cityHold: false,
      cityHoldDays: 6
    },
    gladiatorArenaRules: {
      enabled: false,
      daysDelayStart: 30,
      countDay: 3
    },
    tournamentRules: {
      enabled: false,
      firstTournamentDay: 14,
      interval: 7,
      pointsToWin: 2,
      saveArmy: true
    }
  };
}

export function cloneSettings(settings: GeneratorSettings): GeneratorSettings {
  return structuredClone(settings);
}

export function applyGenerationPreset(settings: GeneratorSettings): GeneratorSettings {
  const next = cloneSettings(settings);
  switch (next.preset) {
    case "Duel":
      next.playerCount = 2;
      next.mapWidth = 160;
      next.mapHeight = 160;
      next.topology = "Default";
      next.zoneCfg.neutralZoneCount = 4;
      next.zoneCfg.playerZoneCastles = 1;
      next.zoneCfg.neutralZoneCastles = 1;
      next.noDirectPlayerConnections = true;
      next.minNeutralZonesBetweenPlayers = 1;
      next.experimentalBalancedZonePlacement = true;
      break;
    case "FreeForAll":
      next.playerCount = 6;
      next.mapWidth = 200;
      next.mapHeight = 200;
      next.topology = "Default";
      next.zoneCfg.neutralZoneCount = 6;
      break;
    case "KingOfTheHill":
      next.playerCount = 4;
      next.mapWidth = 180;
      next.mapHeight = 180;
      next.topology = "HubAndSpoke";
      next.zoneCfg.neutralZoneCount = 4;
      next.zoneCfg.hubZoneSize = 1.6;
      next.zoneCfg.hubZoneCastles = 1;
      next.gameEndConditions.cityHold = true;
      next.gameEndConditions.victoryCondition = "win_condition_5";
      break;
    case "EmpireBuilder":
      next.playerCount = 4;
      next.mapWidth = 240;
      next.mapHeight = 240;
      next.topology = "SharedWeb";
      next.zoneCfg.neutralZoneCount = 10;
      next.zoneCfg.playerZoneCastles = 2;
      next.zoneCfg.neutralZoneCastles = 1;
      next.naturalExpansionZone = true;
      next.zoneCfg.resourceDensityPercent = 125;
      next.zoneCfg.structureDensityPercent = 130;
      break;
    case "Arena":
      next.playerCount = 2;
      next.mapWidth = 120;
      next.mapHeight = 120;
      next.topology = "Chain";
      next.zoneCfg.neutralZoneCount = 2;
      next.zoneCfg.neutralZoneCastles = 0;
      next.noDirectPlayerConnections = false;
      break;
    case "Chaos":
      next.playerCount = 6;
      next.mapWidth = 200;
      next.mapHeight = 200;
      next.topology = "Random";
      next.zoneCfg.neutralZoneCount = 8;
      next.randomPortals = true;
      next.maxPortalConnections = 16;
      next.zoneCfg.advanced.guardRandomization = 0.25;
      break;
    case "SingleHero":
      next.gameMode = "SingleHero";
      next.playerCount = 2;
      next.mapWidth = 160;
      next.mapHeight = 160;
      next.topology = "Default";
      next.zoneCfg.neutralZoneCount = 4;
      next.zoneCfg.playerZoneCastles = 1;
      next.zoneCfg.neutralZoneCastles = 1;
      next.noDirectPlayerConnections = true;
      next.minNeutralZonesBetweenPlayers = 1;
      next.experimentalBalancedZonePlacement = true;
      next.heroSettings.heroCountMin = 1;
      next.heroSettings.heroCountMax = 1;
      next.heroSettings.heroCountIncrement = 0;
      next.heroHireBan = true;
      next.gameEndConditions.lostStartHero = true;
      next.gameEndConditions.lostStartCity = false;
      next.gameEndConditions.victoryCondition = "win_condition_1";
      next.gameEndConditions.cityHold = false;
      break;
    case "BlitzLike":
      next.gameMode = "Classic";
      next.playerCount = 2;
      next.mapWidth = 120;
      next.mapHeight = 120;
      next.topology = "Chain";
      next.zoneCfg.neutralZoneCount = 2;
      next.zoneCfg.playerZoneCastles = 1;
      next.zoneCfg.neutralZoneCastles = 0;
      next.noDirectPlayerConnections = false;
      next.minNeutralZonesBetweenPlayers = 0;
      next.experimentalBalancedZonePlacement = true;
      next.heroSettings.heroCountMin = 2;
      next.heroSettings.heroCountMax = 4;
      next.heroSettings.heroCountIncrement = 0;
      next.zoneCfg.resourceDensityPercent = 85;
      next.zoneCfg.structureDensityPercent = 85;
      next.zoneCfg.neutralStackStrengthPercent = 130;
      next.zoneCfg.borderGuardStrengthPercent = 140;
      next.zoneCfg.advanced.guardRandomization = 0.02;
      next.gameEndConditions.victoryCondition = "win_condition_1";
      next.gameEndConditions.cityHold = false;
      break;
    case "JebusLikeObjective":
      next.gameMode = "Classic";
      next.playerCount = 2;
      next.mapWidth = 180;
      next.mapHeight = 180;
      next.topology = "HubAndSpoke";
      next.zoneCfg.neutralZoneCount = 4;
      next.zoneCfg.playerZoneCastles = 1;
      next.zoneCfg.neutralZoneCastles = 1;
      next.zoneCfg.hubZoneSize = 1.8;
      next.zoneCfg.hubZoneCastles = 1;
      next.zoneCfg.resourceDensityPercent = 90;
      next.zoneCfg.structureDensityPercent = 120;
      next.zoneCfg.neutralStackStrengthPercent = 120;
      next.zoneCfg.borderGuardStrengthPercent = 130;
      next.noDirectPlayerConnections = true;
      next.minNeutralZonesBetweenPlayers = 1;
      next.experimentalBalancedZonePlacement = true;
      next.gameEndConditions.victoryCondition = "win_condition_5";
      next.gameEndConditions.cityHold = true;
      next.gameEndConditions.cityHoldDays = 6;
      break;
    case "AnarchyLike":
      next.gameMode = "Classic";
      next.playerCount = 4;
      next.mapWidth = 180;
      next.mapHeight = 180;
      next.topology = "SharedWeb";
      next.zoneCfg.neutralZoneCount = 6;
      next.zoneCfg.playerZoneCastles = 1;
      next.zoneCfg.neutralZoneCastles = 1;
      next.noDirectPlayerConnections = false;
      next.randomPortals = true;
      next.maxPortalConnections = 12;
      next.experimentalBalancedZonePlacement = true;
      next.encounterHoles = true;
      next.zoneCfg.neutralStackStrengthPercent = 115;
      next.zoneCfg.borderGuardStrengthPercent = 120;
      next.zoneCfg.advanced.guardRandomization = 0.3;
      next.gameEndConditions.victoryCondition = "win_condition_1";
      next.gameEndConditions.cityHold = false;
      break;
    case "Custom":
      break;
  }
  return next;
}

export function applyPacePreset(settings: GeneratorSettings): GeneratorSettings {
  const next = cloneSettings(settings);
  switch (next.pacePreset) {
    case "Quick":
      next.heroSettings.heroCountMin = 3;
      next.heroSettings.heroCountMax = 6;
      next.zoneCfg.neutralStackStrengthPercent = 80;
      next.zoneCfg.borderGuardStrengthPercent = 80;
      next.zoneCfg.structureDensityPercent = 85;
      break;
    case "Standard":
      next.heroSettings.heroCountMin = 4;
      next.heroSettings.heroCountMax = 8;
      next.zoneCfg.neutralStackStrengthPercent = 100;
      next.zoneCfg.borderGuardStrengthPercent = 100;
      break;
    case "Epic":
      next.heroSettings.heroCountMin = 5;
      next.heroSettings.heroCountMax = 12;
      next.zoneCfg.neutralZoneCount = Math.max(next.zoneCfg.neutralZoneCount, 6);
      next.zoneCfg.structureDensityPercent = 130;
      next.zoneCfg.neutralStackStrengthPercent = 125;
      break;
    case "Competitive":
      next.heroSettings.heroCountMin = 4;
      next.heroSettings.heroCountMax = 8;
      next.zoneCfg.advanced.guardRandomization = 0.02;
      next.minNeutralZonesBetweenPlayers = Math.max(next.minNeutralZonesBetweenPlayers, 1);
      next.experimentalBalancedZonePlacement = true;
      break;
    case "Casual":
      next.zoneCfg.resourceDensityPercent = 135;
      next.zoneCfg.neutralStackStrengthPercent = 75;
      next.zoneCfg.borderGuardStrengthPercent = 80;
      break;
    case "HighResource":
      next.zoneCfg.resourceDensityPercent = 160;
      next.zoneCfg.structureDensityPercent = 125;
      break;
    case "LowResource":
      next.zoneCfg.resourceDensityPercent = 70;
      next.zoneCfg.structureDensityPercent = 80;
      next.zoneCfg.neutralStackStrengthPercent = 115;
      break;
    case "Custom":
      break;
  }
  return next;
}

export function applyConnectionStyle(settings: GeneratorSettings): GeneratorSettings {
  const next = cloneSettings(settings);
  switch (next.connectionStyle) {
    case "Balanced":
      next.generateRoads = true;
      next.spawnRemoteFootholds = true;
      next.experimentalBalancedZonePlacement = true;
      next.minNeutralZonesBetweenPlayers = Math.max(next.minNeutralZonesBetweenPlayers, 1);
      break;
    case "SafeLanes":
      next.noDirectPlayerConnections = true;
      next.minNeutralZonesBetweenPlayers = Math.max(next.minNeutralZonesBetweenPlayers, 2);
      next.experimentalBalancedZonePlacement = true;
      next.randomPortals = false;
      break;
    case "OpenConflict":
      next.noDirectPlayerConnections = false;
      next.minNeutralZonesBetweenPlayers = 0;
      next.randomPortals = false;
      break;
    case "Chokepoints":
      next.noDirectPlayerConnections = true;
      next.experimentalBalancedZonePlacement = true;
      next.minNeutralZonesBetweenPlayers = Math.max(next.minNeutralZonesBetweenPlayers, 1);
      next.randomPortals = false;
      next.maxPortalConnections = 4;
      break;
    case "ManyRoutes":
      next.noDirectPlayerConnections = false;
      next.randomPortals = true;
      next.maxPortalConnections = 12;
      break;
    case "PortalHeavy":
      next.randomPortals = true;
      next.maxPortalConnections = 32;
      break;
    case "RoadHeavy":
      next.generateRoads = true;
      next.spawnRemoteFootholds = true;
      break;
    case "RoadLight":
      next.generateRoads = false;
      next.spawnRemoteFootholds = false;
      break;
    case "Custom":
      break;
  }
  return next;
}

export function applyContentPreset(settings: GeneratorSettings): GeneratorSettings {
  const next = cloneSettings(settings);
  switch (next.contentPreset) {
    case "ArtifactRich":
      next.zoneCfg.structureDensityPercent = 125;
      next.zoneCfg.neutralStackStrengthPercent = 110;
      break;
    case "ResourceRich":
      next.zoneCfg.resourceDensityPercent = 150;
      next.zoneCfg.neutralStackStrengthPercent = 85;
      break;
    case "CreatureHeavy":
      next.zoneCfg.structureDensityPercent = 135;
      next.zoneCfg.neutralStackStrengthPercent = 125;
      break;
    case "TownFocused":
      next.zoneCfg.neutralZoneCastles = Math.max(next.zoneCfg.neutralZoneCastles, 1);
      next.zoneCfg.structureDensityPercent = 120;
      next.spawnRemoteFootholds = true;
      break;
    case "TreasureSparse":
      next.zoneCfg.resourceDensityPercent = 75;
      next.zoneCfg.structureDensityPercent = 75;
      break;
    case "HighRiskHighReward":
      next.zoneCfg.resourceDensityPercent = 140;
      next.zoneCfg.structureDensityPercent = 140;
      next.zoneCfg.neutralStackStrengthPercent = 150;
      next.zoneCfg.borderGuardStrengthPercent = 140;
      break;
    case "Default":
      break;
  }
  return next;
}

export function normalizeSettings(settings: GeneratorSettings): GeneratorSettings {
  let next = applyGenerationPreset(settings);
  next = applyPacePreset(next);
  next = applyConnectionStyle(next);
  next = applyContentPreset(next);
  if (next.gameEndConditions.victoryCondition === "win_condition_5") {
    next.gameEndConditions.cityHold = true;
  }
  if (next.topology === "Triangle") {
    next.playerCount = 3;
  }
  next.playerCount = clampInt(next.playerCount, 2, 8);
  next.mapWidth = clampInt(next.mapWidth, 96, 512);
  next.mapHeight = clampInt(next.mapHeight, 96, 512);
  next.zoneCfg.neutralZoneCount = clampInt(next.zoneCfg.neutralZoneCount, 0, 24);
  next.zoneCfg.playerZoneCastles = clampInt(next.zoneCfg.playerZoneCastles, 0, 8);
  next.zoneCfg.neutralZoneCastles = clampInt(next.zoneCfg.neutralZoneCastles, 0, 8);
  next.maxPortalConnections = clampInt(next.maxPortalConnections, 0, 32);
  next.movementBonus = clampInt(next.movementBonus, -100, 100);
  return next;
}

export function validateSettings(settings: GeneratorSettings): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const playerCount = settings.topology === "Triangle" ? 3 : settings.playerCount;
  const advancedNeutralCount = settings.zoneCfg.advanced.enabled
    ? settings.zoneCfg.advanced.neutralLowNoCastleCount +
      settings.zoneCfg.advanced.neutralLowCastleCount +
      settings.zoneCfg.advanced.neutralMediumNoCastleCount +
      settings.zoneCfg.advanced.neutralMediumCastleCount +
      settings.zoneCfg.advanced.neutralHighNoCastleCount +
      settings.zoneCfg.advanced.neutralHighCastleCount
    : settings.zoneCfg.neutralZoneCount;
  const totalZones = playerCount + advancedNeutralCount + (settings.naturalExpansionZone ? playerCount : 0) + (settings.topology === "HubAndSpoke" || settings.topology === "Triangle" ? 1 : 0);

  if (!settings.templateName.trim()) errors.push("Template name is required.");
  if (settings.heroSettings.heroCountMin > settings.heroSettings.heroCountMax) errors.push("Initial hero cap cannot be greater than max hero cap.");
  if (settings.mapWidth < 96 || settings.mapHeight < 96) errors.push("Map dimensions must be at least 96x96.");
  if (totalZones > 32) errors.push("Generated templates support at most 32 zones.");
  if (settings.tournamentRules.enabled && playerCount !== 2) errors.push("Tournament mode requires exactly 2 players.");
  if (settings.gameEndConditions.cityHold && settings.zoneCfg.neutralZoneCount === 0 && settings.topology !== "HubAndSpoke" && settings.topology !== "Triangle") {
    errors.push("City Hold needs a hub, triangle center, or at least one neutral zone.");
  }
  if (settings.mapWidth > 240 || settings.mapHeight > 240) warnings.push("Official examples top out at 240x240. Larger or rectangular maps are experimental.");
  if (settings.randomPortals && settings.maxPortalConnections === 0) warnings.push("Random portals are enabled, but max portal connections is 0.");
  if (settings.noDirectPlayerConnections && settings.zoneCfg.neutralZoneCount === 0 && settings.topology !== "HubAndSpoke") {
    warnings.push("Player isolation may be impossible without neutral zones or a hub.");
  }

  return { errors, warnings };
}

function clampInt(value: number, min: number, max: number): number {
  return Math.round(clamp(value, min, max));
}
