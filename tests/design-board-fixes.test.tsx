// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { boardSlots } from "../src/boardSlots";
import { buildPreviewDesign } from "../src/community/previewDesign";
import {
  PREVIEW_LARGE_HEIGHT,
  PREVIEW_LARGE_WIDTH,
  PREVIEW_THUMBNAIL_HEIGHT,
  PREVIEW_THUMBNAIL_WIDTH,
  generateMapPreviewImages,
} from "../src/community/previewImageGenerator";
import { CommunityMapCanvasPreview, COMMUNITY_MAP_CARD_PREVIEW_SIZE } from "../src/components/community/CommunityMapCanvasPreview";
import { DesignBoardCanvas } from "../src/components/DesignBoardCanvas";
import {
  BOARD_DRAG_START_DISTANCE,
  BOARD_ZONE_HIT_TOLERANCE,
  clampConnectionMenuPoint,
  DesignBoard,
  hitTestBoardZone,
  type BoardCallbacks,
} from "../src/components/designBoard";
import {
  boardZoneBadgeRadius,
  buildBoardRenderState,
  schematicBoardHeightForWidth,
  type BoardRenderZoneLayout,
} from "../src/components/designBoardRender";
import { addZone, createDefaultDesign, designToTemplate, type TemplateDesign } from "../src/design";
import { renderPreview } from "../src/previewRenderer";
import type { Point } from "../src/types";

// ── Canvas / layout test doubles ────────────────────────────────────────────

interface DrawCall {
  method: string;
  args: unknown[];
}

const contextCalls = new WeakMap<object, DrawCall[]>();
const resizeCallbacks = new Set<() => void>();
let pendingFrames: FrameRequestCallback[] = [];

function recordingContext(canvas: object): CanvasRenderingContext2D {
  const calls: DrawCall[] = [];
  contextCalls.set(canvas, calls);
  const target: Record<string, unknown> = {
    canvas,
    createLinearGradient: () => ({ addColorStop: () => undefined }),
  };
  return new Proxy(target, {
    get(object, prop) {
      if (prop in object) return object[prop as string];
      return (...args: unknown[]) => {
        calls.push({ method: String(prop), args });
      };
    },
    set(object, prop, value) {
      calls.push({ method: `set:${String(prop)}`, args: [value] });
      object[prop as string] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

function callsFor(canvas: object): DrawCall[] {
  return contextCalls.get(canvas) ?? [];
}

class ResizeObserverMock {
  constructor(private readonly callback: () => void) {}
  observe(): void {
    resizeCallbacks.add(this.callback);
  }
  unobserve(): void {}
  disconnect(): void {
    resizeCallbacks.delete(this.callback);
  }
}

function flushFrames(): void {
  const frames = pendingFrames;
  pendingFrames = [];
  frames.forEach((frame) => frame(0));
}

function triggerResize(): void {
  [...resizeCallbacks].forEach((callback) => callback());
}

beforeEach(() => {
  pendingFrames = [];
  resizeCallbacks.clear();
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    pendingFrames.push(callback);
    return pendingFrames.length;
  });
  vi.stubGlobal("cancelAnimationFrame", () => undefined);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
    return recordingContext(this);
  } as never);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (
    this: HTMLCanvasElement,
    callback: BlobCallback,
    type?: string,
  ) {
    callback(new Blob(["preview"], { type: type ?? "image/png" }));
  });
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ── DesignBoard harness ─────────────────────────────────────────────────────

const BOARD_WIDTH = 800;
const BOARD_HEIGHT = 600;

type CallbackMocks = { [K in keyof Required<BoardCallbacks>]: ReturnType<typeof vi.fn> };

function mountBoard(design: TemplateDesign, options: { roadMode?: boolean } = {}) {
  const parent = document.createElement("div");
  const canvas = document.createElement("canvas");
  parent.appendChild(canvas);
  document.body.appendChild(parent);
  let size = { width: BOARD_WIDTH, height: BOARD_HEIGHT };
  Object.defineProperty(parent, "clientWidth", { configurable: true, get: () => size.width });
  Object.defineProperty(parent, "clientHeight", { configurable: true, get: () => size.height });
  canvas.getBoundingClientRect = () => ({
    x: 0, y: 0, left: 0, top: 0, width: size.width, height: size.height, right: size.width, bottom: size.height, toJSON: () => ({}),
  }) as DOMRect;
  canvas.setPointerCapture = vi.fn();
  canvas.releasePointerCapture = vi.fn();
  canvas.hasPointerCapture = vi.fn(() => true);

  const callbacks: CallbackMocks = {
    selectZone: vi.fn(),
    selectConnection: vi.fn(),
    moveZone: vi.fn(),
    connectZones: vi.fn(),
    hoverZone: vi.fn(),
    resized: vi.fn(),
  };
  const board = new DesignBoard(canvas, callbacks as unknown as BoardCallbacks);
  board.update(design, "", "", options.roadMode ?? false);
  flushFrames();

  return {
    board,
    canvas,
    callbacks,
    setParentSize(next: { width: number; height: number }) {
      size = next;
      triggerResize();
      flushFrames();
    },
  };
}

function pointer(canvas: HTMLCanvasElement, type: string, point: Point, init: PointerEventInit = {}): void {
  canvas.dispatchEvent(new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: point.x,
    clientY: point.y,
    pointerId: 1,
    pointerType: "mouse",
    button: type === "pointermove" ? -1 : 0,
    buttons: type === "pointerup" ? 0 : 1,
    ...init,
  }));
}

function layoutsFor(design: TemplateDesign, width = BOARD_WIDTH, height = BOARD_HEIGHT) {
  return buildBoardRenderState(buildPreviewDesign(design), width, height);
}

function zoneCenter(design: TemplateDesign, zoneId: string): Point {
  const layout = layoutsFor(design).zoneLayoutsById.get(zoneId)!;
  return { x: layout.box.centerX, y: layout.box.centerY };
}

function radiusOf(layout: BoardRenderZoneLayout): number {
  return boardZoneBadgeRadius(layout);
}

/** Default design with Spawn-2 moved into the slot directly right of Neutral-3. */
function adjacentDesign(): TemplateDesign {
  const design = createDefaultDesign();
  const neutralSlot = boardSlots().find((slot) => Math.abs(slot.position.x - 0.5) < 1e-6 && Math.abs(slot.position.y - 0.5) < 1e-6)!;
  const rightSlot = boardSlots().find((slot) => slot.row === neutralSlot.row && slot.column === neutralSlot.column + 1)!;
  design.zones.find((zone) => zone.id === "zone-2")!.position = { ...rightSlot.position };
  return design;
}

const SLOT_STEP_X = (0.82 - 0.18) / 6;

// ── Bug 1: hidden board keeps its size ──────────────────────────────────────

describe("design board sizing", () => {
  it("keeps the last good canvas size while the board is hidden instead of shrinking it to 1x1", () => {
    const { canvas, callbacks, setParentSize } = mountBoard(createDefaultDesign());
    expect(canvas.width).toBe(BOARD_WIDTH);
    expect(canvas.height).toBe(BOARD_HEIGHT);
    expect(callbacks.resized).toHaveBeenLastCalledWith(BOARD_WIDTH, BOARD_HEIGHT);

    setParentSize({ width: 0, height: 0 });

    expect(canvas.width).toBe(BOARD_WIDTH);
    expect(canvas.height).toBe(BOARD_HEIGHT);
    expect(canvas.style.width).toBe(`${BOARD_WIDTH}px`);
    expect(callbacks.resized).not.toHaveBeenCalledWith(0, 0);

    setParentSize({ width: 1000, height: 750 });
    expect(canvas.width).toBe(1000);
    expect(canvas.height).toBe(750);
  });

  it("redraws at the new resolution when only the device pixel ratio changes", () => {
    const listeners: Array<() => void> = [];
    vi.stubGlobal("matchMedia", vi.fn(() => ({
      matches: true,
      addEventListener: (_type: string, listener: () => void) => listeners.push(listener),
      removeEventListener: vi.fn(),
    })));
    const { canvas } = mountBoard(createDefaultDesign());
    expect(canvas.width).toBe(BOARD_WIDTH);

    const descriptor = Object.getOwnPropertyDescriptor(window, "devicePixelRatio");
    Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 2 });
    try {
      listeners.splice(0).forEach((listener) => listener());
      expect(canvas.width).toBe(BOARD_WIDTH * 2);
      expect(canvas.height).toBe(BOARD_HEIGHT * 2);
      expect(canvas.style.width).toBe(`${BOARD_WIDTH}px`);
      expect(listeners.length).toBeGreaterThan(0);
    } finally {
      if (descriptor) Object.defineProperty(window, "devicePixelRatio", descriptor);
      else Reflect.deleteProperty(window, "devicePixelRatio");
    }
  });
});

// ── Bug 2 / 4: click vs drag, grab offset, pointer buttons ──────────────────

describe("design board zone dragging", () => {
  it("treats a press with a few pixels of wobble as a click, not a move", () => {
    const design = createDefaultDesign();
    const { canvas, callbacks } = mountBoard(design);
    const center = zoneCenter(design, "zone-3");

    pointer(canvas, "pointerdown", center);
    pointer(canvas, "pointermove", { x: center.x + 2, y: center.y + 1 });
    pointer(canvas, "pointerup", { x: center.x + 2, y: center.y + 1 });

    expect(BOARD_DRAG_START_DISTANCE).toBeGreaterThan(Math.hypot(2, 1));
    expect(callbacks.selectZone).toHaveBeenCalledWith("zone-3");
    expect(callbacks.moveZone).not.toHaveBeenCalled();
  });

  it("snaps the zone centre (pointer minus grab offset) so an off-centre grab does not jump a slot", () => {
    const design = createDefaultDesign();
    const { canvas, callbacks } = mountBoard(design);
    const center = zoneCenter(design, "zone-3");
    const layout = layoutsFor(design).zoneLayoutsById.get("zone-3")!;
    const grab = { x: center.x + radiusOf(layout) - 1, y: center.y };
    // Precondition: the grab point is past the midpoint to the next slot, so raw-pointer snapping would jump.
    expect(grab.x - center.x).toBeGreaterThan((SLOT_STEP_X * BOARD_WIDTH) / 2);

    pointer(canvas, "pointerdown", grab);
    pointer(canvas, "pointermove", { x: grab.x + 5, y: grab.y });
    pointer(canvas, "pointerup", { x: grab.x + 5, y: grab.y });

    expect(callbacks.moveZone).not.toHaveBeenCalled();
  });

  it("moves an off-centre grabbed zone by exactly the dragged distance", () => {
    const design = createDefaultDesign();
    const { canvas, callbacks } = mountBoard(design);
    const center = zoneCenter(design, "zone-3");
    const layout = layoutsFor(design).zoneLayoutsById.get("zone-3")!;
    const grab = { x: center.x + radiusOf(layout) - 1, y: center.y };
    const drop = { x: grab.x + SLOT_STEP_X * BOARD_WIDTH, y: grab.y };

    pointer(canvas, "pointerdown", grab);
    pointer(canvas, "pointermove", drop);
    pointer(canvas, "pointerup", drop);

    expect(callbacks.moveZone).toHaveBeenCalledTimes(1);
    const [zoneId, position] = callbacks.moveZone.mock.calls[0]!;
    expect(zoneId).toBe("zone-3");
    expect((position as Point).x).toBeCloseTo(0.5 + SLOT_STEP_X, 6);
    expect((position as Point).y).toBeCloseTo(0.5, 6);
  });

  it("does not report a move when a drag ends back on the zone's own slot", () => {
    const design = createDefaultDesign();
    const { canvas, callbacks } = mountBoard(design);
    const center = zoneCenter(design, "zone-3");

    pointer(canvas, "pointerdown", center);
    pointer(canvas, "pointermove", { x: center.x + 20, y: center.y + 15 });
    pointer(canvas, "pointermove", { x: center.x + 3, y: center.y });
    pointer(canvas, "pointerup", { x: center.x + 3, y: center.y });

    expect(callbacks.moveZone).not.toHaveBeenCalled();
  });

  it("ignores right and middle button presses on zones", () => {
    const design = createDefaultDesign();
    const { canvas, callbacks } = mountBoard(design);
    const center = zoneCenter(design, "zone-1");
    const far = { x: center.x + 150, y: center.y + 120 };

    for (const [button, buttons] of [[2, 2], [1, 4]] as const) {
      pointer(canvas, "pointerdown", center, { button, buttons });
      pointer(canvas, "pointermove", far, { buttons });
      pointer(canvas, "pointerup", far, { button, buttons: 0 });
    }

    expect(callbacks.selectZone).not.toHaveBeenCalled();
    expect(callbacks.moveZone).not.toHaveBeenCalled();
  });

  it("cancels a zone drag when a mouse move reports the primary button already released", () => {
    const design = createDefaultDesign();
    const { canvas, callbacks } = mountBoard(design);
    const center = zoneCenter(design, "zone-1");
    const far = { x: center.x + 150, y: center.y + 120 };

    pointer(canvas, "pointerdown", center);
    pointer(canvas, "pointermove", far);
    pointer(canvas, "pointermove", { x: far.x + 5, y: far.y }, { buttons: 0 });
    pointer(canvas, "pointerup", { x: far.x + 5, y: far.y });

    expect(callbacks.moveZone).not.toHaveBeenCalled();
  });

  it("does not create a road when a Road Mode handle is only clicked", () => {
    const design = adjacentDesign();
    const { canvas, callbacks } = mountBoard(design, { roadMode: true });
    const handle = layoutsFor(design).zoneLayoutsById.get("zone-3")!.handle;

    pointer(canvas, "pointerdown", handle);
    pointer(canvas, "pointerup", handle);
    expect(callbacks.connectZones).not.toHaveBeenCalled();

    const target = zoneCenter(design, "zone-1");
    pointer(canvas, "pointerdown", handle);
    pointer(canvas, "pointermove", target);
    pointer(canvas, "pointerup", target);
    expect(callbacks.connectZones).toHaveBeenCalledWith("zone-3", "zone-1", design);
  });

  it("keeps road drops forgiving on a hub's wide box while clicks there miss the drawn circle", () => {
    const design = addZone(createDefaultDesign(), "Hub");
    const hub = layoutsFor(design).zoneLayouts.find((layout) => layout.zone.role === "Hub")!;
    const side = { x: hub.box.left + 2, y: hub.box.centerY };
    expect(hub.box.centerX - side.x).toBeGreaterThan(radiusOf(hub) + BOARD_ZONE_HIT_TOLERANCE);

    const clickBoard = mountBoard(design);
    pointer(clickBoard.canvas, "pointerdown", side);
    pointer(clickBoard.canvas, "pointerup", side);
    expect(clickBoard.callbacks.selectZone).not.toHaveBeenCalledWith(hub.zone.id);

    const { canvas, callbacks } = mountBoard(design, { roadMode: true });
    const handle = layoutsFor(design).zoneLayoutsById.get("zone-1")!.handle;
    pointer(canvas, "pointerdown", handle);
    pointer(canvas, "pointermove", side);
    pointer(canvas, "pointerup", side);
    expect(callbacks.connectZones).toHaveBeenCalledWith("zone-1", hub.zone.id, design);
  });
});

// ── Bug 3: zone hit area matches the drawn circle ───────────────────────────

describe("design board hit testing", () => {
  it("hit-tests the drawn zone circle plus a small tolerance", () => {
    const design = createDefaultDesign();
    const state = layoutsFor(design);
    const layout = state.zoneLayoutsById.get("zone-3")!;
    const radius = boardZoneBadgeRadius(layout);
    const { centerX, centerY } = layout.box;

    expect(hitTestBoardZone(state.reversedZoneLayouts, { x: centerX + radius + BOARD_ZONE_HIT_TOLERANCE - 0.5, y: centerY })?.zone.id).toBe("zone-3");
    expect(hitTestBoardZone(state.reversedZoneLayouts, { x: centerX + radius + BOARD_ZONE_HIT_TOLERANCE + 1, y: centerY })).toBeUndefined();
    // The old ellipse reached box.width / 2 + 4 horizontally, well outside the drawn circle.
    expect(hitTestBoardZone(state.reversedZoneLayouts, { x: centerX + layout.box.width / 2 + 2, y: centerY })).toBeUndefined();
  });

  it("selects the connection when clicking the visible line between adjacent zones", () => {
    const design = adjacentDesign();
    const { canvas, callbacks } = mountBoard(design);
    const state = layoutsFor(design);
    const left = state.zoneLayoutsById.get("zone-3")!;
    const right = state.zoneLayoutsById.get("zone-2")!;
    const lineStart = left.box.centerX + radiusOf(left);
    const lineEnd = right.box.centerX - radiusOf(right);
    expect(lineEnd - lineStart).toBeGreaterThan(8);
    const click = { x: (lineStart + lineEnd) / 2, y: left.box.centerY };

    pointer(canvas, "pointerdown", click);
    pointer(canvas, "pointerup", click);

    expect(callbacks.selectZone).not.toHaveBeenCalledWith("zone-2");
    expect(callbacks.selectZone).not.toHaveBeenCalledWith("zone-3");
    expect(callbacks.selectConnection).toHaveBeenCalledWith("conn-3-2", expect.objectContaining({
      x: expect.closeTo((0.5 + 0.5 + SLOT_STEP_X) / 2, 6),
      y: expect.closeTo(0.5, 6),
    }));
  });
});

// ── Bug 8: connection menu placement ────────────────────────────────────────

describe("board connection menu", () => {
  it("keeps the menu inside the board", () => {
    const board = { width: 800, height: 600 };
    const menu = { width: 200, height: 44 };

    expect(clampConnectionMenuPoint({ x: 0.5, y: 0.5 }, board, menu)).toEqual({ x: 400, y: 300 });
    expect(clampConnectionMenuPoint({ x: 0.01, y: 0.02 }, board, menu)).toEqual({ x: 108, y: 62 });
    expect(clampConnectionMenuPoint({ x: 0.99, y: 1 }, board, menu)).toEqual({ x: 692, y: 592 });
    expect(clampConnectionMenuPoint({ x: 0.5, y: 0.5 }, { width: 150, height: 600 }, menu).x).toBe(75);
  });

  it("repositions the open menu when the board is resized", () => {
    let size = { width: BOARD_WIDTH, height: BOARD_HEIGHT };
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(() => size.width);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(() => size.height);
    vi.spyOn(HTMLCanvasElement.prototype, "getBoundingClientRect").mockImplementation(() => ({
      x: 0, y: 0, left: 0, top: 0, width: size.width, height: size.height, right: size.width, bottom: size.height, toJSON: () => ({}),
    }) as DOMRect);

    const design = createDefaultDesign();
    const props = {
      design,
      selectedZoneId: "",
      roadMode: false,
      onSelectZone: vi.fn(),
      onMoveZone: vi.fn(),
      onConnectZones: vi.fn(),
      onEditConnection: vi.fn(),
      onDeleteConnection: vi.fn(),
    };
    const onSelectConnection = vi.fn();
    const { container, rerender } = render(
      <DesignBoardCanvas {...props} selectedConnectionId="" onSelectConnection={onSelectConnection} />
    );
    const canvas = container.querySelector("canvas") as HTMLCanvasElement;
    canvas.setPointerCapture = vi.fn();
    canvas.releasePointerCapture = vi.fn();
    canvas.hasPointerCapture = vi.fn(() => false);
    const lineY = BOARD_HEIGHT * 0.5;

    fireEvent.pointerDown(canvas, { clientX: BOARD_WIDTH * 0.34, clientY: lineY, pointerId: 1 });
    expect(onSelectConnection).toHaveBeenCalledWith("conn-1-3");
    rerender(<DesignBoardCanvas {...props} selectedConnectionId="conn-1-3" onSelectConnection={onSelectConnection} />);

    const menu = container.querySelector(".board-connection-actions") as HTMLElement;
    expect(menu).toBeTruthy();
    expect(Number.parseFloat(menu.style.left)).toBeCloseTo(BOARD_WIDTH * 0.34, 6);
    expect(Number.parseFloat(menu.style.top)).toBeCloseTo(lineY, 6);

    size = { width: 1000, height: 750 };
    act(() => triggerResize());

    const resizedMenu = container.querySelector(".board-connection-actions") as HTMLElement;
    expect(Number.parseFloat(resizedMenu.style.left)).toBeCloseTo(1000 * 0.34, 6);
    expect(Number.parseFloat(resizedMenu.style.top)).toBeCloseTo(750 * 0.5, 6);
  });
});

// ── Bug 1 / 5: preview export renders a clean board offscreen ───────────────

describe("builder preview export", () => {
  it("renders the schematic board from the design instead of copying the live (possibly hidden) canvas", async () => {
    const hiddenBoardCanvas = document.createElement("canvas");
    hiddenBoardCanvas.width = 1;
    hiddenBoardCanvas.height = 1;
    const created: HTMLCanvasElement[] = [];
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation(((tagName: string, options?: ElementCreationOptions) => {
      const element = originalCreateElement(tagName, options);
      if (tagName === "canvas") created.push(element as HTMLCanvasElement);
      return element;
    }) as typeof document.createElement);

    const result = await generateMapPreviewImages(createDefaultDesign(), { format: "image/png", source: hiddenBoardCanvas });

    expect(result.largeWidth).toBe(PREVIEW_LARGE_WIDTH);
    expect(result.largeHeight).toBe(PREVIEW_LARGE_HEIGHT);
    expect(result.thumbnailWidth).toBe(PREVIEW_THUMBNAIL_WIDTH);
    expect(result.thumbnailHeight).toBe(PREVIEW_THUMBNAIL_HEIGHT);
    expect(result.large.type).toBe("image/png");

    const drawImageCalls = created.flatMap((canvas) => callsFor(canvas)
      .filter((call) => call.method === "drawImage")
      .map((call) => ({ target: canvas, args: call.args })));
    expect(drawImageCalls.some((call) => call.args[0] === hiddenBoardCanvas)).toBe(false);

    const outputs = drawImageCalls.filter((call) => call.args[0] instanceof HTMLCanvasElement);
    expect(outputs.map((call) => [call.target.width, call.target.height])).toEqual([
      [PREVIEW_LARGE_WIDTH, PREVIEW_LARGE_HEIGHT],
      [PREVIEW_THUMBNAIL_WIDTH, PREVIEW_THUMBNAIL_HEIGHT],
    ]);
    const boardCanvas = outputs[0]!.args[0] as HTMLCanvasElement;
    expect(outputs[1]!.args[0]).toBe(boardCanvas);
    // The board is rendered at the background's aspect ratio and at least 1:1 for the large export.
    expect(boardCanvas.width).toBe(PREVIEW_LARGE_WIDTH);
    expect(boardCanvas.height).toBe(schematicBoardHeightForWidth(PREVIEW_LARGE_WIDTH));
    const cropY = (boardCanvas.height - PREVIEW_LARGE_HEIGHT) / 2;
    expect(outputs[0]!.args.slice(1)).toEqual([0, cropY, PREVIEW_LARGE_WIDTH, PREVIEW_LARGE_HEIGHT, 0, 0, PREVIEW_LARGE_WIDTH, PREVIEW_LARGE_HEIGHT]);

    const boardCalls = callsFor(boardCanvas);
    const texts = boardCalls.filter((call) => call.method === "fillText").map((call) => call.args[0]);
    expect(texts).toEqual(expect.arrayContaining(["Spawn-1", "Neutral-3", "Spawn-2"]));
    // No builder UI: no selection shadow and no Road Mode "+" handles.
    expect(boardCalls.filter((call) => call.method === "set:shadowColor")).toEqual([]);
    expect(boardCalls.some((call) => call.method === "set:fillStyle" && call.args[0] === "rgba(18, 25, 35, 0.94)")).toBe(false);
  });
});

// ── Bug 6: community canvas previews are sized by CSS ───────────────────────

describe("community canvas preview sizing", () => {
  it("sets only the pixel buffer and lets the element scale to its container", () => {
    const { container } = render(
      <CommunityMapCanvasPreview
        previewDesignJson={null}
        width={COMMUNITY_MAP_CARD_PREVIEW_SIZE.width}
        height={COMMUNITY_MAP_CARD_PREVIEW_SIZE.height}
        className="community-map-preview"
      />
    );
    const canvas = container.querySelector("canvas") as HTMLCanvasElement;

    expect(canvas.width).toBe(COMMUNITY_MAP_CARD_PREVIEW_SIZE.width);
    expect(canvas.height).toBe(COMMUNITY_MAP_CARD_PREVIEW_SIZE.height);
    expect(canvas.style.width).toBe("100%");
    expect(canvas.style.height).toBe("auto");
  });
});

// ── Bug 7: classic preview uses the assigned spawn player ───────────────────

describe("classic preview player colours", () => {
  it("labels and colours a spawn by its assigned player, not its name", () => {
    const design = createDefaultDesign();
    const spawn = design.zones.find((zone) => zone.id === "zone-2")!;
    spawn.name = "Spawn-4";
    spawn.player = 2;
    const template = designToTemplate(design);
    expect(template.variants?.[0]?.zones?.find((zone) => zone.name === "Spawn-4")?.mainObjects?.[0]?.spawn).toBe("Player2");

    const ctx = recordingContext({});
    renderPreview(ctx, template, { width: 800, height: 450 });
    const calls = callsFor((ctx as unknown as { canvas: object }).canvas);
    const texts = calls.filter((call) => call.method === "fillText").map((call) => call.args[0]);
    const fills = calls.filter((call) => call.method === "set:fillStyle").map((call) => call.args[0]);

    expect(texts).toContain("P2");
    expect(texts).not.toContain("P4");
    expect(fills).toContain("rgba(200,60,60,0.45)");
    expect(fills).not.toContain("rgba(60,180,75,0.45)");
  });

  it("colours a natural expansion like the player of its parent spawn", () => {
    const template = {
      name: "Naturals",
      sizeX: 160,
      sizeZ: 160,
      variants: [{
        border: { cornerRadius: 0.15, obstaclesWidth: 3 },
        connections: [],
        zones: [
          { name: "Spawn-A", generatorPosition: { x: 0.2, y: 0.5 }, mainObjects: [{ type: "Spawn", spawn: "Player3" }] },
          { name: "Natural-A", generatorPosition: { x: 0.4, y: 0.5 } },
          { name: "Hub", generatorPosition: { x: 0.8, y: 0.5 } },
        ],
      }],
    } as unknown as Parameters<typeof renderPreview>[1];

    const ctx = recordingContext({});
    renderPreview(ctx, template, { width: 800, height: 450 });
    const calls = callsFor((ctx as unknown as { canvas: object }).canvas);
    const texts = calls.filter((call) => call.method === "fillText").map((call) => call.args[0]);
    const fills = calls.filter((call) => call.method === "set:fillStyle").map((call) => call.args[0]);

    expect(texts).toContain("P3");
    expect(texts).toContain("E3");
    expect(fills).toContain("rgba(70,130,210,0.45)");
    expect(fills).toContain("rgba(70,130,210,0.55)");
    expect(fills).not.toContain("rgba(212,175,55,0.45)");
  });
});
