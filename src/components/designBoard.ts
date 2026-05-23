import {
  BOARD_CONNECTION_HANDLE_HIT_RADIUS,
  BOARD_CONNECTION_HANDLE_SIZE,
  SCHEMATIC_BOARD_BACKGROUND_SOURCE,
} from "@/boardAssets";
import { nearestAvailableBoardSlot, pointBoardSlotIndex } from "@/boardSlots";
import { buildPreviewDesign } from "@/community/previewDesign";
import {
  createDefaultDesign,
  type TemplateDesign,
} from "@/design";
import { clamp } from "@/math";
import type { Point } from "@/types";
import {
  buildBoardRenderState,
  renderSchematicBoardPreview,
  schematicBoardHeightForWidth,
  type BoardRenderConnectionLayout,
  type BoardRenderZoneLayout,
} from "@/components/designBoardRender";

export interface BoardCallbacks {
  selectZone(zoneId: string): void;
  selectConnection(connectionId: string, point: Point | null): void;
  moveZone(zoneId: string, position: Point): void;
  connectZones(fromZoneId: string, toZoneId: string, currentDesign: TemplateDesign): void;
  hoverZone(zoneId: string, point: Point | null, hintId?: string): void;
}

interface ConnectionDrag {
  fromZoneId: string;
  pointer: Point;
  dropZoneId: string;
}

export class DesignBoard {
  private ctx: CanvasRenderingContext2D | null;
  private design: TemplateDesign = createDefaultDesign();
  private selectedZoneId = "";
  private selectedConnectionId = "";
  private roadMode = false;
  private draggingZoneId = "";
  private connectionDrag: ConnectionDrag | null = null;
  private hoveredZoneId = "";
  private imageCache = new Map<string, HTMLImageElement>();
  private boardBackground = this.imageFor(SCHEMATIC_BOARD_BACKGROUND_SOURCE);
  private dpr = window.devicePixelRatio || 1;
  private resizeObserver: ResizeObserver;
  private removeListeners: Array<() => void> = [];
  private width = 0;
  private height = 0;
  private zoneLayouts: BoardRenderZoneLayout[] = [];
  private reversedZoneLayouts: BoardRenderZoneLayout[] = [];
  private connectionLayouts: BoardRenderConnectionLayout[] = [];
  private zoneLayoutsById = new Map<string, BoardRenderZoneLayout>();
  private dragPreviewPosition: Point | null = null;
  private renderFrame = 0;

  constructor(private canvas: HTMLCanvasElement, private callbacks: BoardCallbacks) {
    this.ctx = canvas.getContext("2d");
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement ?? canvas);
    this.listen("pointerdown", (event) => this.pointerDown(event));
    this.listen("pointermove", (event) => this.pointerMove(event));
    this.listen("pointerup", (event) => this.pointerUp(event));
    this.listen("pointerleave", () => {
      this.setHoveredZone("", null);
      this.cancelDrag();
    });
    this.resize();
  }

  update(design: TemplateDesign, selectedZoneId: string, selectedConnectionId: string, roadMode: boolean): void {
    const designChanged = this.design !== design;
    this.design = design;
    this.selectedZoneId = selectedZoneId;
    this.selectedConnectionId = selectedConnectionId;
    if (this.roadMode !== roadMode && !roadMode) this.connectionDrag = null;
    this.roadMode = roadMode;
    if (designChanged) this.rebuildZoneLayouts();
    this.requestRender();
  }

  destroy(): void {
    if (this.renderFrame) cancelAnimationFrame(this.renderFrame);
    this.removeListeners.forEach((remove) => remove());
    this.resizeObserver.disconnect();
  }

  private listen(type: keyof HTMLElementEventMap, listener: (event: PointerEvent) => void): void {
    const typedListener = listener as EventListener;
    this.canvas.addEventListener(type, typedListener);
    this.removeListeners.push(() => this.canvas.removeEventListener(type, typedListener));
  }

  private resize(): void {
    const parent = this.canvas.parentElement;
    if (!parent) return;

    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, parent.clientWidth);
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
  }

  private pointerDown(event: PointerEvent): void {
    const point = this.eventPoint(event);
    const handle = this.roadMode ? this.hitConnectionHandle(point) : undefined;
    if (handle) {
      this.setHoveredZone("", null);
      this.callbacks.selectConnection("", null);
      this.connectionDrag = { fromZoneId: handle.zone.id, pointer: point, dropZoneId: "" };
      this.canvas.setPointerCapture(event.pointerId);
      this.callbacks.selectZone(handle.zone.id);
      this.requestRender();
      return;
    }

    const hit = this.hitTest(point);

    if (!hit) {
      const connectionHit = this.hitConnection(point);
      if (connectionHit) {
        this.draggingZoneId = "";
        this.setHoveredZone("", null);
        this.callbacks.selectZone("");
        this.callbacks.selectConnection(connectionHit.connection.id, connectionHit.midpoint);
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
    this.draggingZoneId = hit.zone.id;
    this.canvas.setPointerCapture(event.pointerId);
    this.callbacks.selectZone(hit.zone.id);
  }

  private pointerMove(event: PointerEvent): void {
    const point = this.eventPoint(event);
    if (this.connectionDrag) {
      this.setHoveredZone("", null);
      const dropZone = this.hitTest(point);
      this.connectionDrag = {
        ...this.connectionDrag,
        pointer: point,
        dropZoneId: dropZone && dropZone.zone.id !== this.connectionDrag.fromZoneId ? dropZone.zone.id : ""
      };
      this.requestRender();
      return;
    }

    if (!this.draggingZoneId) {
      const hover = this.hitTest(point);
      this.setHoveredZone(hover?.zone.id ?? "", hover ? point : null);
      return;
    }

    this.setHoveredZone("", null);
    if (!this.width || !this.height) return;
    this.dragPreviewPosition = this.nearestSlotPreviewPosition(point);
    this.rebuildZoneLayouts();
    this.requestRender();
  }

  private pointerUp(event: PointerEvent): void {
    if (this.connectionDrag) {
      const point = this.eventPoint(event);
      const dropZone = this.hitTest(point);
      const fromZoneId = this.connectionDrag.fromZoneId;
      this.connectionDrag = null;
      if (dropZone && dropZone.zone.id !== fromZoneId) this.callbacks.connectZones(fromZoneId, dropZone.zone.id, this.design);
      else this.requestRender();
      return;
    }

    if (this.draggingZoneId && this.dragPreviewPosition) {
      const zoneId = this.draggingZoneId;
      const position = this.dragPreviewPosition;
      this.draggingZoneId = "";
      this.dragPreviewPosition = null;
      this.callbacks.moveZone(zoneId, position);
      return;
    }
    this.draggingZoneId = "";
    this.dragPreviewPosition = null;
  }

  private cancelDrag(): void {
    this.draggingZoneId = "";
    this.dragPreviewPosition = null;
    this.connectionDrag = null;
    this.rebuildZoneLayouts();
    this.requestRender();
  }

  private setHoveredZone(zoneId: string, point: Point | null, hintId?: string): void {
    if (zoneId === this.hoveredZoneId && !point) return;
    this.hoveredZoneId = zoneId;
    this.callbacks.hoverZone(zoneId, point, hintId);
  }

  private nearestSlotPreviewPosition(point: Point): Point {
    const normalizedPoint = {
      x: clamp(point.x / this.width, 0.04, 0.96),
      y: clamp(point.y / this.height, 0.06, 0.94)
    };
    const occupied = this.design.zones
      .filter((zone) => zone.id !== this.draggingZoneId)
      .map((zone) => pointBoardSlotIndex(zone.position));
    return nearestAvailableBoardSlot(normalizedPoint, occupied).position;
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
    preview.zones = preview.zones.map((zone) => zone.id === this.draggingZoneId && this.dragPreviewPosition
      ? { ...zone, position: this.dragPreviewPosition }
      : zone);
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
    return this.reversedZoneLayouts.find((layout) => {
      const halfWidth = layout.box.width / 2 + 4;
      const halfHeight = layout.box.height / 2 + 4;
      const dx = (point.x - layout.box.centerX) / halfWidth;
      const dy = (point.y - layout.box.centerY) / halfHeight;
      return dx * dx + dy * dy <= 1;
    });
  }

  private hitConnection(point: Point): BoardRenderConnectionLayout | undefined {
    let closest: BoardRenderConnectionLayout | undefined;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (const layout of this.connectionLayouts) {
      const distance = distanceToSegment(point, layout.from, layout.to);
      if (distance > 10 || distance >= closestDistance) continue;
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

  private imageFor(source: string): HTMLImageElement {
    const cached = this.imageCache.get(source);
    if (cached) return cached;

    const image = new Image();
    image.decoding = "async";
    image.src = source;
    image.onload = () => {
      this.resize();
      this.requestRender();
    };
    image.onerror = () => this.requestRender();
    this.imageCache.set(source, image);
    return image;
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
