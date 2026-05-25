import { buildGameRules } from "../generator/gameRulesBuilder.ts";
import { directConnection } from "../generator/connectionBuilder.ts";
import { computeContentScale, defaultGuardRandomization, sideLayoutName, treasureLayoutName, type GenerationTuning } from "../generator/math.ts";
import { buildAllMandatoryContent, buildHubZone, buildNeutralZone, buildSpawnZone } from "../generator/templateContentBuilder.ts";
import { applyNeutralCastleRuinsToZone } from "../generator/topologyVariantBuilder.ts";
import { normalizeBoardZonePositions } from "../boardSlots.ts";
import { createDefaultSettings } from "../settings.ts";
import { matchZoneBiomeSelector, terrainSelector } from "../terrain.ts";
import { parseRmgTemplate, type BiomeSelector, type Bonus, type Border, type Connection, type ContentCountLimit, type ContentPlacementRule, type GlobalBans, type JsonValue, type MainObject, type MandatoryContentGroup, type NeutralZoneQuality, type NoiseEntry, type Orientation, type RmgTemplate, type TerrainTheme, type ValidationResult, type ValueOverride, type Zone, type ZoneLayout } from "../types.ts";
import {
  cloneSelector,
  clampPoint,
  createZone,
  createDefaultDesign,
  isFiniteNumber,
  isNoiseEntry,
  normalizeDesignLockState,
  ringPosition,
  suffixForZone,
  toStringList,
  type DesignConnection,
  type DesignFile,
  type DesignBorder,
  type DesignOrientation,
  type DesignZone,
  type DesignZoneRole,
  type TemplateDesign
} from "./model.ts";
import { validateDesign } from "./validation.ts";
import { uniqueNearestSpawnName } from "./zoneOwnership.ts";

export type ReleaseImportStrategy = "design_file" | "rmg_template";
export type ReleaseImportFailureCategory =
  | "invalid_json"
  | "not_design_file"
  | "invalid_design_file"
  | "invalid_rmg_template"
  | "unsupported_legacy_settings";

export type ReleaseImportAttempt =
  | { strategy: ReleaseImportStrategy; ok: true }
  | { strategy: ReleaseImportStrategy; ok: false; category: ReleaseImportFailureCategory; message: string };

export type ParseDesignOrTemplateFileResult =
  | { ok: true; design: TemplateDesign; strategy: ReleaseImportStrategy; attempts: ReleaseImportAttempt[] }
  | { ok: false; errorMessage: string; attempts: ReleaseImportAttempt[] };

export type ApplyRmgJsonResult =
  | { ok: true; design: TemplateDesign }
  | { ok: false; parseError?: string; validation?: ValidationResult };

export interface DesignToTemplateOptions {
  skipValidation?: boolean;
}

export function designToTemplate(design: TemplateDesign, options: DesignToTemplateOptions = {}): RmgTemplate {
  if (!options.skipValidation) {
    const validation = validateDesign(design);
    if (validation.errors.length > 0) throw new Error(validation.errors.join("\n"));
  }

  const totalZones = design.zones.length;
  const defaultTuning: GenerationTuning = {
    contentScale: computeContentScale(design.mapWidth, design.mapHeight, totalZones),
    resourceDensityMultiplier: 0.5,
    structureDensityMultiplier: 1,
    neutralStackStrengthMultiplier: 1,
    borderGuardStrengthMultiplier: 1,
    guardRandomization: defaultGuardRandomization
  };
  const connsByZone = new Map(design.zones.map((zone) => [zone.id, [] as string[]]));
  for (const connection of design.connections) {
    if (connection.road) {
      connsByZone.get(connection.from)?.push(connection.name);
      connsByZone.get(connection.to)?.push(connection.name);
    }
  }

  const playerZones = design.zones.filter((zone) => zone.role === "Spawn").sort((a, b) => (a.player ?? 99) - (b.player ?? 99));
  const zones: Zone[] = design.zones.map((designZone, index) => {
    const tuning = tuningForZone(defaultTuning, designZone);
    const roadNames = connsByZone.get(designZone.id) ?? [];
    const isHoldCity = designZone.holdCity;
    let zone: Zone;
    if (designZone.role === "Spawn") {
      const playerIndex = Math.max(1, designZone.player ?? playerZones.indexOf(designZone) + 1);
      zone = buildSpawnZone(suffixForZone(designZone, "Spawn"), `Player${playerIndex}`, roadNames, designZone.castleCount, true, designZone.size, designZone.footholds, designZone.roads, tuning);
    } else if (designZone.role === "Hub") {
      zone = buildHubZone(roadNames, tuning, isHoldCity, designZone.size, designZone.castleCount, designZone.roads);
      zone.name = designZone.name;
    } else {
      zone = buildNeutralZone({ letter: suffixForZone(designZone, "Neutral"), quality: designZone.quality, role: "Standard", castleCount: designZone.castleCount }, roadNames, designZone.size, designZone.footholds, designZone.roads, tuning, isHoldCity);
    }
    zone.name = designZone.name;
    zone.layout = designZone.layout || zone.layout;
    zone.guardCutoffValue = designZone.guardCutoffValue;
    zone.guardMultiplier = designZone.guardMultiplier;
    zone.guardWeeklyIncrement = designZone.guardWeeklyIncrement;
    zone.guardReactionDistribution = [...designZone.guardReactionDistribution];
    zone.diplomacyModifier = designZone.diplomacyModifier;
    zone.guardedContentPool = [...designZone.guardedContentPool];
    zone.unguardedContentPool = [...designZone.unguardedContentPool];
    zone.resourcesContentPool = [...designZone.resourcesContentPool];
    zone.contentCountLimits = [...designZone.contentCountLimits];
    zone.mandatoryContent = [...designZone.mandatoryContent];
    zone.guardedContentValue = designZone.guardedContentValue;
    zone.guardedContentValuePerArea = designZone.guardedContentValuePerArea;
    zone.unguardedContentValue = designZone.unguardedContentValue;
    zone.unguardedContentValuePerArea = designZone.unguardedContentValuePerArea;
    zone.resourcesValue = designZone.resourcesValue;
    zone.resourcesValuePerArea = designZone.resourcesValuePerArea;
    applyZoneRuleOverrides(zone, designZone);
    if (designZone.useCustomMainObjects) {
      zone.mainObjects = cloneCustomMainObjectsForDesignZone(designZone);
    }
    zone.crossroadsPosition = designZone.crossroadsPosition;
    zone.generatorPosition = clampPoint(designZone.position);
    const effectiveTerrainTheme = designZone.terrainTheme === "FactionMatched" ? design.terrainTheme : designZone.terrainTheme;
    if (hasCustomBiomeOverrides(designZone, zone)) {
      setZoneBiome(zone, "zoneBiome", designZone.zoneBiome);
      setZoneBiome(zone, "contentBiome", designZone.contentBiome);
      setZoneBiome(zone, "metaObjectsBiome", designZone.metaObjectsBiome);
    } else if (effectiveTerrainTheme !== "FactionMatched") {
      applyZoneTerrain(zone, effectiveTerrainTheme);
    }
    if (index === 0) zone.crossroadsPosition = 0;
    return zone;
  });

  const zonesById = new Map(design.zones.map((zone) => [zone.id, zone]));
  const connections: Connection[] = design.connections.map((connection) => {
    const from = zonesById.get(connection.from)!;
    const to = zonesById.get(connection.to)!;
    const defaultGuardZone = from.role === "Spawn" && to.role !== "Spawn" ? to.name : from.name;
    if (connection.type === "Portal") {
      const templateConnection: Connection = {
        name: connection.name,
        from: from.name,
        to: to.name,
        connectionType: "Portal",
        portalPlacementRulesFrom: [{ type: "Crossroads", args: [], targetMin: 0.1, targetMax: 0.3, weight: 2 }],
        portalPlacementRulesTo: [{ type: "Crossroads", args: [], targetMin: 0.1, targetMax: 0.3, weight: 2 }],
        road: connection.road,
        guardEscape: false,
        guardValue: connection.guardStrength,
        guardWeeklyIncrement: 0.15
      };
      applyConnectionGuardOverrides(templateConnection, connection);
      if (connection.portalPlacementRulesFrom !== undefined) {
        templateConnection.portalPlacementRulesFrom = clonePlacementRules(connection.portalPlacementRulesFrom);
      }
      if (connection.portalPlacementRulesTo !== undefined) {
        templateConnection.portalPlacementRulesTo = clonePlacementRules(connection.portalPlacementRulesTo);
      }
      return templateConnection;
    }
    if (connection.type === "Proximity") {
      return { name: connection.name, from: from.name, to: to.name, connectionType: "Proximity" };
    }
    const templateConnection = directConnection(
      connection.name,
      from.name,
      to.name,
      connection.guardZone ?? defaultGuardZone,
      connection.guardStrength,
      connection.guardMatchGroup ?? `manual_guard_${connection.id}`,
      defaultTuning
    );
    applyConnectionGuardOverrides(templateConnection, connection);
    if (connection.simTurnSquad !== undefined) {
      templateConnection.simTurnSquad = connection.simTurnSquad;
    }
    return templateConnection;
  });

  const settings = createDefaultSettings();
  settings.templateName = design.templateName;
  settings.gameMode = design.gameMode;
  settings.playerCount = design.playerCount;
  settings.mapWidth = design.mapWidth;
  settings.mapHeight = design.mapHeight;
  settings.heroSettings = structuredClone(design.heroSettings);
  settings.heroHireBan = design.heroHireBan;
  settings.encounterHoles = design.encounterHoles;
  settings.movementBonus = design.movementBonus;
  settings.factionLawsExpPercent = design.factionLawsExpPercent;
  settings.astrologyExpPercent = design.astrologyExpPercent;
  settings.gameEndConditions = structuredClone(design.gameEndConditions);
  settings.gladiatorArenaRules = structuredClone(design.gladiatorArenaRules);
  settings.tournamentRules = structuredClone(design.tournamentRules);
  const playerZoneCastles = playerZones.length > 0 ? Math.max(...playerZones.map((zone) => zone.castleCount)) : 1;
  const generatedMandatoryContent = buildDesignMandatoryContent(design, playerZoneCastles);

  const variant = {
    orientation: exportOrientation(design.orientation, zones[0]?.name),
    border: exportBorder(design.border),
    zones,
    connections
  };
  for (const zone of zones) {
    const designZone = design.zones.find((candidate) => candidate.name === zone.name);
    if (designZone?.role !== "Neutral") continue;
    const laneSpawnZoneName = uniqueNearestSpawnName(design, designZone);
    if (designZone.matchAdjacentNeutralCastleFactions && laneSpawnZoneName) {
      matchZoneCityFactions(zone, laneSpawnZoneName);
    }
    if (designZone.naturalExpansion && laneSpawnZoneName) {
      matchZoneCityFactions(zone, laneSpawnZoneName);
    }
    if (designZone.neutralCastlesAsRuins) {
      applyNeutralCastleRuinsToZone(zone);
    }
  }
  for (const zone of zones) {
    const designZone = design.zones.find((candidate) => candidate.name === zone.name);
    if (designZone?.useCustomMainObjects) {
      zone.mainObjects = cloneCustomMainObjectsForDesignZone(designZone);
    }
  }

  const gameRules = buildGameRules(settings, design.gameEndConditions.victoryCondition);
  if (hasGlobalBans(design.importedGameRulesGlobalBans)) {
    gameRules.globalBans = cloneGlobalBans(design.importedGameRulesGlobalBans);
  }

  const templateDescription = design.templateDescription.trim();

  return {
    name: design.templateName,
    gameMode: design.gameMode,
    ...(templateDescription ? { description: templateDescription } : {}),
    displayWinCondition: design.gameEndConditions.victoryCondition,
    sizeX: design.mapWidth,
    sizeZ: design.mapHeight,
    gameRules,
    variants: [variant],
    zoneLayouts: cloneZoneLayouts(design.zoneLayouts),
    mandatoryContent: design.useCustomMandatoryContent ? cloneMandatoryContent(design.mandatoryContent) : generatedMandatoryContent,
    contentCountLimits: cloneContentCountLimits(design.contentCountLimits),
    contentPools: cloneJsonValueArray(design.contentPools),
    contentLists: cloneJsonValueArray(design.contentLists),
    ...(design.valueOverrides.length > 0 ? { valueOverrides: cloneValueOverrides(design.valueOverrides) } : {}),
    ...(hasGlobalBans(design.globalBans) ? { globalBans: cloneGlobalBans(design.globalBans) } : {})
  };
}

export function serializeDesignFile(design: TemplateDesign): string {
  return `${JSON.stringify({ format: "olden-era-template-design", version: 1, design }, null, 2)}\n`;
}

export function parseDesignOrTemplateFileResult(text: string): ParseDesignOrTemplateFileResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch (error) {
    const message = `File is not valid JSON. ${errorMessage(error)}`;
    return {
      ok: false,
      errorMessage: message,
      attempts: [
        { strategy: "design_file", ok: false, category: "invalid_json", message },
        { strategy: "rmg_template", ok: false, category: "invalid_json", message }
      ]
    };
  }

  const attempts: ReleaseImportAttempt[] = [];
  if (isDesignFile(parsed)) {
    attempts.push({ strategy: "design_file", ok: true });
    return { ok: true, design: normalizeDesignLockState(parsed.design), strategy: "design_file", attempts };
  }

  attempts.push({
    strategy: "design_file",
    ok: false,
    category: hasDesignFileMarker(parsed) ? "invalid_design_file" : "not_design_file",
    message: hasDesignFileMarker(parsed)
      ? "Design file marker is present, but the design payload is not a valid release design file."
      : "Missing release design file marker."
  });

  if (isUnsupportedLegacySettingsFile(parsed)) {
    attempts.push({
      strategy: "rmg_template",
      ok: false,
      category: "unsupported_legacy_settings",
      message: "Legacy generator settings files are no longer supported. Import a release .oetd.json design file or .rmg.json template."
    });
    return { ok: false, errorMessage: formatReleaseImportFailure(attempts), attempts };
  }

  try {
    const design = templateToDesign(parseRmgTemplate(text));
    attempts.push({ strategy: "rmg_template", ok: true });
    return { ok: true, design, strategy: "rmg_template", attempts };
  } catch (error) {
    attempts.push({
      strategy: "rmg_template",
      ok: false,
      category: "invalid_rmg_template",
      message: errorMessage(error)
    });
    return { ok: false, errorMessage: formatReleaseImportFailure(attempts), attempts };
  }
}

export function parseDesignOrTemplateFile(text: string): TemplateDesign {
  const result = parseDesignOrTemplateFileResult(text);
  if (result.ok) return result.design;
  throw new Error(result.errorMessage);
}

export function applyRmgJsonToDesign(text: string, previous: TemplateDesign): ApplyRmgJsonResult {
  let template: RmgTemplate;
  try {
    template = parseRmgTemplate(text);
  } catch (error) {
    return { ok: false, parseError: error instanceof Error ? error.message : "Unable to parse template JSON." };
  }

  const imported = templateToDesign(template);
  const validation = validateDesign(imported);
  if (validation.errors.length > 0) {
    return { ok: false, validation };
  }

  return { ok: true, design: mergeImportedDesign(previous, imported, template) };
}

export function mergeImportedDesign(previous: TemplateDesign, imported: TemplateDesign, template?: RmgTemplate): TemplateDesign {
  const previousZonesByName = new Map(previous.zones.map((zone) => [zone.name, zone]));
  const importedTemplateZonesByName = new Map((template?.variants?.[0]?.zones ?? []).map((zone) => [zone.name, zone]));
  const usedZoneIds = new Set<string>();

  const mergedZones = imported.zones.map((zone) => {
    const previousZone = previousZonesByName.get(zone.name);
    const templateZone = importedTemplateZonesByName.get(zone.name);
    const id = previousZone && !usedZoneIds.has(previousZone.id)
      ? previousZone.id
      : nextPrefixedId(usedZoneIds, "zone");

    usedZoneIds.add(id);

    return {
      ...zone,
      id,
      terrainTheme: previousZone?.terrainTheme ?? zone.terrainTheme,
      resourceDensityPercent: previousZone?.resourceDensityPercent ?? zone.resourceDensityPercent,
      structureDensityPercent: previousZone?.structureDensityPercent ?? zone.structureDensityPercent,
      neutralStackStrengthPercent: previousZone?.neutralStackStrengthPercent ?? zone.neutralStackStrengthPercent,
      footholds: previousZone?.footholds ?? zone.footholds,
      roads: templateZone?.roads !== undefined ? templateZone.roads.length > 0 : (previousZone?.roads ?? zone.roads),
      position: templateZone?.generatorPosition ? zone.position : (previousZone?.position ?? zone.position)
    };
  });

  const mergedZonesByName = new Map(mergedZones.map((zone) => [zone.name, zone]));
  const previousZoneNamesById = new Map(previous.zones.map((zone) => [zone.id, zone.name]));
  const importedZoneNamesById = new Map(imported.zones.map((zone) => [zone.id, zone.name]));
  const previousConnectionsByKey = new Map(previous.connections.flatMap((connection) => {
    const fromName = previousZoneNamesById.get(connection.from);
    const toName = previousZoneNamesById.get(connection.to);
    if (!fromName || !toName) return [];
    return [[connectionIdentity(connection.name, fromName, toName), connection] as const];
  }));
  const usedConnectionIds = new Set<string>();

  const mergedConnections = imported.connections.flatMap((connection) => {
    const fromName = importedZoneNamesById.get(connection.from);
    const toName = importedZoneNamesById.get(connection.to);
    const fromZone = fromName ? mergedZonesByName.get(fromName) : undefined;
    const toZone = toName ? mergedZonesByName.get(toName) : undefined;
    if (!fromName || !toName || !fromZone || !toZone) return [];

    const previousConnection = previousConnectionsByKey.get(connectionIdentity(connection.name, fromName, toName));
    const id = previousConnection && !usedConnectionIds.has(previousConnection.id)
      ? previousConnection.id
      : nextPrefixedId(usedConnectionIds, "conn");

    usedConnectionIds.add(id);

    return [{
      ...connection,
      id,
      from: fromZone.id,
      to: toZone.id
    }];
  });

  return normalizeDesignLockState({
    ...imported,
    lockMapDimensions: previous.lockMapDimensions,
    terrainTheme: inferGlobalTerrainTheme(imported.zones) ?? previous.terrainTheme,
    matchAdjacentNeutralCastleFactions: inferAdjacentNeutralCastleMatch(template?.variants?.[0]?.zones ?? []) ?? previous.matchAdjacentNeutralCastleFactions,
    neutralCastlesAsRuins: inferGlobalNeutralCastleRuins(imported.zones) ?? previous.neutralCastlesAsRuins,
    zones: mergedZones,
    connections: mergedConnections
  });
}

export function templateToDesign(template: RmgTemplate): TemplateDesign {
  const defaults = createDefaultDesign();
  const variant = template.variants?.[0];
  const zones = template.variants?.[0]?.zones ?? [];
  const connections = template.variants?.[0]?.connections ?? [];
  const usedSpawnPlayers = new Set<number>();
  const gameRules = template.gameRules;
  const winConditions = gameRules?.winConditions;
  const hasHoldCityObject = zones.some((zone) => zone.mainObjects?.some((object) => object.holdCityWinCon === true));
  const importedCityHold = template.displayWinCondition === "win_condition_5" || hasHoldCityObject;
  const designZones = zones.map((zone, index) => {
    const role = inferDesignZoneRole(zone);
    const quality: NeutralZoneQuality = zone.layout === sideLayoutName ? "Low" : zone.layout === treasureLayoutName ? "Medium" : "High";
    const prototype = defaultZonePrototype(role, quality);
    return createZone(`zone-${index + 1}`, zone.name, role, {
      player: role === "Spawn" ? inferImportedSpawnPlayer(zone, usedSpawnPlayers) : undefined,
      quality,
      castleCount: zone.mainObjects?.filter((object) => object.type === "City" || object.type === "Spawn" || object.type === "Ruins").length ?? 0,
      size: zone.size ?? 1,
      terrainTheme: inferZoneTerrainTheme(zone),
      guardRandomizationPercent: Math.round((zone.guardRandomization ?? defaultGuardRandomization) * 100),
      layout: zone.layout ?? prototype.layout,
      guardCutoffValue: zone.guardCutoffValue ?? prototype.guardCutoffValue ?? 2000,
      guardMultiplier: zone.guardMultiplier ?? prototype.guardMultiplier ?? 1,
      guardWeeklyIncrement: zone.guardWeeklyIncrement ?? prototype.guardWeeklyIncrement ?? 0.2,
      guardReactionDistribution: zone.guardReactionDistribution?.length ? [...zone.guardReactionDistribution] : [...(prototype.guardReactionDistribution ?? [])],
      diplomacyModifier: zone.diplomacyModifier ?? prototype.diplomacyModifier ?? -0.5,
      guardedContentPool: zone.guardedContentPool ? [...zone.guardedContentPool] : [...(prototype.guardedContentPool ?? [])],
      unguardedContentPool: zone.unguardedContentPool ? [...zone.unguardedContentPool] : [...(prototype.unguardedContentPool ?? [])],
      resourcesContentPool: zone.resourcesContentPool ? [...zone.resourcesContentPool] : [...(prototype.resourcesContentPool ?? [])],
      contentCountLimits: zone.contentCountLimits !== undefined ? toStringList(zone.contentCountLimits) : toStringList(prototype.contentCountLimits),
      guardedContentValue: zone.guardedContentValue ?? prototype.guardedContentValue ?? 0,
      guardedContentValuePerArea: zone.guardedContentValuePerArea ?? prototype.guardedContentValuePerArea ?? 0,
      unguardedContentValue: zone.unguardedContentValue ?? prototype.unguardedContentValue ?? 0,
      unguardedContentValuePerArea: zone.unguardedContentValuePerArea ?? prototype.unguardedContentValuePerArea ?? 0,
      resourcesValue: zone.resourcesValue ?? prototype.resourcesValue ?? 0,
      resourcesValuePerArea: zone.resourcesValuePerArea ?? prototype.resourcesValuePerArea ?? 0,
      mandatoryContent: zone.mandatoryContent !== undefined ? toStringList(zone.mandatoryContent) : toStringList(prototype.mandatoryContent),
      encounterHolesSettings: importEncounterHolesSettings(zone.encounterHolesSettings),
      randomHireEnableWeeklyUnitIncrement: typeof zone.randomHireEnableWeeklyUnitIncrement === "boolean" ? zone.randomHireEnableWeeklyUnitIncrement : undefined,
      randomHireInitialUnitIncrement: isFiniteNumber(zone.randomHireInitialUnitIncrement) ? zone.randomHireInitialUnitIncrement : undefined,
      useCustomMainObjects: true,
      customMainObjects: cloneMainObjects(zone.mainObjects ?? []),
      zoneBiome: cloneSelector(zone.zoneBiome),
      contentBiome: cloneSelector(zone.contentBiome),
      metaObjectsBiome: cloneSelector(zone.metaObjectsBiome),
      crossroadsPosition: zone.crossroadsPosition ?? prototype.crossroadsPosition ?? 0,
      roads: (zone.roads?.length ?? 0) > 0,
      holdCity: zone.mainObjects?.some((object) => object.holdCityWinCon === true) ?? false,
      matchAdjacentNeutralCastleFactions: role === "Neutral" && (zone.mainObjects?.some((object) =>
        object.type === "City"
        && object.faction?.type === "Match"
        && (object.faction.args?.some((arg) => arg.startsWith("Spawn-")) ?? false)
      ) ?? false),
      neutralCastlesAsRuins: zone.mainObjects?.some((object) => object.type === "Ruins") ?? false,
      naturalExpansion: false,
      position: zone.generatorPosition ?? ringPosition(index, Math.max(1, zones.length))
    });
  });
  const snappedDesignZones = normalizeBoardZonePositions(designZones);
  const idByName = new Map(snappedDesignZones.map((zone) => [zone.name, zone.id]));
  const usedConnectionNames: string[] = [];
  return normalizeDesignLockState({
    ...defaults,
    templateName: template.name,
    templateDescription: typeof template.description === "string" ? template.description : "",
    gameMode: template.gameMode ?? defaults.gameMode,
    playerCount: snappedDesignZones.filter((zone) => zone.role === "Spawn").length,
    mapWidth: template.sizeX,
    mapHeight: template.sizeZ,
    terrainTheme: inferGlobalTerrainTheme(snappedDesignZones) ?? defaults.terrainTheme,
    heroSettings: {
      heroCountMin: gameRules?.heroCountMin ?? defaults.heroSettings.heroCountMin,
      heroCountMax: gameRules?.heroCountMax ?? defaults.heroSettings.heroCountMax,
      heroCountIncrement: gameRules?.heroCountIncrement ?? defaults.heroSettings.heroCountIncrement
    },
    heroHireBan: gameRules?.heroHireBan ?? defaults.heroHireBan,
    encounterHoles: gameRules?.encounterHoles ?? defaults.encounterHoles,
    movementBonus: inferMovementBonus(gameRules?.bonuses, defaults.movementBonus),
    factionLawsExpPercent: modifierToPercent(gameRules?.factionLawsExpModifier, defaults.factionLawsExpPercent),
    astrologyExpPercent: modifierToPercent(gameRules?.astrologyExpModifier, defaults.astrologyExpPercent),
    gameEndConditions: {
      ...defaults.gameEndConditions,
      victoryCondition: importedCityHold ? "win_condition_5" : (template.displayWinCondition ?? defaults.gameEndConditions.victoryCondition),
      lostStartCity: winConditions?.lostStartCity ?? gameRules?.lostStartCity ?? defaults.gameEndConditions.lostStartCity,
      lostStartCityDay: winConditions?.lostStartCityDay ?? defaults.gameEndConditions.lostStartCityDay,
      lostStartHero: winConditions?.lostStartHero ?? gameRules?.lostStartHero ?? defaults.gameEndConditions.lostStartHero,
      cityHold: importedCityHold,
      cityHoldDays: winConditions?.cityHoldDays ?? gameRules?.cityHoldDays ?? defaults.gameEndConditions.cityHoldDays
    },
    gladiatorArenaRules: {
      enabled: winConditions?.gladiatorArena ?? gameRules?.gladiatorArena ?? defaults.gladiatorArenaRules.enabled,
      daysDelayStart: winConditions?.gladiatorArenaDaysDelayStart ?? gameRules?.gladiatorArenaDaysDelayStart ?? defaults.gladiatorArenaRules.daysDelayStart,
      countDay: winConditions?.gladiatorArenaCountDay ?? gameRules?.gladiatorArenaCountDay ?? defaults.gladiatorArenaRules.countDay
    },
    tournamentRules: {
      enabled: winConditions?.tournament ?? gameRules?.tournamentRules ?? defaults.tournamentRules.enabled,
      firstTournamentDay: inferFirstTournamentDay(winConditions?.tournamentDays, defaults.tournamentRules.firstTournamentDay),
      interval: inferTournamentInterval(winConditions?.tournamentDays, defaults.tournamentRules.interval),
      pointsToWin: winConditions?.tournamentPointsToWin ?? defaults.tournamentRules.pointsToWin,
      saveArmy: winConditions?.tournamentSaveArmy ?? defaults.tournamentRules.saveArmy
    },
    orientation: importOrientation(variant?.orientation, zones[0]?.name ?? defaults.orientation.zeroAngleZone),
    border: importBorder(variant?.border),
    zoneLayouts: cloneZoneLayouts(template.zoneLayouts ?? defaults.zoneLayouts),
    useCustomMandatoryContent: Array.isArray(template.mandatoryContent),
    mandatoryContent: cloneMandatoryContent(template.mandatoryContent ?? []),
    contentCountLimits: cloneContentCountLimits(template.contentCountLimits ?? defaults.contentCountLimits),
    contentPools: cloneJsonValueArray(template.contentPools),
    contentLists: cloneJsonValueArray(template.contentLists),
    valueOverrides: cloneValueOverrides(template.valueOverrides),
    globalBans: cloneGlobalBans(template.globalBans) ?? {},
    importedGameRulesGlobalBans: cloneGlobalBans(gameRules?.globalBans),
    zones: snappedDesignZones,
    connections: connections
      .filter((connection) => idByName.has(connection.from) && idByName.has(connection.to))
      .map((connection, index) => ({
        id: `conn-${index + 1}`,
        name: pushUniqueName(usedConnectionNames, connection.name?.trim() || `Path-${connection.from}-${connection.to}`),
        from: idByName.get(connection.from)!,
        to: idByName.get(connection.to)!,
        type: connection.connectionType === "Portal" ? "Portal" : connection.connectionType === "Proximity" ? "Proximity" : "Direct",
        guardStrength: connection.guardValue ?? 30000,
        road: connection.road ?? true,
        guardRandomization: connection.guardRandomization,
        guardWeeklyIncrement: connection.guardWeeklyIncrement,
        guardEscape: connection.guardEscape,
        simTurnSquad: connection.simTurnSquad,
        guardZone: connection.guardZone,
        guardMatchGroup: connection.guardMatchGroup,
        portalPlacementRulesFrom: clonePlacementRules(connection.portalPlacementRulesFrom),
        portalPlacementRulesTo: clonePlacementRules(connection.portalPlacementRulesTo)
      }))
  });
}

function defaultDesignOrientation(zeroAngleZone?: string): DesignOrientation {
  return { zeroAngleZone, baseAngleMin: 45, baseAngleMax: 45, randomAngleAmplitude: 0, randomAngleStep: 0 };
}

function defaultDesignBorder(): DesignBorder {
  return {
    cornerRadius: 0,
    obstaclesWidth: 3,
    obstaclesNoise: [{ amp: 1, freq: 12 }],
    waterWidth: 0,
    waterNoise: [{ amp: 1, freq: 12 }],
    waterType: "water grass"
  };
}

function exportOrientation(orientation: DesignOrientation, fallbackZeroAngleZone: string | undefined): Orientation {
  return {
    zeroAngleZone: orientation.zeroAngleZone || fallbackZeroAngleZone,
    baseAngleMin: orientation.baseAngleMin,
    baseAngleMax: orientation.baseAngleMax,
    randomAngleAmplitude: orientation.randomAngleAmplitude,
    randomAngleStep: orientation.randomAngleStep
  };
}

function importOrientation(orientation: Partial<DesignOrientation> | undefined, fallbackZeroAngleZone: string | undefined): DesignOrientation {
  const defaults = defaultDesignOrientation(fallbackZeroAngleZone);
  return {
    zeroAngleZone: typeof orientation?.zeroAngleZone === "string" ? orientation.zeroAngleZone : defaults.zeroAngleZone,
    baseAngleMin: finiteOrDefault(orientation?.baseAngleMin, defaults.baseAngleMin),
    baseAngleMax: finiteOrDefault(orientation?.baseAngleMax, defaults.baseAngleMax),
    randomAngleAmplitude: finiteOrDefault(orientation?.randomAngleAmplitude, defaults.randomAngleAmplitude),
    randomAngleStep: finiteOrDefault(orientation?.randomAngleStep, defaults.randomAngleStep)
  };
}

function exportBorder(border: DesignBorder): Border {
  return {
    cornerRadius: border.cornerRadius,
    obstaclesWidth: border.obstaclesWidth,
    obstaclesNoise: structuredClone(border.obstaclesNoise),
    waterWidth: border.waterWidth,
    waterNoise: structuredClone(border.waterNoise),
    waterType: border.waterType
  };
}

function applyZoneRuleOverrides(zone: Zone, designZone: DesignZone): void {
  const affectedEncounters = designZone.encounterHolesSettings?.affectedEncounters;
  const twoHoleEncounters = designZone.encounterHolesSettings?.twoHoleEncounters;
  if (isFiniteNumber(affectedEncounters) || isFiniteNumber(twoHoleEncounters)) {
    zone.encounterHolesSettings = {};
    if (isFiniteNumber(affectedEncounters)) zone.encounterHolesSettings.affectedEncounters = affectedEncounters;
    if (isFiniteNumber(twoHoleEncounters)) zone.encounterHolesSettings.twoHoleEncounters = twoHoleEncounters;
  }

  if (typeof designZone.randomHireEnableWeeklyUnitIncrement === "boolean") {
    zone.randomHireEnableWeeklyUnitIncrement = designZone.randomHireEnableWeeklyUnitIncrement;
  }
  if (isFiniteNumber(designZone.randomHireInitialUnitIncrement)) {
    zone.randomHireInitialUnitIncrement = designZone.randomHireInitialUnitIncrement;
  }
}

function importEncounterHolesSettings(settings: Zone["encounterHolesSettings"]): DesignZone["encounterHolesSettings"] {
  if (!settings) return undefined;
  const affectedEncounters = isFiniteNumber(settings.affectedEncounters) ? settings.affectedEncounters : undefined;
  const twoHoleEncounters = isFiniteNumber(settings.twoHoleEncounters) ? settings.twoHoleEncounters : undefined;
  return affectedEncounters !== undefined || twoHoleEncounters !== undefined ? { affectedEncounters, twoHoleEncounters } : undefined;
}

function importBorder(border: Partial<DesignBorder> | undefined): DesignBorder {
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

function finiteOrDefault(value: unknown, fallback: number): number {
  return isFiniteNumber(value) ? value : fallback;
}

function cloneNoiseEntries(value: unknown, fallback: NoiseEntry[]): NoiseEntry[] {
  return Array.isArray(value) && value.every(isNoiseEntry) ? structuredClone(value) : structuredClone(fallback);
}

function applyConnectionGuardOverrides(templateConnection: Connection, designConnection: DesignConnection): void {
  if (designConnection.guardZone !== undefined) {
    templateConnection.guardZone = designConnection.guardZone;
  }
  if (designConnection.guardEscape !== undefined) {
    templateConnection.guardEscape = designConnection.guardEscape;
  }
  if (designConnection.guardRandomization !== undefined) {
    templateConnection.guardRandomization = designConnection.guardRandomization;
  }
  if (designConnection.guardWeeklyIncrement !== undefined) {
    templateConnection.guardWeeklyIncrement = designConnection.guardWeeklyIncrement;
  }
  if (designConnection.guardMatchGroup !== undefined) {
    templateConnection.guardMatchGroup = designConnection.guardMatchGroup;
  }
}

function clonePlacementRules(rules: ContentPlacementRule[] | undefined): ContentPlacementRule[] | undefined {
  return rules ? structuredClone(rules) : undefined;
}

function cloneJsonValueArray(values: JsonValue[] | undefined): JsonValue[] {
  return values ? structuredClone(values) : [];
}

function cloneValueOverrides(valueOverrides: ValueOverride[] | undefined): ValueOverride[] {
  return valueOverrides ? structuredClone(valueOverrides) : [];
}

function cloneGlobalBans(globalBans: GlobalBans | undefined): GlobalBans | undefined {
  return globalBans ? structuredClone(globalBans) : undefined;
}

function hasGlobalBans(globalBans: GlobalBans | undefined): globalBans is GlobalBans {
  return Boolean(globalBans && Object.keys(globalBans).length > 0);
}

function cloneMainObjects(mainObjects: MainObject[]): MainObject[] {
  return structuredClone(mainObjects);
}

function cloneZoneLayouts(layouts: ZoneLayout[]): ZoneLayout[] {
  return structuredClone(layouts);
}

function cloneContentCountLimits(limits: ContentCountLimit[]): ContentCountLimit[] {
  return structuredClone(limits);
}

function cloneMandatoryContent(groups: MandatoryContentGroup[]): MandatoryContentGroup[] {
  return structuredClone(groups);
}

export function getDesignMandatoryContentGroups(design: TemplateDesign): MandatoryContentGroup[] {
  if (design.useCustomMandatoryContent) return cloneMandatoryContent(design.mandatoryContent);
  const playerZones = design.zones.filter((zone) => zone.role === "Spawn").sort((a, b) => (a.player ?? 99) - (b.player ?? 99));
  const playerZoneCastles = playerZones.length > 0 ? Math.max(...playerZones.map((zone) => zone.castleCount)) : 1;
  return buildDesignMandatoryContent(design, playerZoneCastles);
}

function buildDesignMandatoryContent(design: TemplateDesign, playerZoneCastles: number): MandatoryContentGroup[] {
  const playerZones = design.zones.filter((zone) => zone.role === "Spawn").sort((a, b) => (a.player ?? 99) - (b.player ?? 99));
  const playerLetters = playerZones.map((zone) => suffixForZone(zone, "Spawn"));
  const neutralPlans = design.zones
    .filter((zone) => zone.role === "Neutral")
    .map((zone) => ({ letter: suffixForZone(zone, "Neutral"), quality: zone.quality, role: "Standard" as const, castleCount: zone.castleCount }));
  return buildAllMandatoryContent(playerLetters, neutralPlans, { zoneCfg: { playerZoneCastles }, spawnRemoteFootholds: true, naturalExpansionZone: false });
}

function tuningForZone(base: GenerationTuning, zone: DesignZone): GenerationTuning {
  return {
    ...base,
    resourceDensityMultiplier: zone.resourceDensityPercent / 200,
    structureDensityMultiplier: zone.structureDensityPercent / 100,
    neutralStackStrengthMultiplier: zone.neutralStackStrengthPercent / 100,
    guardRandomization: zone.guardRandomizationPercent / 100
  };
}

function applyZoneTerrain(zone: Zone, terrainTheme: TerrainTheme): void {
  if (terrainTheme === "FactionMatched") return;
  const selector = terrainSelector(terrainTheme, matchZoneBiomeSelector);
  zone.zoneBiome = structuredClone(selector);
  zone.contentBiome = structuredClone(selector);
  zone.metaObjectsBiome = structuredClone(selector);
}

function hasCustomBiomeOverrides(designZone: DesignZone, zone: Zone): boolean {
  if (designZone.zoneBiome === undefined && designZone.contentBiome === undefined && designZone.metaObjectsBiome === undefined) {
    return false;
  }
  return !sameBiomeSelector(designZone.zoneBiome, zone.zoneBiome)
    || !sameBiomeSelector(designZone.contentBiome, zone.contentBiome)
    || !sameBiomeSelector(designZone.metaObjectsBiome, zone.metaObjectsBiome);
}

function setZoneBiome(zone: Zone, key: "zoneBiome" | "contentBiome" | "metaObjectsBiome", selector: BiomeSelector | undefined): void {
  if (selector === undefined) {
    delete zone[key];
    return;
  }
  zone[key] = cloneSelector(selector);
}

function sameBiomeSelector(left: BiomeSelector | undefined, right: BiomeSelector | undefined): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function defaultZonePrototype(role: DesignZoneRole, quality: NeutralZoneQuality): Zone {
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

function matchZoneCityFactions(zone: Zone, spawnZoneName: string): void {
  const cityObjects = (zone.mainObjects ?? []).filter((object) => object.type === "City");
  if (cityObjects.length === 0) return;
  cityObjects[0].faction = { type: "Match", args: ["0", spawnZoneName] };
  for (const city of cityObjects.slice(1)) city.faction = { type: "Match", args: ["0"] };
}

function cloneCustomMainObjectsForDesignZone(zone: DesignZone): MainObject[] {
  const mainObjects = cloneMainObjects(zone.customMainObjects);
  if (zone.role !== "Spawn" || !Number.isInteger(zone.player)) return mainObjects;
  for (const mainObject of mainObjects) {
    if (mainObject.type === "Spawn") mainObject.spawn = `Player${zone.player}`;
  }
  return mainObjects;
}

function pushUniqueName(existing: string[], base: string): string {
  const name = uniqueString(existing, base);
  existing.push(name);
  return name;
}

function uniqueString(existing: string[], base: string): string {
  const used = new Set(existing);
  if (!used.has(base)) return base;
  for (let i = 2; ; i++) {
    const candidate = `${base}-${i}`;
    if (!used.has(candidate)) return candidate;
  }
}

function isDesignFile(value: unknown): value is DesignFile {
  return Boolean(value && typeof value === "object" && (value as DesignFile).format === "olden-era-template-design" && isDesign((value as DesignFile).design));
}

function hasDesignFileMarker(value: unknown): boolean {
  return Boolean(value && typeof value === "object" && (value as { format?: unknown }).format === "olden-era-template-design");
}

function isUnsupportedLegacySettingsFile(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (hasDesignFileMarker(value) || hasCurrentRmgTemplateMarker(record)) return false;
  const legacyKeys = [
    "templateName",
    "preset",
    "pacePreset",
    "connectionStyle",
    "contentPreset",
    "playerCount",
    "neutralZoneCount",
    "topology",
    "zoneCfg",
    "generateRoads",
    "randomPortals",
    "noDirectPlayerConnections"
  ];
  return legacyKeys.filter((key) => Object.prototype.hasOwnProperty.call(record, key)).length >= 2;
}

function hasCurrentRmgTemplateMarker(record: Record<string, unknown>): boolean {
  return Object.prototype.hasOwnProperty.call(record, "name") ||
    Object.prototype.hasOwnProperty.call(record, "sizeX") ||
    Object.prototype.hasOwnProperty.call(record, "sizeZ") ||
    Object.prototype.hasOwnProperty.call(record, "variants");
}

function formatReleaseImportFailure(attempts: ReleaseImportAttempt[]): string {
  const failed = attempts.filter((attempt): attempt is Extract<ReleaseImportAttempt, { ok: false }> => !attempt.ok);
  const details = failed.map((attempt) => `${attempt.strategy}: ${attempt.message}`).join(" ");
  return `Unsupported file format. Expected a release design file or .rmg.json template. ${details}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown parse error.";
}

function isDesign(value: unknown): value is TemplateDesign {
  return Boolean(value && typeof value === "object" && (value as TemplateDesign).format === "olden-era-template-design" && Array.isArray((value as TemplateDesign).zones));
}

function inferDesignZoneRole(zone: Zone): DesignZoneRole {
  if (zone.name === "Hub" || zone.name.startsWith("Hub")) return "Hub";
  if (zone.mainObjects?.some((object) => object.type === "Spawn")) return "Spawn";
  return "Neutral";
}

function nextImportedSpawnPlayer(zoneName: string, used: Set<number>): number {
  const namedPlayer = spawnPlayerFromZoneName(zoneName);
  if (namedPlayer !== undefined && !used.has(namedPlayer)) {
    used.add(namedPlayer);
    return namedPlayer;
  }
  const fallback = nextUnusedSpawnPlayer(used) ?? 1;
  used.add(fallback);
  return fallback;
}

function inferImportedSpawnPlayer(zone: Zone, used: Set<number>): number {
  const explicitPlayer = zone.mainObjects?.find((object) => object.type === "Spawn")?.spawn;
  const namedPlayer = explicitPlayer ? playerNumberFromSpawnString(explicitPlayer) : undefined;
  if (namedPlayer !== undefined && !used.has(namedPlayer)) {
    used.add(namedPlayer);
    return namedPlayer;
  }
  return nextImportedSpawnPlayer(zone.name, used);
}

function playerNumberFromSpawnString(spawn: string): number | undefined {
  const match = /^Player(\d+)$/.exec(spawn.trim());
  if (!match) return undefined;
  const player = Number(match[1]);
  return player >= 1 && player <= 8 ? player : undefined;
}

function spawnPlayerFromZoneName(zoneName: string): number | undefined {
  const suffix = zoneName.startsWith("Spawn-") ? zoneName.slice(6) : zoneName;
  if (/^\d+$/.test(suffix)) {
    const player = Number(suffix);
    if (player >= 1 && player <= 8) return player;
  }
  if (/^[A-Z]$/.test(suffix)) {
    const player = suffix.charCodeAt(0) - 64;
    if (player >= 1 && player <= 8) return player;
  }
  return undefined;
}

function nextUnusedSpawnPlayer(used: Set<number>): number | undefined {
  for (let player = 1; player <= 8; player++) {
    if (!used.has(player)) return player;
  }
  return undefined;
}

function modifierToPercent(modifier: number | undefined, fallback: number): number {
  if (typeof modifier !== "number" || !Number.isFinite(modifier)) return fallback;
  return Math.round(modifier * 100);
}

function inferMovementBonus(bonuses: Bonus[] | Bonus | undefined, fallback: number): number {
  const bonusList = Array.isArray(bonuses) ? bonuses : bonuses ? [bonuses] : [];
  const value = bonusList.find((bonus) => bonus.parameters?.[0] === "movementBonus")?.parameters?.[1];
  if (value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function inferFirstTournamentDay(days: number[] | undefined, fallback: number): number {
  if (!days || days.length === 0) return fallback;
  return days[0]! + 1;
}

function inferTournamentInterval(days: number[] | undefined, fallback: number): number {
  if (!days || days.length < 2) return fallback;
  return days[1]! + 1;
}

function inferZoneTerrainTheme(zone: Zone): TerrainTheme {
  const selectors = [zone.zoneBiome, zone.contentBiome, zone.metaObjectsBiome];
  const first = selectors[0];
  if (!selectors.every((selector) => sameBiomeSelector(selector, first))) return "FactionMatched";
  if (sameBiomeSelector(first, undefined) || sameBiomeSelector(first, { type: "MatchMainObject", args: ["0"] }) || sameBiomeSelector(first, matchZoneBiomeSelector)) {
    return "FactionMatched";
  }
  if (sameBiomeSelector(first, terrainSelector("Random")) || sameBiomeSelector(first, terrainSelector("Mixed"))) return "Random";
  for (const theme of ["Grass", "Snow", "Desert", "Lava", "Swamp"] as const) {
    if (sameBiomeSelector(first, terrainSelector(theme))) return theme;
  }
  return "FactionMatched";
}

function inferGlobalTerrainTheme(zones: DesignZone[]): TerrainTheme | undefined {
  if (zones.length === 0) return undefined;
  const themes = new Set(zones.map((zone) => zone.terrainTheme));
  return themes.size === 1 ? zones[0]?.terrainTheme : undefined;
}

function inferAdjacentNeutralCastleMatch(zones: Zone[]): boolean | undefined {
  const neutralCities = zones.filter((zone) =>
    inferDesignZoneRole(zone) === "Neutral"
    && (zone.mainObjects?.some((object) => object.type === "City" || object.type === "Ruins") ?? false)
  );
  if (neutralCities.length === 0) return undefined;
  return neutralCities.some((zone) =>
    zone.mainObjects?.some((object) => object.faction?.type === "Match" && (object.faction.args?.some((arg) => arg.startsWith("Spawn-")) ?? false))
    ?? false
  );
}

function inferGlobalNeutralCastleRuins(zones: DesignZone[]): boolean | undefined {
  const neutralCities = zones.filter((zone) => zone.role === "Neutral" && zone.castleCount > 0);
  if (neutralCities.length === 0) return undefined;
  return neutralCities.every((zone) => zone.neutralCastlesAsRuins);
}

function connectionIdentity(name: string, fromName: string, toName: string): string {
  return `${name}\u0000${fromName}\u0000${toName}`;
}

function nextPrefixedId(used: Set<string>, prefix: string): string {
  for (let index = 1; ; index++) {
    const candidate = `${prefix}-${index}`;
    if (!used.has(candidate)) return candidate;
  }
}
