import { parsePreviewDesignJson } from "@/community/previewDesign";
import {
  buildBoardRenderState,
  renderSchematicBoardPlaceholder,
  renderSchematicBoardPreview,
  schematicBoardHeightForWidth,
} from "@/components/designBoardRender";

export const COMMUNITY_MAP_CARD_PREVIEW_SIZE = {
  width: 384,
  height: 256,
} as const;

export const COMMUNITY_MAP_DETAIL_PREVIEW_SIZE = {
  width: 940,
  height: schematicBoardHeightForWidth(940),
} as const;

export const COMMUNITY_TEMPLATE_PREVIEW_IMAGE_SIZE = {
  width: 700,
  height: 700,
} as const;

interface CommunityPreviewImageOptions {
  width?: number;
  height?: number;
  dpr?: number;
  type?: "image/png" | "image/webp";
  quality?: number;
}

export async function renderCommunityMapPreviewImageBlob(
  previewDesignJson: string | null,
  options: CommunityPreviewImageOptions = {}
): Promise<Blob> {
  const width = options.width ?? COMMUNITY_TEMPLATE_PREVIEW_IMAGE_SIZE.width;
  const height = options.height ?? COMMUNITY_TEMPLATE_PREVIEW_IMAGE_SIZE.height;
  const dpr = options.dpr ?? 1;
  const type = options.type ?? "image/png";

  if (typeof OffscreenCanvas !== "undefined") {
    try {
      const canvas = new OffscreenCanvas(Math.round(width * dpr), Math.round(height * dpr));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Failed to create OffscreenCanvas 2D context.");
      paintCommunityPreview(ctx as unknown as CanvasRenderingContext2D, previewDesignJson, width, height, dpr);
      if (typeof canvas.convertToBlob !== "function") {
        throw new Error("OffscreenCanvas convertToBlob is unavailable.");
      }
      return await canvas.convertToBlob({ type, quality: options.quality });
    } catch (error) {
      if (typeof document === "undefined") throw error;
    }
  }

  if (typeof document === "undefined") {
    throw new Error("No DOM canvas fallback is available.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to create canvas 2D context.");
  paintCommunityPreview(ctx, previewDesignJson, width, height, dpr);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas toBlob returned null."));
      },
      type,
      options.quality
    );
  });
}

function paintCommunityPreview(
  ctx: CanvasRenderingContext2D,
  previewDesignJson: string | null,
  width: number,
  height: number,
  dpr: number
): void {
  const preview = parsePreviewDesignJson(previewDesignJson);
  if (!preview) {
    renderSchematicBoardPlaceholder(ctx, width, height, dpr);
    return;
  }

  const state = buildBoardRenderState(preview, width, height);
  renderSchematicBoardPreview(ctx, state, {
    width,
    height,
    dpr,
    presentation: "community",
    simplify: true,
  });
}
