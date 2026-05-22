/**
 * Offscreen preview renderer.
 *
 * Renders a deterministic map preview from an RmgTemplate onto any
 * CanvasRenderingContext2D. No DOM events, no ResizeObserver – pure drawing.
 */

import { getZonePosition } from "./generator";
import { clamp } from "./math";
import type { Connection, RmgTemplate, RoadEndpoint, Zone } from "./types";
import {
  computePowerDiagram,
  polygonCentroid,
  type Polygon,
  type WeightedSite,
} from "./voronoi";

// ── Player colors ──────────────────────────────────────────────────────────

const PLAYER_COLORS = [
  { fill: "rgba(212,175,55,0.45)", border: "#d4af37", text: "#fff" },
  { fill: "rgba(200,60,60,0.45)", border: "#c83c3c", text: "#fff" },
  { fill: "rgba(70,130,210,0.45)", border: "#4682d2", text: "#fff" },
  { fill: "rgba(60,180,75,0.45)", border: "#3cb44b", text: "#fff" },
  { fill: "rgba(145,100,200,0.45)", border: "#9164c8", text: "#fff" },
  { fill: "rgba(60,190,185,0.45)", border: "#3cbeb9", text: "#fff" },
  { fill: "rgba(230,150,50,0.45)", border: "#e6962d", text: "#fff" },
  { fill: "rgba(210,105,160,0.45)", border: "#d269a0", text: "#fff" },
];

const NEUTRAL_COLOR = { fill: "rgba(120,110,90,0.35)", border: "#787060", text: "#d4cbb8" };
const HUB_COLOR = { fill: "rgba(90,80,60,0.50)", border: "#a09070", text: "#f0e2c5" };
const NATURAL_ALPHA = 0.55;

// ── Zone helpers ───────────────────────────────────────────────────────────

function zonePlayerIndex(zone: Zone): number | null {
  if (!zone.name.startsWith("Spawn-")) return null;
  const suffix = zone.name.slice(6);
  const numeric = Number(suffix);
  if (Number.isInteger(numeric) && numeric >= 1) {
    const idx = numeric - 1;
    return idx >= 0 && idx < PLAYER_COLORS.length ? idx : null;
  }
  if (/^[A-Z]$/.test(suffix)) {
    const idx = suffix.charCodeAt(0) - 65;
    return idx >= 0 && idx < PLAYER_COLORS.length ? idx : null;
  }
  return null;
}

function isHub(zone: Zone): boolean {
  return zone.name === "Hub";
}

function isNatural(zone: Zone): boolean {
  return zone.name.startsWith("Natural-");
}

function naturalParentIndex(zone: Zone): number | null {
  if (!isNatural(zone)) return null;
  const suffix = zone.name.slice(8);
  const numeric = Number(suffix);
  if (Number.isInteger(numeric) && numeric >= 1) {
    const idx = numeric - 1;
    return idx >= 0 && idx < PLAYER_COLORS.length ? idx : null;
  }
  if (/^[A-Z]$/.test(suffix)) {
    const idx = suffix.charCodeAt(0) - 65;
    return idx >= 0 && idx < PLAYER_COLORS.length ? idx : null;
  }
  return null;
}

function zoneColor(zone: Zone) {
  const pi = zonePlayerIndex(zone);
  if (pi !== null) return PLAYER_COLORS[pi];
  if (isHub(zone)) return HUB_COLOR;
  const ni = naturalParentIndex(zone);
  if (ni !== null) {
    const parent = PLAYER_COLORS[ni];
    return {
      fill: parent.fill.replace(/[\d.]+\)$/, `${NATURAL_ALPHA})`),
      border: parent.border,
      text: parent.text,
    };
  }
  return NEUTRAL_COLOR;
}

function zoneLabel(zone: Zone): string {
  if (zone.name.startsWith("Spawn-")) return `P${zone.name.slice(6)}`;
  if (zone.name.startsWith("Neutral-")) return `N${zone.name.slice(8)}`;
  if (zone.name.startsWith("Natural-")) return `E${zone.name.slice(8)}`;
  if (zone.name === "Hub") return "Hub";
  return zone.name;
}

function zoneSublabel(zone: Zone, gridSquares?: number): string {
  const parts: string[] = [];
  const castles = (zone.mainObjects ?? []).filter(
    (o) => o.type === "City" || o.type === "Spawn"
  ).length;
  if (castles > 0) parts.push(`${castles} 🏰`);
  if (zone.size !== undefined && zone.size !== 1) parts.push(`×${zone.size}`);
  if (gridSquares !== undefined) parts.push(`${gridSquares} □`);
  return parts.join("  ");
}

// ── Public interface ───────────────────────────────────────────────────────

export interface PreviewRenderOptions {
  /** Canvas width in CSS pixels. */
  width: number;
  /** Canvas height in CSS pixels. */
  height: number;
  /** Device pixel ratio (default 1 for export). */
  dpr?: number;
  /** Optional title overlay. */
  title?: string;
  /** Optional metadata overlay: player count, size, win condition. */
  metadata?: { playerCount?: number; size?: string; winCondition?: string };
}

/**
 * Render a deterministic map preview onto the given canvas context.
 * The context must already be sized to `options.width * dpr × options.height * dpr`.
 */
export function renderPreview(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  template: RmgTemplate,
  options: PreviewRenderOptions
): void {
  const dpr = options.dpr ?? 1;
  const w = options.width;
  const h = options.height;
  const mapW = template.sizeX;
  const mapH = template.sizeZ;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const variant = template.variants?.[0];
  const zones: Zone[] = variant?.zones ?? [];
  const connections: Connection[] = variant?.connections ?? [];

  // ── Background ──
  ctx.fillStyle = "#12100c";
  ctx.fillRect(0, 0, w, h);

  if (zones.length === 0) return;

  // ── Voronoi computation ──
  const aspect = mapW / mapH;
  const diagramW = 1000;
  const diagramH = diagramW / aspect;
  const totalWeight = zones.reduce((s, z) => s + (z.size ?? 1), 0);
  const diagramArea = diagramW * diagramH;

  const sites: WeightedSite[] = zones.map((z) => {
    const pos = getZonePosition(z);
    const size = z.size ?? 1;
    const areaShare = (size / totalWeight) * diagramArea;
    return { x: pos.x * diagramW, y: pos.y * diagramH, weight: areaShare * 0.4 };
  });

  const rawCells = computePowerDiagram(sites, diagramW, diagramH);
  const cells: Polygon[] = rawCells.map((cell) =>
    cell.map((p) => ({ x: p.x / diagramW, y: p.y / diagramH }))
  );

  // ── Drawing area ──
  const pad = 12;
  const drawW = w - pad * 2;
  const drawH = h - pad * 2;

  const cornerRadius = variant?.border?.cornerRadius ?? 0.15;
  const cr = Math.min(cornerRadius * Math.min(drawW, drawH), Math.min(drawW, drawH) * 0.25);

  drawRoundedRect(ctx, pad, pad, drawW, drawH, cr);
  ctx.fillStyle = "#1a1712";
  ctx.fill();
  ctx.strokeStyle = "#5a4a30";
  ctx.lineWidth = 1.0;
  ctx.stroke();

  // Clip to map border
  ctx.save();
  drawRoundedRect(ctx, pad, pad, drawW, drawH, cr);
  ctx.clip();

  // ── Draw neutral zone cells first, then player zones on top ──
  const neutralIndices: number[] = [];
  const playerIndices: number[] = [];
  for (let i = 0; i < zones.length; i++) {
    if (zonePlayerIndex(zones[i]) !== null) {
      playerIndices.push(i);
    } else {
      neutralIndices.push(i);
    }
  }
  for (const i of neutralIndices) drawZoneCell(ctx, zones, cells, i, pad, pad, drawW, drawH);
  for (const i of playerIndices) drawZoneCell(ctx, zones, cells, i, pad, pad, drawW, drawH);

  // ── Draw connections (no plus sign for roads) ──
  let roadConnectionIndex = 0;
  const roadNames = roadConnectionNames(zones);
  for (const conn of connections) {
    const isRoadConnection = conn.road === true || (conn.name !== undefined && roadNames.has(conn.name));
    const color = isRoadConnection ? roadConnectionColor(roadConnectionIndex++) : undefined;
    drawConnection(ctx, conn, zones, cells, pad, pad, drawW, drawH, color);
  }

  ctx.restore(); // un-clip

  // ── Labels on top (not clipped) ──
  for (let i = 0; i < zones.length; i++) {
    drawZoneLabel(ctx, template, zones, cells, i, pad, pad, drawW, drawH, mapW, mapH);
  }

  // ── Optional overlays ──
  if (options.title || options.metadata) {
    drawOverlays(ctx, w, h, options.title, options.metadata);
  }
}

// ── Cell drawing ───────────────────────────────────────────────────────────

function drawZoneCell(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  zones: Zone[],
  cells: Polygon[],
  index: number,
  ox: number, oy: number, w: number, h: number
): void {
  const cell = cells[index];
  if (cell.length < 3) return;
  const zone = zones[index];
  const colors = zoneColor(zone);

  ctx.beginPath();
  for (let i = 0; i < cell.length; i++) {
    const px = ox + cell[i].x * w;
    const py = oy + cell[i].y * h;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = colors.fill;
  ctx.fill();
  ctx.strokeStyle = "rgba(90,74,48,0.45)";
  ctx.lineWidth = 0.8;
  ctx.stroke();
}

function drawConnection(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  conn: Connection,
  zones: Zone[],
  cells: Polygon[],
  ox: number, oy: number, w: number, h: number,
  roadColor?: string
): void {
  const fromZone = zones.find((z) => z.name === conn.from);
  const toZone = zones.find((z) => z.name === conn.to);
  if (!fromZone || !toZone) return;

  const fromIdx = zones.indexOf(fromZone);
  const toIdx = zones.indexOf(toZone);
  const fromPt = fromIdx >= 0 && cells[fromIdx]?.length >= 3
    ? polygonCentroid(cells[fromIdx]) : getZonePosition(fromZone);
  const toPt = toIdx >= 0 && cells[toIdx]?.length >= 3
    ? polygonCentroid(cells[toIdx]) : getZonePosition(toZone);

  const x1 = ox + fromPt.x * w;
  const y1 = oy + fromPt.y * h;
  const x2 = ox + toPt.x * w;
  const y2 = oy + toPt.y * h;

  ctx.beginPath();
  ctx.lineWidth = roadColor ? 1.6 : 1.0;
  const connType = conn.connectionType ?? "Direct";
  if (connType === "Portal") {
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = roadColor ?? "rgba(160,130,220,0.6)";
  } else if (connType === "Proximity") {
    ctx.setLineDash([2, 4]);
    ctx.strokeStyle = roadColor ?? "rgba(140,130,110,0.4)";
  } else {
    ctx.setLineDash([]);
    ctx.strokeStyle = roadColor ?? "rgba(180,160,120,0.5)";
  }

  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Portal diamond marker
  if (connType === "Portal") {
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const s = 4;
    ctx.beginPath();
    ctx.moveTo(mx, my - s);
    ctx.lineTo(mx + s, my);
    ctx.lineTo(mx, my + s);
    ctx.lineTo(mx - s, my);
    ctx.closePath();
    ctx.fillStyle = roadColor ?? "rgba(160,130,220,0.8)";
    ctx.fill();
  }
}

function roadConnectionColor(index: number): string {
  const hue = Math.round((index * 137.508 + 38) % 360);
  const lightness = 58 + ((index % 3) * 4);
  return `hsl(${hue}, 82%, ${lightness}%)`;
}

function roadConnectionNames(zones: Zone[]): Set<string> {
  const names = new Set<string>();
  for (const zone of zones) {
    for (const road of zone.roads ?? []) {
      addRoadEndpointConnectionName(names, road.from);
      addRoadEndpointConnectionName(names, road.to);
    }
  }
  return names;
}

function addRoadEndpointConnectionName(names: Set<string>, endpoint: RoadEndpoint | undefined): void {
  if (!endpoint || typeof endpoint !== "object" || !("type" in endpoint) || endpoint.type !== "Connection") return;
  if (!("args" in endpoint) || !Array.isArray(endpoint.args)) return;
  const [name] = endpoint.args;
  if (typeof name === "string" && name) names.add(name);
}

function drawZoneLabel(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  template: RmgTemplate,
  zones: Zone[],
  cells: Polygon[],
  index: number,
  ox: number, oy: number, w: number, h: number,
  mapW: number, mapH: number
): void {
  const cell = cells[index];
  if (cell.length < 3) return;

  const zone = zones[index];
  const colors = zoneColor(zone);
  const centroid = polygonCentroid(cell);
  const cx = ox + centroid.x * w;
  const cy = oy + centroid.y * h;

  const zoneSize = zone.size ?? 1;
  const totalWeightForLabels = zones.reduce((s, z) => s + (z.size ?? 1), 0);
  const borderWidth = template.variants?.[0]?.border?.obstaclesWidth ?? 3;
  const totalMapArea = mapW * mapH;
  const effectiveArea = totalMapArea - 2 * borderWidth * (mapW + mapH - 2 * borderWidth);
  const gridSquares = Math.round((zoneSize / totalWeightForLabels) * Math.max(0, effectiveArea));

  const label = zoneLabel(zone);
  const sub = zoneSublabel(zone, gridSquares);
  const mainFontSize = clamp(Math.round(w * 0.009), 10, 11);
  const subFontSize = clamp(Math.round(w * 0.0075), 8, 10);

  // Main label
  ctx.font = `bold ${mainFontSize}px Inter, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillText(label, cx + 1, cy - (sub ? 5 : 0) + 1);
  ctx.fillStyle = colors.text;
  ctx.fillText(label, cx, cy - (sub ? 5 : 0));

  // Sublabel
  if (sub) {
    ctx.font = `${subFontSize}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillText(sub, cx + 1, cy + 10);
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText(sub, cx, cy + 9);
  }
}

// ── Overlays ───────────────────────────────────────────────────────────────

function drawOverlays(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  w: number, h: number,
  title?: string,
  metadata?: { playerCount?: number; size?: string; winCondition?: string }
): void {
  if (title) {
    const fontSize = clamp(Math.round(w * 0.028), 11, 20);
    ctx.font = `bold ${fontSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const tx = 16;
    const ty = 16;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    const metrics = ctx.measureText(title);
    const bgPad = 6;
    const textWidth = metrics?.width ?? (title.length * fontSize * 0.6);
    drawRoundedRect(ctx, tx - bgPad, ty - bgPad / 2, textWidth + bgPad * 2, fontSize + bgPad, 4);
    ctx.fill();
    ctx.fillStyle = "#ffe8a8";
    ctx.fillText(title, tx, ty);
  }

  if (metadata) {
    const parts: string[] = [];
    if (metadata.playerCount) parts.push(`${metadata.playerCount}P`);
    if (metadata.size) parts.push(metadata.size);
    if (metadata.winCondition && metadata.winCondition !== "win_condition_1") {
      parts.push(metadata.winCondition.replace(/^win_condition_/, "WC"));
    }
    if (parts.length > 0) {
      const fontSize = clamp(Math.round(w * 0.022), 9, 14);
      ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      const text = parts.join(" · ");
      const mx = w - 16;
      const my = h - 12;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      const metrics = ctx.measureText(text);
      const bgPad = 4;
      const metaTextWidth = metrics?.width ?? (text.length * fontSize * 0.6);
      drawRoundedRect(ctx, mx - metaTextWidth - bgPad, my - fontSize - bgPad / 2, metaTextWidth + bgPad * 2, fontSize + bgPad, 3);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.fillText(text, mx, my);
    }
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function drawRoundedRect(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
