import type { DesignZone } from "./design";
import type { Point } from "./types";
import { clamp } from "./math";
import { zoneBoardMarkers, type ZoneBoardMarkerKind, type ZoneHintTone } from "./zoneHints";

const BOARD_ZONE_PADDING = 10;
const BOARD_ZONE_MAX_CANVAS_COVERAGE = 0.11;
const BOARD_ZONE_MIN_LAYOUT_SCALE = 0.18;
const BOARD_ZONE_MIN_VISUAL_GAP = 14;
const BOARD_ZONE_GLOBAL_SCALE = 0.96;

export interface BoardZoneBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

export function boardZoneVisualScale(size?: number): number {
  if (!Number.isFinite(size)) return 1;
  const normalizedSize = clamp(size ?? 1, 0.1, 2);
  return clamp(Math.sqrt(normalizedSize), 0.7, 1.3);
}

export function boardZoneDimensions(
  zone: Pick<DesignZone, "role"> & { size?: number },
  layoutScale = 1,
): { width: number; height: number } {
  const base = zone.role === "Hub" ? { width: 126, height: 104 } : { width: 118, height: 96 };
  const scale = boardZoneVisualScale(zone.size);
  return {
    width: Math.round(base.width * scale * layoutScale),
    height: Math.round(base.height * scale * layoutScale),
  };
}

export function boardZoneLayoutScale(
  zones: ReadonlyArray<Pick<DesignZone, "role"> & { size?: number; position?: Point }>,
  width: number,
  height: number,
): number {
  if (zones.length === 0 || width <= 0 || height <= 0) return 1;

  const canvasArea = width * height;
  if (canvasArea <= 0) return 1;

  const totalBadgeArea = zones.reduce((sum, zone) => {
    const dimensions = boardZoneDimensions(zone);
    const badgeRadius = Math.max(10, (Math.min(dimensions.width, dimensions.height) - 12) / 2 + 4);
    return sum + Math.PI * badgeRadius * badgeRadius;
  }, 0);

  const maxBadgeArea = canvasArea * BOARD_ZONE_MAX_CANVAS_COVERAGE;
  const areaScale = totalBadgeArea <= maxBadgeArea
    ? 1
    : Math.sqrt(maxBadgeArea / totalBadgeArea);

  return clamp(
    Math.min(areaScale, closestZoneSpacingScale(zones, width, height)) * BOARD_ZONE_GLOBAL_SCALE,
    BOARD_ZONE_MIN_LAYOUT_SCALE,
    1,
  );
}

function closestZoneSpacingScale(
  zones: ReadonlyArray<Pick<DesignZone, "role"> & { size?: number; position?: Point }>,
  width: number,
  height: number,
): number {
  if (zones.length < 2 || zones.some((zone) => !zone.position)) return 1;

  let scale = 1;
  for (let leftIndex = 0; leftIndex < zones.length; leftIndex++) {
    const left = zones[leftIndex]!;
    const leftPosition = left.position!;
    const leftMinDimension = Math.min(boardZoneDimensions(left).width, boardZoneDimensions(left).height);
    for (let rightIndex = leftIndex + 1; rightIndex < zones.length; rightIndex++) {
      const right = zones[rightIndex]!;
      const rightPosition = right.position!;
      const rightMinDimension = Math.min(boardZoneDimensions(right).width, boardZoneDimensions(right).height);
      const distance = Math.hypot(
        (leftPosition.x - rightPosition.x) * width,
        (leftPosition.y - rightPosition.y) * height,
      );
      const maxCombinedRadius = Math.max(0, distance - BOARD_ZONE_MIN_VISUAL_GAP);
      const pairScale = (maxCombinedRadius + 4) / ((leftMinDimension + rightMinDimension) / 2);
      scale = Math.min(scale, pairScale);
    }
  }

  return scale;
}

export function boardZoneBox(
  zone: Pick<DesignZone, "role" | "position"> & { size?: number },
  width: number,
  height: number,
  layoutScale = 1,
): BoardZoneBox {
  const { width: boxWidth, height: boxHeight } = boardZoneDimensions(zone, layoutScale);
  const centerX = zone.position.x * width;
  const centerY = zone.position.y * height;
  const maxLeft = Math.max(BOARD_ZONE_PADDING, width - boxWidth - BOARD_ZONE_PADDING);
  const maxTop = Math.max(BOARD_ZONE_PADDING, height - boxHeight - BOARD_ZONE_PADDING);
  const left = clamp(centerX - boxWidth / 2, BOARD_ZONE_PADDING, maxLeft);
  const top = clamp(centerY - boxHeight / 2, BOARD_ZONE_PADDING, maxTop);

  return {
    left,
    top,
    right: left + boxWidth,
    bottom: top + boxHeight,
    width: boxWidth,
    height: boxHeight,
    centerX: left + boxWidth / 2,
    centerY: top + boxHeight / 2,
  };
}

export function boardConnectionHandlePoint(
  zone: Pick<DesignZone, "role" | "position"> & { size?: number },
  width: number,
  height: number,
  layoutScale = 1,
): Point {
  const box = boardZoneBox(zone, width, height, layoutScale);
  return {
    x: clamp(box.right + BOARD_ZONE_PADDING, BOARD_ZONE_PADDING, Math.max(BOARD_ZONE_PADDING, width - BOARD_ZONE_PADDING)),
    y: box.top + 16,
  };
}

function spawnPlayerFromSuffix(suffix: string): number {
  const numeric = Number(suffix);
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 8) return numeric;
  if (suffix.length === 1) {
    const fromLetter = suffix.charCodeAt(0) - 64;
    if (fromLetter >= 1 && fromLetter <= 8) return fromLetter;
  }
  return 1;
}

export function boardZoneBadgeLabel(zone: Pick<DesignZone, "role" | "name" | "player">): string {
  if (zone.role === "Spawn") {
    const player = zone.player !== undefined && zone.player >= 1 ? zone.player : spawnPlayerFromSuffix(zone.name.slice(6));
    return `S-${player}`;
  }
  if (zone.role === "Hub") return "Hub";
  if (zone.name.startsWith("Neutral-")) return `N-${zone.name.slice(8)}`;
  return zone.name.length > 10 ? `${zone.name.slice(0, 9)}…` : zone.name;
}

export function boardZoneShortName(name: string): string {
  if (name.startsWith("Spawn-")) return `S-${spawnPlayerFromSuffix(name.slice(6))}`;
  if (name.startsWith("Neutral-")) return `N-${name.slice(8)}`;
  return name.length > 10 ? `${name.slice(0, 9)}...` : name;
}

/** Footer title: full template zone id (Spawn-1, Neutral-2, Hub). */
export function boardZoneFooterName(name: string): string {
  if (name.length <= 14) return name;
  return `${name.slice(0, 13)}…`;
}

/** Footer subtitle for castle count on the zone. */
export function boardZoneFooterCityLabel(castleCount: number): string {
  if (castleCount <= 0) return "No cities";
  return `${castleCount} ${castleCount === 1 ? "city" : "cities"}`;
}

export interface BoardZoneFooterMarker {
  icon: string;
  kind: ZoneBoardMarkerKind;
  tone: ZoneHintTone;
}

export function boardZoneFooterMarkers(zone: DesignZone): BoardZoneFooterMarker[] {
  return zoneBoardMarkers(zone).map((marker) => ({
    icon: marker.hint.icon,
    kind: marker.kind,
    tone: marker.hint.tone,
  }));
}

export function boardZoneFooterStatusLabel(zone: DesignZone): string {
  const markers = boardZoneFooterMarkers(zone).map((marker) => marker.icon);
  if (markers.length === 0) return "Standard";
  return markers.join(" · ");
}

export interface BoardZoneFooterLayout {
  left: number;
  top: number;
  width: number;
  height: number;
  cityY: number;
  statusY: number;
}

const BOARD_ZONE_FOOTER_SIDE_INSET = 16;
const BOARD_ZONE_FOOTER_HEIGHT = 36;
const BOARD_ZONE_FOOTER_BOTTOM_GAP = 2;
const BOARD_ZONE_NAME_VERTICAL_GAP = 8;
const BOARD_ZONE_NAME_SAFE_MARGIN = 14;

export function boardZoneNameY(box: BoardZoneBox, canvasHeight?: number): number {
  const aboveY = Math.max(BOARD_ZONE_NAME_SAFE_MARGIN, box.top - BOARD_ZONE_NAME_VERTICAL_GAP);
  if (canvasHeight === undefined) return aboveY;

  const belowY = Math.min(canvasHeight - BOARD_ZONE_NAME_SAFE_MARGIN, box.bottom + BOARD_ZONE_NAME_VERTICAL_GAP + 2);
  if (box.centerY < canvasHeight / 2) return aboveY;
  return belowY;
}

export function boardZoneFooterLayout(box: BoardZoneBox): BoardZoneFooterLayout {
  const top = box.bottom - BOARD_ZONE_FOOTER_HEIGHT - BOARD_ZONE_FOOTER_BOTTOM_GAP;
  return {
    left: box.left + BOARD_ZONE_FOOTER_SIDE_INSET,
    top,
    width: box.width - BOARD_ZONE_FOOTER_SIDE_INSET * 2,
    height: BOARD_ZONE_FOOTER_HEIGHT,
    cityY: top + 11,
    statusY: top + 26,
  };
}
