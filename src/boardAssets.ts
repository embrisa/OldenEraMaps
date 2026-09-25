import { boardConnectionHandlePoint as boardConnectionHandlePointForZone } from "./designBoardGeometry";

export const BOARD_CONNECTION_HANDLE_HIT_RADIUS = 18;
export const BOARD_CONNECTION_HANDLE_SIZE = 22;

export const SCHEMATIC_BOARD_BACKGROUND_SOURCE =
  "/assets/olden-era/backgrounds/schematic-board-design-image.png";
export const SCHEMATIC_BOARD_BACKGROUND_WIDTH = 1448;
export const SCHEMATIC_BOARD_BACKGROUND_HEIGHT = 1086;

export const boardConnectionHandlePoint = boardConnectionHandlePointForZone;

let schematicBoardBackgroundImage: HTMLImageElement | null = null;

/**
 * The board background, created once and shared by the builder board, community previews and
 * the preview export so they all draw the same already-loaded image. Null where `Image` is unavailable.
 */
export function getSchematicBoardBackgroundImage(): HTMLImageElement | null {
  if (typeof Image === "undefined") return null;
  if (!schematicBoardBackgroundImage) {
    schematicBoardBackgroundImage = new Image();
    schematicBoardBackgroundImage.decoding = "async";
    schematicBoardBackgroundImage.src = SCHEMATIC_BOARD_BACKGROUND_SOURCE;
  }
  return schematicBoardBackgroundImage;
}

/**
 * Resolves with the shared background once it is ready to draw, has failed, or `timeoutMs` elapsed.
 * Never rejects: renderers skip a background that is not loaded. The wait stays short because exports
 * run from a click and the save picker needs that click's (few-second) user activation.
 */
export async function loadSchematicBoardBackgroundImage(timeoutMs = 1500): Promise<HTMLImageElement | null> {
  const image = getSchematicBoardBackgroundImage();
  if (!image || image.complete) return image;
  // Without decode() (e.g. jsdom) there is no reliable completion signal; draw without it.
  if (typeof image.decode !== "function") return image;

  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    image.decode().catch(() => undefined),
    new Promise<void>((resolve) => {
      timer = setTimeout(resolve, timeoutMs);
    }),
  ]);
  clearTimeout(timer);
  return image;
}
