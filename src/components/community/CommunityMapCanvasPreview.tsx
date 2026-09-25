import { useEffect, useMemo, useRef, type JSX } from "react";
import { getSchematicBoardBackgroundImage } from "@/boardAssets";
import { parsePreviewDesignJson } from "@/community/previewDesign";
import {
  buildBoardRenderState,
  renderSchematicBoardPlaceholder,
  renderSchematicBoardPreview,
  type RenderSchematicBoardOptions,
} from "@/components/designBoardRender";

export {
  COMMUNITY_MAP_CARD_PREVIEW_SIZE,
  COMMUNITY_MAP_DETAIL_PREVIEW_SIZE,
} from "@/community/communityPreviewImage";

interface CommunityMapCanvasPreviewProps {
  previewDesignJson: string | null;
  width: number;
  height: number;
  className: string;
  title?: string;
  ariaLabel?: string;
  decorative?: boolean;
  simplify?: boolean;
  presentation?: RenderSchematicBoardOptions["presentation"];
  showSpawnKeepMarkers?: boolean;
}

export function CommunityMapCanvasPreview({
  previewDesignJson,
  width,
  height,
  className,
  title,
  ariaLabel,
  decorative = false,
  simplify = false,
  presentation = "community",
  showSpawnKeepMarkers = true,
}: CommunityMapCanvasPreviewProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const preview = useMemo(() => parsePreviewDesignJson(previewDesignJson), [previewDesignJson]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(typeof window === "undefined" ? 1 : window.devicePixelRatio || 1, 2);
    // Only the pixel buffer is sized here; the element scales to its container (see `style` below).
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    const paint = () => {
      if (!preview) {
        renderSchematicBoardPlaceholder(ctx, width, height, dpr);
        return;
      }
      const state = buildBoardRenderState(preview, width, height);
      renderSchematicBoardPreview(ctx, state, {
        width,
        height,
        dpr,
        backgroundImage: getSchematicBoardBackgroundImage(),
        presentation,
        showSpawnKeepMarkers,
        simplify,
      });
    };

    paint();
    const background = getSchematicBoardBackgroundImage();
    if (!background || background.complete) return;
    background.addEventListener("load", paint);
    background.addEventListener("error", paint);
    return () => {
      background.removeEventListener("load", paint);
      background.removeEventListener("error", paint);
    };
  }, [height, presentation, preview, showSpawnKeepMarkers, simplify, width]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      // Fill the card/dialog width; the height follows the CSS aspect-ratio (or the bitmap's ratio).
      style={{ width: "100%", height: "auto" }}
      title={title}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : ariaLabel}
      role={decorative ? undefined : "img"}
    />
  );
}
