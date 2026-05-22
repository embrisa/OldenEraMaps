import { normalizeBoardZonePositions } from "../boardSlots.ts";
import { designToTemplate, serializeDesignFile, templateToDesign, validateDesign, type TemplateDesign } from "../design.ts";
import { parseRmgTemplate, serializeRmgTemplate, type RmgTemplate } from "../types.ts";
import {
  deriveFactualTags,
  deriveSizeClass,
  deriveWinConditionKind,
  validateDescriptiveTagSelection,
  type CommunityBinaryTagState,
  type CommunityFactualTagContext,
  type CommunityNeutralMix,
  type CommunityRiskHint,
  type CommunityTopologyHint
} from "./tags.ts";
import {
  normalizeMapDescription,
  validateMapDescription,
  validateMapTitle
} from "./textValidation.ts";
import { buildPreviewDesign, parsePreviewDesignJson, PREVIEW_RENDERER_VERSION } from "./previewDesign.ts";

export const COMMUNITY_UPLOAD_MAX_JSON_BYTES = 2 * 1024 * 1024;
export const COMMUNITY_UPLOAD_MAX_JSON_DEPTH = 80;

export interface UploadMapRequest {
  title: string;
  description: string;
  visibility: "public" | "unlisted" | "private";
  descriptiveTagSlugs: string[];
  templateJson: unknown;
  designJson?: unknown;
  previewDesignJson?: unknown;
  previewRendererVersion?: unknown;
}

export interface PreparedCommunityUploadCore {
  title: string;
  description: string;
  visibility: UploadMapRequest["visibility"];
  slug: string;
  template: RmgTemplate;
  design: TemplateDesign;
  templateJson: unknown;
  designJson: unknown | null;
  templateSha256: string;
  metadata: CommunityUploadMetadata;
  previewDesignJson: unknown;
  previewRendererVersion: number;
  factualTagSlugs: string[];
  descriptiveTagSlugs: string[];
  warnings: string[];
}

export interface CommunityUploadMetadata extends CommunityFactualTagContext {
  mapWidth: number;
  mapHeight: number;
  playerCount: number;
  zoneCount: number;
  connectionCount: number;
  winCondition: string;
  winConditionKind: CommunityFactualTagContext["winConditionKind"];
  terrainTheme: string | null;
  templateName: string;
  templateDescription: string | null;
}

export class UploadValidationError extends Error {
  constructor(
    message: string,
    public readonly code = "upload_validation_failed",
    public readonly details: string[] = [message]
  ) {
    super(message);
    this.name = "UploadValidationError";
  }
}

export async function prepareCommunityUploadCore(request: UploadMapRequest): Promise<PreparedCommunityUploadCore> {
  const titleValidation = validateMapTitle(request.title);
  if (!titleValidation.ok) {
    throw new UploadValidationError(titleValidation.errors[0]!, "invalid_title", titleValidation.errors);
  }
  const descriptionValidation = validateMapDescription(request.description);
  if (!descriptionValidation.ok) {
    throw new UploadValidationError(descriptionValidation.errors[0]!, "invalid_description", descriptionValidation.errors);
  }
  const title = titleValidation.value || "Untitled Map";
  const description = descriptionValidation.value;
  const visibility = request.visibility;
  if (!["public", "unlisted", "private"].includes(visibility)) {
    throw new UploadValidationError("Choose a valid map visibility.", "invalid_visibility");
  }

  const templateText = stringifyTemplateInput(request.templateJson);
  if (byteLength(templateText) > COMMUNITY_UPLOAD_MAX_JSON_BYTES) {
    throw new UploadValidationError("Template JSON is larger than the 2 MB upload limit.", "payload_too_large");
  }
  const rawTemplate = parseJsonWithDepthLimit(templateText, COMMUNITY_UPLOAD_MAX_JSON_DEPTH);
  let template: RmgTemplate;
  let design: TemplateDesign;
  try {
    template = parseRmgTemplate(JSON.stringify(rawTemplate));
    design = templateToDesign(template);
  } catch (error) {
    throw new UploadValidationError(error instanceof Error ? error.message : "Template structure is not valid for upload.", "invalid_template");
  }
  const designValidation = validateDesign(design);
  if (designValidation.errors.length > 0) {
    throw new UploadValidationError("Template structure is not valid for upload.", "invalid_template", designValidation.errors);
  }

  const canonicalTemplate = canonicalizeTemplate(template);
  const templateSha256 = await sha256Hex(canonicalTemplate.text);
  const uploadDesign = normalizeDesignJson(request.designJson, design, canonicalTemplate.text);
  const previewDesign = buildPreviewDesign(uploadDesign);
  const previewDesignJson = normalizeUploadPreviewDesignJson(request.previewDesignJson, request.previewRendererVersion, previewDesign);
  const metadata = deriveUploadMetadata(template, uploadDesign);
  const riskWarnings = deriveUploadWarnings(uploadDesign, metadata);
  const factualTags = deriveFactualTags(metadata);
  const factualTagSlugs = factualTags.map((tag) => tag.slug);
  const descriptiveTags = validateDescriptiveTagSelection(request.descriptiveTagSlugs, metadata, factualTags);
  if (descriptiveTags.errors.length > 0) {
    throw new UploadValidationError(descriptiveTags.errors[0]!, "invalid_tags", descriptiveTags.errors);
  }

  return {
    title,
    description,
    visibility,
    slug: slugify(title),
    template,
    design: uploadDesign,
    templateJson: canonicalTemplate.json,
    designJson: JSON.parse(serializeDesignFile(uploadDesign)),
    templateSha256,
    metadata,
    previewDesignJson,
    previewRendererVersion: PREVIEW_RENDERER_VERSION,
    factualTagSlugs,
    descriptiveTagSlugs: descriptiveTags.tags.map((tag) => tag.slug),
    warnings: [...designValidation.warnings, ...riskWarnings]
  };
}

function normalizeUploadPreviewDesignJson(
  value: unknown,
  rendererVersion: unknown,
  expected: ReturnType<typeof buildPreviewDesign>
): ReturnType<typeof buildPreviewDesign> {
  if (rendererVersion !== undefined && rendererVersion !== PREVIEW_RENDERER_VERSION) {
    throw new UploadValidationError("Preview renderer version does not match the release renderer.", "invalid_preview_design");
  }
  if (value === null || value === undefined) return expected;
  if (typeof value === "string") {
    throw new UploadValidationError("Preview design JSON must be structured release preview data.", "invalid_preview_design");
  }

  const candidate = parsePreviewDesignJson(value);
  if (!candidate) {
    throw new UploadValidationError("Upload requires a valid preview design payload.", "invalid_preview_design");
  }
  if (stableStringify(candidate) !== stableStringify(expected)) {
    throw new UploadValidationError("Preview design JSON does not match the uploaded design JSON.", "invalid_preview_design");
  }

  return candidate;
}

export function deriveUploadMetadata(template: RmgTemplate, design: TemplateDesign): CommunityUploadMetadata {
  const directConnections = design.connections.filter((connection) => connection.type === "Direct");
  const portalConnections = design.connections.filter((connection) => connection.type === "Portal");
  const spawnZones = design.zones.filter((zone) => zone.role === "Spawn");
  const topologyHints = deriveTopologyHints(design);
  const neutralZones = design.zones.filter((zone) => zone.role === "Neutral");
  const roads = deriveRoadState(directConnections);
  const portals: CommunityBinaryTagState = portalConnections.length > 0 ? "on" : "off";
  const neutralMix = deriveNeutralMix(neutralZones);
  const neutralCastles = neutralZones.some((zone) => zone.castleCount > 0);
  const riskHints = deriveRiskHints(design);
  const winConditionKind = deriveWinConditionKind(design.gameEndConditions.victoryCondition);

  return {
    mapWidth: template.sizeX,
    mapHeight: template.sizeZ,
    playerCount: spawnZones.length,
    zoneCount: design.zones.length,
    connectionCount: design.connections.length,
    winCondition: design.gameEndConditions.victoryCondition,
    winConditionKind,
    sizeClass: deriveSizeClass(template.sizeX, template.sizeZ),
    terrainTheme: design.terrainTheme === "FactionMatched" || design.terrainTheme === "Random" ? null : design.terrainTheme,
    templateName: template.name,
    topologyHints,
    roads,
    portals,
    neutralMix,
    neutralCastles,
    riskHints,
    templateDescription: typeof template.description === "string" && template.description.trim().length > 0
      ? normalizeMapDescription(template.description)
      : null
  };
}

function stringifyTemplateInput(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    throw new UploadValidationError("Template JSON could not be serialized.", "malformed_json");
  }
}

function parseJsonWithDepthLimit(text: string, maxDepth: number): unknown {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new UploadValidationError("Template JSON is malformed.", "malformed_json");
  }
  if (maxJsonDepth(parsed) > maxDepth) {
    throw new UploadValidationError("Template JSON is nested too deeply.", "payload_too_deep");
  }
  return parsed;
}

function maxJsonDepth(value: unknown): number {
  if (value === null || typeof value !== "object") return 0;
  if (Array.isArray(value)) return 1 + Math.max(0, ...value.map(maxJsonDepth));
  return 1 + Math.max(0, ...Object.values(value as Record<string, unknown>).map(maxJsonDepth));
}

function canonicalizeTemplate(template: RmgTemplate): { json: unknown; text: string } {
  const json = JSON.parse(serializeRmgTemplate(template));
  return {
    json,
    text: stableStringify(json)
  };
}

function canonicalTemplateTextFromDesign(design: TemplateDesign): string {
  return canonicalizeTemplate(designToTemplate(design)).text;
}

function normalizeDesignJson(value: unknown, fallback: TemplateDesign, normalizedTemplateText: string): TemplateDesign {
  if (value === null || value === undefined) return fallback;

  const candidate = parseDesignJson(value);
  if (!candidate) {
    throw new UploadValidationError("Design JSON must be a release design file.", "invalid_design");
  }

  const validation = validateDesign(candidate);
  if (validation.errors.length > 0) {
    throw new UploadValidationError("Design JSON is not valid for upload.", "invalid_design", validation.errors);
  }

  const candidateTemplateText = canonicalTemplateTextFromDesign(candidate);
  if (candidateTemplateText !== normalizedTemplateText) {
    throw new UploadValidationError("Design JSON does not match the uploaded template JSON.", "invalid_design");
  }

  return {
    ...candidate,
    zones: normalizeBoardZonePositions(candidate.zones)
  };
}

function parseDesignJson(value: unknown): TemplateDesign | null {
  const normalized = typeof value === "string"
    ? null
    : value;
  if (!normalized || typeof normalized !== "object") return null;

  const root = normalized as Record<string, unknown>;
  const candidate = root.format === "olden-era-template-design" && root.design && typeof root.design === "object"
    ? root.design as Record<string, unknown>
    : null;

  return candidate && isTemplateDesignLike(candidate) ? candidate as unknown as TemplateDesign : null;
}

function isTemplateDesignLike(value: Record<string, unknown>): boolean {
  return value.format === "olden-era-template-design"
    && value.version === 1
    && typeof value.templateName === "string"
    && Array.isArray(value.zones)
    && Array.isArray(value.connections)
    && typeof value.mapWidth === "number"
    && typeof value.mapHeight === "number";
}

function deriveTopologyHints(design: TemplateDesign): CommunityTopologyHint[] {
  const hints = new Set<CommunityTopologyHint>();
  const degrees = new Map(design.zones.map((zone) => [zone.id, 0]));
  for (const connection of design.connections) {
    degrees.set(connection.from, (degrees.get(connection.from) ?? 0) + 1);
    degrees.set(connection.to, (degrees.get(connection.to) ?? 0) + 1);
  }
  const degreeValues = [...degrees.values()];
  const hubCount = degreeValues.filter((degree) => degree >= Math.max(3, design.zones.length - 2)).length;
  if (design.connections.length >= design.zones.length && degreeValues.every((degree) => degree >= 2)) hints.add("ring");
  if (degreeValues.filter((degree) => degree === 1).length === 2 && degreeValues.filter((degree) => degree === 2).length >= Math.max(0, design.zones.length - 2)) hints.add("chain");
  if (hubCount > 0 || design.zones.some((zone) => zone.role === "Hub")) hints.add("hub");
  if (design.connections.length >= design.zones.length + design.zones.filter((zone) => zone.role === "Spawn").length - 1) hints.add("shared-web");
  if (design.zones.some((zone) => distanceFromCenter(zone.position) < 0.18) && design.zones.some((zone) => distanceFromCenter(zone.position) > 0.32)) hints.add("balanced");
  if (hints.size === 0) hints.add("random");
  return [...hints];
}

function deriveRoadState(connections: TemplateDesign["connections"]): CommunityBinaryTagState | null {
  if (connections.length === 0) return null;
  if (connections.every((connection) => connection.road)) return "on";
  if (connections.every((connection) => !connection.road)) return "off";
  return null;
}

function deriveNeutralMix(neutralZones: TemplateDesign["zones"]): CommunityNeutralMix | null {
  const qualityScore = neutralZones.reduce((sum, zone) => sum + (zone.quality === "High" ? 3 : zone.quality === "Medium" ? 2 : 1), 0);
  const averageQuality = neutralZones.length === 0 ? 0 : qualityScore / neutralZones.length;
  if (averageQuality === 0) return null;
  if (averageQuality < 1.5) return "low";
  if (averageQuality < 2.5) return "medium";
  return "high";
}

function deriveRiskHints(design: TemplateDesign): CommunityRiskHint[] {
  const hints = new Set<CommunityRiskHint>();
  const areaPerZone = (design.mapWidth * design.mapHeight) / Math.max(1, design.zones.length);
  if (areaPerZone < 1600) hints.add("high-zone-density");
  if (design.mapWidth > 240 || design.mapHeight > 240) hints.add("experimental-size");
  if (design.zones.filter((zone) => zone.castleCount >= 2).length >= Math.max(3, Math.ceil(design.zones.length / 3))) {
    hints.add("many-castles");
  }
  return [...hints];
}

function deriveUploadWarnings(design: TemplateDesign, metadata: CommunityUploadMetadata): string[] {
  const warnings: string[] = [];
  const areaPerZone = (metadata.mapWidth * metadata.mapHeight) / Math.max(1, metadata.zoneCount);
  if (areaPerZone < 1600) warnings.push("Estimated area per zone is very small and may increase in-game generation risk.");
  if (metadata.mapWidth > 240 || metadata.mapHeight > 240) warnings.push("Map size is above the known official maximum and should be treated as experimental.");
  if (design.zones.filter((zone) => zone.castleCount >= 2).length >= Math.max(3, Math.ceil(design.zones.length / 3))) {
    warnings.push("Many zones contain multiple castles, which is a risky generation combination.");
  }
  if (design.gameEndConditions.cityHold && design.zones.filter((zone) => zone.holdCity && zone.castleCount > 0).length !== 1) {
    warnings.push("City Hold maps should have exactly one valid hold-city zone.");
  }
  return [...new Set(warnings)];
}

function distanceFromCenter(point: { x: number; y: number }): number {
  return Math.hypot(point.x - 0.5, point.y - 0.5);
}

export function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "map";
}

export function stableStringify(value: unknown): string {
  return `${JSON.stringify(sortJson(value), null, 2)}\n`;
}

function sortJson(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sortJson);
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortJson(child)])
  );
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}
