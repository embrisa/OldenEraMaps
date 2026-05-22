import { centerLayoutName, sideLayoutName, spawnLayoutName, treasureLayoutName } from "@/generator/math";
import type { DesignZone } from "@/design";
import { zoneHints } from "@/zoneHints";
import { formatSidListForDisplay } from "@/displayNames";

export interface ZoneHoverSection {
  title: string;
  items: Array<{ label: string; value: string }>;
}

const layoutLabels = new Map<string, string>([
  [spawnLayoutName, "Spawn"],
  [sideLayoutName, "Side"],
  [treasureLayoutName, "Treasure"],
  [centerLayoutName, "Center"]
]);

export function zoneHoverSections(zone: DesignZone, focusedHintId?: string): ZoneHoverSection[] {
  const hints = zoneHints(zone);
  const focusedHint = hints.find((hint) => hint.id === focusedHintId);
  const highlightItems = focusedHint
    ? [{ label: focusedHint.label, value: focusedHint.detail }]
    : hints.slice(0, 8).map((hint) => ({ label: hint.label, value: hint.detail }));

  return [
    {
      title: focusedHint ? "Hint" : "Highlights",
      items: highlightItems
    },
    {
      title: "Basics",
      items: [
        { label: "ID", value: zone.id },
        { label: "Role", value: `${zone.role} Zone` },
        { label: "Player", value: zone.player === undefined ? "No Player" : `Player ${zone.player}` },
        { label: "Quality", value: `${zone.quality} Quality` },
        { label: "Castles", value: formatCityCount(zone.castleCount, zone.neutralCastlesAsRuins && zone.role === "Neutral") },
        { label: "Size", value: `${formatValue(zone.size)} Size` }
      ]
    },
    {
      title: "Terrain",
      items: [
        { label: "Theme", value: `${zone.terrainTheme} Terrain` },
        { label: "Layout", value: `${layoutLabels.get(zone.layout) ?? zone.layout} Layout` },
        { label: "Crossroads", value: `Crossroads ${formatValue(zone.crossroadsPosition)}` },
        { label: "Zone Biome", value: `Zone Biome ${formatValue(zone.zoneBiome)}` },
        { label: "Content Biome", value: `Content Biome ${formatValue(zone.contentBiome)}` },
        { label: "Meta Objects Biome", value: `Meta Biome ${formatValue(zone.metaObjectsBiome)}` }
      ]
    },
    {
      title: "Guards",
      items: [
        { label: "Strength", value: `${percent(zone.neutralStackStrengthPercent)} Guard Strength` },
        { label: "Randomness", value: `${percent(zone.guardRandomizationPercent)} Randomness` },
        { label: "Cutoff", value: `Cutoff ${formatValue(zone.guardCutoffValue)}` },
        { label: "Multiplier", value: `Multiplier ${formatValue(zone.guardMultiplier)}` },
        { label: "Weekly Increment", value: `Weekly +${formatValue(zone.guardWeeklyIncrement)}` },
        { label: "Diplomacy Modifier", value: `Diplomacy ${formatValue(zone.diplomacyModifier)}` },
        { label: "Reaction Distribution", value: `Reaction ${formatValue(zone.guardReactionDistribution)}` }
      ]
    },
    {
      title: "Rules",
      items: [
        { label: "Roads", value: `Roads ${formatValue(zone.roads)}` },
        { label: "Footholds", value: `Footholds ${formatValue(zone.footholds)}` },
        { label: "Hold City", value: `Hold City ${formatValue(zone.holdCity)}` },
        { label: "Natural Expansion", value: `Natural Expansion ${formatValue(zone.naturalExpansion)}` },
        { label: "Match Adjacent Neutral Castles", value: `Match Adjacent ${formatValue(zone.matchAdjacentNeutralCastleFactions)}` },
        { label: "Neutral Castles as Ruins", value: `Ruins ${formatValue(zone.neutralCastlesAsRuins)}` }
      ]
    },
    {
      title: "Content",
      items: [
        { label: "Resources %", value: `${percent(zone.resourceDensityPercent)} Resources` },
        { label: "Structures %", value: `${percent(zone.structureDensityPercent)} Structures` },
        { label: "Guarded Value", value: `${formatValue(zone.guardedContentValue)} Guarded Value` },
        { label: "Guarded Value / Area", value: `${formatValue(zone.guardedContentValuePerArea)} Guarded / Area` },
        { label: "Unguarded Value", value: `${formatValue(zone.unguardedContentValue)} Unguarded Value` },
        { label: "Unguarded Value / Area", value: `${formatValue(zone.unguardedContentValuePerArea)} Unguarded / Area` },
        { label: "Resources Value", value: `${formatValue(zone.resourcesValue)} Resource Value` },
        { label: "Resources Value / Area", value: `${formatValue(zone.resourcesValuePerArea)} Resources / Area` },
        { label: "Guarded Pool", value: `Guarded: ${formatSidListForDisplay(zone.guardedContentPool)}` },
        { label: "Unguarded Pool", value: `Unguarded: ${formatSidListForDisplay(zone.unguardedContentPool)}` },
        { label: "Resources Pool", value: `Resources: ${formatSidListForDisplay(zone.resourcesContentPool)}` },
        { label: "Count Limits", value: `Presets: ${formatSidListForDisplay(zone.contentCountLimits)}` }
      ]
    }
  ];
}

function formatValue(value: unknown): string {
  if (value === undefined || value === null) return "Default";
  if (typeof value === "boolean") return value ? "Enabled" : "Disabled";
  if (typeof value === "number") return Number.isInteger(value) ? value.toLocaleString() : String(value);
  if (Array.isArray(value)) return value.length ? value.join(", ") : "None";
  if (typeof value === "object") {
    const selector = value as { type?: unknown; args?: unknown };
    if (typeof selector.type === "string" && Array.isArray(selector.args)) {
      return selector.args.length ? `${selector.type}(${selector.args.join(", ")})` : selector.type;
    }
    return JSON.stringify(value);
  }
  return String(value);
}

function percent(value: number): string {
  return `${formatValue(value)}%`;
}

function formatCityCount(count: number, ruins: boolean): string {
  const noun = ruins ? (count === 1 ? "Ruin" : "Ruins") : (count === 1 ? "City" : "Cities");
  return `${count} ${noun}`;
}
