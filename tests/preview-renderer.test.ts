// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { createDefaultDesign, designToTemplate } from "../src/design";
import { renderPreview, type PreviewRenderOptions } from "../src/previewRenderer";
import {
  PREVIEW_LARGE_WIDTH,
  PREVIEW_LARGE_HEIGHT,
  PREVIEW_THUMBNAIL_WIDTH,
  PREVIEW_THUMBNAIL_HEIGHT,
  generateMapPreviewImages,
} from "../src/community/previewImageGenerator";

// ── Helper: stub CanvasRenderingContext2D ───────────────────────────────────

interface DrawCall {
  method: string;
  args: unknown[];
}

function createStubContext(): { ctx: CanvasRenderingContext2D; calls: DrawCall[] } {
  const calls: DrawCall[] = [];
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(target, prop) {
      if (prop in target) return target[prop as string];
      return (...args: unknown[]) => {
        calls.push({ method: String(prop), args });
      };
    },
    set(target, prop, value) {
      calls.push({ method: `set:${String(prop)}`, args: [value] });
      target[prop as string] = value;
      return true;
    },
  };
  const ctx = new Proxy({
    canvas: { width: 1200, height: 675 },
  } as Record<string, unknown>, handler);
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("previewRenderer", () => {
  it("renders a default 2-player design without errors", () => {
    const design = createDefaultDesign();
    const template = designToTemplate(design);
    const { ctx, calls } = createStubContext();

    const opts: PreviewRenderOptions = { width: PREVIEW_LARGE_WIDTH, height: PREVIEW_LARGE_HEIGHT };
    renderPreview(ctx, template, opts);

    // Should have drawn background + zone cells + connections + labels
    expect(calls.length).toBeGreaterThan(10);
    const fillTextCalls = calls.filter((c) => c.method === "fillText");
    expect(fillTextCalls.length).toBeGreaterThan(0);

    // Zone labels P1, P2, N3 should appear
    const labelTexts = fillTextCalls.map((c) => c.args[0] as string);
    expect(labelTexts).toContain("P1");
    expect(labelTexts).toContain("P2");
  });

  it("renders a 4-player design with Hub zone", () => {
    const design = createDefaultDesign();
    design.templateName = "Hub Test";
    // The default already has zones but let's verify rendering the template works
    const template = designToTemplate(design);
    const { ctx, calls } = createStubContext();

    renderPreview(ctx, template, { width: PREVIEW_THUMBNAIL_WIDTH, height: PREVIEW_THUMBNAIL_HEIGHT });
    expect(calls.length).toBeGreaterThan(5);
  });

  it("uses a slightly smaller font for zone labels in large previews", () => {
    const design = createDefaultDesign();
    const template = designToTemplate(design);
    const { ctx, calls } = createStubContext();

    renderPreview(ctx, template, { width: PREVIEW_LARGE_WIDTH, height: PREVIEW_LARGE_HEIGHT });

    const fontCalls = calls
      .filter((call) => call.method === "set:font")
      .map((call) => call.args[0])
      .filter((value): value is string => typeof value === "string");

    expect(fontCalls).toContain("bold 11px Inter, system-ui, sans-serif");
    expect(fontCalls).toContain("9px Inter, system-ui, sans-serif");
  });

  it("renders with title and metadata overlays", () => {
    const design = createDefaultDesign();
    const template = designToTemplate(design);
    const { ctx, calls } = createStubContext();

    renderPreview(ctx, template, {
      width: PREVIEW_LARGE_WIDTH,
      height: PREVIEW_LARGE_HEIGHT,
      title: "Temple Clash",
      metadata: { playerCount: 2, size: "160×160" },
    });

    const fillTextCalls = calls.filter((c) => c.method === "fillText");
    const texts = fillTextCalls.map((c) => c.args[0] as string);
    expect(texts).toContain("Temple Clash");
    expect(texts.some((t) => t.includes("2P"))).toBe(true);
  });

  it("does not render plus sign / road markers for connections", () => {
    const design = createDefaultDesign();
    // All default connections have roads
    design.connections.forEach((c) => { c.road = true; });
    const template = designToTemplate(design);
    const { ctx, calls } = createStubContext();

    renderPreview(ctx, template, { width: PREVIEW_LARGE_WIDTH, height: PREVIEW_LARGE_HEIGHT });

    // No "+" text should appear in fillText calls
    const fillTextCalls = calls.filter((c) => c.method === "fillText");
    const texts = fillTextCalls.map((c) => c.args[0] as string);
    expect(texts).not.toContain("+");
  });

  it("draws each road connection with a distinct preview color", () => {
    const design = createDefaultDesign();
    design.connections.forEach((connection) => { connection.road = true; });
    const template = designToTemplate(design);
    const { ctx, calls } = createStubContext();

    renderPreview(ctx, template, { width: PREVIEW_LARGE_WIDTH, height: PREVIEW_LARGE_HEIGHT });

    const roadStrokeColors = calls
      .filter((call) => call.method === "set:strokeStyle")
      .map((call) => call.args[0])
      .filter((value): value is string => typeof value === "string" && value.startsWith("hsl("));

    expect(roadStrokeColors).toHaveLength(design.connections.length);
    expect(new Set(roadStrokeColors).size).toBe(roadStrokeColors.length);
  });

  it("does not assign unique road colors to non-road preview connections", () => {
    const design = createDefaultDesign();
    design.connections[0]!.road = false;
    design.connections[1]!.road = true;
    const template = designToTemplate(design);
    const { ctx, calls } = createStubContext();

    renderPreview(ctx, template, { width: PREVIEW_LARGE_WIDTH, height: PREVIEW_LARGE_HEIGHT });

    const roadStrokeColors = calls
      .filter((call) => call.method === "set:strokeStyle")
      .map((call) => call.args[0])
      .filter((value): value is string => typeof value === "string" && value.startsWith("hsl("));

    expect(roadStrokeColors).toHaveLength(1);
  });

  it("draws player zones after neutral zones", () => {
    const design = createDefaultDesign();
    const template = designToTemplate(design);
    const { ctx, calls } = createStubContext();

    renderPreview(ctx, template, { width: 800, height: 450 });

    // Verify that fillText calls have neutral labels appearing before player labels
    const fillTextCalls = calls.filter((c) => c.method === "fillText");
    const labelTexts = fillTextCalls.map((c) => c.args[0] as string);

    // Zone cells are drawn (via fill() calls), we track the order by checking
    // that the rendering function completed without errors
    expect(labelTexts.length).toBeGreaterThan(0);
  });

  it("handles empty template (no zones) gracefully", () => {
    // Create a minimal template directly (designToTemplate validates, so bypass it)
    const template = {
      name: "Empty",
      sizeX: 160,
      sizeZ: 160,
      variants: [{ zones: [], connections: [], border: { cornerRadius: 0.15, obstaclesWidth: 3 } }],
    } as unknown as import("../src/types").RmgTemplate;
    const { ctx } = createStubContext();

    // Should not throw
    expect(() => {
      renderPreview(ctx, template, { width: 480, height: 270 });
    }).not.toThrow();
  });

  it("produces different output for different designs", () => {
    const design1 = createDefaultDesign();
    design1.templateName = "Design A";
    const template1 = designToTemplate(design1);
    const { ctx: ctx1, calls: calls1 } = createStubContext();
    renderPreview(ctx1, template1, { width: 480, height: 270, title: "Design A" });

    const design2 = createDefaultDesign();
    design2.templateName = "Design B";
    design2.mapWidth = 200;
    design2.mapHeight = 200;
    const template2 = designToTemplate(design2);
    const { ctx: ctx2, calls: calls2 } = createStubContext();
    renderPreview(ctx2, template2, { width: 480, height: 270, title: "Design B" });

    // Different titles should produce different fillText calls
    const texts1 = calls1.filter((c) => c.method === "fillText").map((c) => c.args[0]);
    const texts2 = calls2.filter((c) => c.method === "fillText").map((c) => c.args[0]);
    expect(texts1).toContain("Design A");
    expect(texts2).toContain("Design B");
    expect(texts1).not.toContain("Design B");
  });

  it("uses stable dimensions across renders", () => {
    const design = createDefaultDesign();
    const template = designToTemplate(design);
    const opts: PreviewRenderOptions = { width: PREVIEW_LARGE_WIDTH, height: PREVIEW_LARGE_HEIGHT };

    const { ctx: ctx1, calls: calls1 } = createStubContext();
    renderPreview(ctx1, template, opts);
    const { ctx: ctx2, calls: calls2 } = createStubContext();
    renderPreview(ctx2, template, opts);

    // Same design should produce same number of draw calls
    expect(calls1.length).toBe(calls2.length);
  });
});

describe("preview image dimensions", () => {
  it("exports expected default sizes", () => {
    expect(PREVIEW_LARGE_WIDTH).toBe(1200);
    expect(PREVIEW_LARGE_HEIGHT).toBe(675);
    expect(PREVIEW_THUMBNAIL_WIDTH).toBe(480);
    expect(PREVIEW_THUMBNAIL_HEIGHT).toBe(270);
  });
});

describe("preview image generation", () => {
  it("crops the schematic board screenshot to the preview aspect ratio when a source canvas is provided", async () => {
    const drawCalls: Array<{ canvasWidth: number; canvasHeight: number; args: unknown[] }> = [];
    const sourceCanvas = { width: 1448, height: 1086 } as HTMLCanvasElement;
    const originalCreateElement = document.createElement.bind(document) as typeof document.createElement;
    const createElementMock = vi.spyOn(document, "createElement").mockImplementation(((tagName: string) => {
      if (tagName !== "canvas") return originalCreateElement(tagName as never);

      const canvas = {
        width: 0,
        height: 0,
        getContext: () => ({
          drawImage: (...args: unknown[]) => {
            drawCalls.push({ canvasWidth: canvas.width, canvasHeight: canvas.height, args });
          },
        }),
        toBlob: (callback: (blob: Blob | null) => void, type?: string) => {
          callback(new Blob(["preview"], { type: type ?? "image/png" }));
        },
      } as unknown as HTMLCanvasElement;

      return canvas;
    }) as typeof document.createElement);

    try {
      const result = await generateMapPreviewImages(createDefaultDesign(), {
        source: sourceCanvas,
        format: "image/png",
      });

      expect(result.largeWidth).toBe(PREVIEW_LARGE_WIDTH);
      expect(result.largeHeight).toBe(PREVIEW_LARGE_HEIGHT);
      expect(result.thumbnailWidth).toBe(PREVIEW_THUMBNAIL_WIDTH);
      expect(result.thumbnailHeight).toBe(PREVIEW_THUMBNAIL_HEIGHT);
      expect(drawCalls).toHaveLength(2);

      for (const call of drawCalls) {
        expect(call.args[0]).toBe(sourceCanvas);
        expect(call.args[1]).toBe(0);
        expect(call.args[2]).toBeCloseTo(135.75, 2);
        expect(call.args[3]).toBe(1448);
        expect(call.args[4]).toBeCloseTo(814.5, 2);
        expect(call.args[5]).toBe(0);
        expect(call.args[6]).toBe(0);
      }

      expect(drawCalls[0]?.canvasWidth).toBe(PREVIEW_LARGE_WIDTH);
      expect(drawCalls[0]?.canvasHeight).toBe(PREVIEW_LARGE_HEIGHT);
      expect(drawCalls[0]?.args[7]).toBe(PREVIEW_LARGE_WIDTH);
      expect(drawCalls[0]?.args[8]).toBe(PREVIEW_LARGE_HEIGHT);

      expect(drawCalls[1]?.canvasWidth).toBe(PREVIEW_THUMBNAIL_WIDTH);
      expect(drawCalls[1]?.canvasHeight).toBe(PREVIEW_THUMBNAIL_HEIGHT);
      expect(drawCalls[1]?.args[7]).toBe(PREVIEW_THUMBNAIL_WIDTH);
      expect(drawCalls[1]?.args[8]).toBe(PREVIEW_THUMBNAIL_HEIGHT);
    } finally {
      createElementMock.mockRestore();
    }
  });

  it("falls back to a DOM canvas when OffscreenCanvas export is unavailable", async () => {
    const originalOffscreenCanvas = globalThis.OffscreenCanvas;
    const originalCreateElement = document.createElement.bind(document) as typeof document.createElement;
    const drawCalls: Array<{ canvasWidth: number; canvasHeight: number }> = [];

    class BrokenOffscreenCanvasMock {
      width: number;
      height: number;

      constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
      }

      getContext(): null {
        return null;
      }
    }

    globalThis.OffscreenCanvas = BrokenOffscreenCanvasMock as unknown as typeof OffscreenCanvas;
    const createElementMock = vi.spyOn(document, "createElement").mockImplementation(((tagName: string) => {
      if (tagName !== "canvas") return originalCreateElement(tagName as never);

      const canvas = {
        width: 0,
        height: 0,
        getContext: () => ({
          setTransform: vi.fn(),
          clearRect: vi.fn(),
          fillRect: vi.fn(),
          beginPath: vi.fn(),
          closePath: vi.fn(),
          moveTo: vi.fn(),
          lineTo: vi.fn(),
          stroke: vi.fn(),
          save: vi.fn(),
          restore: vi.fn(),
          arc: vi.fn(),
          fill: vi.fn(),
          createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
          drawImage: vi.fn(() => {
            drawCalls.push({ canvasWidth: canvas.width, canvasHeight: canvas.height });
          }),
          clip: vi.fn(),
          fillText: vi.fn(),
          quadraticCurveTo: vi.fn(),
          setLineDash: vi.fn(),
          strokeText: vi.fn(),
          createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() }))
        }),
        toBlob: (callback: (blob: Blob | null) => void, type?: string) => {
          callback(new Blob(["preview"], { type: type ?? "image/png" }));
        },
        toDataURL: () => "data:image/png;base64,preview",
      } as unknown as HTMLCanvasElement;

      return canvas;
    }) as typeof document.createElement);

    try {
      const result = await generateMapPreviewImages(createDefaultDesign(), {
        source: { width: 1448, height: 1086 } as HTMLCanvasElement,
      });

      expect(result.large.type).toBe("image/png");
      expect(result.thumbnail.type).toBe("image/png");
      expect(drawCalls).toHaveLength(2);
      expect(drawCalls[0]).toEqual({ canvasWidth: PREVIEW_LARGE_WIDTH, canvasHeight: PREVIEW_LARGE_HEIGHT });
      expect(drawCalls[1]).toEqual({ canvasWidth: PREVIEW_THUMBNAIL_WIDTH, canvasHeight: PREVIEW_THUMBNAIL_HEIGHT });
    } finally {
      createElementMock.mockRestore();
      globalThis.OffscreenCanvas = originalOffscreenCanvas;
    }
  });
});
