import type { GeneratorSettings } from "../types.ts";

export const zoneSuffixes = Array.from({ length: 32 }, (_, index) => String(index + 1));

export function compareZoneSuffixes(left: string, right: string): number {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (Number.isInteger(leftNumber) && Number.isInteger(rightNumber)) return leftNumber - rightNumber;
  return left.localeCompare(right);
}

export function zoneSuffixPair(left: string, right: string): string {
  return compareZoneSuffixes(left, right) <= 0 ? `${left}-${right}` : `${right}-${left}`;
}

export const spawnLayoutName = "zone_layout_spawns";
export const sideLayoutName = "zone_layout_sides";
export const treasureLayoutName = "zone_layout_treasure_zone";
export const centerLayoutName = "zone_layout_center";
export const defaultGuardRandomization = 0.05;

export interface GenerationTuning {
  contentScale: number;
  resourceDensityMultiplier: number;
  structureDensityMultiplier: number;
  neutralStackStrengthMultiplier: number;
  borderGuardStrengthMultiplier: number;
  guardRandomization: number;
}

export interface RandomSource {
  next(): number;
  nextInt(maxExclusive?: number): number;
  nextDouble(): number;
}

export function createRng(seed?: number): RandomSource {
  let state = (seed ?? Date.now()) >>> 0;
  return {
    next() {
      state = (1664525 * state + 1013904223) >>> 0;
      return state;
    },
    nextInt(maxExclusive = 2147483647) {
      return Math.floor(this.nextDouble() * maxExclusive);
    },
    nextDouble() {
      return this.next() / 0x100000000;
    }
  };
}

export function byRandom<T>(items: T[], rng: RandomSource): T[] {
  return [...items].map((item) => ({ item, key: rng.nextInt() })).sort((a, b) => a.key - b.key).map(({ item }) => item);
}

export function scaleValue(value: number, multiplier: number): number {
  return Math.max(0, Math.trunc(value * multiplier));
}

export function scaleStructureValue(value: number, tuning: GenerationTuning): number {
  return scaleValue(value, tuning.structureDensityMultiplier);
}

export function scaleResourceValue(value: number, tuning: GenerationTuning): number {
  return scaleValue(value, tuning.resourceDensityMultiplier);
}

export function scaleNeutralGuardValue(value: number, tuning: GenerationTuning): number {
  return scaleValue(value, tuning.neutralStackStrengthMultiplier);
}

export function scaleBorderGuardValue(value: number, tuning: GenerationTuning): number {
  return scaleValue(value, tuning.borderGuardStrengthMultiplier);
}

export function scaleGuardMultiplier(value: number, tuning: GenerationTuning): number {
  return roundAway(value * tuning.neutralStackStrengthMultiplier, 3);
}

export function effectiveGuardRandomization(settings: GeneratorSettings): number {
  if (!settings.zoneCfg.advanced.enabled) return defaultGuardRandomization;
  const value = settings.zoneCfg.advanced.guardRandomization;
  if (!Number.isFinite(value)) return defaultGuardRandomization;
  return roundAway(clamp(value, 0, 0.5), 3);
}

export function computeContentScale(mapWidth: number, mapHeight: number, totalZones: number): number {
  const referenceArea = (160 * 160) / 4;
  const zoneArea = (mapWidth * mapHeight) / Math.max(1, totalZones);
  return clamp(Math.sqrt(zoneArea / referenceArea), 0.5, 2.5);
}

export function normalizeZoneSize(zoneSize: number): number {
  if (!Number.isFinite(zoneSize)) return 1;
  return roundAway(clamp(zoneSize, 0.1, 2), 2);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function roundAway(value: number, decimals = 0): number {
  const factor = 10 ** decimals;
  const scaled = value * factor;
  const rounded = scaled < 0 ? Math.ceil(scaled - 0.5) : Math.floor(scaled + 0.5);
  return rounded / factor;
}

