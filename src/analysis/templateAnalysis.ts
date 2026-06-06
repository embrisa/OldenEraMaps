import type { Connection, MainObject, RmgTemplate, Zone } from "../types";

export type TemplateAnalysisFindingSeverity = "warning" | "positive" | "info";
export type TemplateAnalysisZoneRole = "Player" | "Neutral castle" | "Hub" | "Neutral";

export interface TemplateAnalysisFinding {
  severity: TemplateAnalysisFindingSeverity;
  message: string;
}

export interface PlayerStartMetrics {
  player: string;
  zoneName: string;
  startWealth: number;
  expansionValue: number;
  nearestOpponentDistance: number | null;
  neutralCastleDistance: number | null;
}

export interface TemplateContentSummary {
  zoneCount: number;
  playerZoneCount: number;
  neutralZoneCount: number;
  neutralCastleZoneCount: number;
  connectionCount: number;
  totalTreasure: number;
  totalResources: number;
}

export interface TemplateAnalysisZoneRow {
  zoneName: string;
  role: TemplateAnalysisZoneRole;
  degree: number;
  treasure: number;
  resources: number;
}

export interface TemplateAnalysis {
  balanceApplicable: boolean;
  balanceScore: number | null;
  balanceInapplicableReason?: string;
  playerStarts: PlayerStartMetrics[];
  findings: TemplateAnalysisFinding[];
  summary: TemplateContentSummary;
  zoneRows: TemplateAnalysisZoneRow[];
}

interface ZoneInfo {
  zone: Zone;
  role: TemplateAnalysisZoneRole;
  degree: number;
  treasure: number;
  resources: number;
}

interface SpawnInfo {
  zone: Zone;
  player: string;
}

const warningSpreadThreshold = 0.12;
const castleHopSpreadThreshold = 2;
const wellBalancedScoreThreshold = 90;

export function analyzeTemplate(template: RmgTemplate): TemplateAnalysis {
  const variant = template.variants?.[0];
  const zones = Array.isArray(variant?.zones) ? variant.zones : [];
  const connections = Array.isArray(variant?.connections) ? variant.connections : [];
  const graph = buildGraph(zones, connections);
  const zoneInfos = zones.map((zone) => toZoneInfo(zone, graph.get(zone.name)?.size ?? 0));
  const spawns = zones.flatMap((zone) => spawnObjects(zone).map((spawn) => ({ zone, player: spawn.spawn?.trim() || zone.name })));
  const neutralCastleZones = zones.filter((zone) => spawnObjects(zone).length === 0 && cityObjects(zone).length > 0);
  const playerStarts = spawns.map((spawn) => buildPlayerStartMetrics(spawn, spawns, zoneInfos, neutralCastleZones, graph));
  const summary = summarize(zoneInfos, connections.length);
  const balanceApplicability = getBalanceApplicability(spawns, zones);
  const findings: TemplateAnalysisFinding[] = [];
  let balanceScore: number | null = null;

  if (!balanceApplicability.applicable) {
    findings.push({ severity: "info", message: balanceApplicability.reason });
  } else {
    balanceScore = scoreBalance(playerStarts);
    findings.push(...balanceFindings(playerStarts, balanceScore, neutralCastleZones.length));
  }

  return {
    balanceApplicable: balanceApplicability.applicable,
    balanceScore,
    balanceInapplicableReason: balanceApplicability.applicable ? undefined : balanceApplicability.reason,
    playerStarts,
    findings: orderFindings(findings),
    summary,
    zoneRows: zoneInfos.map((info) => ({
      zoneName: info.zone.name,
      role: info.role,
      degree: info.degree,
      treasure: info.treasure,
      resources: info.resources
    }))
  };
}

function buildPlayerStartMetrics(spawn: SpawnInfo, spawns: SpawnInfo[], zoneInfos: ZoneInfo[], neutralCastleZones: Zone[], graph: Map<string, Set<string>>): PlayerStartMetrics {
  const distances = shortestDistances(spawn.zone.name, graph);
  const startWealth = zoneWealth(spawn.zone);
  const expansionValue = zoneInfos
    .filter((info) => info.role !== "Player")
    .reduce((total, info) => {
      const distance = distances.get(info.zone.name);
      if (distance === undefined || distance <= 0) return total;
      return total + zoneWealth(info.zone) / distance;
    }, 0);
  const nearestOpponentDistance = minFinite(spawns
    .filter((candidate) => candidate.zone.name !== spawn.zone.name)
    .map((candidate) => distances.get(candidate.zone.name)));
  const neutralCastleDistance = minFinite(neutralCastleZones.map((zone) => distances.get(zone.name)));

  return {
    player: playerLabel(spawn.player),
    zoneName: spawn.zone.name,
    startWealth,
    expansionValue,
    nearestOpponentDistance,
    neutralCastleDistance
  };
}

function scoreBalance(playerStarts: PlayerStartMetrics[]): number {
  const startWealthScore = equalityScore(playerStarts.map((start) => start.startWealth));
  const expansionScore = equalityScore(playerStarts.map((start) => start.expansionValue));
  const opponentDistanceScore = equalityScore(playerStarts.map((start) => start.nearestOpponentDistance));
  return Math.round(startWealthScore * 0.45 + expansionScore * 0.35 + opponentDistanceScore * 0.2);
}

function balanceFindings(playerStarts: PlayerStartMetrics[], balanceScore: number, neutralCastleZoneCount: number): TemplateAnalysisFinding[] {
  const findings: TemplateAnalysisFinding[] = [];
  const poorerStarts = spreadFindingTargets(playerStarts, (start) => start.startWealth);

  if (poorerStarts.spread >= warningSpreadThreshold && poorerStarts.targets.length > 0) {
    findings.push({
      severity: "warning",
      message: `${poorerStarts.targets.join(", ")} ${poorerStarts.targets.length === 1 ? "has" : "have"} a poorer start economy than the richest start.`
    });
  }

  if (neutralCastleZoneCount > 0) {
    const unreachable = playerStarts.filter((start) => start.neutralCastleDistance === null);
    const reachableDistances = playerStarts.map((start) => start.neutralCastleDistance).filter((value): value is number => typeof value === "number");
    const castleDistanceSpread = reachableDistances.length > 1 ? Math.max(...reachableDistances) - Math.min(...reachableDistances) : 0;
    if (unreachable.length > 0) {
      findings.push({
        severity: "warning",
        message: `${unreachable.map((start) => start.player).join(", ")} cannot reach a neutral city through the template graph.`
      });
    } else if (castleDistanceSpread >= castleHopSpreadThreshold) {
      findings.push({
        severity: "warning",
        message: `Neutral city access is uneven by ${castleDistanceSpread} connection hops.`
      });
    }
  }

  if (playerStarts.length >= 3) {
    const closeStarts = playerStarts.filter((start) => start.nearestOpponentDistance !== null && start.nearestOpponentDistance <= 1);
    if (closeStarts.length > 0) {
      findings.push({
        severity: "warning",
        message: `${closeStarts.map((start) => start.player).join(", ")} ${closeStarts.length === 1 ? "starts" : "start"} within one hop of an opponent.`
      });
    }
  }

  if (balanceScore >= wellBalancedScoreThreshold && findings.length === 0) {
    findings.push({ severity: "positive", message: "The player starts look well balanced by template-level metrics." });
  }

  return findings;
}

function toZoneInfo(zone: Zone, degree: number): ZoneInfo {
  return {
    zone,
    role: classifyZone(zone),
    degree,
    treasure: zoneTreasure(zone),
    resources: numeric(zone.resourcesValue)
  };
}

function classifyZone(zone: Zone): TemplateAnalysisZoneRole {
  if (spawnObjects(zone).length > 0) return "Player";

  const name = zone.name.toLowerCase();
  const layout = typeof zone.layout === "string" ? zone.layout.toLowerCase() : "";
  const role = typeof zone.role === "string" ? zone.role.toLowerCase() : "";
  if (name.includes("hub") || layout.includes("center") || layout.includes("hub") || role === "hub") return "Hub";
  if (cityObjects(zone).length > 0) return "Neutral castle";

  return "Neutral";
}

function summarize(zoneInfos: ZoneInfo[], connectionCount: number): TemplateContentSummary {
  return {
    zoneCount: zoneInfos.length,
    playerZoneCount: zoneInfos.filter((info) => info.role === "Player").length,
    neutralZoneCount: zoneInfos.filter((info) => info.role === "Neutral").length,
    neutralCastleZoneCount: zoneInfos.filter((info) => spawnObjects(info.zone).length === 0 && cityObjects(info.zone).length > 0).length,
    connectionCount,
    totalTreasure: zoneInfos.reduce((total, info) => total + info.treasure, 0),
    totalResources: zoneInfos.reduce((total, info) => total + info.resources, 0)
  };
}

function getBalanceApplicability(spawns: SpawnInfo[], zones: Zone[]): { applicable: true } | { applicable: false; reason: string } {
  if (zones.length === 0) return { applicable: false, reason: "Balance analysis needs at least one template variant with zones." };
  if (spawns.length < 2) return { applicable: false, reason: "Balance score needs at least two player spawn zones." };
  return { applicable: true };
}

function buildGraph(zones: Zone[], connections: Connection[]): Map<string, Set<string>> {
  const graph = new Map(zones.map((zone) => [zone.name, new Set<string>()]));
  for (const connection of connections) {
    if (!graph.has(connection.from) || !graph.has(connection.to)) continue;
    graph.get(connection.from)?.add(connection.to);
    graph.get(connection.to)?.add(connection.from);
  }
  return graph;
}

function shortestDistances(start: string, graph: Map<string, Set<string>>): Map<string, number> {
  const distances = new Map<string, number>();
  if (!graph.has(start)) return distances;

  const queue = [start];
  distances.set(start, 0);
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    const distance = distances.get(current) ?? 0;
    for (const next of graph.get(current) ?? []) {
      if (distances.has(next)) continue;
      distances.set(next, distance + 1);
      queue.push(next);
    }
  }
  return distances;
}

function equalityScore(values: Array<number | null | undefined>): number {
  const finite = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (finite.length !== values.length) return 0;
  if (finite.length <= 1) return 100;

  const max = Math.max(...finite);
  const min = Math.min(...finite);
  if (max <= 0) return min >= 0 ? 100 : 0;
  return clamp((min / max) * 100, 0, 100);
}

function spreadFindingTargets(playerStarts: PlayerStartMetrics[], value: (start: PlayerStartMetrics) => number): { spread: number; targets: string[] } {
  if (playerStarts.length <= 1) return { spread: 0, targets: [] };
  const values = playerStarts.map((start) => value(start)).filter((candidate) => Number.isFinite(candidate));
  if (values.length !== playerStarts.length || values.length === 0) return { spread: 0, targets: [] };
  const max = Math.max(...values);
  const min = Math.min(...values);
  if (max <= 0) return { spread: 0, targets: [] };
  return {
    spread: (max - min) / max,
    targets: playerStarts.filter((start) => value(start) === min).map((start) => start.player)
  };
}

function orderFindings(findings: TemplateAnalysisFinding[]): TemplateAnalysisFinding[] {
  const rank = { warning: 0, positive: 1, info: 2 } satisfies Record<TemplateAnalysisFindingSeverity, number>;
  return [...findings].sort((left, right) => rank[left.severity] - rank[right.severity]);
}

function minFinite(values: Array<number | undefined>): number | null {
  const finite = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return finite.length > 0 ? Math.min(...finite) : null;
}

function zoneWealth(zone: Zone): number {
  return zoneTreasure(zone) + numeric(zone.resourcesValue);
}

function zoneTreasure(zone: Zone): number {
  return numeric(zone.guardedContentValue) + numeric(zone.unguardedContentValue);
}

function spawnObjects(zone: Zone): MainObject[] {
  return (zone.mainObjects ?? []).filter((object) => object.type === "Spawn");
}

function cityObjects(zone: Zone): MainObject[] {
  return (zone.mainObjects ?? []).filter((object) => object.type === "City");
}

function numeric(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function playerLabel(player: string): string {
  const match = /^Player\s*(\d+)$/i.exec(player);
  return match ? `Player ${match[1]}` : player;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
