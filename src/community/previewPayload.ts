import { requireReleasePreviewDesignJson } from "./releaseRowJson.ts";

export function requireStoredPreviewDesignJson(previewValue: unknown, rendererVersion?: unknown): string {
  if (arguments.length === 1) {
    return requireReleasePreviewDesignJson(previewValue);
  }
  return requireReleasePreviewDesignJson(previewValue, rendererVersion);
}
