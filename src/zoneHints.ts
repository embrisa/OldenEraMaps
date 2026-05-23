import type { DesignZone } from "./design";

export type ZoneHintTone = "muted" | "info" | "success" | "warning" | "danger" | "treasure";

export interface ZoneHint {
  id: string;
  icon: string;
  label: string;
  detail: string;
  tone: ZoneHintTone;
}

export interface ZoneHintStyle {
  border: string;
  glow: string;
}

export type ZoneBoardMarkerKind = "dot" | "ring" | "diamond" | "slash" | "square";

export interface ZoneBoardMarker {
  hint: ZoneHint;
  kind: ZoneBoardMarkerKind;
}

const BOARD_MARKER_LIMIT = 3;

const BOARD_MARKER_PRIORITY: Record<string, number> = {
  "hold-city": 120,
  ruins: 110,
  "natural-expansion": 100,
  guards: 90,
  "no-roads": 60,
  "no-footholds": 50,
};

const hintColors: Record<ZoneHintTone, { fill: string; stroke: string; text: string }> = {
  muted: { fill: "rgba(74, 88, 105, 0.92)", stroke: "rgba(175, 190, 205, 0.5)", text: "#e5edf6" },
  info: { fill: "rgba(63, 96, 132, 0.94)", stroke: "rgba(133, 180, 224, 0.66)", text: "#e8f3ff" },
  success: { fill: "rgba(73, 112, 78, 0.94)", stroke: "rgba(151, 206, 136, 0.66)", text: "#ecffe8" },
  warning: { fill: "rgba(134, 94, 47, 0.94)", stroke: "rgba(228, 173, 92, 0.74)", text: "#fff2d5" },
  danger: { fill: "rgba(132, 62, 57, 0.95)", stroke: "rgba(224, 124, 111, 0.76)", text: "#fff0ee" },
  treasure: { fill: "rgba(132, 105, 39, 0.96)", stroke: "rgba(236, 202, 111, 0.78)", text: "#fff4cf" },
};

export function zoneHints(zone: DesignZone): ZoneHint[] {
  const hints: ZoneHint[] = [
    sizeHint(zone),
    guardHint(zone),
    resourceHint(zone),
    structureHint(zone),
  ];

  if (zone.castleCount > 0) {
    if (zone.neutralCastlesAsRuins && zone.role === "Neutral") {
      hints.push({
        id: "ruins",
        icon: "🏚",
        label: "Neutral ruins",
        detail: `${zone.castleCount} ${plural(zone.castleCount, "neutral ruin", "neutral ruins")}.`,
        tone: "warning",
      });
    } else {
      hints.push({
        id: "cities",
        icon: "🏘",
        label: "Cities",
        detail: `${zone.castleCount} ${plural(zone.castleCount, "city", "cities")}.`,
        tone: zone.castleCount >= 2 ? "treasure" : "info",
      });
    }
  }

  if (zone.holdCity) {
    hints.push({ id: "hold-city", icon: "🏰", label: "Hold city", detail: "This zone is marked as the City Hold objective.", tone: "treasure" });
  }
  if (zone.naturalExpansion) {
    hints.push({ id: "natural-expansion", icon: "🌱", label: "Natural expansion", detail: "Neutral city faction can match an adjacent spawn.", tone: "success" });
  }
  if (!zone.roads) {
    hints.push({ id: "no-roads", icon: "🚫", label: "No roads", detail: "Road generation is disabled inside this zone.", tone: "warning" });
  }
  if (!zone.footholds) {
    hints.push({ id: "no-footholds", icon: "⛔", label: "No footholds", detail: "Remote foothold content is disabled for this zone.", tone: "muted" });
  }
  if (hasBiomeOverride(zone)) {
    hints.push({ id: "biome", icon: "🌿", label: "Biome override", detail: "One or more biome selectors are customized.", tone: "info" });
  }

  return hints;
}

/** Compact schematic markers: only notable deviations from defaults (full detail stays in hover). */
export function zoneBoardMarkers(zone: DesignZone): ZoneBoardMarker[] {
  return zoneHints(zone)
    .filter((hint) => isNotableBoardHint(hint))
    .sort((left, right) => (BOARD_MARKER_PRIORITY[right.id] ?? 0) - (BOARD_MARKER_PRIORITY[left.id] ?? 0))
    .slice(0, BOARD_MARKER_LIMIT)
    .map((hint) => ({ hint, kind: boardMarkerKindForHint(hint) }));
}

export function zoneHintColors(tone: ZoneHintTone): { fill: string; stroke: string; text: string } {
  return hintColors[tone];
}

export function zoneBoardMarkerColors(tone: ZoneHintTone): { fill: string; stroke: string } {
  const colors = hintColors[tone];
  return { fill: colors.text, stroke: colors.stroke };
}

export function zoneHintStyle(zone: DesignZone): ZoneHintStyle {
  const hints = zoneHints(zone);
  const guard = hints.find((hint) => hint.id === "guards");
  const resources = hints.find((hint) => hint.id === "resources");
  const holdCity = hints.find((hint) => hint.id === "hold-city");

  if (guard?.tone === "danger") return { border: "#ff8877", glow: "rgba(255, 136, 119, 0.42)" };
  if (guard?.tone === "warning") return { border: "#ffc46b", glow: "rgba(255, 196, 107, 0.38)" };
  if (guard?.tone === "success") return { border: "#8fdb85", glow: "rgba(143, 219, 133, 0.34)" };
  if (guard?.tone === "info") return { border: "#8dbde8", glow: "rgba(141, 189, 232, 0.28)" };
  if (holdCity) return { border: "#ead072", glow: "rgba(234, 208, 114, 0.28)" };
  if (resources?.tone === "treasure") return { border: "#d9bd68", glow: "rgba(217, 189, 104, 0.24)" };
  if (zone.size >= 1.25) return { border: "#83b7db", glow: "rgba(131, 183, 219, 0.2)" };
  if (zone.size <= 0.75) return { border: "#9cb0c4", glow: "rgba(156, 176, 196, 0.18)" };
  return { border: "rgba(150, 174, 199, 0.46)", glow: "rgba(118, 146, 176, 0.18)" };
}

function isNotableBoardHint(hint: ZoneHint): boolean {
  switch (hint.id) {
    case "guards":
      return hint.tone === "warning" || hint.tone === "danger";
    case "cities":
      return false;
    case "ruins":
    case "hold-city":
    case "natural-expansion":
    case "no-roads":
    case "no-footholds":
      return true;
    default:
      return false;
  }
}

function boardMarkerKindForHint(hint: ZoneHint): ZoneBoardMarkerKind {
  if (hint.id === "hold-city" || hint.id === "natural-expansion") return "diamond";
  if (hint.id === "ruins") return "square";
  if (hint.id === "no-roads" || hint.id === "no-footholds") return "slash";
  if (hint.tone === "danger" || hint.tone === "warning") return "ring";
  return "dot";
}

function sizeHint(zone: DesignZone): ZoneHint {
  if (zone.size <= 0.75) {
    return { id: "size", icon: "📏", label: "Compact", detail: `Small zone footprint (${formatNumber(zone.size)}x).`, tone: "muted" };
  }
  if (zone.size >= 1.25) {
    return { id: "size", icon: "📏", label: "Large", detail: `Large zone footprint (${formatNumber(zone.size)}x).`, tone: "info" };
  }
  return { id: "size", icon: "📏", label: "Standard size", detail: `Standard zone footprint (${formatNumber(zone.size)}x).`, tone: "info" };
}

function guardHint(zone: DesignZone): ZoneHint {
  const pressure = guardPressure(zone);
  const roundedPressure = Math.round(pressure);
  if (roundedPressure >= 185) return { id: "guards", icon: "⚔", label: "Brutal guards", detail: `Very high guard pressure (${roundedPressure} index).`, tone: "danger" };
  if (roundedPressure >= 145) return { id: "guards", icon: "⚔", label: "Tough guards", detail: `Above-average guard pressure (${roundedPressure} index).`, tone: "warning" };
  if (zone.role === "Spawn" && zone.quality === "Low" && roundedPressure <= 135) return { id: "guards", icon: "⚔", label: "Light guards", detail: `Low guard pressure (${roundedPressure} index).`, tone: "success" };
  if (roundedPressure <= 110) return { id: "guards", icon: "⚔", label: "Light guards", detail: `Low guard pressure (${roundedPressure} index).`, tone: "success" };
  return { id: "guards", icon: "⚔", label: "Normal guards", detail: `Typical guard pressure (${roundedPressure} index).`, tone: "info" };
}

function resourceHint(zone: DesignZone): ZoneHint {
  const richness = resourceRichness(zone);
  if (richness >= 150) return { id: "resources", icon: "💰", label: "Resource heavy", detail: `High resource budget (${Math.round(richness)} index).`, tone: "treasure" };
  if (richness >= 115) return { id: "resources", icon: "💰", label: "Rich resources", detail: `Above-average resource budget (${Math.round(richness)} index).`, tone: "success" };
  if (richness <= 70) return { id: "resources", icon: "💰", label: "Resource light", detail: `Low resource budget (${Math.round(richness)} index).`, tone: "warning" };
  return { id: "resources", icon: "💰", label: "Normal resources", detail: `Typical resource budget (${Math.round(richness)} index).`, tone: "info" };
}

function structureHint(zone: DesignZone): ZoneHint {
  if (zone.structureDensityPercent >= 140) return { id: "structures", icon: "🧱", label: "Structure dense", detail: `${zone.structureDensityPercent}% structure density.`, tone: "treasure" };
  if (zone.structureDensityPercent <= 65) return { id: "structures", icon: "🧱", label: "Sparse structures", detail: `${zone.structureDensityPercent}% structure density.`, tone: "muted" };
  return { id: "structures", icon: "🧱", label: "Normal structures", detail: `${zone.structureDensityPercent}% structure density.`, tone: "info" };
}

function guardPressure(zone: DesignZone): number {
  return zone.neutralStackStrengthPercent * Math.max(0.1, zone.guardMultiplier) * (1 + Math.max(0, zone.guardWeeklyIncrement) * 0.5);
}

function resourceRichness(zone: DesignZone): number {
  const direct = zone.resourcesValue > 0 ? (zone.resourcesValue / 40) * 100 : 100;
  const perArea = zone.resourcesValuePerArea > 0 ? (zone.resourcesValuePerArea / 4) * 100 : 100;
  return (zone.resourceDensityPercent * 0.5) + (direct * 0.25) + (perArea * 0.25);
}

function hasBiomeOverride(zone: DesignZone): boolean {
  return [zone.zoneBiome, zone.contentBiome, zone.metaObjectsBiome].some((selector) => {
    if (selector === undefined) return false;
    return selector.type !== "MatchZone" || (selector.args?.length ?? 0) > 0;
  });
}

function plural(count: number, singular: string, pluralValue: string): string {
  return count === 1 ? singular : pluralValue;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}
