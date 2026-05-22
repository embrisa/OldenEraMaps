import { createDefaultDesign, designToTemplate, serializeDesignFile, type TemplateDesign } from "@/design";
import { serializeTemplate } from "@/generator";
import { deriveUploadMetadata } from "@/community/uploadCore";
import {
  validateAuthorDisplayName,
  validateMapDescription,
  validateMapTitle
} from "@/community/textValidation";
import {
  createTagFromSlug,
  deriveFactualTags,
  sortTags,
  validateDescriptiveTagSelection,
  type CommunityTag,
  type CommunityTagCategory,
  type CommunityTagKind
} from "@/community/tags";
import { buildPreviewDesign, parsePreviewDesignJson, PREVIEW_RENDERER_VERSION, serializePreviewDesign } from "@/community/previewDesign";

export const COMMUNITY_CATALOG_STORAGE_KEY = "olden-era-template-generator.community-catalog";
export const COMMUNITY_VIEWER_STORAGE_KEY = "olden-era-template-generator.community-viewer";

export interface CommunityMapRecord {
  id: string;
  slug: string;
  title: string;
  summary: string;
  authorName: string;
  tags: CommunityTag[];
  visibility: "public" | "unlisted";
  mapWidth: number;
  mapHeight: number;
  playerCount: number;
  zoneCount: number;
  connectionCount: number;
  templateName: string;
  previewDesignJson: string;
  previewRendererVersion: number;
  designJson: string;
  templateJson: string;
  uploadedAt: string;
  updatedAt: string;
  downloadCount: number;
  averageRating: number;
  ratingCount: number;
}

export interface CommunityRatingRecord {
  id: string;
  mapId: string;
  viewerId: string;
  value: number;
  createdAt: string;
  updatedAt: string;
}

export interface CommunityCatalog {
  version: 2;
  maps: CommunityMapRecord[];
  ratings: CommunityRatingRecord[];
}

export interface CommunityUploadDraft {
  title: string;
  summary: string;
  authorName: string;
  descriptiveTagSlugs: string[];
  visibility: CommunityMapRecord["visibility"];
}

export interface CommunityCatalogStats {
  mapCount: number;
  ratingCount: number;
  averageRating: number;
}

export function loadCommunityCatalog(storage: Storage | undefined = browserStorage()): CommunityCatalog {
  const fallback = shouldUseSeedCatalog() ? buildSeedCatalog() : emptyCommunityCatalog();
  if (!storage) return fallback;

  const raw = storage.getItem(COMMUNITY_CATALOG_STORAGE_KEY);
  if (!raw) {
    persistCommunityCatalog(fallback, storage);
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw) as CommunityCatalog;
    const catalog = shouldUseSeedCatalog() ? finalizeCatalog(parsed) : removeSeedCatalogEntries(finalizeCatalog(parsed));
    if (!shouldUseSeedCatalog()) persistCommunityCatalog(catalog, storage);
    return catalog;
  } catch {
    persistCommunityCatalog(fallback, storage);
    return fallback;
  }
}

export function persistCommunityCatalog(catalog: CommunityCatalog, storage: Storage | undefined = browserStorage()): void {
  storage?.setItem(COMMUNITY_CATALOG_STORAGE_KEY, JSON.stringify(finalizeCatalog(catalog)));
}

export function ensureCommunityViewerId(storage: Storage | undefined = browserStorage()): string {
  if (!storage) return "local-viewer";
  const existing = storage.getItem(COMMUNITY_VIEWER_STORAGE_KEY);
  if (existing) return existing;

  const created = createRecordId("viewer");
  storage.setItem(COMMUNITY_VIEWER_STORAGE_KEY, created);
  return created;
}

export function uploadCommunityMap(
  catalog: CommunityCatalog,
  design: TemplateDesign,
  draft: CommunityUploadDraft,
  uploadedAt = new Date().toISOString()
): CommunityCatalog {
  const titleValidation = validateMapTitle(draft.title);
  if (!titleValidation.ok) throw new Error(titleValidation.errors[0]);
  const descriptionValidation = validateMapDescription(draft.summary);
  if (!descriptionValidation.ok) throw new Error(descriptionValidation.errors[0]);
  const authorValidation = validateAuthorDisplayName(draft.authorName);
  if (!authorValidation.ok) throw new Error(authorValidation.errors[0]);

  const title = titleValidation.value || design.templateName.trim() || "Untitled Map";
  const authorName = authorValidation.value || "Anonymous Cartographer";
  const template = designToTemplate(design);
  const metadata = deriveUploadMetadata(template, design);
  const summary = metadata.templateDescription ?? descriptionValidation.value;
  const factualTags = deriveFactualTags(metadata);
  const descriptiveSelection = validateDescriptiveTagSelection(draft.descriptiveTagSlugs, metadata, factualTags);
  if (descriptiveSelection.errors.length > 0) {
    throw new Error(descriptiveSelection.errors[0]);
  }
  const playerCount = design.zones.filter((zone) => zone.role === "Spawn").length;
  const map: CommunityMapRecord = {
    id: createRecordId("map"),
    slug: slugify(title),
    title,
    summary,
    authorName,
    tags: sortTags([...factualTags, ...descriptiveSelection.tags]),
    visibility: draft.visibility,
    mapWidth: design.mapWidth,
    mapHeight: design.mapHeight,
    playerCount,
    zoneCount: design.zones.length,
    connectionCount: design.connections.length,
    templateName: design.templateName,
    previewDesignJson: serializePreviewDesign(buildPreviewDesign(design)),
    previewRendererVersion: PREVIEW_RENDERER_VERSION,
    designJson: serializeDesignFile(design),
    templateJson: serializeTemplate(template),
    uploadedAt,
    updatedAt: uploadedAt,
    downloadCount: 0,
    averageRating: 0,
    ratingCount: 0
  };

  return finalizeCatalog({
    ...catalog,
    maps: [map, ...catalog.maps]
  });
}

export function rateCommunityMap(
  catalog: CommunityCatalog,
  mapId: string,
  viewerId: string,
  value: number,
  ratedAt = new Date().toISOString()
): CommunityCatalog {
  const normalizedValue = clampRating(value);
  const existing = catalog.ratings.find((rating) => rating.mapId === mapId && rating.viewerId === viewerId);
  const ratings = existing
    ? catalog.ratings.map((rating) => rating.id === existing.id ? { ...rating, value: normalizedValue, updatedAt: ratedAt } : rating)
    : catalog.ratings.concat({
      id: createRecordId("rating"),
      mapId,
      viewerId,
      value: normalizedValue,
      createdAt: ratedAt,
      updatedAt: ratedAt
    });

  return finalizeCatalog({ ...catalog, ratings });
}

export function recordCommunityDownload(catalog: CommunityCatalog, mapId: string): CommunityCatalog {
  return finalizeCatalog({
    ...catalog,
    maps: catalog.maps.map((map) => map.id === mapId ? { ...map, downloadCount: map.downloadCount + 1 } : map)
  });
}

export function getViewerRating(catalog: CommunityCatalog, mapId: string, viewerId: string): number | undefined {
  return catalog.ratings.find((rating) => rating.mapId === mapId && rating.viewerId === viewerId)?.value;
}

export function summarizeCommunityCatalog(catalog: CommunityCatalog): CommunityCatalogStats {
  const publicMaps = catalog.maps.filter((map) => map.visibility === "public");
  const ratingCount = catalog.ratings.length;
  const averageRating = ratingCount === 0
    ? 0
    : roundToTenth(catalog.ratings.reduce((sum, rating) => sum + rating.value, 0) / ratingCount);

  return {
    mapCount: publicMaps.length,
    ratingCount,
    averageRating
  };
}

export function visibleCommunityMaps(catalog: CommunityCatalog): CommunityMapRecord[] {
  return catalog.maps.filter((map) => map.visibility === "public");
}

export interface BrowseNumericRange {
  min?: number;
  max?: number;
}

export interface BrowseRangeFilters {
  players?: BrowseNumericRange;
  mapWidth?: BrowseNumericRange;
  mapHeight?: BrowseNumericRange;
  zones?: BrowseNumericRange;
  connections?: BrowseNumericRange;
}

export function filterCommunityMaps(
  maps: readonly CommunityMapRecord[],
  options: {
    query?: string;
    selectedTagSlugs?: readonly string[];
    rangeFilters?: BrowseRangeFilters;
  }
): CommunityMapRecord[] {
  const normalizedQuery = options.query?.trim().toLowerCase() ?? "";
  const selectedTagSlugs = [...new Set((options.selectedTagSlugs ?? []).filter(Boolean))];
  const rangeFilters = options.rangeFilters ?? {};

  return maps.filter((map) => {
    if (selectedTagSlugs.length > 0) {
      const mapTagSlugs = new Set(map.tags.map((tag) => tag.slug));
      if (!selectedTagSlugs.every((slug) => mapTagSlugs.has(slug))) return false;
    }

    if (!matchesRange(map.playerCount, rangeFilters.players)) return false;
    if (!matchesRange(map.mapWidth, rangeFilters.mapWidth)) return false;
    if (!matchesRange(map.mapHeight, rangeFilters.mapHeight)) return false;
    if (!matchesRange(map.zoneCount, rangeFilters.zones)) return false;
    if (!matchesRange(map.connectionCount, rangeFilters.connections)) return false;

    if (normalizedQuery === "") return true;
    return [
      map.title,
      map.summary,
      map.authorName,
      map.templateName,
      ...map.tags.flatMap((tag) => [tag.slug, tag.label])
    ].some((value) => value.toLowerCase().includes(normalizedQuery));
  });
}

export interface CommunityTagFilterGroup {
  id: string;
  label: string;
  tags: CommunityTag[];
}

export interface CommunityTagFilterSection {
  kind: CommunityTagKind;
  label: string;
  groups: CommunityTagFilterGroup[];
}

const FACTUAL_FILTER_GROUPS: Array<{ category: CommunityTagCategory; label: string }> = [
  { category: "win-condition", label: "Win condition" },
  { category: "roads", label: "Roads" },
  { category: "portals", label: "Portals" },
  { category: "topology", label: "Topology" },
  { category: "neutral", label: "Neutral mix" },
  { category: "risk", label: "Risk" }
];

const DESCRIPTIVE_FILTER_GROUPS: Array<{ category: CommunityTagCategory; label: string }> = [
  { category: "audience", label: "Audience" },
  { category: "pacing", label: "Pacing" },
  { category: "economy", label: "Economy" },
  { category: "layout", label: "Layout" }
];

export function buildCommunityTagFilterSections(maps: readonly CommunityMapRecord[]): CommunityTagFilterSection[] {
  const allTags = dedupeTags(maps.flatMap((map) => map.tags));
  const factualTags = allTags.filter((tag) => tag.kind === "factual");
  const descriptiveTags = allTags.filter((tag) => tag.kind === "descriptive");

  const factualGroups = FACTUAL_FILTER_GROUPS
    .map((group) => ({
      id: group.category,
      label: group.label,
      tags: factualTags
        .filter((tag) => tag.category === group.category)
        .sort((left, right) => left.label.localeCompare(right.label))
    }))
    .filter((group) => group.tags.length > 0);

  const sections: CommunityTagFilterSection[] = [];
  if (factualGroups.length > 0) {
    sections.push({
      kind: "factual",
      label: "Factual filters",
      groups: factualGroups
    });
  }
  if (descriptiveTags.length > 0) {
    const groupedCategories = new Set(DESCRIPTIVE_FILTER_GROUPS.map((group) => group.category));
    const descriptiveGroups: CommunityTagFilterGroup[] = DESCRIPTIVE_FILTER_GROUPS
      .map((group) => ({
        id: group.category,
        label: group.label,
        tags: descriptiveTags
          .filter((tag) => tag.category === group.category)
          .sort((left, right) => left.label.localeCompare(right.label))
      }))
      .filter((group) => group.tags.length > 0);
    const otherTags = descriptiveTags.filter((tag) => !groupedCategories.has(tag.category));
    if (otherTags.length > 0) {
      descriptiveGroups.push({
        id: "other",
        label: "Other",
        tags: otherTags.sort((left, right) => left.label.localeCompare(right.label))
      });
    }
    sections.push({
      kind: "descriptive",
      label: "Descriptive filters",
      groups: descriptiveGroups
    });
  }
  return sections;
}

function matchesRange(value: number, range: BrowseNumericRange | undefined): boolean {
  const min = normalizeRangeEndpoint(range?.min);
  const max = normalizeRangeEndpoint(range?.max);
  if (min !== undefined && value < min) return false;
  if (max !== undefined && value > max) return false;
  return true;
}

function normalizeRangeEndpoint(value: number | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function finalizeCatalog(catalog: CommunityCatalog): CommunityCatalog {
  const maps = catalog.maps.map(normalizeCommunityMapRecord);
  const ratingsByMap = new Map<string, CommunityRatingRecord[]>();
  for (const rating of catalog.ratings) {
    const list = ratingsByMap.get(rating.mapId);
    if (list) list.push(rating);
    else ratingsByMap.set(rating.mapId, [rating]);
  }

  return {
    version: 2,
    maps: maps
      .map((map) => {
        const ratings = ratingsByMap.get(map.id) ?? [];
        const total = ratings.reduce((sum, rating) => sum + clampRating(rating.value), 0);
        return {
          ...map,
          averageRating: ratings.length === 0 ? 0 : roundToTenth(total / ratings.length),
          ratingCount: ratings.length
        };
      })
      .sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt)),
    ratings: catalog.ratings.map((rating) => ({ ...rating, value: clampRating(rating.value) }))
  };
}

function emptyCommunityCatalog(): CommunityCatalog {
  return {
    version: 2,
    maps: [],
    ratings: []
  };
}

function shouldUseSeedCatalog(): boolean {
  return !import.meta.env.PROD;
}

function removeSeedCatalogEntries(catalog: CommunityCatalog): CommunityCatalog {
  const maps = catalog.maps.filter((map) => !map.id.startsWith("seed-map-"));
  const mapIds = new Set(maps.map((map) => map.id));
  const ratings = catalog.ratings.filter((rating) => !rating.id.startsWith("seed-rating-") && mapIds.has(rating.mapId));
  return finalizeCatalog({ version: 2, maps, ratings });
}

function buildSeedCatalog(): CommunityCatalog {
  const duel = createDefaultDesign();
  duel.templateName = "Temple Border Clash";
  duel.mapWidth = 160;
  duel.mapHeight = 160;

  const mirrored = createDefaultDesign();
  mirrored.templateName = "Crossroads Pressure";
  mirrored.mapWidth = 200;
  mirrored.mapHeight = 200;
  mirrored.connections[0]!.guardStrength = 38000;
  mirrored.connections[1]!.guardStrength = 38000;
  mirrored.gameEndConditions.victoryCondition = "win_condition_1";

  const wide = createDefaultDesign();
  wide.templateName = "Merchant Ring";
  wide.mapWidth = 216;
  wide.mapHeight = 160;
  wide.terrainTheme = "Snow";
  wide.heroSettings.heroCountMax = 5;

  const uploadedAtA = "2026-05-09T18:20:00.000Z";
  const uploadedAtB = "2026-05-11T20:10:00.000Z";
  const uploadedAtC = "2026-05-14T09:45:00.000Z";

  const maps = [
    createSeedMap(duel, {
      id: "seed-map-1",
      title: "Temple Border Clash",
      summary: "Fast 1v1 with a central neutral breakpoint and reliable expansion pacing.",
      authorName: "Olden Era Studio",
      descriptiveTagSlugs: ["tempo", "competitive"],
      uploadedAt: uploadedAtA,
      downloadCount: 128
    }),
    createSeedMap(mirrored, {
      id: "seed-map-2",
      title: "Crossroads Pressure",
      summary: "Four-player pressure map with a public hub and heavier contest over side lanes.",
      authorName: "Olden Era Studio",
      descriptiveTagSlugs: ["casual", "high-risk", "chokepoints"],
      uploadedAt: uploadedAtB,
      downloadCount: 91
    }),
    createSeedMap(wide, {
      id: "seed-map-3",
      title: "Merchant Ring",
      summary: "Macro-oriented shared economy map with extra neutrals and wider route options.",
      authorName: "Olden Era Studio",
      descriptiveTagSlugs: ["macro", "wide", "exploration-heavy"],
      uploadedAt: uploadedAtC,
      downloadCount: 76
    })
  ];

  const ratings: CommunityRatingRecord[] = [
    { id: "seed-rating-1", mapId: "seed-map-1", viewerId: "seed-viewer-a", value: 5, createdAt: uploadedAtA, updatedAt: uploadedAtA },
    { id: "seed-rating-2", mapId: "seed-map-1", viewerId: "seed-viewer-b", value: 4, createdAt: uploadedAtA, updatedAt: uploadedAtA },
    { id: "seed-rating-3", mapId: "seed-map-2", viewerId: "seed-viewer-a", value: 4, createdAt: uploadedAtB, updatedAt: uploadedAtB },
    { id: "seed-rating-4", mapId: "seed-map-2", viewerId: "seed-viewer-c", value: 5, createdAt: uploadedAtB, updatedAt: uploadedAtB },
    { id: "seed-rating-5", mapId: "seed-map-3", viewerId: "seed-viewer-d", value: 3, createdAt: uploadedAtC, updatedAt: uploadedAtC }
  ];

  return finalizeCatalog({
    version: 2,
    maps,
    ratings
  });
}

function createSeedMap(
  design: TemplateDesign,
    options: {
      id: string;
      title: string;
      summary: string;
      authorName: string;
      descriptiveTagSlugs: string[];
      uploadedAt: string;
      downloadCount: number;
    }
): CommunityMapRecord {
  const metadata = deriveUploadMetadata(designToTemplate(design), design);
  const factualTags = deriveFactualTags(metadata);
  const descriptiveSelection = validateDescriptiveTagSelection(options.descriptiveTagSlugs, metadata, factualTags);
  if (descriptiveSelection.errors.length > 0) {
    throw new Error(descriptiveSelection.errors[0]);
  }
  return {
    id: options.id,
    slug: slugify(options.title),
    title: options.title,
    summary: options.summary,
    authorName: options.authorName,
    tags: sortTags([...factualTags, ...descriptiveSelection.tags]),
    visibility: "public",
    mapWidth: design.mapWidth,
    mapHeight: design.mapHeight,
    playerCount: design.zones.filter((zone) => zone.role === "Spawn").length,
    zoneCount: design.zones.length,
    connectionCount: design.connections.length,
    templateName: design.templateName,
    previewDesignJson: serializePreviewDesign(buildPreviewDesign(design)),
    previewRendererVersion: PREVIEW_RENDERER_VERSION,
    designJson: serializeDesignFile(design),
    templateJson: serializeTemplate(designToTemplate(design)),
    uploadedAt: options.uploadedAt,
    updatedAt: options.uploadedAt,
    downloadCount: options.downloadCount,
    averageRating: 0,
    ratingCount: 0
  };
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "map";
}

function clampRating(value: number): number {
  return Math.min(5, Math.max(1, Math.round(value)));
}

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

function createRecordId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;
}

function normalizeCommunityMapRecord(map: CommunityMapRecord): CommunityMapRecord {
  if (typeof map.previewDesignJson !== "string") {
    throw new Error("Community map record is missing previewDesignJson.");
  }
  if (map.previewRendererVersion !== PREVIEW_RENDERER_VERSION) {
    throw new Error("Community map record has a stale previewRendererVersion.");
  }
  const previewDesign = parsePreviewDesignJson(map.previewDesignJson);
  if (!previewDesign) {
    throw new Error("Community map record has invalid previewDesignJson.");
  }
  return {
    ...map,
    previewDesignJson: serializePreviewDesign(previewDesign),
    previewRendererVersion: PREVIEW_RENDERER_VERSION,
    tags: normalizeStoredTags((map as CommunityMapRecord & { tags: Array<CommunityTag | string> }).tags)
  };
}

function normalizeStoredTags(tags: Array<CommunityTag | string>): CommunityTag[] {
  return sortTags(dedupeTags(tags.map((tag) => typeof tag === "string" ? createTagFromSlug(tag) : createTagFromSlug(tag.slug, tag.kind))));
}

function dedupeTags(tags: readonly CommunityTag[]): CommunityTag[] {
  const deduped = new Map(tags.map((tag) => [tag.slug, tag]));
  return [...deduped.values()];
}

function browserStorage(): Storage | undefined {
  return typeof window === "undefined" ? undefined : window.localStorage;
}
