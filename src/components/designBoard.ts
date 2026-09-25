import {
  BOARD_CONNECTION_HANDLE_HIT_RADIUS,
  BOARD_CONNECTION_HANDLE_SIZE,
  getSchematicBoardBackgroundImage,
} from "@/boardAssets";
import { nearestAvailableBoardSlot, pointBoardSlotIndex, sameBoardPosition } from "@/boardSlots";
import { buildPreviewDesign } from "@/community/previewDesign";
import {
  createDefaultDesign,
  type TemplateDesign,
} from "@/design";
import { clamp } from "@/math";
import type { Point } from "@/types";
import {
  boardZoneBadgeRadius,
  buildBoardRenderState,
  renderSchematicBoardPreview,
  schematicBoardHeightForWidth,
  type BoardRenderConnectionLayout,
  type BoardRenderZoneLayout,
} from "@/components/designBoardRender";

/** Pointer travel (CSS px) before a press becomes a drag, so wobble during a click never moves or connects anything. */
export const BOARD_DRAG_START_DISTANCE = 4;
/** Extra hit radius (CSS px) around a zone's drawn circle, about the width of its outer stroke. */
export const BOARD_ZONE_HIT_TOLERANCE = 3;
const BOARD_CONNECTION_HIT_DISTANCE = 10;
/** `.board-connection-actions` is centred above its anchor with this gap (see its CSS transform). */
const CONNECTION_MENU_GAP = 10;
const CONNECTION_MENU_MARGIN = 8;

export interface BoardSize {
  width: number;
  height: number;
}

export interface BoardCallbacks {
  selectZone(zoneId: string): void;
  /** `anchor` is the connection midpoint as a fraction (0–1) of the board size, so it stays valid across resizes. */
  selectConnection(connectionId: string, anchor: Point | null): void;
  moveZone(zoneId: string, position: Point): void;
  connectZones(fromZoneId: string, toZoneId: string, currentDesign: TemplateDesign): void;
  hoverZone(zoneId: string, point: Point | null, hintId?: string): void;
  /** The board's CSS size changed. Not called while the board is hidden. */
  resized?(width: number, height: number): void;
}

interface ZoneDrag {
  zoneId: string;
  /** Pointer position at the press. */
  start: Point;
  /** Pointer minus the zone centre at the press; removed before snapping so an off-centre grab does not jump a slot. */
  grabOffset: Point;
  /** The zone's displayed (normalized) board position at the press. */
  origin: Point;
  /** False until the pointer has travelled BOARD_DRAG_START_DISTANCE. */
  active: boolean;
  /** Slot the zone is previewed at while the drag is active. */
  position: Point | null;
}

interface ConnectionDrag {
  fromZoneId: string;
  start: Point;
  pointer: Point;
  dropZoneId: string;
  active: boolean;
}

/** Topmost zone whose drawn circle (plus `tolerance`) contains `point`; `layoutsTopFirst` is in reverse draw order. */
export function hitTestBoardZone(
  layoutsTopFirst: readonly BoardRenderZoneLayout[],
  point: Point,
  tolerance = BOARD_ZONE_HIT_TOLERANCE,
): BoardRenderZoneLayout | undefined {
  return layoutsTopFirst.find((layout) => {
    const radius = boardZoneBadgeRadius(layout) + tolerance;
    const dx = point.x - layout.box.centerX;
    const dy = point.y - layout.box.centerY;
    return dx * dx + dy * dy <= radius * radius;
  });
}

/**
 * Road drop target: the zone's layout box as an ellipse, more forgiving than the click area (hubs' boxes are
 * wider than their circles). Safe for drops because connection lines are never drop targets.
 */
export function hitTestBoardZoneDropTarget(
  layoutsTopFirst: readonly BoardRenderZoneLayout[],
  point: Point,
): BoardRenderZoneLayout | undefined {
  return layoutsTopFirst.find((layout) => {
    const dx = (point.x - layout.box.centerX) / (layout.box.width / 2 + 4);
    const dy = (point.y - layout.box.centerY) / (layout.box.height / 2 + 4);
    return dx * dx + dy * dy <= 1;
  });
}

/**
 * Where the connection actions menu should be anchored (CSS px) so the whole menu stays inside the board.
 * `anchor` is a board fraction; `menu` is the rendered menu size (0 × 0 before it is measured).
 */
export function clampConnectionMenuPoint(anchor: Point, board: BoardSize, menu: BoardSize, margin = CONNECTION_MENU_MARGIN): Point {
  const x = anchor.x * board.width;
  const y = anchor.y * board.height;
  if (board.width <= 0 || board.height <= 0) return { x, y };

  const minX = margin + menu.width / 2;
  const maxX = board.width - margin - menu.width / 2;
  const minY = margin + menu.height + CONNECTION_MENU_GAP;
  const maxY = board.height - margin;
  return {
    x: minX <= maxX ? clamp(x, minX, maxX) : board.width / 2,
    y: minY <= maxY ? clamp(y, minY, maxY) : minY,
  };
}

function exceedsDragStartDistance(start: Point, point: Point): boolean {
  return Math.hypot(point.x - start.x, point.y - start.y) >= BOARD_DRAG_START_DISTANCE;
}

/**
 * Mouse and pen report hover moves, so a move without the primary button means the press already ended
 * without a pointerup reaching the board (released over a context menu, another window, ...). Touch cannot
 * hover, and events without a pointer type carry no reliable button state.
 */
function primaryButtonReleased(event: PointerEvent): boolean {
  return (event.pointerType === "mouse" || event.pointerType === "pen") && (event.buttons & 1) === 0;
}

export class DesignBoard {
  private ctx: CanvasRenderingContext2D | null;
  private design: TemplateDesign = createDefaultDesign();
  private selectedZoneId = "";
  private selectedConnectionId = "";
  private roadMode = false;
  private zoneDrag: ZoneDrag | null = null;
  private connectionDrag: ConnectionDrag | null = null;
  private hoveredZoneId = "";
  private boardBackground = getSchematicBoardBackgroundImage();
  private dpr = window.devicePixelRatio || 1;
  private resizeObserver: ResizeObserver;
  private removeListeners: Array<() => void> = [];
  private stopWatchingDevicePixelRatio: () => void = () => undefined;
  private width = 0;
  private height = 0;
  private zoneLayouts: BoardRenderZoneLayout[] = [];
  private reversedZoneLayouts: BoardRenderZoneLayout[] = [];
  private connectionLayouts: BoardRenderConnectionLayout[] = [];
  private zoneLayoutsById = new Map<string, BoardRenderZoneLayout>();
  private activePointerId: number | null = null;
  private renderFrame = 0;

  constructor(private canvas: HTMLCanvasElement, private callbacks: BoardCallbacks) {
    this.ctx = canvas.getContext("2d");
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement ?? canvas);
    this.listen("pointerdown", (event) => this.pointerDown(event));
    this.listen("pointermove", (event) => this.pointerMove(event));
    this.listen("pointerup", (event) => this.pointerUp(event));
    this.listen("pointercancel", (event) => this.pointerCancel(event));
    this.listen("lostpointercapture", (event) => this.pointerCancel(event));
    this.listen("pointerleave", () => {
      this.setHoveredZone("", null);
    });
    this.watchBackgroundImage();
    this.watchDevicePixelRatio();
    this.resize();
  }

  update(design: TemplateDesign, selectedZoneId: string, selectedConnectionId: string, roadMode: boolean): void {
    const designChanged = this.design !== design;
    this.design = design;
    this.selectedZoneId = selectedZoneId;
    this.selectedConnectionId = selectedConnectionId;
    if (!roadMode && this.connectionDrag) {
      this.connectionDrag = null;
      this.releaseActivePointer(this.activePointerId);
    }
    this.roadMode = roadMode;
    if (designChanged) this.rebuildZoneLayouts();
    this.requestRender();
  }

  destroy(): void {
    if (this.renderFrame) cancelAnimationFrame(this.renderFrame);
    this.renderFrame = 0;
    this.removeListeners.forEach((remove) => remove());
    this.removeListeners = [];
    this.stopWatchingDevicePixelRatio();
    this.resizeObserver.disconnect();
  }

  private listen(type: keyof HTMLElementEventMap, listener: (event: PointerEvent) => void): void {
    const typedListener = listener as EventListener;
    this.canvas.addEventListener(type, typedListener);
    this.removeListeners.push(() => this.canvas.removeEventListener(type, typedListener));
  }

  private watchBackgroundImage(): void {
    const image = this.boardBackground;
    if (!image || image.complete) return;
    const redraw = () => {
      this.resize();
      this.requestRender();
    };
    image.addEventListener("load", redraw);
    image.addEventListener("error", redraw);
    this.removeListeners.push(() => {
      image.removeEventListener("load", redraw);
      image.removeEventListener("error", redraw);
    });
  }

  /** Moving the window to a screen with another pixel ratio changes no CSS size, so the ResizeObserver stays quiet. */
  private watchDevicePixelRatio(): void {
    this.stopWatchingDevicePixelRatio();
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    const onChange = () => {
      this.watchDevicePixelRatio();
      this.resize();
    };
    query.addEventListener("change", onChange);
    this.stopWatchingDevicePixelRatio = () => query.removeEventListener("change", onChange);
  }

  private resize(): void {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    // A hidden board (e.g. its tab is display:none) measures 0 px. Keep the last good size instead of
    // shrinking the canvas to 1×1; the observer fires again once the board is shown.
    if (parent.clientWidth <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    const width = parent.clientWidth;
    const height = parent.clientHeight > 0 ? parent.clientHeight : schematicBoardHeightForWidth(width);
    const pixelWidth = Math.round(width * dpr);
    const pixelHeight = Math.round(height * dpr);

    if (this.dpr === dpr && this.width === width && this.height === height && this.canvas.width === pixelWidth && this.canvas.height === pixelHeight) {
      return;
    }

    this.dpr = dpr;
    this.width = width;
    this.height = height;
    this.canvas.width = pixelWidth;
    this.canvas.height = pixelHeight;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.rebuildZoneLayouts();
    this.requestRender();
    this.callbacks.resized?.(width, height);
  }

  private pointerDown(event: PointerEvent): void {
    // Only the primary button edits the board; right/middle presses would start drags whose pointerup
    // is often swallowed by the context menu or autoscroll.
    if (event.button !== 0) return;
    // A previous press whose pointerup never arrived must not leak into this one.
    if (this.zoneDrag || this.connectionDrag) this.cancelDrag();

    const point = this.eventPoint(event);
    const handle = this.roadMode ? this.hitConnectionHandle(point) : undefined;
    if (handle) {
      this.setHoveredZone("", null);
      this.callbacks.selectConnection("", null);
      this.connectionDrag = { fromZoneId: handle.zone.id, start: point, pointer: point, dropZoneId: "", active: false };
      this.capturePointer(event.pointerId);
      this.callbacks.selectZone(handle.zone.id);
      this.requestRender();
      return;
    }

    const hit = this.hitTest(point);

    if (!hit) {
      const connectionHit = this.hitConnection(point);
      if (connectionHit) {
        this.setHoveredZone("", null);
        this.callbacks.selectZone("");
        this.callbacks.selectConnection(connectionHit.connection.id, this.boardFraction(connectionHit.midpoint));
        this.requestRender();
        return;
      }
      this.setHoveredZone("", null);
      this.callbacks.selectConnection("", null);
      this.callbacks.selectZone("");
      return;
    }
    this.setHoveredZone("", null);
    this.callbacks.selectConnection("", null);
    const origin = hit.zone.position;
    this.zoneDrag = {
      zoneId: hit.zone.id,
      start: point,
      grabOffset: { x: point.x - origin.x * this.width, y: point.y - origin.y * this.height },
      origin,
      active: false,
      position: null,
    };
    this.capturePointer(event.pointerId);
    this.callbacks.selectZone(hit.zone.id);
  }

  private pointerMove(event: PointerEvent): void {
    if (this.activePointerId !== null && event.pointerId !== this.activePointerId) return;
    if ((this.zoneDrag || this.connectionDrag) && primaryButtonReleased(event)) this.cancelDrag();

    const point = this.eventPoint(event);
    if (this.connectionDrag) {
      this.setHoveredZone("", null);
      const active = this.connectionDrag.active || exceedsDragStartDistance(this.connectionDrag.start, point);
      const dropZone = active ? this.hitDropTarget(point) : undefined;
      this.connectionDrag = {
        ...this.connectionDrag,
        active,
        pointer: point,
        dropZoneId: dropZone && dropZone.zone.id !== this.connectionDrag.fromZoneId ? dropZone.zone.id : ""
      };
      this.requestRender();
      return;
    }

    const drag = this.zoneDrag;
    if (!drag) {
      const hover = this.hitTest(point);
      this.setHoveredZone(hover?.zone.id ?? "", hover ? point : null);
      return;
    }

    this.setHoveredZone("", null);
    if (!this.width || !this.height) return;
    if (!drag.active && !exceedsDragStartDistance(drag.start, point)) return;

    const position = this.dragSlotPosition(point, drag);
    const moved = !drag.position || !sameBoardPosition(drag.position, position);
    this.zoneDrag = { ...drag, active: true, position };
    if (!moved) return;
    this.rebuildZoneLayouts();
    this.requestRender();
  }

  private pointerUp(event: PointerEvent): void {
    if (this.activePointerId !== null && event.pointerId !== this.activePointerId) return;
    const connectionDrag = this.connectionDrag;
    if (connectionDrag) {
      const point = this.eventPoint(event);
      this.connectionDrag = null;
      this.releaseActivePointer(event.pointerId);
      const dropZone = connectionDrag.active || exceedsDragStartDistance(connectionDrag.start, point) ? this.hitDropTarget(point) : undefined;
      if (dropZone && dropZone.zone.id !== connectionDrag.fromZoneId) this.callbacks.connectZones(connectionDrag.fromZoneId, dropZone.zone.id, this.design);
      else this.requestRender();
      return;
    }

    const drag = this.zoneDrag;
    this.zoneDrag = null;
    this.releaseActivePointer(event.pointerId);
    if (!drag?.active) return;
    if (drag.position && !sameBoardPosition(drag.position, drag.origin)) {
      // The layouts keep showing the dropped slot until the moved design comes back through update().
      this.callbacks.moveZone(drag.zoneId, drag.position);
      return;
    }
    this.rebuildZoneLayouts();
    this.requestRender();
  }

  private pointerCancel(event: PointerEvent): void {
    if (!this.zoneDrag && !this.connectionDrag) return;
    if (this.activePointerId !== null && event.pointerId !== this.activePointerId) return;
    this.cancelDrag();
  }

  private cancelDrag(): void {
    const pointerId = this.activePointerId;
    this.zoneDrag = null;
    this.connectionDrag = null;
    this.releaseActivePointer(pointerId);
    this.rebuildZoneLayouts();
    this.requestRender();
  }

  private capturePointer(pointerId: number): void {
    this.activePointerId = pointerId;
    this.canvas.setPointerCapture(pointerId);
  }

  private releaseActivePointer(pointerId: number | null): void {
    this.activePointerId = null;
    if (pointerId === null || !this.canvas.hasPointerCapture(pointerId)) return;
    this.canvas.releasePointerCapture(pointerId);
  }

  private setHoveredZone(zoneId: string, point: Point | null, hintId?: string): void {
    if (zoneId === this.hoveredZoneId && !point) return;
    this.hoveredZoneId = zoneId;
    this.callbacks.hoverZone(zoneId, point, hintId);
  }

  /** Nearest free slot to the dragged zone's centre (pointer minus grab offset). */
  private dragSlotPosition(point: Point, drag: ZoneDrag): Point {
    const normalizedCenter = {
      x: clamp((point.x - drag.grabOffset.x) / this.width, 0.04, 0.96),
      y: clamp((point.y - drag.grabOffset.y) / this.height, 0.06, 0.94)
    };
    const occupied = this.zoneLayouts
      .filter((layout) => layout.zone.id !== drag.zoneId)
      .map((layout) => pointBoardSlotIndex(layout.zone.position));
    return nearestAvailableBoardSlot(normalizedCenter, occupied).position;
  }

  private boardFraction(point: Point): Point {
    return {
      x: this.width ? point.x / this.width : 0,
      y: this.height ? point.y / this.height : 0,
    };
  }

  private render(): void {
    this.renderFrame = 0;
    if (!this.ctx || !this.width || !this.height) return;

    const ctx = this.ctx;
    renderSchematicBoardPreview(ctx, {
      zoneLayouts: this.zoneLayouts,
      reversedZoneLayouts: this.reversedZoneLayouts,
      connectionLayouts: this.connectionLayouts,
      zoneLayoutsById: this.zoneLayoutsById,
    }, {
      width: this.width,
      height: this.height,
      dpr: this.dpr,
      backgroundImage: this.boardBackground,
      selectedZoneId: this.selectedZoneId,
      selectedConnectionId: this.selectedConnectionId,
    });
    if (this.roadMode) this.drawConnectionHandles(ctx);
    if (this.connectionDrag) this.drawPendingConnection(ctx);
  }

  private requestRender(): void {
    if (this.renderFrame) return;
    this.renderFrame = requestAnimationFrame(() => this.render());
  }

  private rebuildZoneLayouts(): void {
    if (!this.width || !this.height) {
      this.zoneLayouts = [];
      this.reversedZoneLayouts = [];
      this.connectionLayouts = [];
      this.zoneLayoutsById.clear();
      return;
    }

    const preview = buildPreviewDesign(this.design);
    const drag = this.zoneDrag;
    const dragPosition = drag?.active ? drag.position : null;
    if (drag && dragPosition) {
      preview.zones = preview.zones.map((zone) => zone.id === drag.zoneId ? { ...zone, position: dragPosition } : zone);
    }
    const state = buildBoardRenderState(preview, this.width, this.height);
    this.zoneLayouts = state.zoneLayouts;
    this.reversedZoneLayouts = state.reversedZoneLayouts;
    this.connectionLayouts = state.connectionLayouts;
    this.zoneLayoutsById = state.zoneLayoutsById;
  }

  private drawConnectionHandles(ctx: CanvasRenderingContext2D): void {
    for (const layout of this.zoneLayouts) {
      const active = this.connectionDrag?.fromZoneId === layout.zone.id;
      const size = BOARD_CONNECTION_HANDLE_SIZE;
      ctx.save();
      ctx.beginPath();
      ctx.arc(layout.handle.x, layout.handle.y, size / 2 + 5, 0, Math.PI * 2);
      ctx.fillStyle = active ? "rgba(35, 45, 59, 0.98)" : "rgba(18, 25, 35, 0.94)";
      ctx.fill();
      ctx.strokeStyle = active ? "#d8ba64" : "rgba(141, 166, 191, 0.5)";
      ctx.lineWidth = active ? 1.5 : 0.8;
      ctx.stroke();
      ctx.strokeStyle = active ? "#f7df8a" : "#ffd95a";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(layout.handle.x - 5, layout.handle.y);
      ctx.lineTo(layout.handle.x + 5, layout.handle.y);
      ctx.moveTo(layout.handle.x, layout.handle.y - 5);
      ctx.lineTo(layout.handle.x, layout.handle.y + 5);
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawPendingConnection(ctx: CanvasRenderingContext2D): void {
    if (!this.connectionDrag) return;
    const from = this.zoneLayoutsById.get(this.connectionDrag.fromZoneId);
    if (!from) return;

    ctx.save();
    ctx.strokeStyle = this.connectionDrag.dropZoneId ? "#d8c57a" : "#c8a65a";
    ctx.lineWidth = 1.8;
    ctx.setLineDash([8, 7]);
    ctx.beginPath();
    ctx.moveTo(from.zone.position.x * this.width, from.zone.position.y * this.height);
    ctx.lineTo(this.connectionDrag.pointer.x, this.connectionDrag.pointer.y);
    ctx.stroke();
    ctx.restore();
  }

  private hitTest(point: Point): BoardRenderZoneLayout | undefined {
    return hitTestBoardZone(this.reversedZoneLayouts, point);
  }

  private hitDropTarget(point: Point): BoardRenderZoneLayout | undefined {
    return hitTestBoardZoneDropTarget(this.reversedZoneLayouts, point);
  }

  private hitConnection(point: Point): BoardRenderConnectionLayout | undefined {
    let closest: BoardRenderConnectionLayout | undefined;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (const layout of this.connectionLayouts) {
      const distance = distanceToSegment(point, layout.from, layout.to);
      if (distance > BOARD_CONNECTION_HIT_DISTANCE || distance >= closestDistance) continue;
      closest = layout;
      closestDistance = distance;
    }

    return closest;
  }

  private hitConnectionHandle(point: Point): BoardRenderZoneLayout | undefined {
    const radiusSquared = BOARD_CONNECTION_HANDLE_HIT_RADIUS * BOARD_CONNECTION_HANDLE_HIT_RADIUS;
    return this.reversedZoneLayouts.find((layout) => {
      const dx = point.x - layout.handle.x;
      const dy = point.y - layout.handle.y;
      return dx * dx + dy * dy <= radiusSquared;
    });
  }

  private eventPoint(event: PointerEvent): Point {
    const rect = this.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
}

function distanceToSegment(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    const offsetX = point.x - start.x;
    const offsetY = point.y - start.y;
    return Math.sqrt(offsetX * offsetX + offsetY * offsetY);
  }

  const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared, 0, 1);
  const projectionX = start.x + t * dx;
  const projectionY = start.y + t * dy;
  const offsetX = point.x - projectionX;
  const offsetY = point.y - projectionY;
  return Math.sqrt(offsetX * offsetX + offsetY * offsetY);
}
