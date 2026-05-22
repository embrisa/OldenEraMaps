import type { ContentCountLimit, ContentItem, ContentPlacementRule, MainObject, MandatoryContentGroup, NeutralZoneQuality, Zone, ZoneLayout } from "../types.ts";
import type { GenerationTuning } from "./math.ts";
import { centerLayoutName, normalizeZoneSize, scaleGuardMultiplier, scaleNeutralGuardValue, scaleResourceValue, scaleStructureValue, scaleValue, sideLayoutName, spawnLayoutName, treasureLayoutName } from "./math.ts";
import type { NeutralZonePlan } from "./neutralZonePlanner.ts";
import { buildConnectorZoneRoads, buildOuterZoneRoads } from "./connectionBuilder.ts";

const t2Guarded = ["classic_template_pool_random_t2_item", "classic_template_pool_random_t2_pandora", "classic_template_pool_random_t2_hire", "classic_template_pool_random_t2_unit_bank", "classic_template_pool_random_t2_res_bank", "classic_template_pool_random_t2_stat", "classic_template_pool_random_t2_magic"];
const t2Unguarded = ["classic_template_pool_random_unguarded_t2_item", "classic_template_pool_random_unguarded_t2_pandora", "classic_template_pool_random_unguarded_t2_hire", "classic_template_pool_random_unguarded_t2_unit_bank", "classic_template_pool_random_unguarded_t2_res_bank", "classic_template_pool_random_unguarded_t2_stat", "classic_template_pool_random_unguarded_t2_magic"];
const t3Guarded = t2Guarded.map((name) => name.replace("_t2_", "_t3_"));
const t3Unguarded = t2Unguarded.map((name) => name.replace("_t2_", "_t3_"));
const t4Guarded = t2Guarded.map((name) => name.replace("_t2_", "_t4_"));
const t4Unguarded = t2Unguarded.map((name) => name.replace("_t2_", "_t4_"));
const t5Guarded = t2Guarded.map((name) => name.replace("_t2_", "_t5_"));
const t5Unguarded = t2Unguarded.map((name) => name.replace("_t2_", "_t5_"));

interface ZoneRoleProfile {
  layout: string;
  guardCutoffValue: number;
  guardMultiplier: number;
  guardWeeklyIncrement: number;
  guardReactionDistribution: number[];
  guardedContentPool: string[];
  unguardedContentPool: string[];
  resourcesContentPool: string[];
  guardedContentValue: number;
  guardedContentValuePerArea: number;
  unguardedContentValue: number;
  unguardedContentValuePerArea: number;
  resourcesValue: number;
  resourcesValuePerArea: number;
  primaryCityGuardValue: number;
  extraCityGuardValue: number;
  holdCityGuardValue: number;
  marqueeCityGuardValue?: number;
  marqueeObjectiveGuardValue?: number;
  primaryBuildingsConstructionSid: string;
  extraBuildingsConstructionSid: string;
  spawnGuardValue?: number;
}

const zoneRoleProfiles = {
  spawn: {
    layout: spawnLayoutName,
    guardCutoffValue: 1500,
    guardMultiplier: 1.25,
    guardWeeklyIncrement: 0.15,
    guardReactionDistribution: [60, 20, 10, 10, 2, 0],
    guardedContentPool: [...t2Guarded],
    unguardedContentPool: [...t2Unguarded],
    resourcesContentPool: ["content_pool_general_resources_start_zone_poor"],
    guardedContentValue: 300000,
    guardedContentValuePerArea: 2400,
    unguardedContentValue: 45000,
    unguardedContentValuePerArea: 360,
    resourcesValue: 30000,
    resourcesValuePerArea: 240,
    primaryCityGuardValue: 2500,
    extraCityGuardValue: 2500,
    holdCityGuardValue: 25000,
    primaryBuildingsConstructionSid: "poor_buildings_construction",
    extraBuildingsConstructionSid: "poor_buildings_construction",
    spawnGuardValue: 5000
  },
  center: {
    layout: centerLayoutName,
    guardCutoffValue: 2000,
    guardMultiplier: 1.6,
    guardWeeklyIncrement: 0.2,
    guardReactionDistribution: [0, 10, 10, 20, 10, 0],
    guardedContentPool: [...t4Guarded, ...t5Guarded],
    unguardedContentPool: [...t4Unguarded],
    resourcesContentPool: ["content_pool_general_resources_start_zone_poor"],
    guardedContentValue: 650000,
    guardedContentValuePerArea: 3600,
    unguardedContentValue: 0,
    unguardedContentValuePerArea: 0,
    resourcesValue: 0,
    resourcesValuePerArea: 0,
    primaryCityGuardValue: 16000,
    extraCityGuardValue: 16000,
    holdCityGuardValue: 60000,
    primaryBuildingsConstructionSid: "rich_buildings_construction",
    extraBuildingsConstructionSid: "rich_buildings_construction"
  },
  sideNeutral: {
    layout: sideLayoutName,
    guardCutoffValue: 1500,
    guardMultiplier: 1.6,
    guardWeeklyIncrement: 0.15,
    guardReactionDistribution: [0, 10, 10, 10, 10, 0],
    guardedContentPool: [...t2Guarded],
    unguardedContentPool: [...t2Unguarded],
    resourcesContentPool: ["content_pool_general_resources_start_zone_poor"],
    guardedContentValue: 300000,
    guardedContentValuePerArea: 1600,
    unguardedContentValue: 20000,
    unguardedContentValuePerArea: 160,
    resourcesValue: 12000,
    resourcesValuePerArea: 100,
    primaryCityGuardValue: 4000,
    extraCityGuardValue: 2000,
    holdCityGuardValue: 25000,
    primaryBuildingsConstructionSid: "poor_buildings_construction",
    extraBuildingsConstructionSid: "poor_buildings_construction"
  },
  treasureNeutral: {
    layout: treasureLayoutName,
    guardCutoffValue: 1500,
    guardMultiplier: 1.5,
    guardWeeklyIncrement: 0.15,
    guardReactionDistribution: [0, 10, 10, 10, 10, 0],
    guardedContentPool: [...t3Guarded, ...t4Guarded],
    unguardedContentPool: [...t3Unguarded, ...t4Unguarded],
    resourcesContentPool: ["content_pool_general_resources_start_zone_poor"],
    guardedContentValue: 450000,
    guardedContentValuePerArea: 2400,
    unguardedContentValue: 20000,
    unguardedContentValuePerArea: 180,
    resourcesValue: 5000,
    resourcesValuePerArea: 0,
    primaryCityGuardValue: 8000,
    extraCityGuardValue: 4000,
    holdCityGuardValue: 25000,
    primaryBuildingsConstructionSid: "rich_buildings_construction",
    extraBuildingsConstructionSid: "poor_buildings_construction"
  },
  highTreasureNeutral: {
    layout: treasureLayoutName,
    guardCutoffValue: 1500,
    guardMultiplier: 1.6,
    guardWeeklyIncrement: 0.15,
    guardReactionDistribution: [0, 10, 10, 20, 10, 0],
    guardedContentPool: [...t4Guarded, ...t5Guarded],
    unguardedContentPool: [...t4Unguarded, ...t5Unguarded],
    resourcesContentPool: ["content_pool_general_resources_start_zone_poor"],
    guardedContentValue: 600000,
    guardedContentValuePerArea: 3200,
    unguardedContentValue: 15000,
    unguardedContentValuePerArea: 120,
    resourcesValue: 0,
    resourcesValuePerArea: 0,
    primaryCityGuardValue: 16000,
    extraCityGuardValue: 8000,
    holdCityGuardValue: 60000,
    marqueeCityGuardValue: 25000,
    marqueeObjectiveGuardValue: 60000,
    primaryBuildingsConstructionSid: "rich_buildings_construction",
    extraBuildingsConstructionSid: "rich_buildings_construction"
  },
  naturalExpansion: {
    layout: sideLayoutName,
    guardCutoffValue: 1500,
    guardMultiplier: 1.4,
    guardWeeklyIncrement: 0.15,
    guardReactionDistribution: [0, 10, 10, 10, 10, 0],
    guardedContentPool: [...t2Guarded],
    unguardedContentPool: [...t2Unguarded],
    resourcesContentPool: ["content_pool_general_resources_start_zone_poor"],
    guardedContentValue: 250000,
    guardedContentValuePerArea: 1400,
    unguardedContentValue: 25000,
    unguardedContentValuePerArea: 200,
    resourcesValue: 18000,
    resourcesValuePerArea: 140,
    primaryCityGuardValue: 6000,
    extraCityGuardValue: 3000,
    holdCityGuardValue: 25000,
    primaryBuildingsConstructionSid: "poor_buildings_construction",
    extraBuildingsConstructionSid: "poor_buildings_construction"
  }
} as const satisfies Record<string, ZoneRoleProfile>;

function scaleZoneRoleProfile(profile: ZoneRoleProfile, tuning: GenerationTuning) {
  return {
    layout: profile.layout,
    guardCutoffValue: profile.guardCutoffValue,
    guardMultiplier: scaleGuardMultiplier(profile.guardMultiplier, tuning),
    guardWeeklyIncrement: profile.guardWeeklyIncrement,
    guardReactionDistribution: [...profile.guardReactionDistribution],
    guardedContentPool: [...profile.guardedContentPool],
    unguardedContentPool: [...profile.unguardedContentPool],
    resourcesContentPool: [...profile.resourcesContentPool],
    guardedContentValue: scaleStructureValue(profile.guardedContentValue * tuning.contentScale, tuning),
    guardedContentValuePerArea: scaleStructureValue(profile.guardedContentValuePerArea * Math.sqrt(tuning.contentScale), tuning),
    unguardedContentValue: scaleStructureValue(profile.unguardedContentValue * tuning.contentScale, tuning),
    unguardedContentValuePerArea: scaleStructureValue(profile.unguardedContentValuePerArea * Math.sqrt(tuning.contentScale), tuning),
    resourcesValue: scaleResourceValue(profile.resourcesValue * tuning.contentScale, tuning),
    resourcesValuePerArea: scaleResourceValue(profile.resourcesValuePerArea * Math.sqrt(tuning.contentScale), tuning)
  };
}

export function buildSpawnZone(letter: string, player: string, ringConns: string[], castleCount: number, matchCastleFactions: boolean, zoneSize: number, spawnFootholds: boolean, generateRoads: boolean, tuning: GenerationTuning): Zone {
  const profile = zoneRoleProfiles.spawn;
  const scaledProfile = scaleZoneRoleProfile(profile, tuning);
  const mainObjects: MainObject[] = [{
    type: "Spawn",
    spawn: player,
    removeGuardIfHasOwner: true,
    guardChance: 1,
    guardValue: scaleNeutralGuardValue(profile.spawnGuardValue ?? 5000, tuning),
    guardWeeklyIncrement: 0.1,
    buildingsConstructionSid: "default_buildings_construction",
    placement: "Uniform",
    placementArgs: ["true", "0.7", "0"]
  }];
  for (let i = 1; i < castleCount; i++) {
    mainObjects.push({
      type: "City",
      faction: matchCastleFactions ? { type: "Match", args: ["0"] } : { type: "Random", args: [] },
      guardChance: 1,
      guardValue: scaleNeutralGuardValue(profile.extraCityGuardValue, tuning),
      guardWeeklyIncrement: 0.1,
      buildingsConstructionSid: profile.extraBuildingsConstructionSid,
      placement: "Uniform",
      placementArgs: ["false", "-0.8", "3"]
    });
  }
  return {
    name: `Spawn-${letter}`,
    size: normalizeZoneSize(zoneSize),
    layout: scaledProfile.layout,
    guardCutoffValue: scaledProfile.guardCutoffValue,
    guardRandomization: tuning.guardRandomization,
    guardMultiplier: scaledProfile.guardMultiplier,
    guardWeeklyIncrement: scaledProfile.guardWeeklyIncrement,
    guardReactionDistribution: scaledProfile.guardReactionDistribution,
    diplomacyModifier: -0.5,
    guardedContentPool: scaledProfile.guardedContentPool,
    unguardedContentPool: scaledProfile.unguardedContentPool,
    resourcesContentPool: scaledProfile.resourcesContentPool,
    mandatoryContent: [`mandatory_content_side_${letter}`],
    contentCountLimits: buildSideContentLimits(),
    guardedContentValue: scaledProfile.guardedContentValue,
    guardedContentValuePerArea: scaledProfile.guardedContentValuePerArea,
    unguardedContentValue: scaledProfile.unguardedContentValue,
    unguardedContentValuePerArea: scaledProfile.unguardedContentValuePerArea,
    resourcesValue: scaledProfile.resourcesValue,
    resourcesValuePerArea: scaledProfile.resourcesValuePerArea,
    mainObjects,
    zoneBiome: { type: "MatchMainObject", args: ["0"] },
    contentBiome: { type: "MatchMainObject", args: ["0"] },
    metaObjectsBiome: { type: "MatchMainObject", args: ["0"] },
    crossroadsPosition: 0,
    roads: castleCount > 0 ? buildOuterZoneRoads(ringConns, castleCount, spawnFootholds, generateRoads) : buildConnectorZoneRoads(ringConns, generateRoads)
  };
}

export function buildHubZone(spokeConns: string[], tuning: GenerationTuning, isHoldCity = false, size = 1, castleCount = 0, generateRoads = true): Zone {
  const profile = zoneRoleProfiles.center;
  const scaledProfile = scaleZoneRoleProfile(profile, tuning);
  const effectiveCastleCount = isHoldCity ? Math.max(1, castleCount) : castleCount;
  const holdCityGuardValue = objectiveGuardValueForRole(profile.holdCityGuardValue, tuning);
  const mainObjects = Array.from({ length: effectiveCastleCount }, (_, i) => ({
    type: "City",
    guardChance: isHoldCity && i === 0 ? 1 : 0.5,
    guardValue: isHoldCity && i === 0 ? holdCityGuardValue : scaleNeutralGuardValue(profile.extraCityGuardValue, tuning),
    guardWeeklyIncrement: 0.1,
    buildingsConstructionSid: isHoldCity && i === 0 ? "ultra_rich_buildings_construction" : profile.primaryBuildingsConstructionSid,
    faction: { type: "FromList", args: [] },
    placement: isHoldCity && i === 0 ? "Center" : "Uniform",
    placementArgs: isHoldCity && i === 0 ? [] : ["true", "0.8", "2"],
    holdCityWinCon: isHoldCity && i === 0 ? true : undefined
  }));
  return {
    name: "Hub",
    size,
    layout: scaledProfile.layout,
    guardCutoffValue: scaledProfile.guardCutoffValue,
    guardRandomization: 0.05,
    guardMultiplier: scaledProfile.guardMultiplier,
    guardWeeklyIncrement: scaledProfile.guardWeeklyIncrement,
    guardReactionDistribution: scaledProfile.guardReactionDistribution,
    diplomacyModifier: -0.5,
    guardedContentPool: scaledProfile.guardedContentPool,
    unguardedContentPool: scaledProfile.unguardedContentPool,
    resourcesContentPool: scaledProfile.resourcesContentPool,
    mandatoryContent: [],
    contentCountLimits: buildSideContentLimits(),
    guardedContentValue: scaledProfile.guardedContentValue,
    guardedContentValuePerArea: scaledProfile.guardedContentValuePerArea,
    unguardedContentValue: scaledProfile.unguardedContentValue,
    unguardedContentValuePerArea: scaledProfile.unguardedContentValuePerArea,
    resourcesValue: scaledProfile.resourcesValue,
    resourcesValuePerArea: scaledProfile.resourcesValuePerArea,
    mainObjects,
    zoneBiome: effectiveCastleCount > 0 ? { type: "MatchMainObject", args: ["0"] } : { type: "MatchZone", args: [] },
    contentBiome: effectiveCastleCount > 0 ? { type: "MatchMainObject", args: ["0"] } : { type: "MatchZone", args: [] },
    metaObjectsBiome: effectiveCastleCount > 0 ? { type: "MatchMainObject", args: ["0"] } : { type: "MatchZone", args: [] },
    crossroadsPosition: 0,
    roads: effectiveCastleCount > 0 ? buildOuterZoneRoads(spokeConns, effectiveCastleCount, false, generateRoads) : buildConnectorZoneRoads(spokeConns, generateRoads)
  };
}

export function buildNeutralZone(plan: NeutralZonePlan, ringConns: string[], zoneSize: number, spawnFootholds: boolean, generateRoads: boolean, tuning: GenerationTuning, isHoldCity = false): Zone {
  if (plan.role === "Connector") return buildConnectorZone(plan, ringConns, zoneSize, spawnFootholds, generateRoads, tuning, isHoldCity);

  const profile = profileFor(plan.quality);
  const castleCount = isHoldCity ? Math.max(1, plan.castleCount) : plan.castleCount;
  const primaryCityBaseGuardValue = isHoldCity
    ? profile.holdCityGuardValue
    : profile.marqueeCityGuardValue ?? profile.primaryCityGuardValue;
  const primaryCityGuardValue = objectiveGuardValueForRole(primaryCityBaseGuardValue, tuning);
  const mainObjects: MainObject[] = castleCount > 0 ? [{
    type: "City",
    guardChance: 1,
    guardValue: primaryCityGuardValue,
    guardWeeklyIncrement: 0.1,
    buildingsConstructionSid: isHoldCity ? "ultra_rich_buildings_construction" : profile.primaryBuildingsConstructionSid,
    faction: { type: "FromList", args: [] },
    placement: isHoldCity ? "Center" : "Uniform",
    placementArgs: isHoldCity ? [] : ["true", "0.8", "2"],
    holdCityWinCon: isHoldCity ? true : undefined
  }] : [];
  for (let i = 1; i < castleCount; i++) mainObjects.push({
    type: "City",
    guardChance: 1,
    guardValue: scaleNeutralGuardValue(profile.extraCityGuardValue, tuning),
    guardWeeklyIncrement: 0.1,
    buildingsConstructionSid: profile.extraBuildingsConstructionSid,
    faction: { type: "FromList", args: [] },
    placement: "Uniform",
    placementArgs: ["false", "-0.8", "3"]
  });
  return {
    name: `Neutral-${plan.letter}`,
    size: normalizeZoneSize(zoneSize),
    layout: profile.layout,
    guardCutoffValue: profile.guardCutoffValue,
    guardRandomization: tuning.guardRandomization,
    guardMultiplier: scaleGuardMultiplier(profile.guardMultiplier, tuning),
    guardWeeklyIncrement: profile.guardWeeklyIncrement,
    guardReactionDistribution: [...profile.guardReactionDistribution],
    diplomacyModifier: -0.5,
    guardedContentPool: [...profile.guardedContentPool],
    unguardedContentPool: [...profile.unguardedContentPool],
    resourcesContentPool: [...profile.resourcesContentPool],
    mandatoryContent: [`mandatory_content_neutral_${plan.letter}`],
    contentCountLimits: buildSideContentLimits(),
    guardedContentValue: scaleStructureValue(profile.guardedContentValue * tuning.contentScale, tuning),
    guardedContentValuePerArea: scaleStructureValue(profile.guardedContentValuePerArea * Math.sqrt(tuning.contentScale), tuning),
    unguardedContentValue: scaleStructureValue(profile.unguardedContentValue * tuning.contentScale, tuning),
    unguardedContentValuePerArea: scaleStructureValue(profile.unguardedContentValuePerArea * Math.sqrt(tuning.contentScale), tuning),
    resourcesValue: scaleResourceValue(profile.resourcesValue * tuning.contentScale, tuning),
    resourcesValuePerArea: scaleResourceValue(profile.resourcesValuePerArea * Math.sqrt(tuning.contentScale), tuning),
    mainObjects,
    zoneBiome: castleCount > 0 ? { type: "MatchMainObject", args: ["0"] } : { type: "MatchZone", args: [] },
    contentBiome: castleCount > 0 ? { type: "MatchMainObject", args: ["0"] } : { type: "MatchZone", args: [] },
    metaObjectsBiome: castleCount > 0 ? { type: "MatchMainObject", args: ["0"] } : { type: "MatchZone", args: [] },
    crossroadsPosition: 0,
    roads: castleCount > 0 ? buildOuterZoneRoads(ringConns, castleCount, spawnFootholds, generateRoads) : buildConnectorZoneRoads(ringConns, generateRoads)
  };
}

export function buildConnectorZone(plan: NeutralZonePlan, ringConns: string[], zoneSize: number, spawnFootholds: boolean, generateRoads: boolean, tuning: GenerationTuning, isHoldCity = false): Zone {
  const profile = connectorProfile();
  const castleCount = isHoldCity ? Math.max(1, plan.castleCount) : plan.castleCount;
  const primaryCityBaseGuardValue = isHoldCity
    ? profile.holdCityGuardValue
    : profile.marqueeCityGuardValue ?? profile.primaryCityGuardValue;
  const primaryCityGuardValue = objectiveGuardValueForRole(primaryCityBaseGuardValue, tuning);
  const mainObjects: MainObject[] = castleCount > 0 ? [{
    type: "City",
    guardChance: 1,
    guardValue: primaryCityGuardValue,
    guardWeeklyIncrement: 0.1,
    buildingsConstructionSid: isHoldCity ? "ultra_rich_buildings_construction" : profile.primaryBuildingsConstructionSid,
    faction: { type: "FromList", args: [] },
    placement: isHoldCity ? "Center" : "Uniform",
    placementArgs: isHoldCity ? [] : ["true", "0.8", "2"],
    holdCityWinCon: isHoldCity ? true : undefined
  }] : [];
  for (let i = 1; i < castleCount; i++) mainObjects.push({
    type: "City",
    guardChance: 1,
    guardValue: scaleNeutralGuardValue(profile.extraCityGuardValue, tuning),
    guardWeeklyIncrement: 0.1,
    buildingsConstructionSid: profile.extraBuildingsConstructionSid,
    faction: { type: "FromList", args: [] },
    placement: "Uniform",
    placementArgs: ["false", "-0.8", "3"]
  });
  return {
    name: `Neutral-${plan.letter}`,
    size: normalizeZoneSize(zoneSize),
    layout: profile.layout,
    guardCutoffValue: profile.guardCutoffValue,
    guardRandomization: tuning.guardRandomization,
    guardMultiplier: scaleGuardMultiplier(profile.guardMultiplier, tuning),
    guardWeeklyIncrement: profile.guardWeeklyIncrement,
    guardReactionDistribution: [...profile.guardReactionDistribution],
    diplomacyModifier: -0.5,
    guardedContentPool: [...profile.guardedContentPool],
    unguardedContentPool: [...profile.unguardedContentPool],
    resourcesContentPool: [...profile.resourcesContentPool],
    mandatoryContent: [`mandatory_content_neutral_${plan.letter}`],
    contentCountLimits: buildSideContentLimits(),
    guardedContentValue: scaleStructureValue(profile.guardedContentValue * tuning.contentScale, tuning),
    guardedContentValuePerArea: scaleStructureValue(profile.guardedContentValuePerArea * Math.sqrt(tuning.contentScale), tuning),
    unguardedContentValue: scaleStructureValue(profile.unguardedContentValue * tuning.contentScale, tuning),
    unguardedContentValuePerArea: scaleStructureValue(profile.unguardedContentValuePerArea * Math.sqrt(tuning.contentScale), tuning),
    resourcesValue: scaleResourceValue(profile.resourcesValue * tuning.contentScale, tuning),
    resourcesValuePerArea: scaleResourceValue(profile.resourcesValuePerArea * Math.sqrt(tuning.contentScale), tuning),
    mainObjects,
    zoneBiome: castleCount > 0 ? { type: "MatchMainObject", args: ["0"] } : { type: "MatchZone", args: [] },
    contentBiome: castleCount > 0 ? { type: "MatchMainObject", args: ["0"] } : { type: "MatchZone", args: [] },
    metaObjectsBiome: castleCount > 0 ? { type: "MatchMainObject", args: ["0"] } : { type: "MatchZone", args: [] },
    crossroadsPosition: 0,
    roads: castleCount > 0 ? buildOuterZoneRoads(ringConns, castleCount, spawnFootholds, generateRoads) : buildConnectorZoneRoads(ringConns, generateRoads)
  };
}

export function buildNaturalExpansionZone(playerLetter: string, ringConns: string[], zoneSize: number, spawnFootholds: boolean, generateRoads: boolean, tuning: GenerationTuning): Zone {
  const profile = zoneRoleProfiles.naturalExpansion;
  const zone = buildNeutralZone({ letter: playerLetter, quality: "Low", role: "Standard", castleCount: 1 }, ringConns, zoneSize, spawnFootholds, generateRoads, tuning);
  zone.name = `Natural-${playerLetter}`;
  zone.layout = profile.layout;
  zone.guardCutoffValue = profile.guardCutoffValue;
  zone.guardMultiplier = scaleGuardMultiplier(profile.guardMultiplier, tuning);
  zone.guardWeeklyIncrement = profile.guardWeeklyIncrement;
  zone.guardReactionDistribution = [...profile.guardReactionDistribution];
  zone.guardedContentPool = [...profile.guardedContentPool];
  zone.unguardedContentPool = [...profile.unguardedContentPool];
  zone.resourcesContentPool = [...profile.resourcesContentPool];
  zone.mandatoryContent = [`mandatory_content_natural_${playerLetter}`];
  zone.guardedContentValue = scaleStructureValue(profile.guardedContentValue * tuning.contentScale, tuning);
  zone.guardedContentValuePerArea = scaleStructureValue(profile.guardedContentValuePerArea * Math.sqrt(tuning.contentScale), tuning);
  zone.unguardedContentValue = scaleStructureValue(profile.unguardedContentValue * tuning.contentScale, tuning);
  zone.unguardedContentValuePerArea = scaleStructureValue(profile.unguardedContentValuePerArea * Math.sqrt(tuning.contentScale), tuning);
  zone.resourcesValue = scaleResourceValue(profile.resourcesValue * tuning.contentScale, tuning);
  zone.resourcesValuePerArea = scaleResourceValue(profile.resourcesValuePerArea * Math.sqrt(tuning.contentScale), tuning);
  zone.mainObjects![0].guardValue = scaleNeutralGuardValue(profile.primaryCityGuardValue, tuning);
  zone.mainObjects![0].buildingsConstructionSid = profile.primaryBuildingsConstructionSid;
  zone.mainObjects![0].faction = { type: "Match", args: ["0", `Spawn-${playerLetter}`] };
  return zone;
}

function profileFor(quality: NeutralZoneQuality): ZoneRoleProfile {
  if (quality === "Low") return zoneRoleProfiles.sideNeutral;
  if (quality === "High") return zoneRoleProfiles.highTreasureNeutral;
  return zoneRoleProfiles.treasureNeutral;
}

function connectorProfile(): ZoneRoleProfile {
  return {
    layout: sideLayoutName,
    guardCutoffValue: 1500,
    guardMultiplier: 1.4,
    guardWeeklyIncrement: 0.2,
    guardReactionDistribution: [0, 10, 15, 10, 10, 0],
    guardedContentPool: [...t2Guarded, ...t3Guarded],
    unguardedContentPool: [...t2Unguarded, ...t3Unguarded],
    resourcesContentPool: ["content_pool_general_resources_start_zone_poor"],
    guardedContentValue: 180000,
    guardedContentValuePerArea: 1600,
    unguardedContentValue: 42000,
    unguardedContentValuePerArea: 340,
    resourcesValue: 18000,
    resourcesValuePerArea: 180,
    primaryCityGuardValue: 7000,
    extraCityGuardValue: 3500,
    holdCityGuardValue: 25000,
    primaryBuildingsConstructionSid: "rich_buildings_construction",
    extraBuildingsConstructionSid: "poor_buildings_construction"
  };
}

function buildSideContentLimits(): string[] {
  const limits: string[] = [];
  for (let a = 1; a <= 5; a++) for (let b = a + 1; b <= 6; b++) limits.push(`content_limits_side_${a}_${b}`);
  return limits;
}

export function buildZoneLayouts(): ZoneLayout[] {
  return [
    buildZoneLayout(spawnLayoutName, 0.24, 0.48, 0.3, 16, 0.16, 160, -0.3, 0.4, [20, 2, 1]),
    buildZoneLayout(sideLayoutName, 0.36, 0.5, 0.25, 16, 0.128, 128, -0.3, 0.3, [20, 2, 1]),
    buildZoneLayout(treasureLayoutName, 0.5, 0.5, 0.45, 12, 0.12, 96, -0.3, 0.3, [12, 3, 1]),
    buildZoneLayout(centerLayoutName, 0.56, 0.6, 0.3, 10, 0.128, 96, -0.25, 0.3, [12, 4, 1])
  ];
}

function buildZoneLayout(name: string, obstaclesFill: number, obstaclesFillVoid: number, lakesFill: number, minLakeArea: number, elevationClusterScale: number, roadClusterArea: number, roadAttraction: number, ambientNoise: number, groupSizeWeights: number[]): ZoneLayout {
  return { name, obstaclesFill, obstaclesFillVoid, lakesFill, minLakeArea, elevationClusterScale, elevationModes: [{ weight: 2, minElevatedFraction: 0.2, maxElevatedFraction: 0.4 }, { weight: 1, minElevatedFraction: 0.6, maxElevatedFraction: 0.8 }], roadClusterArea, guardedEncounterResourceFractions: { countBounds: [], fractions: [0.66] }, ambientPickupDistribution: { repulsion: 1, noise: ambientNoise, roadAttraction, obstacleAttraction: 0, groupSizeWeights } };
}

export function buildAllMandatoryContent(playerLetters: string[], neutralZones: NeutralZonePlan[], settings: { zoneCfg: { playerZoneCastles: number }, spawnRemoteFootholds: boolean, naturalExpansionZone: boolean }, tuning?: Pick<GenerationTuning, "neutralStackStrengthMultiplier">): MandatoryContentGroup[] {
  const groups = playerLetters.map((letter) => ({ name: `mandatory_content_side_${letter}`, content: buildPlayerZoneMandatoryContent(settings.zoneCfg.playerZoneCastles, settings.spawnRemoteFootholds) }));
  if (settings.naturalExpansionZone) groups.push(...playerLetters.map((letter) => ({ name: `mandatory_content_natural_${letter}`, content: buildLowNeutralMandatoryContent(1, settings.spawnRemoteFootholds) })));
  groups.push(...neutralZones.map((zone) => ({ name: `mandatory_content_neutral_${zone.letter}`, content: zone.role === "Connector" ? buildConnectorNeutralMandatoryContent(zone.castleCount, settings.spawnRemoteFootholds) : zone.quality === "High" ? buildHighNeutralMandatoryContent(zone.castleCount, settings.spawnRemoteFootholds, tuning) : zone.quality === "Low" ? buildLowNeutralMandatoryContent(zone.castleCount, settings.spawnRemoteFootholds) : buildMediumNeutralMandatoryContent(zone.castleCount, settings.spawnRemoteFootholds) })));
  return groups;
}

function buildPlayerZoneMandatoryContent(castleCount: number, spawnFootholds: boolean): ContentItem[] {
  return [...foothold(castleCount, spawnFootholds), { name: "name_mine_wood", sid: "mine_wood", isMine: true, isGuarded: true }, { name: "name_mine_ore", sid: "mine_ore", isMine: true, isGuarded: true }, { sid: "mine_gold", isMine: true }, { sid: "watchtower" }, { sid: "market", isGuarded: true }, { sid: "mana_well" }, { includeLists: ["content_list_building_random_hires_low_tier"] }, { sid: "random_item_epic", soloEncounter: true }, { sid: "pandora_box", soloEncounter: true }];
}

function buildLowNeutralMandatoryContent(castleCount: number, spawnFootholds: boolean): ContentItem[] {
  return [...foothold(castleCount, spawnFootholds), { includeLists: ["basic_content_list_rare_mines_by_biome"], isMine: true }, { includeLists: ["basic_content_list_rare_mines"], isMine: true }, { sid: "market", isGuarded: true }, { includeLists: ["basic_content_list_vision_buildings_tier_1"] }, { includeLists: ["content_list_building_random_hires_low_tier"] }, { sid: "pandora_box", soloEncounter: true }];
}

function buildMediumNeutralMandatoryContent(castleCount: number, spawnFootholds: boolean): ContentItem[] {
  return [...foothold(castleCount, spawnFootholds), { sid: "mine_crystals", isMine: true }, { sid: "mine_mercury", isMine: true }, { sid: "mine_gemstones", isMine: true }, { sid: "mine_gold", isMine: true }, { sid: "watchtower", isGuarded: true }, { includeLists: ["content_list_building_random_hires_high_tier"] }, { sid: "random_item_epic", soloEncounter: true }, { sid: "pandora_box", soloEncounter: true }];
}

function buildConnectorNeutralMandatoryContent(castleCount: number, spawnFootholds: boolean): ContentItem[] {
  return [...foothold(castleCount, spawnFootholds), { includeLists: ["basic_content_list_rare_mines_by_biome"], isMine: true }, { sid: "watchtower", isGuarded: true }, { sid: "market", isGuarded: true }, { includeLists: ["content_list_building_random_hires_high_tier"] }, { sid: "random_item_epic", soloEncounter: true }, { sid: "pandora_box", soloEncounter: true }];
}

function buildHighNeutralMandatoryContent(castleCount: number, spawnFootholds: boolean, tuning?: Pick<GenerationTuning, "neutralStackStrengthMultiplier">): ContentItem[] {
  const profile = profileFor("High");
  const objectiveGuardValue = objectiveGuardValueForRole(profile.marqueeObjectiveGuardValue ?? 60000, tuning ?? { neutralStackStrengthMultiplier: 1 });
  return [
    ...foothold(castleCount, spawnFootholds),
    {
      includeLists: ["content_list_building_utopia"],
      guardValue: objectiveGuardValue,
      designatedEncounter: true
    },
    {
      includeLists: ["content_list_building_epic_guarded_resource_banks"],
      guardValue: objectiveGuardValue,
      designatedEncounter: true
    },
    { includeLists: ["basic_content_list_building_hero_stats_and_skills_tier_3"] },
    { includeLists: ["content_list_building_random_hires_high_tier"] },
    { sid: "random_item_legendary", soloEncounter: true },
    { sid: "pandora_box", soloEncounter: true },
    { sid: "mine_gold", isMine: true }
  ];
}

function objectiveGuardValueForRole(value: number, tuning: Pick<GenerationTuning, "neutralStackStrengthMultiplier">): number {
  return scaleValue(value, tuning.neutralStackStrengthMultiplier);
}

function foothold(castleCount: number, spawnFootholds: boolean): ContentItem[] {
  if (!spawnFootholds) return [];
  const rules: ContentPlacementRule[] = [{ type: "Crossroads", args: [], targetMin: 0.2, targetMax: 0.3, weight: 0 }];
  if (castleCount > 0) rules.push({ type: "MainObject", args: ["0"], targetMin: 0.2, targetMax: 0.4, weight: 0 });
  if (castleCount > 1) rules.push({ type: "MainObject", args: ["1"], targetMin: 0.5, targetMax: 0.5, weight: 2 });
  return [{ name: "name_remote_foothold_1", sid: "remote_foothold", isGuarded: false, rules }];
}

export function buildAllContentCountLimits(): ContentCountLimit[] {
  const sidLimits = ["black_tower", "fountain", "fountain_2", "mana_well", "market", "forge", "stables", "watchtower", "wind_rose", "university", "wise_owl", "pandora_box"].map((sid) => ({ sid, maxCount: sid === "black_tower" ? 0 : sid === "market" || sid === "stables" || sid === "wind_rose" ? 1 : sid === "pandora_box" ? 4 : 2 }));
  const limits: ContentCountLimit[] = [{ name: "content_limits_side", limits: sidLimits }, { name: "content_limits_side_0_0", playerMin: 0, playerMax: 0, limits: sidLimits }];
  for (let a = 1; a <= 5; a++) for (let b = a + 1; b <= 6; b++) limits.push({ name: `content_limits_side_${a}_${b}`, playerMin: a, playerMax: b, limits: sidLimits });
  return limits;
}
