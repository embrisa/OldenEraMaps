/**
 * Preview image generator.
 *
 * Generates thumbnail and large preview Blobs from a TemplateDesign.
 * Prefers a cropped schematic board screenshot when one is supplied,
 * and otherwise falls back to the deterministic preview renderer.
 */

import { designToTemplate, type TemplateDesign } from "@/design";
import { renderPreview, type PreviewRenderOptions } from "@/previewRenderer";

// ── Default sizes (task spec) ──────────────────────────────────────────────

export const PREVIEW_LARGE_WIDTH = 1200;
export const PREVIEW_LARGE_HEIGHT = 675;
export const PREVIEW_THUMBNAIL_WIDTH = 480;
export const PREVIEW_THUMBNAIL_HEIGHT = 270;

export interface PreviewImageResult {
  large: Blob;
  largeWidth: number;
  largeHeight: number;
  thumbnail: Blob;
  thumbnailWidth: number;
  thumbnailHeight: number;
}

export type PreviewImageSource = HTMLCanvasElement | OffscreenCanvas | HTMLImageElement | ImageBitmap;

export interface GeneratePreviewOptions {
  /** Large preview width (default 1200). */
  largeWidth?: number;
  /** Large preview height (default 675). */
  largeHeight?: number;
  /** Thumbnail width (default 480). */
  thumbnailWidth?: number;
  /** Thumbnail height (default 270). */
  thumbnailHeight?: number;
  /** Image format: "image/webp" or "image/png" (default webp with png fallback). */
  format?: "image/webp" | "image/png";
  /** Quality for lossy formats (0–1, default 0.85). */
  quality?: number;
  /** Optional board screenshot source to crop into the preview sizes. */
  source?: PreviewImageSource;
  /** Optional title to overlay. */
  title?: string;
  /** Optional metadata to overlay. */
  metadata?: { playerCount?: number; size?: string; winCondition?: string };
}

/**
 * Generate preview images from a TemplateDesign.
 * Returns both large and thumbnail Blobs.
 *
 * Uses OffscreenCanvas when available, falls back to document.createElement("canvas").
 */
export async function generateMapPreviewImages(
  design: TemplateDesign,
  options: GeneratePreviewOptions = {}
): Promise<PreviewImageResult> {
  const template = designToTemplate(design);
  const format = options.format ?? preferredFormat();
  const quality = options.quality ?? 0.85;

  const largeW = options.largeWidth ?? PREVIEW_LARGE_WIDTH;
  const largeH = options.largeHeight ?? PREVIEW_LARGE_HEIGHT;
  const thumbW = options.thumbnailWidth ?? PREVIEW_THUMBNAIL_WIDTH;
  const thumbH = options.thumbnailHeight ?? PREVIEW_THUMBNAIL_HEIGHT;
  const source = options.source;

  const renderOpts: Omit<PreviewRenderOptions, "width" | "height"> = {
    dpr: 1,
    title: options.title,
    metadata: options.metadata,
  };

  const [large, thumbnail] = await Promise.all([
    source
      ? renderSourceToBlob(source, largeW, largeH, format, quality)
      : renderToBlob({ ...renderOpts, width: largeW, height: largeH }, template, format, quality),
    source
      ? renderSourceToBlob(source, thumbW, thumbH, format, quality)
      : renderToBlob({ ...renderOpts, width: thumbW, height: thumbH }, template, format, quality),
  ]);

  return {
    large,
    largeWidth: largeW,
    largeHeight: largeH,
    thumbnail,
    thumbnailWidth: thumbW,
    thumbnailHeight: thumbH,
  };
}

// ── Internal rendering ─────────────────────────────────────────────────────

async function renderSourceToBlob(
  source: PreviewImageSource,
  width: number,
  height: number,
  format: string,
  quality: number
): Promise<Blob> {
  const { width: sourceWidth, height: sourceHeight } = readSourceDimensions(source);
  const crop = centerCropRect(sourceWidth, sourceHeight, width, height);

  if (typeof OffscreenCanvas !== "undefined") {
    try {
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Failed to create OffscreenCanvas 2D context.");
      if (typeof canvas.convertToBlob !== "function") {
        throw new Error("OffscreenCanvas convertToBlob is unavailable.");
      }
      ctx.drawImage(source as CanvasImageSource, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);
      return await canvas.convertToBlob({ type: format, quality });
    } catch (error) {
      if (typeof document === "undefined") throw error;
    }
  }

  if (typeof document === "undefined") {
    throw new Error("No DOM canvas fallback is available.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to create canvas 2D context.");
  ctx.drawImage(source as CanvasImageSource, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas toBlob returned null."));
      },
      format,
      quality
    );
  });
}

async function renderToBlob(
  renderOptions: PreviewRenderOptions,
  template: ReturnType<typeof designToTemplate>,
  format: string,
  quality: number
): Promise<Blob> {
  const w = renderOptions.width;
  const h = renderOptions.height;

  if (typeof OffscreenCanvas !== "undefined") {
    try {
      const canvas = new OffscreenCanvas(w, h);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Failed to create OffscreenCanvas 2D context.");
      if (typeof canvas.convertToBlob !== "function") {
        throw new Error("OffscreenCanvas convertToBlob is unavailable.");
      }
      renderPreview(ctx as unknown as OffscreenCanvasRenderingContext2D, template, renderOptions);
      return await canvas.convertToBlob({ type: format, quality });
    } catch (error) {
      if (typeof document === "undefined") throw error;
    }
  }

  if (typeof document === "undefined") {
    throw new Error("No DOM canvas fallback is available.");
  }

  // Fallback: use a DOM canvas
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to create canvas 2D context.");
  renderPreview(ctx, template, renderOptions);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas toBlob returned null."));
      },
      format,
      quality
    );
  });
}

function readSourceDimensions(source: PreviewImageSource): { width: number; height: number } {
  const width = "naturalWidth" in source ? source.naturalWidth || source.width : source.width;
  const height = "naturalHeight" in source ? source.naturalHeight || source.height : source.height;
  if (!(width > 0) || !(height > 0)) {
    throw new Error("Preview source has invalid dimensions.");
  }
  return { width, height };
}

function centerCropRect(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number
): { x: number; y: number; width: number; height: number } {
  const sourceAspect = sourceWidth / sourceHeight;
  const targetAspect = targetWidth / targetHeight;

  if (sourceAspect > targetAspect) {
    const width = sourceHeight * targetAspect;
    return {
      x: (sourceWidth - width) / 2,
      y: 0,
      width,
      height: sourceHeight,
    };
  }

  const height = sourceWidth / targetAspect;
  return {
    x: 0,
    y: (sourceHeight - height) / 2,
    width: sourceWidth,
    height,
  };
}

function preferredFormat(): "image/webp" | "image/png" {
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const dataUrl = canvas.toDataURL("image/webp");
    if (dataUrl.startsWith("data:image/webp")) return "image/webp";
  }
  return "image/png";
}
