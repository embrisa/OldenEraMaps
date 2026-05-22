import type { GeneratorSettings, NeutralZoneQuality } from "../types.ts";
import { clamp, zoneSuffixes } from "./math.ts";

export type NeutralZoneRole = "Standard" | "Connector";

export interface NeutralZonePlan {
  letter: string;
  quality: NeutralZoneQuality;
  role: NeutralZoneRole;
  castleCount: number;
}

export function buildNeutralZonePlan(settings: GeneratorSettings): NeutralZonePlan[] {
  const plans: NeutralZonePlan[] = [];
  const playerCount = settings.topology === "Triangle" ? 3 : settings.playerCount;
  const maxNeutralZones = Math.max(0, zoneSuffixes.length - playerCount);
  const castleZoneCastleCount = Math.trunc(clamp(settings.zoneCfg.neutralZoneCastles, 1, 4));

  const add = (requestedCount: number, quality: NeutralZoneQuality, castleCount: number) => {
    const count = Math.trunc(clamp(requestedCount, 0, 30));
    for (let i = 0; i < count && plans.length < maxNeutralZones; i++) {
      plans.push({ letter: zoneSuffixes[playerCount + plans.length], quality, role: "Standard", castleCount });
    }
  };

  if (settings.zoneCfg.advanced.enabled) {
    add(settings.zoneCfg.advanced.neutralLowNoCastleCount, "Low", 0);
    add(settings.zoneCfg.advanced.neutralLowCastleCount, "Low", castleZoneCastleCount);
    add(settings.zoneCfg.advanced.neutralMediumNoCastleCount, "Medium", 0);
    add(settings.zoneCfg.advanced.neutralMediumCastleCount, "Medium", castleZoneCastleCount);
    add(settings.zoneCfg.advanced.neutralHighNoCastleCount, "High", 0);
    add(settings.zoneCfg.advanced.neutralHighCastleCount, "High", castleZoneCastleCount);
  } else {
    add(settings.zoneCfg.neutralZoneCount, "Medium", Math.trunc(clamp(settings.zoneCfg.neutralZoneCastles, 0, 4)));
  }

  if ((settings.topology === "SharedWeb" || settings.topology === "Ladder") && plans.length === 0 && maxNeutralZones > 0) {
    plans.push({ letter: zoneSuffixes[playerCount], quality: "Medium", role: "Standard", castleCount: Math.trunc(clamp(settings.zoneCfg.neutralZoneCastles, 0, 4)) });
  }

  if (settings.topology === "Triangle") {
    plans.length = 0;
    if (!settings.naturalExpansionZone) {
      for (let i = 0; i < Math.min(3, maxNeutralZones); i++) {
        plans.push({ letter: zoneSuffixes[playerCount + i], quality: "High", role: "Standard", castleCount: 1 });
      }
    }
  }

  return plans;
}

export function assignNeutralZoneRoles(settings: GeneratorSettings, playerLetters: string[], neutralZones: NeutralZonePlan[]): NeutralZonePlan[] {
  if (neutralZones.length === 0 || settings.minNeutralZonesBetweenPlayers <= 0) return neutralZones;
  if (settings.topology !== "Default" && settings.topology !== "Chain") return neutralZones;
  if (settings.zoneCfg.advanced.enabled) return neutralZones;
  if (neutralZones.some((zone) => zone.quality !== "Medium")) return neutralZones;

  const orderedLetters = buildOrderedLetters(settings, playerLetters, neutralZones, settings.topology === "Default");
  const connectorLetters = settings.topology === "Default"
    ? collectRingConnectorLetters(playerLetters, orderedLetters)
    : collectChainConnectorLetters(playerLetters, orderedLetters);

  if (connectorLetters.size === 0) return neutralZones;
  return neutralZones.map((zone) => connectorLetters.has(zone.letter) ? { ...zone, role: "Connector" } : zone);
}

export function canHonorNeutralSeparation(settings: GeneratorSettings, neutralZoneCount: number): boolean {
  const min = settings.minNeutralZonesBetweenPlayers;
  if (min <= 0) return true;
  if (settings.randomPortals) return false;
  switch (settings.topology) {
    case "Default": return neutralZoneCount >= settings.playerCount * min;
    case "Chain": return neutralZoneCount >= (settings.playerCount - 1) * min;
    case "HubAndSpoke": return min <= 1;
    case "SharedWeb":
    case "Ladder": return min <= 1 && neutralZoneCount >= 1;
    case "Triangle": return min <= 1 && neutralZoneCount >= 3;
    default: return false;
  }
}

export function buildOrderedLetters(settings: GeneratorSettings, playerLetters: string[], neutralZones: NeutralZonePlan[], isRing: boolean): string[] {
  const neutralLetters = neutralZones.map((zone) => zone.letter);
  if (settings.experimentalBalancedZonePlacement) {
    const honored = settings.minNeutralZonesBetweenPlayers > 0 && canHonorNeutralSeparation(settings, neutralLetters.length)
      ? settings.minNeutralZonesBetweenPlayers
      : 0;
    return isRing ? buildBalancedRingLetters(playerLetters, neutralZones, honored) : buildBalancedChainLetters(playerLetters, neutralZones, honored);
  }
  const min = settings.minNeutralZonesBetweenPlayers;
  if (min <= 0 || settings.randomPortals || !canHonorNeutralSeparation(settings, neutralLetters.length)) {
    return [...playerLetters, ...neutralLetters];
  }

  const ordered: string[] = [];
  const remaining = [...neutralLetters];
  for (let i = 0; i < playerLetters.length; i++) {
    ordered.push(playerLetters[i]);
    if (!(isRing || i < playerLetters.length - 1)) continue;
    for (let j = 0; j < min && remaining.length > 0; j++) ordered.push(remaining.shift()!);
  }
  ordered.push(...remaining);
  return ordered.length > 0 ? ordered : [...playerLetters, ...neutralLetters];
}

export function buildBalancedRingLetters(playerLetters: string[], neutralZones: NeutralZonePlan[], minNeutralZonesBetweenPlayers: number): string[] {
  if (playerLetters.length === 0) return buildBalancedNeutralRing(neutralZones, 1);
  if (neutralZones.length === 0) return [...playerLetters];
  const gaps = assignNeutralZonesToGaps(neutralZones, buildEvenGapCapacities(playerLetters.length, neutralZones.length, minNeutralZonesBetweenPlayers), false);
  return playerLetters.flatMap((letter, i) => [letter, ...orderNeutralsWithinGap(gaps[i]).map((zone) => zone.letter)]);
}

export function buildBalancedChainLetters(playerLetters: string[], neutralZones: NeutralZonePlan[], minNeutralZonesBetweenPlayers: number): string[] {
  if (playerLetters.length === 0) return neutralZones.map((zone) => zone.letter);
  const gapCount = playerLetters.length + 1;
  const capacities = Array<number>(gapCount).fill(0);
  let remaining = neutralZones.length;
  const requiredInterior = Math.max(0, playerLetters.length - 1) * minNeutralZonesBetweenPlayers;
  if (minNeutralZonesBetweenPlayers > 0 && neutralZones.length >= requiredInterior) {
    for (let i = 1; i < gapCount - 1; i++) capacities[i] = minNeutralZonesBetweenPlayers;
    remaining -= requiredInterior;
  }
  const extras = buildEvenGapCapacities(gapCount, remaining, 0);
  for (let i = 0; i < gapCount; i++) capacities[i] += extras[i];
  const gaps = assignNeutralZonesToGaps(neutralZones, capacities, true);
  const ordered = orderEdgeGap(gaps[0], true).map((zone) => zone.letter);
  for (let i = 0; i < playerLetters.length; i++) {
    ordered.push(playerLetters[i]);
    const gap = gaps[i + 1];
    ordered.push(...(i === playerLetters.length - 1 ? orderEdgeGap(gap, false) : orderNeutralsWithinGap(gap)).map((zone) => zone.letter));
  }
  return ordered.length > 0 ? ordered : [...playerLetters, ...neutralZones.map((zone) => zone.letter)];
}

export function buildBalancedNeutralRing(neutralZones: NeutralZonePlan[], playerCount: number): string[] {
  if (neutralZones.length <= 1) return neutralZones.map((zone) => zone.letter);
  const gaps = assignNeutralZonesToGaps(neutralZones, buildEvenGapCapacities(Math.max(1, playerCount), neutralZones.length, 0), false);
  return gaps.flatMap((gap) => orderNeutralsWithinGap(gap).map((zone) => zone.letter));
}

function buildEvenGapCapacities(gapCount: number, itemCount: number, minimumPerGap: number): number[] {
  const capacities = Array<number>(Math.max(0, gapCount)).fill(0);
  if (gapCount <= 0 || itemCount <= 0) return capacities;
  let remaining = itemCount;
  const reserved = Math.max(0, minimumPerGap) * gapCount;
  if (minimumPerGap > 0 && itemCount >= reserved) {
    capacities.fill(minimumPerGap);
    remaining -= reserved;
  }
  for (let i = 0; i < remaining; i++) {
    capacities[Math.trunc(clamp(Math.floor((i + 0.5) * gapCount / remaining), 0, gapCount - 1))]++;
  }
  return capacities;
}

function assignNeutralZonesToGaps(neutralZones: NeutralZonePlan[], gapCapacities: number[], preferInteriorGaps: boolean): NeutralZonePlan[][] {
  const gaps = gapCapacities.map(() => [] as NeutralZonePlan[]);
  const loads = gapCapacities.map(() => 0);
  const groups = new Map<number, NeutralZonePlan[]>();
  for (const zone of neutralZones) groups.set(neutralZoneBalanceScore(zone), [...(groups.get(neutralZoneBalanceScore(zone)) ?? []), zone]);
  for (const [score, groupZones] of [...groups.entries()].sort((a, b) => b[0] - a[0])) {
    void score;
    const sorted = groupZones.sort((a, b) => a.letter.localeCompare(b.letter));
    for (let groupIndex = 0; groupIndex < sorted.length; groupIndex++) {
      let candidates = gapCapacities.map((_, i) => i).filter((i) => gaps[i].length < gapCapacities[i]);
      if (candidates.length === 0) return gaps;
      if (preferInteriorGaps) {
        const interior = candidates.filter((i) => i > 0 && i < gapCapacities.length - 1);
        if (interior.length > 0) candidates = interior;
      }
      const preferred = candidates[Math.trunc(clamp(Math.floor((groupIndex + 0.5) * candidates.length / Math.max(1, sorted.length)), 0, candidates.length - 1))];
      const selected = candidates.sort((a, b) =>
        gapDistance(a, preferred, gapCapacities.length, preferInteriorGaps) - gapDistance(b, preferred, gapCapacities.length, preferInteriorGaps)
        || loads[a] - loads[b]
        || gaps[a].length - gaps[b].length
        || a - b)[0];
      gaps[selected].push(sorted[groupIndex]);
      loads[selected] += neutralZoneBalanceScore(sorted[groupIndex]);
    }
  }
  return gaps;
}

function orderNeutralsWithinGap(neutralZones: NeutralZonePlan[]): NeutralZonePlan[] {
  if (neutralZones.length <= 1) return [...neutralZones];
  const sorted = [...neutralZones].sort((a, b) => neutralZoneBalanceScore(b) - neutralZoneBalanceScore(a) || a.letter.localeCompare(b.letter));
  const slots = Array<NeutralZonePlan>(neutralZones.length);
  const positions = [...Array(slots.length).keys()].sort((a, b) => Math.abs(a - (slots.length - 1) / 2) - Math.abs(b - (slots.length - 1) / 2) || a - b);
  sorted.forEach((zone, i) => { slots[positions[i]] = zone; });
  return slots;
}

function orderEdgeGap(neutralZones: NeutralZonePlan[], highQualityNearPlayer: boolean): NeutralZonePlan[] {
  const ordered = [...neutralZones].sort((a, b) => neutralZoneBalanceScore(a) - neutralZoneBalanceScore(b) || a.letter.localeCompare(b.letter));
  return highQualityNearPlayer ? ordered : ordered.reverse();
}

export function neutralZoneBalanceScore(zone: NeutralZonePlan): number {
  const quality = zone.quality === "High" ? 3 : zone.quality === "Medium" ? 2 : 1;
  return quality + Math.min(zone.castleCount, 4) * 0.15;
}

function collectRingConnectorLetters(playerLetters: string[], orderedLetters: string[]): Set<string> {
  const playerIndexes = orderedLetters.flatMap((letter, index) => playerLetters.includes(letter) ? [index] : []);
  const connectorLetters = new Set<string>();
  if (playerIndexes.length <= 1) return connectorLetters;

  for (let i = 0; i < playerIndexes.length; i++) {
    const start = playerIndexes[i];
    const end = playerIndexes[(i + 1) % playerIndexes.length];
    const gap: string[] = [];
    for (let cursor = (start + 1) % orderedLetters.length; cursor !== end; cursor = (cursor + 1) % orderedLetters.length) {
      const letter = orderedLetters[cursor];
      if (!playerLetters.includes(letter)) gap.push(letter);
    }
    const connector = selectGapConnectorLetter(gap);
    if (connector) connectorLetters.add(connector);
  }

  return connectorLetters;
}

function collectChainConnectorLetters(playerLetters: string[], orderedLetters: string[]): Set<string> {
  const playerIndexes = orderedLetters.flatMap((letter, index) => playerLetters.includes(letter) ? [index] : []);
  const connectorLetters = new Set<string>();
  if (playerIndexes.length <= 1) return connectorLetters;

  for (let i = 0; i < playerIndexes.length - 1; i++) {
    const gap = orderedLetters.slice(playerIndexes[i] + 1, playerIndexes[i + 1]).filter((letter) => !playerLetters.includes(letter));
    const connector = selectGapConnectorLetter(gap);
    if (connector) connectorLetters.add(connector);
  }

  return connectorLetters;
}

function selectGapConnectorLetter(gapLetters: string[]): string | undefined {
  if (gapLetters.length === 0) return undefined;
  return gapLetters[Math.floor((gapLetters.length - 1) / 2)];
}

function gapDistance(gap: number, preferredGap: number, gapCount: number, linear: boolean): number {
  const distance = Math.abs(gap - preferredGap);
  return linear || gapCount <= 1 ? distance : Math.min(distance, gapCount - distance);
}

export function ladderNeutralIndexes(playerIndex: number, playerCount: number, neutralCount: number): number[] {
  if (neutralCount <= 0) return [];
  if (playerCount <= 1) return [0];
  const position = playerIndex * (neutralCount - 1) / (playerCount - 1);
  const left = Math.floor(position);
  const right = Math.ceil(position);
  return left === right ? [left] : [left, right];
}
