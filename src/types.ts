export type MapGenerationPreset =
  | "Custom"
  | "Duel"
  | "FreeForAll"
  | "KingOfTheHill"
  | "EmpireBuilder"
  | "Arena"
  | "Chaos"
  | "SingleHero"
  | "BlitzLike"
  | "JebusLikeObjective"
  | "AnarchyLike";

export type GamePacePreset =
  | "Custom"
  | "Quick"
  | "Standard"
  | "Epic"
  | "Competitive"
  | "Casual"
  | "HighResource"
  | "LowResource";

export type ConnectionStyle =
  | "Custom"
  | "Balanced"
  | "SafeLanes"
  | "OpenConflict"
  | "Chokepoints"
  | "ManyRoutes"
  | "PortalHeavy"
  | "RoadHeavy"
  | "RoadLight";

export type ContentPreset =
  | "Default"
  | "ArtifactRich"
  | "ResourceRich"
  | "CreatureHeavy"
  | "TownFocused"
  | "TreasureSparse"
  | "HighRiskHighReward";

export type MapTopology =
  | "Default"
  | "HubAndSpoke"
  | "Chain"
  | "SharedWeb"
  | "Random"
  | "Ladder"
  | "Triangle";

export type TerrainTheme =
  | "FactionMatched"
  | "Random"
  | "Grass"
  | "Snow"
  | "Desert"
  | "Lava"
  | "Swamp"
  | "Mixed";

export type NeutralZoneQuality = "Low" | "Medium" | "High";

export interface GeneratorSettings {
  preset: MapGenerationPreset;
  identityPreset?: MapGenerationPreset;
  pacePreset: GamePacePreset;
  connectionStyle: ConnectionStyle;
  contentPreset: ContentPreset;
  templateName: string;
  gameMode: string;
  seed?: number;
  playerCount: number;
  mapWidth: number;
  mapHeight: number;
  experimentalMapSizes: boolean;
  heroSettings: HeroSettings;
  noDirectPlayerConnections: boolean;
  randomPortals: boolean;
  maxPortalConnections: number;
  spawnRemoteFootholds: boolean;
  generateRoads: boolean;
  experimentalBalancedZonePlacement: boolean;
  matchPlayerCastleFactions: boolean;
  matchAdjacentNeutralCastleFactions: boolean;
  neutralCastlesAsRuins: boolean;
  naturalExpansionZone: boolean;
  terrainTheme: TerrainTheme;
  minNeutralZonesBetweenPlayers: number;
  topology: MapTopology;
  zoneCfg: ZoneConfiguration;
  heroHireBan: boolean;
  encounterHoles: boolean;
  movementBonus: number;
  factionLawsExpPercent: number;
  astrologyExpPercent: number;
  gameEndConditions: GameEndConditions;
  gladiatorArenaRules: GladiatorArenaRules;
  tournamentRules: TournamentRules;
}

export interface HeroSettings {
  heroCountMin: number;
  heroCountMax: number;
  heroCountIncrement: number;
}

export interface AdvancedSettings {
  enabled: boolean;
  neutralLowNoCastleCount: number;
  neutralLowCastleCount: number;
  neutralMediumNoCastleCount: number;
  neutralMediumCastleCount: number;
  neutralHighNoCastleCount: number;
  neutralHighCastleCount: number;
  playerZoneSize: number;
  neutralZoneSize: number;
  guardRandomization: number;
}

export interface ZoneConfiguration {
  neutralZoneCount: number;
  playerZoneCastles: number;
  neutralZoneCastles: number;
  resourceDensityPercent: number;
  structureDensityPercent: number;
  neutralStackStrengthPercent: number;
  borderGuardStrengthPercent: number;
  hubZoneSize: number;
  hubZoneCastles: number;
  advanced: AdvancedSettings;
}

export interface GameEndConditions {
  victoryCondition: string;
  lostStartCity: boolean;
  lostStartCityDay: number;
  lostStartHero: boolean;
  cityHold: boolean;
  cityHoldDays: number;
}

export interface GladiatorArenaRules {
  enabled: boolean;
  daysDelayStart: number;
  countDay: number;
}

export interface TournamentRules {
  enabled: boolean;
  firstTournamentDay: number;
  interval: number;
  pointsToWin: number;
  saveArmy: boolean;
}

type JsonScalar = string | number | boolean | null;
export type JsonValue = JsonScalar | JsonValue[] | { [key: string]: JsonValue };

export interface RmgTemplate {
  name: string;
  gameMode?: string;
  description?: string;
  displayWinCondition?: string;
  sizeX: number;
  sizeZ: number;
  gameRules?: GameRules;
  valueOverrides?: ValueOverride[];
  globalBans?: GlobalBans;
  variants?: Variant[];
  zoneLayouts?: ZoneLayout[];
  mandatoryContent?: MandatoryContentGroup[];
  contentCountLimits?: ContentCountLimit[];
  contentPools?: JsonValue[];
  contentLists?: JsonValue[];
  [key: string]: unknown;
}

export interface GameRules {
  heroCountMin?: number;
  heroCountMax?: number;
  heroCountIncrement?: number;
  heroHireBan?: boolean;
  encounterHoles?: boolean;
  tournamentRules?: boolean;
  factionLawsExpModifier?: number;
  astrologyExpModifier?: number;
  bonuses?: Bonus[] | Bonus;
  winConditions?: WinConditions;

  // Older examples sometimes place selected win-condition fields directly on gameRules.
  classic?: boolean;
  desertion?: boolean;
  desertionDay?: number;
  desertionValue?: number;
  heroLighting?: boolean;
  heroLightingDay?: number;
  lostStartCity?: boolean;
  lostStartHero?: boolean;
  cityHold?: boolean;
  cityHoldDays?: number;
  gladiatorArena?: boolean;
  gladiatorArenaRegistrationStartWork?: boolean;
  gladiatorArenaRegistrationStartFight?: boolean;
  gladiatorArenaDaysDelayStart?: number;
  gladiatorArenaCountDay?: number;
  championSelectRule?: string;
  globalBans?: GlobalBans;
  holdCityWinCon?: boolean;
  [key: string]: unknown;
}

export interface Bonus {
  sid: string;
  receiverSide?: number;
  receiverFilter?: string;
  parameters?: string[];
  [key: string]: unknown;
}

export interface WinConditions {
  classic?: boolean;
  desertion?: boolean;
  desertionDay?: number;
  desertionValue?: number;
  heroLighting?: boolean;
  heroLightingDay?: number;
  lostStartCity?: boolean;
  lostStartCityDay?: number;
  lostStartHero?: boolean;
  cityHold?: boolean;
  cityHoldDays?: number;
  gladiatorArena?: boolean;
  gladiatorArenaRegistrationStartWork?: boolean;
  gladiatorArenaRegistrationStartFight?: boolean;
  gladiatorArenaDaysDelayStart?: number;
  gladiatorArenaCountDay?: number;
  championSelectRule?: string;
  tournament?: boolean;
  tournamentDays?: number[];
  tournamentAnnounceDays?: number[];
  tournamentPointsToWin?: number;
  tournamentSaveArmy?: boolean;
  [key: string]: unknown;
}

export interface ValueOverride {
  sid: string;
  variant?: number;
  guardValue?: number;
  [key: string]: unknown;
}

export interface GlobalBans {
  items?: string[];
  heroes?: string[];
  magics?: string[];
  [key: string]: unknown;
}

export interface Variant {
  orientation?: Orientation;
  border?: Border;
  zones?: Zone[];
  connections?: Connection[];
  [key: string]: unknown;
}

export interface Orientation {
  mode?: string;
  zeroAngleZone?: string;
  baseAngleMin?: number;
  baseAngleMax?: number;
  randomAngleAmplitude?: number;
  randomAngleStep?: number;
  [key: string]: unknown;
}

export interface Border {
  cornerRadius?: number;
  obstaclesWidth?: number;
  obstaclesNoise?: NoiseEntry[];
  waterWidth?: number;
  waterNoise?: NoiseEntry[];
  waterType?: string;
  [key: string]: unknown;
}

export interface NoiseEntry {
  amp: number;
  freq: number;
  [key: string]: unknown;
}

export interface Zone {
  name: string;
  size?: number;
  layout?: string;
  guardCutoffValue?: number;
  guardRandomization?: number;
  guardMultiplier?: number;
  guardWeeklyIncrement?: number;
  guardReactionDistribution?: number[];
  diplomacyModifier?: number;
  encounterHolesSettings?: EncounterHolesSettings;
  guardedContentPool?: string[];
  unguardedContentPool?: string[];
  resourcesContentPool?: string[];
  mandatoryContent?: string[];
  contentCountLimits?: StringListLike;
  guardedContentValue?: number;
  guardedContentValuePerArea?: number;
  unguardedContentValue?: number;
  unguardedContentValuePerArea?: number;
  resourcesValue?: number;
  resourcesValuePerArea?: number;
  mainObjects?: MainObject[];
  zoneBiome?: BiomeSelector;
  contentBiome?: BiomeSelector;
  metaObjectsBiome?: BiomeSelector;
  crossroadsPosition?: number;
  roads?: Road[];

  // Preview-only hint stripped before serialization.
  generatorPosition?: Point;

  // Example-backed fields preserved when loading existing templates.
  randomHireEnableWeeklyUnitIncrement?: boolean;
  randomHireInitialUnitIncrement?: number;
  [key: string]: unknown;
}

export interface EncounterHolesSettings {
  affectedEncounters?: number;
  twoHoleEncounters?: number;
  [key: string]: unknown;
}

export interface MainObject {
  type: string;
  spawn?: string;
  guardChance?: number;
  guardValue?: number;
  guardRandomization?: number;
  guardWeeklyIncrement?: number;
  removeGuardIfHasOwner?: boolean;
  buildingsConstructionSid?: string;
  faction?: TypedSelector;
  factions?: TypedSelector;
  owner?: number | string;
  placement?: string;
  placementArgs?: string[];
  holdCityWinCon?: boolean;
  enableWeeklyUnitIncrement?: boolean;
  initialUnitIncrement?: number;
  isKeyObject?: boolean;
  [key: string]: unknown;
}

export interface TypedSelector {
  type?: string;
  args?: string[];
  [key: string]: unknown;
}

export type Selector = TypedSelector;
export type BiomeSelector = TypedSelector;

export interface Road {
  type?: string;
  from?: RoadEndpoint;
  to?: RoadEndpoint;
  [key: string]: unknown;
}

export interface RoadEndpoint {
  type?: string;
  args?: string[];
  [key: string]: unknown;
}

export interface Connection {
  name?: string;
  from: string;
  to: string;
  connectionType?: string;
  guardZone?: string;
  guardEscape?: boolean;
  simTurnSquad?: boolean;
  guardValue?: number;
  guardRandomization?: number;
  guardWeeklyIncrement?: number;
  guardMatchGroup?: string;
  portalPlacementRulesFrom?: ContentPlacementRule[];
  portalPlacementRulesTo?: ContentPlacementRule[];
  road?: boolean;
  gatePlacement?: string;
  length?: number;
  [key: string]: unknown;
}

export interface ZoneLayout {
  name: string;
  obstaclesFill?: number;
  obstaclesFillVoid?: number;
  lakesFill?: number;
  minLakeArea?: number;
  elevationClusterScale?: number;
  elevationModes?: ElevationMode[];
  roadClusterArea?: number;
  guardedEncounterResourceFractions?: GuardedEncounterResourceFractions;
  ambientPickupDistribution?: AmbientPickupDistribution;
  [key: string]: unknown;
}

export interface ElevationMode {
  weight: number;
  minElevatedFraction: number;
  maxElevatedFraction: number;
  [key: string]: unknown;
}

export interface GuardedEncounterResourceFractions {
  countBounds?: number[];
  fractions?: number[];
  [key: string]: unknown;
}

export interface AmbientPickupDistribution {
  repulsion?: number;
  noise?: number;
  roadAttraction?: number;
  obstacleAttraction?: number;
  groupSizeWeights?: number[];
  [key: string]: unknown;
}

export interface MandatoryContentGroup {
  name: string;
  content?: ContentItem[];
  [key: string]: unknown;
}

export interface ContentItem {
  name?: string;
  sid?: string;
  variant?: number;
  isGuarded?: boolean;
  isMine?: boolean;
  soloEncounter?: boolean;
  includeLists?: string[];
  rules?: ContentPlacementRule[];

  // Example-backed fields preserved when loading existing templates.
  content?: ContentItem[];
  designatedEncounter?: boolean;
  guardValue?: number;
  owner?: number | string;
  road?: boolean;
  [key: string]: unknown;
}

export type StringListLike = string | Array<string | number | boolean>;

export interface ContentPlacementRule {
  type?: string;
  args?: StringListLike;
  targetMin?: number;
  targetMax?: number;
  target?: number;
  weight?: number;
  [key: string]: unknown;
}

export interface ContentCountLimit {
  name: string;
  playerMin?: number;
  playerMax?: number;
  limits?: ContentSidLimit[];
  [key: string]: unknown;
}

export interface ContentSidLimit {
  sid: string;
  variant?: number;
  maxCount?: number;
  includeLists?: string[];
  content?: ContentItem[];
  [key: string]: unknown;
}

export interface Point {
  x: number;
  y: number;
}

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

export interface SerializeRmgTemplateOptions {
  includeGeneratorPositions?: boolean;
}

export function parseRmgTemplate(json: string): RmgTemplate {
  const template = JSON.parse(json) as unknown;
  validateRmgTemplate(template);
  return template;
}

export function serializeRmgTemplate(template: RmgTemplate, options: SerializeRmgTemplateOptions = {}): string {
  return `${JSON.stringify(toSerializableValue(template, options), null, 2)}\n`;
}

function toSerializableValue(value: unknown, options: SerializeRmgTemplateOptions): unknown {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (Array.isArray(value)) {
    return value
      .map((item) => toSerializableValue(item, options))
      .filter((item) => item !== undefined);
  }
  if (typeof value !== "object") return value;

  const result: Record<string, unknown> = {};
  for (const [childKey, childValue] of Object.entries(value)) {
    if (childKey === "generatorPosition" && !options.includeGeneratorPositions) continue;

    const normalized =
      (childKey === "args" || childKey === "contentCountLimits") && isStringListLike(childValue)
        ? normalizeStringList(childValue)
        : toSerializableValue(childValue, options);

    if (normalized !== undefined) result[childKey] = normalized;
  }
  return result;
}

function isStringListLike(value: unknown): value is StringListLike {
  return typeof value === "string" || (Array.isArray(value) && value.every((item) => ["string", "number", "boolean"].includes(typeof item)));
}

function normalizeStringList(value: StringListLike): string[] {
  const items = typeof value === "string" ? [value] : value;
  return items.map((item) => String(item));
}

function validateRmgTemplate(value: unknown): asserts value is RmgTemplate {
  if (!isRecord(value)) {
    throw new Error("Invalid RMG template: expected top-level JSON object.");
  }

  if (!isNonEmptyString(value.name)) {
    throw new Error("Invalid RMG template: required field \"name\" must be a non-empty string.");
  }

  if (!isFinitePositiveNumber(value.sizeX)) {
    throw new Error("Invalid RMG template: required field \"sizeX\" must be a finite positive number.");
  }

  if (!isFinitePositiveNumber(value.sizeZ)) {
    throw new Error("Invalid RMG template: required field \"sizeZ\" must be a finite positive number.");
  }

  if (!hasOwn(value, "variants")) return;

  if (!Array.isArray(value.variants)) {
    throw new Error("Invalid RMG template: field \"variants\" must be an array when present.");
  }

  value.variants.forEach((variant, variantIndex) => {
    if (!isRecord(variant)) {
      throw new Error(`Invalid RMG template: variants[${variantIndex}] must be an object.`);
    }

    const hasZones = hasOwn(variant, "zones");
    const hasConnections = hasOwn(variant, "connections");
    let zoneNames: Set<string> | undefined;

    if (hasZones) {
      if (!Array.isArray(variant.zones)) {
        throw new Error(`Invalid RMG template: variants[${variantIndex}].zones must be an array when present.`);
      }

      const names = new Set<string>();
      zoneNames = names;
      variant.zones.forEach((zone, zoneIndex) => {
        if (!isRecord(zone)) {
          throw new Error(`Invalid RMG template: variants[${variantIndex}].zones[${zoneIndex}] must be an object.`);
        }

        if (!isNonEmptyString(zone.name)) {
          throw new Error(`Invalid RMG template: variants[${variantIndex}].zones[${zoneIndex}].name must be a non-empty string.`);
        }

        if (names.has(zone.name)) {
          throw new Error(`Invalid RMG template: variants[${variantIndex}].zones[${zoneIndex}].name duplicates zone "${zone.name}".`);
        }

        names.add(zone.name);
      });
    }

    if (hasConnections) {
      if (!Array.isArray(variant.connections)) {
        throw new Error(`Invalid RMG template: variants[${variantIndex}].connections must be an array when present.`);
      }

      variant.connections.forEach((connection, connectionIndex) => {
        if (!isRecord(connection)) {
          throw new Error(`Invalid RMG template: variants[${variantIndex}].connections[${connectionIndex}] must be an object.`);
        }

        if (!isNonEmptyString(connection.from)) {
          throw new Error(`Invalid RMG template: variants[${variantIndex}].connections[${connectionIndex}].from must be a non-empty string.`);
        }

        if (!isNonEmptyString(connection.to)) {
          throw new Error(`Invalid RMG template: variants[${variantIndex}].connections[${connectionIndex}].to must be a non-empty string.`);
        }

        if (zoneNames !== undefined && !zoneNames.has(connection.from)) {
          throw new Error(`Invalid RMG template: variants[${variantIndex}].connections[${connectionIndex}].from references unknown zone "${connection.from}".`);
        }

        if (zoneNames !== undefined && !zoneNames.has(connection.to)) {
          throw new Error(`Invalid RMG template: variants[${variantIndex}].connections[${connectionIndex}].to references unknown zone "${connection.to}".`);
        }
      });
    }
  });
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFinitePositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
