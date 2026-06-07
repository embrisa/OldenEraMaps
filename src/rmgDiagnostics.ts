import type { Connection, ContentItem, MainObject, MandatoryContentGroup, RmgTemplate, Road, RoadEndpoint, Variant, Zone } from "./types";

export type RmgDiagnosticSeverity = "error" | "warning" | "info";

export interface RmgDiagnostic {
  code: string;
  severity: RmgDiagnosticSeverity;
  message: string;
  zoneName?: string;
  connectionName?: string;
  roadEndpoint?: string;
  mainObjectIndex?: number;
  mandatoryContentName?: string;
  contentCountLimitName?: string;
}

export interface RmgDiagnosticSummary {
  diagnostics: RmgDiagnostic[];
  errors: RmgDiagnostic[];
  warnings: RmgDiagnostic[];
  infos: RmgDiagnostic[];
}

const cityHoldWinCondition = "win_condition_5";
const knownLegendaryPoolEntry = "classic_template_pool_random_t5_item";
const guaranteedLegendarySid = "random_item_legendary";

export function collectRmgDiagnostics(template: RmgTemplate): RmgDiagnosticSummary {
  const diagnostics = [
    ...validateTemplateStructure(template),
    ...validateCityHoldObjective(template),
    ...validateRouteAndRoadConsistency(template),
    ...validateBranchMirroring(template),
    ...recommendTemplateSizeAndPacing(template),
    ...recommendGuardRewardScaling(template),
    troubleshootingInfo()
  ];

  return {
    diagnostics,
    errors: diagnostics.filter((diagnostic) => diagnostic.severity === "error"),
    warnings: diagnostics.filter((diagnostic) => diagnostic.severity === "warning"),
    infos: diagnostics.filter((diagnostic) => diagnostic.severity === "info")
  };
}

export function validateTemplateStructure(template: RmgTemplate): RmgDiagnostic[] {
  const diagnostics: RmgDiagnostic[] = [];
  const variant = firstVariant(template);
  const zones = variant?.zones ?? [];
  const connections = variant?.connections ?? [];
  const zoneNames = new Set(zones.map((zone) => zone.name));
  const connectionNames = new Set(connections.map((connection) => connection.name).filter((name): name is string => Boolean(name?.trim())));
  const mandatoryContentNames = new Set((template.mandatoryContent ?? []).map((group) => group.name));
  const contentLimitNames = new Set((template.contentCountLimits ?? []).map((limit) => limit.name));

  for (const [dimension, label] of [[template.sizeX, "sizeX"], [template.sizeZ, "sizeZ"]] as const) {
    if (dimension % 16 !== 0) {
      diagnostics.push({
        code: "size_grid_invalid",
        severity: "error",
        message: `${label} must be divisible by 16. Received ${dimension}.`
      });
    }
  }

  if (template.sizeX === 214 && template.sizeZ === 214) {
    diagnostics.push({
      code: "size_214_suspicious",
      severity: "warning",
      message: "214x214 is a suspicious size that has been observed to generate and then crash on load."
    });
  }

  for (const connection of connections) {
    if (!zoneNames.has(connection.from)) {
      diagnostics.push({
        code: "connection_missing_zone",
        severity: "error",
        message: `Connection ${connection.name ?? "<unnamed>"} references missing from zone ${connection.from}.`,
        connectionName: connection.name,
        zoneName: connection.from
      });
    }
    if (!zoneNames.has(connection.to)) {
      diagnostics.push({
        code: "connection_missing_zone",
        severity: "error",
        message: `Connection ${connection.name ?? "<unnamed>"} references missing to zone ${connection.to}.`,
        connectionName: connection.name,
        zoneName: connection.to
      });
    }
    if (connection.guardZone && !zoneNames.has(connection.guardZone)) {
      diagnostics.push({
        code: "connection_missing_guard_zone",
        severity: "error",
        message: `Connection ${connection.name ?? "<unnamed>"} references missing guard zone ${connection.guardZone}.`,
        connectionName: connection.name,
        zoneName: connection.guardZone
      });
    }
  }

  const localMandatoryContentNames = collectMandatoryContentItemNames(template.mandatoryContent ?? []);
  for (const zone of zones) {
    for (const name of zone.mandatoryContent ?? []) {
      if (!mandatoryContentNames.has(name)) {
        diagnostics.push({
          code: "zone_missing_mandatory_content",
          severity: "error",
          message: `Zone ${zone.name} references missing mandatory content group ${name}.`,
          zoneName: zone.name,
          mandatoryContentName: name
        });
      }
    }

    for (const name of toStringArray(zone.contentCountLimits)) {
      if (!contentLimitNames.has(name)) {
        diagnostics.push({
          code: "zone_missing_content_count_limit",
          severity: "error",
          message: `Zone ${zone.name} references missing content count limit ${name}.`,
          zoneName: zone.name,
          contentCountLimitName: name
        });
      }
    }

    const mainObjects = zone.mainObjects ?? [];
    if (mainObjects.length === 0 && zone.crossroadsPosition !== undefined) {
      diagnostics.push({
        code: "crossroads_empty_zone",
        severity: "error",
        message: `Zone ${zone.name} must not define crossroadsPosition without main objects.`,
        zoneName: zone.name
      });
    }
    if (mainObjects.length > 0 && zone.crossroadsPosition !== undefined && (zone.crossroadsPosition < 0 || zone.crossroadsPosition > 1)) {
      diagnostics.push({
        code: "crossroads_invalid_position",
        severity: "error",
        message: `Zone ${zone.name} has invalid crossroadsPosition ${zone.crossroadsPosition}. Expected a value from 0 to 1.`,
        zoneName: zone.name
      });
    }

    for (const [roadIndex, road] of (zone.roads ?? []).entries()) {
      diagnostics.push(...validateRoadEndpoint(zone, road.from, "from", roadIndex, connectionNames, mainObjects, localMandatoryContentNames));
      diagnostics.push(...validateRoadEndpoint(zone, road.to, "to", roadIndex, connectionNames, mainObjects, localMandatoryContentNames));
    }
  }

  return sortDiagnostics(diagnostics);
}

export function validateCityHoldObjective(template: RmgTemplate): RmgDiagnostic[] {
  const diagnostics: RmgDiagnostic[] = [];
  const zones = firstVariant(template)?.zones ?? [];
  const cityHoldEnabled = template.gameRules?.winConditions?.cityHold === true || template.displayWinCondition === cityHoldWinCondition;
  const holdCityObjects = zones.flatMap((zone) =>
    (zone.mainObjects ?? []).map((object, index) => ({ zone, object, index })).filter((item) => item.object.holdCityWinCon === true)
  );
  const allCities = zones.flatMap((zone) =>
    (zone.mainObjects ?? []).map((object, index) => ({ zone, object, index })).filter((item) => item.object.type === "City")
  );

  if (cityHoldEnabled) {
    if (allCities.length === 0) {
      diagnostics.push({
        code: "city_hold_missing_city",
        severity: "error",
        message: "City Hold requires at least one real City main object."
      });
    }
    if (holdCityObjects.length === 0) {
      diagnostics.push({
        code: "city_hold_missing_target",
        severity: "error",
        message: "City Hold requires exactly one City with holdCityWinCon: true."
      });
    }
    if (holdCityObjects.length > 1) {
      for (const item of holdCityObjects.slice(1)) {
        diagnostics.push({
          code: "city_hold_multiple_targets",
          severity: "error",
          message: `Zone ${item.zone.name} main object ${item.index} is an extra hold-city target.`,
          zoneName: item.zone.name,
          mainObjectIndex: item.index
        });
      }
    }
    for (const item of holdCityObjects) {
      if (item.object.type !== "City") {
        diagnostics.push({
          code: "city_hold_target_not_city",
          severity: "error",
          message: `Zone ${item.zone.name} main object ${item.index} is marked as a hold-city target but is a ${item.object.type}.`,
          zoneName: item.zone.name,
          mainObjectIndex: item.index
        });
      }
    }
    if (template.displayWinCondition !== cityHoldWinCondition) {
      diagnostics.push({
        code: "city_hold_display_condition_mismatch",
        severity: "error",
        message: `displayWinCondition must be ${cityHoldWinCondition} when City Hold is enabled.`
      });
    }
  } else {
    for (const item of holdCityObjects) {
      diagnostics.push({
        code: "city_hold_stale_target",
        severity: "warning",
        message: `Zone ${item.zone.name} main object ${item.index} still has holdCityWinCon: true while City Hold is disabled.`,
        zoneName: item.zone.name,
        mainObjectIndex: item.index
      });
    }
    if (template.displayWinCondition === cityHoldWinCondition) {
      diagnostics.push({
        code: "city_hold_stale_display_condition",
        severity: "warning",
        message: `displayWinCondition is still ${cityHoldWinCondition} while City Hold is disabled.`
      });
    }
  }

  return sortDiagnostics(diagnostics);
}

export function validateRouteAndRoadConsistency(template: RmgTemplate): RmgDiagnostic[] {
  const diagnostics: RmgDiagnostic[] = [];
  const variant = firstVariant(template);
  const zones = variant?.zones ?? [];
  const connections = variant?.connections ?? [];
  const graphPairs = new Set(connections
    .filter((connection) => connection.connectionType === "Direct" || connection.connectionType === "Portal")
    .map((connection) => pairKey(connection.from, connection.to)));

  for (const connection of connections) {
    if ((connection.connectionType !== "Direct" && connection.connectionType !== "Portal") || connection.road === false) continue;
    const fromZone = zones.find((zone) => zone.name === connection.from);
    const toZone = zones.find((zone) => zone.name === connection.to);
    const visibleRoad = zoneRoadReferencesConnection(fromZone, connection.name) || zoneRoadReferencesConnection(toZone, connection.name);
    if (!visibleRoad) {
      diagnostics.push({
        code: "route_missing_visible_road",
        severity: "warning",
        message: `Connection ${connection.name ?? "<unnamed>"} exists but no visible road segment references it.`,
        connectionName: connection.name
      });
    }
  }

  for (const zone of zones) {
    for (const road of zone.roads ?? []) {
      const connected = referencedConnectionNames(road);
      if (connected.length < 2) continue;
      for (const [leftIndex, leftName] of connected.entries()) {
        for (const rightName of connected.slice(leftIndex + 1)) {
          if (!graphPairs.has(pairKeyForConnectionNames(connections, leftName, rightName))) {
            diagnostics.push({
              code: "route_road_without_graph_path",
              severity: "warning",
              message: `Zone ${zone.name} draws a road between ${leftName} and ${rightName}, but the connection graph does not expose that path.`,
              zoneName: zone.name,
              roadEndpoint: `${leftName} -> ${rightName}`
            });
          }
        }
      }
    }
  }

  const battleCityPlayers = detectBattleCityPlayers(zones);
  if (battleCityPlayers.length >= 2 && zones.some((zone) => zone.name === "Center")) {
    for (const player of battleCityPlayers) {
      const chain = [`Spawn-${player}`, `P${player}-N1`, `P${player}-N2`, `P${player}-N3`, "Center"];
      for (let index = 0; index < chain.length - 1; index += 1) {
        if (!graphPairs.has(pairKey(chain[index], chain[index + 1]))) {
          diagnostics.push({
            code: "route_branch_chain_missing",
            severity: "error",
            message: `Expected BattleCity route segment ${chain[index]} -> ${chain[index + 1]} is missing.`,
            zoneName: chain[index]
          });
          break;
        }
      }
    }
  }

  return sortDiagnostics(diagnostics);
}

export function validateBranchMirroring(template: RmgTemplate): RmgDiagnostic[] {
  const zones = firstVariant(template)?.zones ?? [];
  const connections = firstVariant(template)?.connections ?? [];
  const players = detectBattleCityPlayers(zones);
  if (players.length < 2 || !zones.some((zone) => zone.name === "Center")) return [];

  const summaries = players.map((player) => buildBranchSummary(player, zones, connections));
  const baseline = summaries[0];
  const diagnostics: RmgDiagnostic[] = [];

  for (const summary of summaries.slice(1)) {
    if (summary.zoneCount !== baseline.zoneCount) {
      diagnostics.push({
        code: "branch_zone_count_mismatch",
        severity: "error",
        message: `Player ${summary.player} branch has ${summary.zoneCount} zones, expected ${baseline.zoneCount}.`,
        zoneName: `P${summary.player}-N1`
      });
      continue;
    }

    for (let index = 0; index < baseline.steps.length; index += 1) {
      const expected = baseline.steps[index];
      const actual = summary.steps[index];
      if (!actual) {
        diagnostics.push({
          code: "branch_zone_missing",
          severity: "error",
          message: `Player ${summary.player} branch is missing step ${expected.stepLabel}.`,
          zoneName: expected.zoneName
        });
        break;
      }
      if (actual.cityFactionMatchTarget !== undefined && actual.cityFactionMatchTarget !== `Spawn-${summary.player}`) {
        diagnostics.push({
          code: "branch_faction_match_mismatch",
          severity: "error",
          message: `Player ${summary.player} branch ${actual.zoneName} matches city faction to ${actual.cityFactionMatchTarget}, expected Spawn-${summary.player}.`,
          zoneName: actual.zoneName
        });
        break;
      }
      if (actual.mandatoryContentSignature !== expected.mandatoryContentSignature) {
        diagnostics.push({
          code: "branch_mandatory_content_mismatch",
          severity: "error",
          message: `Player ${summary.player} branch ${actual.zoneName} uses different mandatory content than player ${baseline.player}.`,
          zoneName: actual.zoneName
        });
        break;
      }
      if (actual.rewardSignature !== expected.rewardSignature) {
        diagnostics.push({
          code: "branch_reward_mismatch",
          severity: "warning",
          message: `Player ${summary.player} branch ${actual.zoneName} uses different reward references than player ${baseline.player}.`,
          zoneName: actual.zoneName
        });
        break;
      }
      if (actual.guardSignature !== expected.guardSignature) {
        diagnostics.push({
          code: "branch_guard_mismatch",
          severity: "warning",
          message: `Player ${summary.player} branch ${actual.zoneName} uses different guard scaling than player ${baseline.player}.`,
          zoneName: actual.zoneName
        });
        break;
      }
      if (actual.connectionSignature !== expected.connectionSignature) {
        diagnostics.push({
          code: "branch_connection_mismatch",
          severity: "warning",
          message: `Player ${summary.player} branch ${actual.zoneName} uses different route connections than player ${baseline.player}.`,
          zoneName: actual.zoneName
        });
        break;
      }
    }
  }

  return sortDiagnostics(diagnostics);
}

export function recommendTemplateSizeAndPacing(template: RmgTemplate): RmgDiagnostic[] {
  const diagnostics: RmgDiagnostic[] = [];
  const zones = firstVariant(template)?.zones ?? [];
  const players = detectBattleCityPlayers(zones);
  const isThreePlayerSharedCenter = players.length === 3 && zones.some((zone) => zone.name === "Center");
  const isTwoPlayerBattleCity = players.length === 2 && zones.some((zone) => zone.name === "Center");

  if (isTwoPlayerBattleCity && ![160, 176].includes(template.sizeX)) {
    diagnostics.push({
      code: "size_recommendation_duel",
      severity: "warning",
      message: `Two-player BattleCity-style branches usually work best at 160x160 or 176x176. ${template.sizeX}x${template.sizeZ} may need pacing retesting.`
    });
  } else if (isThreePlayerSharedCenter && template.sizeX !== 208) {
    diagnostics.push({
      code: "size_recommendation_shared_center",
      severity: "warning",
      message: `Three-player shared-center branches usually need 208x208 for fair lane pressure. ${template.sizeX}x${template.sizeZ} may need pacing retesting.`
    });
  }

  if (template.sizeX < 160 || template.sizeZ < 160) {
    diagnostics.push({
      code: "size_pacing_small_retest",
      severity: "warning",
      message: "Smaller maps create earlier contact and should be retested for guard scaling and objective pressure."
    });
  }
  if (template.sizeX > 176 || template.sizeZ > 176) {
    diagnostics.push({
      code: "size_pacing_large_retest",
      severity: "warning",
      message: "Larger maps can delay pressure and may require objective or reward pacing adjustments."
    });
  }

  return sortDiagnostics(diagnostics);
}

export function recommendGuardRewardScaling(template: RmgTemplate): RmgDiagnostic[] {
  const diagnostics: RmgDiagnostic[] = [];
  const variant = firstVariant(template);
  const zones = variant?.zones ?? [];
  const connections = variant?.connections ?? [];
  const players = detectBattleCityPlayers(zones);
  if (players.length >= 2 && zones.some((zone) => zone.name === "Center")) {
    const n1 = average(players.map((player) => zoneByName(zones, `P${player}-N1`)?.guardWeeklyIncrement));
    const n2 = average(players.map((player) => zoneByName(zones, `P${player}-N2`)?.guardWeeklyIncrement));
    const n3 = average(players.map((player) => zoneByName(zones, `P${player}-N3`)?.guardWeeklyIncrement));
    const center = zoneByName(zones, "Center")?.guardWeeklyIncrement;
    const centerGate = average(players.map((player) => connectionByZones(connections, `P${player}-N3`, "Center")?.guardWeeklyIncrement));

    if (n2 !== undefined && n1 !== undefined && n2 <= n1) {
      diagnostics.push({
        code: "guard_scaling_flat_n2",
        severity: "warning",
        message: `BattleCity branch N2 zones should scale harder over time than N1 zones.`
      });
    }
    if (n3 !== undefined && n2 !== undefined && n3 <= n2) {
      diagnostics.push({
        code: "guard_scaling_flat_n3",
        severity: "warning",
        message: `BattleCity branch N3 zones should scale harder over time than N2 zones.`
      });
    }
    if (center !== undefined && n3 !== undefined && center <= n3) {
      diagnostics.push({
        code: "guard_scaling_flat_center",
        severity: "warning",
        message: `The center should scale harder over time than the branch N3 zones.`
      });
    }
    if (centerGate !== undefined) {
      const earlyGate = average(players.map((player) => connectionByZones(connections, `P${player}-N1`, `P${player}-N2`)?.guardWeeklyIncrement));
      if (earlyGate !== undefined && centerGate <= earlyGate) {
        diagnostics.push({
          code: "guard_scaling_flat_center_gate",
          severity: "warning",
          message: `The N3-to-center gate should scale harder over time than the earlier branch gates.`
        });
      }
    }
  }

  if (usesHighTierRewards(template) && !hasStrongLateGuardScaling(template)) {
    diagnostics.push({
      code: "guard_reward_scaling_low",
      severity: "warning",
      message: "High-tier reward density is elevated, but the late-game guard scaling still looks low."
    });
  }

  return sortDiagnostics(diagnostics);
}

function validateRoadEndpoint(
  zone: Zone,
  endpoint: RoadEndpoint | undefined,
  label: "from" | "to",
  roadIndex: number,
  connectionNames: Set<string>,
  mainObjects: MainObject[],
  localMandatoryContentNames: Set<string>
): RmgDiagnostic[] {
  if (!endpoint) {
    return [{
      code: "road_endpoint_missing",
      severity: "error",
      message: `Zone ${zone.name} road ${roadIndex} is missing its ${label} endpoint.`,
      zoneName: zone.name,
      roadEndpoint: label
    }];
  }

  if (endpoint.type === "Connection") {
    const connectionName = endpoint.args?.[0];
    if (!connectionName || !connectionNames.has(connectionName)) {
      return [{
        code: "road_missing_connection",
        severity: "error",
        message: `Zone ${zone.name} road ${roadIndex} ${label} endpoint references missing connection ${connectionName ?? "<missing>"}.`,
        zoneName: zone.name,
        roadEndpoint: connectionName ?? label
      }];
    }
  }

  if (endpoint.type === "MainObject") {
    const index = Number(endpoint.args?.[0]);
    if (!Number.isInteger(index) || index < 0 || index >= mainObjects.length) {
      return [{
        code: "road_missing_main_object",
        severity: "error",
        message: `Zone ${zone.name} road ${roadIndex} ${label} endpoint references missing main object index ${endpoint.args?.[0] ?? "<missing>"}.`,
        zoneName: zone.name,
        roadEndpoint: endpoint.args?.[0] ?? label
      }];
    }
  }

  if (endpoint.type === "MandatoryContent") {
    const name = endpoint.args?.[0];
    if (!name || !localMandatoryContentNames.has(name)) {
      return [{
        code: "road_missing_mandatory_endpoint",
        severity: "warning",
        message: `Zone ${zone.name} road ${roadIndex} ${label} endpoint references missing mandatory content marker ${name ?? "<missing>"}.`,
        zoneName: zone.name,
        roadEndpoint: name ?? label
      }];
    }
  }

  return [];
}

function firstVariant(template: RmgTemplate): Variant | undefined {
  return template.variants?.[0];
}

function sortDiagnostics(diagnostics: RmgDiagnostic[]): RmgDiagnostic[] {
  const severityOrder: Record<RmgDiagnosticSeverity, number> = { error: 0, warning: 1, info: 2 };
  return [...diagnostics].sort((left, right) =>
    severityOrder[left.severity] - severityOrder[right.severity]
    || left.code.localeCompare(right.code)
    || (left.zoneName ?? "").localeCompare(right.zoneName ?? "")
    || (left.connectionName ?? "").localeCompare(right.connectionName ?? "")
    || left.message.localeCompare(right.message)
  );
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function collectMandatoryContentItemNames(groups: MandatoryContentGroup[]): Set<string> {
  const names = new Set<string>();
  const queue: ContentItem[] = groups.flatMap((group) => group.content ?? []);
  while (queue.length > 0) {
    const item = queue.shift()!;
    if (typeof item.name === "string" && item.name.trim()) names.add(item.name);
    if (Array.isArray(item.content)) queue.push(...item.content);
  }
  return names;
}

function zoneRoadReferencesConnection(zone: Zone | undefined, connectionName: string | undefined): boolean {
  if (!zone || !connectionName) return false;
  return (zone.roads ?? []).some((road) => referencedConnectionNames(road).includes(connectionName));
}

function referencedConnectionNames(road: Road): string[] {
  return [road.from, road.to]
    .filter((endpoint): endpoint is RoadEndpoint => Boolean(endpoint))
    .filter((endpoint) => endpoint.type === "Connection")
    .map((endpoint) => endpoint.args?.[0])
    .filter((name): name is string => Boolean(name));
}

function pairKey(left: string, right: string): string {
  return left < right ? `${left}|${right}` : `${right}|${left}`;
}

function pairKeyForConnectionNames(connections: Connection[], leftName: string, rightName: string): string {
  const left = connections.find((connection) => connection.name === leftName);
  const right = connections.find((connection) => connection.name === rightName);
  if (!left || !right) return `${leftName}|${rightName}`;

  const names = [left.from, left.to, right.from, right.to];
  const shared = names.find((name, index) => names.indexOf(name) !== index);
  if (!shared) return `${leftName}|${rightName}`;
  const endpoints = [left.from, left.to, right.from, right.to].filter((name) => name !== shared);
  if (endpoints.length < 2) return `${leftName}|${rightName}`;
  return pairKey(endpoints[0], endpoints[1]);
}

function detectBattleCityPlayers(zones: Zone[]): string[] {
  return [...new Set(zones
    .map((zone) => /^P(\d+)-N[123]$/.exec(zone.name)?.[1])
    .filter((value): value is string => Boolean(value)))]
    .sort((left, right) => Number(left) - Number(right));
}

function buildBranchSummary(player: string, zones: Zone[], connections: Connection[]): {
  player: string;
  zoneCount: number;
  steps: Array<{
    stepLabel: string;
    zoneName: string;
    mandatoryContentSignature: string;
    rewardSignature: string;
    guardSignature: string;
    connectionSignature: string;
    cityFactionMatchTarget?: string;
  }>;
} {
  const steps = [1, 2, 3].map((step) => {
    const zoneName = `P${player}-N${step}`;
    const zone = zoneByName(zones, zoneName);
    const nextZone = step === 3 ? "Center" : `P${player}-N${step + 1}`;
    const previousZone = step === 1 ? `Spawn-${player}` : `P${player}-N${step - 1}`;
    const previousConnection = connectionByZones(connections, previousZone, zoneName);
    const nextConnection = connectionByZones(connections, zoneName, nextZone);
    const primaryCity = zone?.mainObjects?.find((object) => object.type === "City");
    return {
      stepLabel: `N${step}`,
      zoneName,
      mandatoryContentSignature: JSON.stringify([...(zone?.mandatoryContent ?? [])].sort().map((name) => normalizeBranchReference(name, player))),
      rewardSignature: JSON.stringify({
        guardedContentValue: zone?.guardedContentValue,
        guardedContentValuePerArea: zone?.guardedContentValuePerArea,
        unguardedContentValue: zone?.unguardedContentValue,
        resourcesValue: zone?.resourcesValue
      }),
      guardSignature: JSON.stringify({
        zoneGuardMultiplier: zone?.guardMultiplier,
        zoneGuardWeeklyIncrement: zone?.guardWeeklyIncrement,
        previousGuardValue: previousConnection?.guardValue,
        previousGuardWeeklyIncrement: previousConnection?.guardWeeklyIncrement,
        nextGuardValue: nextConnection?.guardValue,
        nextGuardWeeklyIncrement: nextConnection?.guardWeeklyIncrement
      }),
      connectionSignature: JSON.stringify({
        previous: previousConnection ? { connectionType: previousConnection.connectionType, road: previousConnection.road } : null,
        next: nextConnection ? { connectionType: nextConnection.connectionType, road: nextConnection.road } : null
      }),
      cityFactionMatchTarget: primaryCity?.faction?.type === "Match" ? primaryCity.faction.args?.[1] : undefined
    };
  });

  return { player, zoneCount: steps.filter((step) => zoneByName(zones, step.zoneName)).length, steps };
}

function zoneByName(zones: Zone[], zoneName: string): Zone | undefined {
  return zones.find((zone) => zone.name === zoneName);
}

function connectionByZones(connections: Connection[], left: string, right: string): Connection | undefined {
  return connections.find((connection) => pairKey(connection.from, connection.to) === pairKey(left, right));
}

function average(values: Array<number | undefined>): number | undefined {
  const finite = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (finite.length === 0) return undefined;
  return finite.reduce((sum, value) => sum + value, 0) / finite.length;
}

function usesHighTierRewards(template: RmgTemplate): boolean {
  const pools = [...(template.contentPools ?? []), ...(template.contentLists ?? [])];
  const serializedPools = JSON.stringify(pools);
  if (serializedPools.includes(knownLegendaryPoolEntry)) return true;

  const queue: ContentItem[] = (template.mandatoryContent ?? []).flatMap((group) => group.content ?? []);
  while (queue.length > 0) {
    const item = queue.shift()!;
    if (item.sid === guaranteedLegendarySid) return true;
    if (Array.isArray(item.includeLists) && item.includeLists.includes(knownLegendaryPoolEntry)) return true;
    if (Array.isArray(item.content)) queue.push(...item.content);
  }
  return false;
}

function hasStrongLateGuardScaling(template: RmgTemplate): boolean {
  const zones = firstVariant(template)?.zones ?? [];
  const connections = firstVariant(template)?.connections ?? [];
  const center = zoneByName(zones, "Center");
  const centerGate = connections
    .filter((connection) => connection.from === "Center" || connection.to === "Center")
    .map((connection) => connection.guardWeeklyIncrement)
    .filter((value): value is number => typeof value === "number");
  return (center?.guardWeeklyIncrement ?? 0) >= 0.5 || centerGate.some((value) => value >= 0.6);
}

function normalizeBranchReference(value: string, player: string): string {
  return value
    .replace(new RegExp(`p${player}`, "ig"), "p*")
    .replace(new RegExp(`spawn_${player}`, "ig"), "spawn_*")
    .replace(new RegExp(`spawn-${player}`, "ig"), "spawn-*");
}

function troubleshootingInfo(): RmgDiagnostic {
  return {
    code: "export_troubleshooting",
    severity: "info",
    message: "If logs crash before checksum output, the template likely generated invalid data. If logs reach checksum output first, generation likely succeeded and the failure is probably load or conversion related. Missing icon spam in Player.log is usually noise unless it mentions a custom object."
  };
}
