import type { GeneratorSettings, GlobalBans, RmgTemplate, ValueOverride, Variant } from "../types";
import { serializeRmgTemplate } from "../types";
import { normalizeSettings, validateSettings } from "../settings";
import { buildGameRules } from "./gameRulesBuilder";
import { assignNeutralZoneRoles, buildNeutralZonePlan, type NeutralZonePlan } from "./neutralZonePlanner";
import { buildVariant } from "./topologyVariantBuilder";
import { buildAllContentCountLimits, buildAllMandatoryContent, buildZoneLayouts } from "./templateContentBuilder";
import { computeContentScale, createRng, effectiveGuardRandomization, zoneSuffixes, type GenerationTuning } from "./math";
import { mixedTerrainSelector, terrainSelector } from "../terrain";

const ANARCHY_LANDMARK_VALUE_OVERRIDES: ValueOverride[] = [
  { sid: "boreal_call", variant: -1, guardValue: 6000 },
  { sid: "jousting_range", variant: -1, guardValue: 6000 },
  { sid: "petrified_memorial", variant: -1, guardValue: 6000 },
  { sid: "point_of_balance", variant: -1, guardValue: 7500 },
  { sid: "the_gorge", variant: -1, guardValue: 6000 },
  { sid: "unforgotten_grave", variant: -1, guardValue: 6000 },
  { sid: "ritual_pyre", variant: -1, guardValue: 6000 }
];

const BLITZ_VALUE_OVERRIDES: ValueOverride[] = [
  { sid: "watchtower", variant: 0, guardValue: 25000 }
];

const BLITZ_GLOBAL_BANS: GlobalBans = {
  items: ["voodoosh_doll_artifact", "flag_of_truce_artifact"]
};

export function generateTemplate(input: GeneratorSettings): RmgTemplate {
  const settings = normalizeSettings(input);
  const validation = validateSettings(settings);
  if (validation.errors.length > 0) throw new Error(validation.errors.join("\n"));
  const valueOverrides = buildValueOverrides(settings);
  const globalBans = buildGlobalBans(settings);

  const rng = createRng(settings.seed);
  const playerCount = settings.topology === "Triangle" ? 3 : settings.playerCount;
  const playerLetters = zoneSuffixes.slice(0, playerCount);
  const neutralZones = assignNeutralZoneRoles(settings, playerLetters, buildNeutralZonePlan(settings));
  const useCityHold = settings.gameEndConditions.cityHold || settings.gameEndConditions.victoryCondition === "win_condition_5";
  const hubOrTriangleHold = useCityHold && (settings.topology === "HubAndSpoke" || settings.topology === "Triangle");
  const holdCityNeutralLetter = useCityHold && !hubOrTriangleHold ? pickHoldCityNeutralLetter(neutralZones) : undefined;
  const totalZones = playerLetters.length + neutralZones.length + (settings.naturalExpansionZone ? playerLetters.length : 0) + (settings.topology === "Triangle" ? 1 : 0);
  const tuning: GenerationTuning = {
    contentScale: computeContentScale(settings.mapWidth, settings.mapHeight, totalZones),
    resourceDensityMultiplier: settings.zoneCfg.resourceDensityPercent / 200,
    structureDensityMultiplier: settings.zoneCfg.structureDensityPercent / 100,
    neutralStackStrengthMultiplier: settings.zoneCfg.neutralStackStrengthPercent / 100,
    borderGuardStrengthMultiplier: settings.zoneCfg.borderGuardStrengthPercent / 100,
    guardRandomization: effectiveGuardRandomization(settings)
  };

  const effectiveVictoryCondition = settings.gameEndConditions.victoryCondition;
  const variant = buildVariant(settings, playerLetters, neutralZones, tuning, rng, holdCityNeutralLetter, hubOrTriangleHold);
  applyTerrainTheme(variant, settings.terrainTheme);

  return {
    name: settings.templateName,
    gameMode: settings.gameMode,
    description: buildTemplateDescription(settings, neutralZones.length),
    displayWinCondition: effectiveVictoryCondition,
    sizeX: settings.mapWidth,
    sizeZ: settings.mapHeight,
    gameRules: buildGameRules(settings, effectiveVictoryCondition),
    ...(valueOverrides.length > 0 ? { valueOverrides } : {}),
    ...(globalBans ? { globalBans } : {}),
    variants: [variant],
    zoneLayouts: buildZoneLayouts(),
    mandatoryContent: buildAllMandatoryContent(playerLetters, neutralZones, settings, tuning),
    contentCountLimits: buildAllContentCountLimits(),
    contentPools: [],
    contentLists: []
  };
}

export function serializeTemplate(template: RmgTemplate): string {
  return serializeRmgTemplate(template);
}

function buildValueOverrides(settings: GeneratorSettings): ValueOverride[] {
  switch (settings.identityPreset ?? settings.preset) {
    case "AnarchyLike":
      return structuredClone(ANARCHY_LANDMARK_VALUE_OVERRIDES);
    case "BlitzLike":
      return structuredClone(BLITZ_VALUE_OVERRIDES);
    default:
      return [];
  }
}

function buildGlobalBans(settings: GeneratorSettings): GlobalBans | undefined {
  switch (settings.identityPreset ?? settings.preset) {
    case "BlitzLike":
      return structuredClone(BLITZ_GLOBAL_BANS);
    default:
      return undefined;
  }
}

function pickHoldCityNeutralLetter(neutralZones: NeutralZonePlan[]): string | undefined {
  return [...neutralZones].sort((a, b) =>
    (b.quality === "High" ? 3 : b.quality === "Medium" ? 2 : 1) - (a.quality === "High" ? 3 : a.quality === "Medium" ? 2 : 1)
    || b.castleCount - a.castleCount
    || a.letter.localeCompare(b.letter))[0]?.letter;
}

function applyTerrainTheme(variant: Variant, terrainTheme: GeneratorSettings["terrainTheme"]): void {
  if (terrainTheme === "FactionMatched") return;
  for (const zone of variant.zones ?? []) {
    const selector = terrainTheme === "Mixed" ? mixedTerrainSelector(zone) : terrainSelector(terrainTheme);
    zone.zoneBiome = structuredClone(selector);
    zone.contentBiome = structuredClone(selector);
    zone.metaObjectsBiome = structuredClone(selector);
  }
}

function buildTemplateDescription(settings: GeneratorSettings, neutralZoneCount: number): string {
  const parts = [
    `${topologyLabel(settings.topology)} layout`,
    countPhrase(neutralZoneCount, "neutral zone", "neutral zones"),
    `${countPhrase(settings.zoneCfg.playerZoneCastles, "castle", "castles")} per player zone`
  ];
  if (neutralZoneCount > 0) {
    parts.push(settings.topology === "Triangle" || settings.zoneCfg.advanced.enabled
      ? "mixed neutral zone tiers"
      : `${countPhrase(settings.zoneCfg.neutralZoneCastles, "castle", "castles")} per neutral zone`);
  }
  const options: string[] = [];
  const identitySummary = presetIdentitySummary(settings.preset);
  if (identitySummary) options.push(identitySummary);
  if (settings.noDirectPlayerConnections) options.push("isolated player starts");
  if (settings.experimentalBalancedZonePlacement) options.push("balanced zone placement");
  if (settings.randomPortals) options.push("random portals");
  if (!settings.spawnRemoteFootholds) options.push("no remote footholds");
  if (!settings.generateRoads) options.push("roads disabled");
  if (settings.naturalExpansionZone) options.push("natural expansion zones");
  if (settings.contentPreset !== "Default") options.push(`content preset: ${settings.contentPreset}`);
  if (settings.heroHireBan) options.push("hero hiring banned");
  if (settings.gameEndConditions.lostStartHero) options.push("start-hero elimination");
  if (settings.encounterHoles) options.push("encounter holes enabled");
  const presetWarning = presetIdentityWarning(settings.preset);
  if (presetWarning) options.push(presetWarning);
  if (options.length > 0) parts.push(`options: ${options.join(", ")}`);
  return `Built with www.OldenEraMaps.com: ${parts.join(", ")}.`;
}

function countPhrase(count: number, singular: string, plural: string): string {
  return count === 0 ? `no ${plural}` : `${count} ${count === 1 ? singular : plural}`;
}

function topologyLabel(topology: GeneratorSettings["topology"]): string {
  return topology === "Default" ? "Ring" : topology === "HubAndSpoke" ? "Hub" : topology === "SharedWeb" ? "Shared Web" : topology;
}

function presetIdentitySummary(preset: GeneratorSettings["preset"]): string | undefined {
  switch (preset) {
    case "SingleHero":
      return "identity: single-hero duel";
    case "BlitzLike":
      return "identity: compressed-tempo contest";
    case "JebusLikeObjective":
      return "identity: jackpot-center city-hold objective";
    case "AnarchyLike":
      return "identity: chaotic encounter-hole format";
    default:
      return undefined;
  }
}

function presetIdentityWarning(preset: GeneratorSettings["preset"]): string | undefined {
  switch (preset) {
    case "AnarchyLike":
      return "specialized format, validate in game";
    default:
      return undefined;
  }
}
