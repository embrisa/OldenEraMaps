import {
  boardConnectionHandlePoint,
  SCHEMATIC_BOARD_BACKGROUND_HEIGHT,
  SCHEMATIC_BOARD_BACKGROUND_WIDTH,
} from "@/boardAssets";
import {
  boardZoneLayoutScale,
  boardZoneBox,
  boardZoneFooterCityLabel,
  boardZoneFooterName,
  boardZoneNameY,
  type BoardZoneBox,
} from "@/designBoardGeometry";
import type { PreviewDesign, PreviewDesignConnection, PreviewDesignZone } from "@/community/previewDesign";
import type { DesignZone } from "@/design";
import type { Point } from "@/types";
import { zoneHintStyle } from "@/zoneHints";

export interface BoardZoneColor {
  base: [number, number, number];
  glow: string;
}

export interface BoardRenderZoneLayout {
  zone: PreviewDesignZone;
  box: BoardZoneBox;
  handle: Point;
  color: BoardZoneColor;
  badgeSize: number;
}

export interface BoardRenderConnectionLayout {
  connection: PreviewDesignConnection;
  from: Point;
  to: Point;
  midpoint: Point;
  color: string;
}

export interface BoardRenderState {
  zoneLayouts: BoardRenderZoneLayout[];
  reversedZoneLayouts: BoardRenderZoneLayout[];
  connectionLayouts: BoardRenderConnectionLayout[];
  zoneLayoutsById: Map<string, BoardRenderZoneLayout>;
}

export interface RenderSchematicBoardOptions {
  width: number;
  height: number;
  dpr: number;
  backgroundImage?: HTMLImageElement | null;
  selectedZoneId?: string;
  selectedConnectionId?: string;
  simplify?: boolean;
  presentation?: "builder" | "community";
}

const boardZonePalette: BoardZoneColor[] = [
  { base: [70, 92, 118], glow: "rgba(118,146,176,0.14)" },
  { base: [75, 92, 79], glow: "rgba(128,152,118,0.13)" },
  { base: [116, 83, 72], glow: "rgba(174,126,104,0.12)" },
  { base: [83, 73, 111], glow: "rgba(136,120,176,0.12)" },
  { base: [110, 94, 58], glow: "rgba(190,154,86,0.12)" }
];

export function schematicBoardHeightForWidth(width: number): number {
  return Math.max(1, Math.round((width * SCHEMATIC_BOARD_BACKGROUND_HEIGHT) / SCHEMATIC_BOARD_BACKGROUND_WIDTH));
}

export function buildBoardRenderState(preview: PreviewDesign, width: number, height: number): BoardRenderState {
  const colorsBySignature = new Map<string, BoardZoneColor>();
  const zoneLayoutsById = new Map<string, BoardRenderZoneLayout>();
  const layoutScale = boardZoneLayoutScale(preview.zones, width, height);
  const zoneLayouts = preview.zones.map((zone) => {
    if (!colorsBySignature.has(zone.signature)) {
      colorsBySignature.set(zone.signature, boardZonePalette[colorsBySignature.size % boardZonePalette.length]);
    }
    const box = boardZoneBox(zone, width, height, layoutScale);
    const badgeSize = Math.min(box.width, box.height) - 12;
    const layout: BoardRenderZoneLayout = {
      zone,
      box,
      handle: boardConnectionHandlePoint(zone, width, height, layoutScale),
      color: colorsBySignature.get(zone.signature) ?? boardZonePalette[0],
      badgeSize,
    };
    zoneLayoutsById.set(zone.id, layout);
    return layout;
  });

  let roadConnectionIndex = 0;
  const connectionLayouts = preview.connections.flatMap((connection) => {
    const from = zoneLayoutsById.get(connection.fromZoneId);
    const to = zoneLayoutsById.get(connection.toZoneId);
    if (!from || !to) return [];
    const color = connection.road ? roadConnectionColor(roadConnectionIndex++) : connectionTypeColor(connection.type);
    const fromPoint = {
      x: from.zone.position.x * width,
      y: from.zone.position.y * height,
    };
    const toPoint = {
      x: to.zone.position.x * width,
      y: to.zone.position.y * height,
    };
    return [{
      connection,
      from: fromPoint,
      to: toPoint,
      color,
      midpoint: {
        x: (fromPoint.x + toPoint.x) / 2,
        y: (fromPoint.y + toPoint.y) / 2,
      }
    }];
  });

  return {
    zoneLayouts,
    reversedZoneLayouts: [...zoneLayouts].reverse(),
    connectionLayouts,
    zoneLayoutsById,
  };
}

export function renderSchematicBoardPreview(
  ctx: CanvasRenderingContext2D,
  state: BoardRenderState,
  options: RenderSchematicBoardOptions,
): void {
  ctx.setTransform(options.dpr, 0, 0, options.dpr, 0, 0);
  ctx.clearRect(0, 0, options.width, options.height);
  drawBoardBackground(ctx, options.width, options.height, options.backgroundImage ?? null);

  for (const layout of state.connectionLayouts) {
    drawConnection(ctx, layout, layout.connection.id === (options.selectedConnectionId ?? ""));
  }
  ctx.setLineDash([]);

  const presentation = options.presentation ?? "builder";
  for (const layout of state.zoneLayouts) {
    drawZone(ctx, layout, {
      selected: layout.zone.id === (options.selectedZoneId ?? ""),
      simplify: options.simplify ?? false,
      canvasHeight: options.height,
      presentation,
    });
  }
}

export function renderSchematicBoardPlaceholder(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  dpr: number,
): void {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  drawBoardBackground(ctx, width, height, null);
  ctx.strokeStyle = "rgba(141, 166, 191, 0.2)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([8, 8]);
  ctx.strokeRect(14, 14, width - 28, height - 28);
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(216, 227, 238, 0.8)";
  ctx.font = "600 14px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Preview unavailable", width / 2, height / 2);
}

function drawBoardBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  image: HTMLImageElement | null,
): void {
  ctx.fillStyle = "#090d12";
  ctx.fillRect(0, 0, width, height);

  if (image?.complete && image.naturalWidth > 0) {
    ctx.drawImage(image, 0, 0, width, height);
  }

  const overlay = ctx.createLinearGradient(0, 0, 0, height);
  overlay.addColorStop(0, "rgba(6, 10, 15, 0.36)");
  overlay.addColorStop(0.55, "rgba(6, 10, 15, 0.46)");
  overlay.addColorStop(1, "rgba(6, 10, 15, 0.62)");
  ctx.fillStyle = overlay;
  ctx.fillRect(0, 0, width, height);
}

function drawConnection(ctx: CanvasRenderingContext2D, layout: BoardRenderConnectionLayout, selected: boolean): void {
  const { connection, from, to, color } = layout;
  ctx.save();
  if (selected) {
    ctx.strokeStyle = connection.road ? color.replace("hsl", "hsla").replace(")", ", 0.34)") : "rgba(246, 222, 142, 0.32)";
    ctx.lineWidth = connection.road ? 5.5 : 4.5;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }
  ctx.strokeStyle = color;
  ctx.setLineDash(connection.type === "Portal" ? [8, 8] : connection.type === "Proximity" ? [3, 7] : []);
  ctx.lineWidth = (connection.road ? 2.2 : 1.4) + (selected ? 0.6 : 0);
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.restore();
}

function connectionTypeColor(type: PreviewDesignConnection["type"]): string {
  return type === "Portal" ? "#8da1b9" : type === "Proximity" ? "#6d7f91" : "#d6b45e";
}

function roadConnectionColor(index: number): string {
  const hue = Math.round((index * 137.508 + 38) % 360);
  const lightness = 62 + ((index % 3) * 4);
  return `hsl(${hue}, 78%, ${lightness}%)`;
}

function drawZone(
  ctx: CanvasRenderingContext2D,
  layout: BoardRenderZoneLayout,
  options: {
    selected: boolean;
    simplify: boolean;
    canvasHeight: number;
    presentation: "builder" | "community";
  },
): void {
  const { box, color, badgeSize, zone } = layout;
  const hintStyle = zoneHintStyle(toDesignZoneLike(zone));
  const badgeRadius = badgeSize / 2 + 4;

  ctx.save();
  if (options.selected) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(box.centerX, box.centerY, badgeRadius + 9, 0, Math.PI * 2);
    ctx.shadowColor = "rgba(0, 0, 0, 0.34)";
    ctx.shadowBlur = 40;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
    ctx.fill();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(box.centerX, box.centerY, badgeRadius, 0, Math.PI * 2);
  ctx.fillStyle = `rgb(${color.base.join(",")})`;
  ctx.fill();

  ctx.strokeStyle = hintStyle.glow;
  ctx.lineWidth = options.selected ? 5.8 : 3.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(box.centerX, box.centerY, badgeRadius, 0, Math.PI * 2);
  ctx.strokeStyle = hintStyle.border;
  ctx.lineWidth = 1.6;
  ctx.stroke();

  if (options.presentation === "community") {
    drawCommunityZoneDetails(ctx, zone, box.centerX, box.centerY, badgeRadius);
    ctx.restore();
    return;
  }

  if (options.simplify) {
    ctx.restore();
    return;
  }

  ctx.fillStyle = "#fff0c8";
  ctx.font = "700 12px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(5, 8, 12, 0.82)";
  const nameY = boardZoneNameY(box, options.canvasHeight);
  const zoneName = boardZoneFooterName(zone.name);
  ctx.strokeText(zoneName, box.centerX, nameY);
  ctx.fillText(zoneName, box.centerX, nameY);

  drawZoneCenterDetails(ctx, zone, box.centerX, box.centerY);
  ctx.restore();
}

function drawCommunityZoneDetails(
  ctx: CanvasRenderingContext2D,
  zone: PreviewDesignZone,
  centerX: number,
  centerY: number,
  badgeRadius: number,
): void {
  if (zone.castleCount > 0) {
    const keepSize = Math.max(9, Math.min(14, badgeRadius * 0.34));
    const keepX = centerX + (zone.role === "Spawn" ? badgeRadius * 0.24 : 0);
    const keepY = centerY + (zone.role === "Spawn" ? badgeRadius * 0.2 : 0);
    drawCommunityKeepMarker(ctx, keepX, keepY, keepSize);
  }

  if (zone.role !== "Spawn") return;

  const label = communitySpawnLabel(zone);
  ctx.save();
  ctx.fillStyle = "#fff0c8";
  ctx.font = `800 ${Math.max(10, Math.min(15, Math.round(badgeRadius * 0.42)))}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(5, 8, 12, 0.82)";
  ctx.strokeText(label, centerX - (zone.castleCount > 0 ? badgeRadius * 0.14 : 0), centerY);
  ctx.fillText(label, centerX - (zone.castleCount > 0 ? badgeRadius * 0.14 : 0), centerY);
  ctx.restore();
}

function drawCommunityKeepMarker(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, size: number): void {
  const bodyWidth = size;
  const bodyHeight = size * 0.72;
  const towerWidth = size * 0.24;
  const towerHeight = size * 0.38;
  const bodyLeft = centerX - bodyWidth / 2;
  const bodyTop = centerY - bodyHeight / 2 + size * 0.12;

  ctx.save();
  ctx.fillStyle = "#f3d778";
  ctx.strokeStyle = "rgba(5, 8, 12, 0.78)";
  ctx.lineWidth = 1.3;
  ctx.lineJoin = "round";

  roundRect(ctx, bodyLeft, bodyTop, bodyWidth, bodyHeight, 2);
  ctx.fill();
  ctx.stroke();

  for (const offset of [-0.34, 0, 0.34]) {
    const towerLeft = centerX + (bodyWidth * offset) - towerWidth / 2;
    const towerTop = bodyTop - towerHeight * (offset === 0 ? 0.85 : 0.55);
    roundRect(ctx, towerLeft, towerTop, towerWidth, towerHeight, 1.5);
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
}

function communitySpawnLabel(zone: PreviewDesignZone): string {
  if (zone.player !== null && Number.isInteger(zone.player) && zone.player >= 1) return `S${zone.player}`;
  const suffix = zone.name.startsWith("Spawn-") ? zone.name.slice(6) : "";
  const numeric = Number(suffix);
  if (Number.isInteger(numeric) && numeric >= 1) return `S${numeric}`;
  if (suffix.length === 1) {
    const fromLetter = suffix.toUpperCase().charCodeAt(0) - 64;
    if (fromLetter >= 1 && fromLetter <= 8) return `S${fromLetter}`;
  }
  return "S1";
}

function drawZoneCenterDetails(ctx: CanvasRenderingContext2D, zone: PreviewDesignZone, centerX: number, centerY: number): void {
  ctx.save();
  ctx.fillStyle = "#dce7f2";
  ctx.font = "700 10px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "rgba(5, 8, 12, 0.72)";
  const cityLabel = boardZoneFooterCityLabel(zone.castleCount);
  const cityY = zone.castleCount > 0 ? centerY - 7 : centerY;
  ctx.strokeText(cityLabel, centerX, cityY);
  ctx.fillText(cityLabel, centerX, cityY);
  ctx.restore();

  if (zone.castleCount > 0) {
    drawCommunityKeepMarker(ctx, centerX, centerY + 10, 13);
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
}

function toDesignZoneLike(zone: PreviewDesignZone): DesignZone {
  return {
    id: zone.id,
    name: zone.name,
    role: zone.role,
    player: zone.player ?? undefined,
    quality: zone.quality as DesignZone["quality"],
    castleCount: zone.castleCount,
    size: zone.size,
    layout: "",
    terrainTheme: zone.terrainTheme as DesignZone["terrainTheme"],
    resourceDensityPercent: zone.resourceDensityPercent,
    structureDensityPercent: zone.structureDensityPercent,
    neutralStackStrengthPercent: zone.neutralStackStrengthPercent,
    guardRandomizationPercent: 100,
    guardCutoffValue: 2000,
    guardMultiplier: zone.guardMultiplier,
    guardWeeklyIncrement: zone.guardWeeklyIncrement,
    guardReactionDistribution: [],
    diplomacyModifier: 0,
    guardedContentPool: [],
    unguardedContentPool: [],
    resourcesContentPool: [],
    contentCountLimits: [],
    guardedContentValue: 0,
    guardedContentValuePerArea: 0,
    unguardedContentValue: 0,
    unguardedContentValuePerArea: 0,
    resourcesValue: zone.resourcesValue,
    resourcesValuePerArea: zone.resourcesValuePerArea,
    mandatoryContent: [],
    encounterHolesSettings: null,
    randomHireEnableWeeklyUnitIncrement: null,
    randomHireInitialUnitIncrement: null,
    useCustomMainObjects: false,
    customMainObjects: [],
    zoneBiome: zone.zoneBiome ?? undefined,
    contentBiome: zone.contentBiome ?? undefined,
    metaObjectsBiome: zone.metaObjectsBiome ?? undefined,
    crossroadsPosition: 0,
    footholds: zone.footholds,
    roads: zone.roads,
    holdCity: zone.holdCity,
    matchAdjacentNeutralCastleFactions: false,
    neutralCastlesAsRuins: zone.neutralCastlesAsRuins,
    naturalExpansion: zone.naturalExpansion,
    position: zone.position,
  };
}
