import { parsePreviewDesignJson, PREVIEW_RENDERER_VERSION, serializePreviewDesign } from "./previewDesign.ts";

const COMMUNITY_ROW_PREFIX = "Community map row";

export type ReleaseJsonObject = Record<string, unknown>;

export function requireReleaseJsonObject(value: unknown, fieldName: string): ReleaseJsonObject {
  if (value === null || value === undefined) {
    throw new Error(`${COMMUNITY_ROW_PREFIX} is missing ${fieldName}.`);
  }
  if (typeof value === "string") {
    throw new Error(`${COMMUNITY_ROW_PREFIX} has legacy stringified ${fieldName}; release rows must store structured JSON.`);
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${COMMUNITY_ROW_PREFIX} has invalid ${fieldName}; release rows must store a structured JSON object.`);
  }
  return value as ReleaseJsonObject;
}

export function requireReleaseTemplateJson(value: unknown): ReleaseJsonObject {
  return requireReleaseJsonObject(value, "template_json");
}

export function serializeReleaseJsonField(value: unknown, fieldName: string): string {
  const structured = requireReleaseJsonObject(value, fieldName);
  return JSON.stringify(structured, null, 2);
}

export function serializeReleaseTemplateJson(value: unknown): string {
  const structured = requireReleaseTemplateJson(value);
  return JSON.stringify(structured, null, 2);
}

export function extractReleaseTemplateDescription(templateJson: ReleaseJsonObject): string | null {
  const description = templateJson.description;
  return typeof description === "string" && description.trim().length > 0 ? description : null;
}

export function requireReleaseTemplateDescription(value: unknown): string | null {
  return extractReleaseTemplateDescription(requireReleaseTemplateJson(value));
}

export function requireOptionalReleaseTemplateDescription(value: unknown): string | null {
  if (value === undefined) return null;
  return requireReleaseTemplateDescription(value);
}

export function requireReleasePreviewDesignJson(value: unknown, rendererVersion?: unknown): string {
  if (arguments.length > 1 && rendererVersion !== PREVIEW_RENDERER_VERSION) {
    throw new Error(`${COMMUNITY_ROW_PREFIX} has stale preview_renderer_version.`);
  }
  const serialized = serializeReleaseJsonField(value, "preview_design_json");
  const parsed = parsePreviewDesignJson(serialized);
  if (!parsed) {
    throw new Error(`${COMMUNITY_ROW_PREFIX} has invalid preview_design_json.`);
  }
  return serializePreviewDesign(parsed);
}
