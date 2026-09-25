import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./databaseTypes";
import {
  filterCommunityMaps,
  loadCommunityCatalog,
  persistCommunityCatalog,
  visibleCommunityMaps,
  type BrowseRangeFilters,
  type CommunityCatalogStats,
  type CommunityMapRecord
} from "./maps";
import { requireStoredPreviewDesignJson } from "./previewPayload.ts";
import { requireOptionalReleaseTemplateDescription, requireReleaseTemplateJson, serializeReleaseJsonField, serializeReleaseTemplateJson } from "./releaseRowJson.ts";
import { ANONYMOUS_AUTHOR_NAME, resolvePublicAuthorName } from "./authorNames";
import { createTagFromSlug, formatWinConditionLabel, sortTags, type CommunityTag } from "./tags";
import {
  normalizeAuthorDisplayName,
  normalizeMapDescription,
  normalizeMapTitle,
  validateAuthorDisplayName,
  validateMapDescription,
  validateMapTitle
} from "./textValidation";
import { isSupabaseConfigured, supabase } from "./supabaseClient";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BrowseSort = "newest" | "top-rated" | "most-downloaded" | "recently-updated";

export interface BrowseFilters {
  query?: string;
  selectedTagSlugs?: string[];
  rangeFilters?: BrowseRangeFilters;
  sort?: BrowseSort;
  page?: number;
  pageSize?: number;
}

export interface BrowseMapCard {
  id: string;
  ownerId: string | null;
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
  winCondition: string;
  templateName: string;
  previewDesignJson: string;
  previewRendererVersion: number;
  uploadedAt: string;
  updatedAt: string;
  downloadCount: number;
  averageRating: number;
  ratingCount: number;
}

export type ManagedMapVisibility = "public" | "unlisted" | "private";
export type ManagedMapStatus = "draft" | "published" | "hidden" | "rejected";

export interface ManagedMapCard extends Omit<BrowseMapCard, "visibility"> {
  visibility: ManagedMapVisibility;
  status: ManagedMapStatus;
}

export interface BrowseResult {
  maps: BrowseMapCard[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface ManagedMapsResult {
  maps: ManagedMapCard[];
}

export interface MapDetail extends BrowseMapCard {
  designJson: string;
  templateJson: string;
}

export interface MapListingPatch {
  title?: string;
  authorName?: string;
  description?: string;
  visibility?: "public" | "unlisted" | "private";
  descriptiveTagSlugs?: string[];
  status?: "published" | "hidden";
}

/** The editable listing fields as shown in an owner's edit form. */
export interface MapListingDraft {
  title: string;
  authorName: string;
  description: string;
  visibility: ManagedMapVisibility;
}

export interface MapRatingStats {
  averageRating: number;
  ratingCount: number;
}

export const BROWSE_DEFAULT_PAGE_SIZE = 24;

/** Columns matched by the browse search box ("Search by name or author"). */
const BROWSE_SEARCH_COLUMNS = ["title", "description", "template_name", "author_name"] as const;

// ---------------------------------------------------------------------------
// List maps
// ---------------------------------------------------------------------------

export async function listMaps(
  filters: BrowseFilters = {},
  client: SupabaseClient<Database> | null = supabase
): Promise<BrowseResult> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = filters.pageSize ?? BROWSE_DEFAULT_PAGE_SIZE;

  if (!client) {
    if (isSupabaseConfigured) throw new Error("Supabase is configured, but the browser client is unavailable.");
    return listMapsLocal(filters, page, pageSize);
  }
  if (client === supabase && !isSupabaseConfigured) {
    return listMapsLocal(filters, page, pageSize);
  }

  return listMapsFromSupabase(client, filters, page, pageSize);
}

// ---------------------------------------------------------------------------
// List signed-in user's maps
// ---------------------------------------------------------------------------

export async function listMyMaps(
  client: SupabaseClient<Database> | null = supabase
): Promise<ManagedMapsResult> {
  if (!client || (client === supabase && !isSupabaseConfigured)) {
    return listMyMapsLocal();
  }

  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  const userId = userData.user?.id;
  if (!userId) throw new Error("Sign in to manage your uploaded maps.");

  const { data, error } = await client
    .from("maps")
    .select(`
      id,
      owner_id,
      slug,
      title,
      author_name,
      description,
      visibility,
      status,
      map_width,
      map_height,
      player_count,
      zone_count,
      connection_count,
      win_condition,
      template_name,
      template_json,
      preview_design_json,
      preview_renderer_version,
      download_count,
      rating_count,
      rating_average,
      created_at,
      updated_at,
      profiles(display_name),
      map_tags(tags(slug, label, kind, category))
    `)
    .eq("owner_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw error;

  return {
    maps: ((data ?? []) as BrowseListRow[]).map(browseRowToManagedCard)
  };
}

async function listMapsFromSupabase(
  client: SupabaseClient<Database>,
  filters: BrowseFilters,
  page: number,
  pageSize: number
): Promise<BrowseResult> {

  let query = client
    .rpc("public_browse_maps", {}, { count: "exact" })
    .select(`
      id,
      owner_id,
      slug,
      title,
      author_name,
      description,
      visibility,
      map_width,
      map_height,
      player_count,
      zone_count,
      connection_count,
      win_condition,
      template_name,
      preview_design_json,
      preview_renderer_version,
      download_count,
      rating_count,
      rating_average,
      created_at,
      updated_at,
      author_name,
      tags
    `)
    .eq("visibility", "public");

  query = applySupabaseSearchFilter(query, filters.query);
  query = applySupabaseRangeFilters(query, filters.rangeFilters);
  query = applySupabaseTagFilters(query, filters.selectedTagSlugs);

  const sort = filters.sort ?? "newest";
  if (sort === "top-rated") {
    query = query.order("rating_average", { ascending: false }).order("rating_count", { ascending: false }).order("created_at", { ascending: false });
  } else if (sort === "most-downloaded") {
    query = query.order("download_count", { ascending: false }).order("created_at", { ascending: false });
  } else if (sort === "recently-updated") {
    query = query.order("updated_at", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;

  const rows = (data ?? []) as BrowseListRow[];
  const cards = rows.map(browseRowToCard);

  const total = count ?? cards.length;
  return {
    maps: cards,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize))
  };
}

// ---------------------------------------------------------------------------
// Browse stats (whole filtered result set, not just the current page)
// ---------------------------------------------------------------------------

/**
 * Map count, rating count, and average score over every public map matching the filters.
 * Returns null when Supabase is not configured; callers summarize the local catalog instead.
 * The map count is exact; past PostgREST's row cap (Supabase max_rows, 1000 by default) the rating
 * numbers only cover the rows returned.
 */
export async function fetchBrowseStats(
  filters: Pick<BrowseFilters, "query" | "selectedTagSlugs" | "rangeFilters"> = {},
  client: SupabaseClient<Database> | null = supabase
): Promise<CommunityCatalogStats | null> {
  if (!client || !isSupabaseConfigured) return null;

  let query = client
    .rpc("public_browse_maps", {}, { count: "exact" })
    .select("rating_count, rating_average")
    .eq("visibility", "public");
  query = applySupabaseSearchFilter(query, filters.query);
  query = applySupabaseRangeFilters(query, filters.rangeFilters);
  query = applySupabaseTagFilters(query, filters.selectedTagSlugs);

  const { data, error, count } = await query;
  if (error) throw error;

  const rows = (data ?? []) as Array<{ rating_count: number; rating_average: number | string }>;
  return summarizeRatingAggregates(
    rows.map((row) => ({ ratingCount: row.rating_count, averageRating: Number(row.rating_average) })),
    count ?? rows.length
  );
}

/** Optimistic aggregate after the viewer rates a map (replacing `previousRating` when they had one). */
export function estimateRatingStatsAfterVote(
  stats: MapRatingStats,
  previousRating: number | undefined,
  nextRating: number
): MapRatingStats {
  const total = stats.averageRating * stats.ratingCount;
  if (previousRating === undefined || stats.ratingCount === 0) {
    const ratingCount = stats.ratingCount + 1;
    return { ratingCount, averageRating: roundToHundredth((total + nextRating) / ratingCount) };
  }
  return {
    ratingCount: stats.ratingCount,
    averageRating: roundToHundredth((total - previousRating + nextRating) / stats.ratingCount)
  };
}

function roundToHundredth(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Rating-weighted summary of per-map aggregates. */
export function summarizeRatingAggregates(
  maps: ReadonlyArray<MapRatingStats>,
  mapCount = maps.length
): CommunityCatalogStats {
  const ratingCount = maps.reduce((sum, map) => sum + map.ratingCount, 0);
  const ratingTotal = maps.reduce((sum, map) => sum + map.averageRating * map.ratingCount, 0);
  return {
    mapCount,
    ratingCount,
    averageRating: ratingCount === 0 ? 0 : Math.round((ratingTotal / ratingCount) * 10) / 10
  };
}

// ---------------------------------------------------------------------------
// Get single map (full detail)
// ---------------------------------------------------------------------------

export async function getMap(
  id: string,
  client: SupabaseClient<Database> | null = supabase
): Promise<MapDetail | null> {
  if (!client) {
    if (isSupabaseConfigured) throw new Error("Supabase is configured, but the browser client is unavailable.");
    return getMapLocal(id);
  }
  if (client === supabase && !isSupabaseConfigured) {
    return getMapLocal(id);
  }

  const { data, error } = await client
    .rpc("public_map_detail", { p_map_id: id })
    .select(`
      id,
      owner_id,
      slug,
      title,
      description,
      visibility,
      map_width,
      map_height,
      player_count,
      zone_count,
      connection_count,
      win_condition,
      template_name,
      preview_design_json,
      preview_renderer_version,
      template_json,
      design_json,
      download_count,
      rating_count,
      rating_average,
      created_at,
      updated_at,
      author_name,
      tags
    `)
    .maybeSingle();

  if (error) throw error;
  if (!data) return await getOwnedMapFromSupabase(id, client);

  const row = data as BrowseDetailRow;
  return browseDetailRowToMapDetail(row);
}

async function getOwnedMapFromSupabase(
  id: string,
  client: SupabaseClient<Database>
): Promise<MapDetail | null> {
  const { data, error } = await client
    .from("maps")
    .select(`
      id,
      owner_id,
      slug,
      title,
      author_name,
      description,
      visibility,
      status,
      map_width,
      map_height,
      player_count,
      zone_count,
      connection_count,
      win_condition,
      template_name,
      preview_design_json,
      preview_renderer_version,
      template_json,
      design_json,
      download_count,
      rating_count,
      rating_average,
      created_at,
      updated_at,
      profiles(display_name),
      map_tags(tags(slug, label, kind, category))
    `)
    .eq("id", id)
    .single();

  if (error?.code === "PGRST116") return null;
  if (error) throw error;
  if (!data) return null;

  return browseDetailRowToMapDetail(data as BrowseDetailRow);
}

// ---------------------------------------------------------------------------
// Rate map
// ---------------------------------------------------------------------------

export async function rateMap(
  mapId: string,
  value: number,
  client: SupabaseClient<Database> | null = supabase
): Promise<void> {
  if (!client || !isSupabaseConfigured) return;

  const clamped = Math.min(5, Math.max(1, Math.round(value)));
  const { error } = await client.rpc("rate_map", {
    p_map_id: mapId,
    p_value: clamped
  });

  if (error) throw new Error(error.message);
}

export async function fetchViewerRating(
  mapId: string,
  client: SupabaseClient<Database> | null = supabase
): Promise<number | null> {
  if (!client || !isSupabaseConfigured) return null;

  const { data, error } = await client.rpc("get_viewer_rating", {
    p_map_id: mapId
  });

  if (error) return null;
  return data as number | null;
}

/** The signed-in viewer's own ratings for a set of maps, keyed by map id (one request per page). */
export async function fetchViewerRatings(
  mapIds: readonly string[],
  userId: string,
  client: SupabaseClient<Database> | null = supabase
): Promise<Record<string, number>> {
  const ids = [...new Set(mapIds.filter(Boolean))];
  if (!client || !isSupabaseConfigured || !userId || ids.length === 0) return {};

  const { data, error } = await client
    .from("ratings")
    .select("map_id, value")
    .eq("user_id", userId)
    .in("map_id", ids);
  if (error) throw error;

  return Object.fromEntries(((data ?? []) as Array<{ map_id: string; value: number }>).map((row) => [row.map_id, row.value]));
}

/** Fresh rating aggregates for one public map, used to refresh a card after the viewer rates it. */
export async function fetchMapRatingStats(
  mapId: string,
  client: SupabaseClient<Database> | null = supabase
): Promise<MapRatingStats | null> {
  if (!client || !isSupabaseConfigured) return null;

  const { data, error } = await client
    .rpc("public_browse_maps", {})
    .select("id, rating_count, rating_average")
    .eq("id", mapId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row = data as { rating_count: number; rating_average: number | string };
  return { averageRating: Number(row.rating_average), ratingCount: row.rating_count };
}

// ---------------------------------------------------------------------------
// Record download
// ---------------------------------------------------------------------------

export async function recordDownload(
  mapId: string,
  client: SupabaseClient<Database> | null = supabase
): Promise<void> {
  if (!client || !isSupabaseConfigured) return;

  const { error } = await client.rpc("record_download", {
    p_map_id: mapId,
    p_anonymous_id: getAnonymousId()
  });

  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Update map listing (owner only)
// ---------------------------------------------------------------------------

/** Shown under the description field of listing edit forms; see updateMapListing. */
export const LISTING_DESCRIPTION_NOTE =
  "Updates the listing description. Downloaded templates keep the description they were shared with.";

/**
 * Updates owner-editable listing columns only. template_json (and the design_json that must stay in
 * sync with it) is derived metadata: the maps_prevent_direct_metadata_update trigger rejects client
 * writes to it, and a rejected column fails the whole UPDATE. A description edit therefore changes
 * the listing description; the downloadable template keeps the description it was uploaded with.
 */
export async function updateMapListing(
  mapId: string,
  patch: MapListingPatch,
  client: SupabaseClient<Database> | null = supabase
): Promise<void> {
  if (!client || !isSupabaseConfigured) return;

  const update: Database["public"]["Tables"]["maps"]["Update"] = {};
  if (patch.title !== undefined) {
    const validation = validateMapTitle(patch.title);
    if (!validation.ok) throw new Error(validation.errors[0]);
    update.title = validation.value || "Untitled Map";
  }
  if (patch.authorName !== undefined) {
    const validation = validateAuthorDisplayName(patch.authorName);
    if (!validation.ok) throw new Error(validation.errors[0]);
    update.author_name = validation.value || ANONYMOUS_AUTHOR_NAME;
  }
  if (patch.description !== undefined) {
    const validation = validateMapDescription(patch.description);
    if (!validation.ok) throw new Error(validation.errors[0]);
    update.description = validation.value;
  }
  if (patch.visibility !== undefined) update.visibility = patch.visibility;
  if (patch.status !== undefined) update.status = patch.status;

  if (Object.keys(update).length > 0) {
    const { error } = await client
      .from("maps")
      .update(update)
      .eq("id", mapId);
    if (error) throw error;
  }
}

/**
 * Builds a patch containing only the listing fields that differ from the current listing, so saving
 * an edit form never rewrites untouched columns (e.g. the displayed, profile-resolved author name).
 */
export function buildMapListingPatch(
  current: { title: string; authorName: string; summary: string; visibility: ManagedMapVisibility },
  draft: MapListingDraft
): MapListingPatch {
  const patch: MapListingPatch = {};

  const title = normalizeMapTitle(draft.title);
  if (title && title !== normalizeMapTitle(current.title)) patch.title = title;

  const authorName = normalizeAuthorDisplayName(draft.authorName);
  if ((authorName || ANONYMOUS_AUTHOR_NAME) !== (normalizeAuthorDisplayName(current.authorName) || ANONYMOUS_AUTHOR_NAME)) {
    patch.authorName = authorName;
  }

  const description = normalizeMapDescription(draft.description);
  if (description !== normalizeMapDescription(current.summary)) patch.description = description;

  if (draft.visibility !== current.visibility) patch.visibility = draft.visibility;
  return patch;
}

// ---------------------------------------------------------------------------
// Delete map listing (owner only)
// ---------------------------------------------------------------------------

export async function deleteMapListing(
  mapId: string,
  client: SupabaseClient<Database> | null = supabase
): Promise<void> {
  if (!client || (client === supabase && !isSupabaseConfigured)) {
    deleteMapListingLocal(mapId);
    return;
  }

  const { data, error } = await client.functions.invoke<{ error?: string; code?: string; details?: string[] }>("delete-map", {
    body: { mapId }
  });

  if (error) {
    const details = await readFunctionError(error, "Failed to delete map listing.");
    if (shouldFallbackToDirectMapDelete(error)) {
      await deleteMapListingDirect(mapId, client);
      return;
    }
    throw new Error(details.message);
  }
  if (data?.error) throw new Error(data.error);
}

async function deleteMapListingDirect(
  mapId: string,
  client: SupabaseClient<Database>
): Promise<void> {
  const { data: map, error: lookupError } = await client
    .from("maps")
    .select("id")
    .eq("id", mapId)
    .maybeSingle<Pick<Database["public"]["Tables"]["maps"]["Row"], "id">>();

  if (lookupError) throw lookupError;
  if (!map) throw new Error("Map not found.");

  const { error: deleteError } = await client
    .from("maps")
    .delete()
    .eq("id", mapId);
  if (deleteError) throw deleteError;
}

function shouldFallbackToDirectMapDelete(error: unknown): boolean {
  const context = typeof error === "object" && error && "context" in error ? (error as { context?: unknown }).context : undefined;
  if (context instanceof Response) {
    return context.status === 404 || context.status === 405;
  }

  const message = [
    error instanceof Error ? error.message : "",
    typeof error === "object" && error && "message" in error && typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message
      : ""
  ]
    .join(" ")
    .toLowerCase();

  return message.includes("failed to fetch")
    || message.includes("networkerror")
    || message.includes("load failed")
    || message.includes("preflight");
}

// ---------------------------------------------------------------------------
// Local fallback helpers (seed catalog)
// ---------------------------------------------------------------------------

function listMapsLocal(filters: BrowseFilters, page: number, pageSize: number): BrowseResult {
  const catalog = loadCommunityCatalog();
  const maps = visibleCommunityMaps(catalog);

  const filtered = filterCommunityMaps(maps, {
    query: filters.query,
    selectedTagSlugs: filters.selectedTagSlugs,
    rangeFilters: filters.rangeFilters
  });

  const sorted = sortLocalMaps(filtered, filters.sort ?? "newest");
  const total = sorted.length;
  const start = (page - 1) * pageSize;
  const paged = sorted.slice(start, start + pageSize);

  return {
    maps: paged.map(communityMapRecordToCard),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize))
  };
}

function listMyMapsLocal(): ManagedMapsResult {
  const catalog = loadCommunityCatalog();
  return {
    maps: catalog.maps
      .slice()
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map((map) => ({
        ...communityMapRecordToCard(map),
        visibility: map.visibility,
        status: "published" as const
      }))
  };
}

function deleteMapListingLocal(mapId: string): void {
  const catalog = loadCommunityCatalog();
  persistCommunityCatalog({
    ...catalog,
    maps: catalog.maps.filter((map) => map.id !== mapId),
    ratings: catalog.ratings.filter((rating) => rating.mapId !== mapId)
  });
}

function getMapLocal(id: string): MapDetail | null {
  const catalog = loadCommunityCatalog();
  const map = catalog.maps.find((m) => m.id === id);
  if (!map) return null;

  return {
    ...communityMapRecordToCard(map),
    designJson: map.designJson,
    templateJson: map.templateJson
  };
}

function communityMapRecordToCard(map: CommunityMapRecord): BrowseMapCard {
  return {
    id: map.id,
    ownerId: null,
    slug: map.slug,
    title: map.title,
    summary: map.summary,
    authorName: map.authorName,
    tags: map.tags,
    visibility: map.visibility,
    mapWidth: map.mapWidth,
    mapHeight: map.mapHeight,
    playerCount: map.playerCount,
    zoneCount: map.zoneCount,
    connectionCount: map.connectionCount,
    winCondition: "Classic",
    templateName: map.templateName,
    previewDesignJson: map.previewDesignJson,
    previewRendererVersion: map.previewRendererVersion,
    uploadedAt: map.uploadedAt,
    updatedAt: map.updatedAt,
    downloadCount: map.downloadCount,
    averageRating: map.averageRating,
    ratingCount: map.ratingCount
  };
}

function sortLocalMaps(maps: CommunityMapRecord[], sort: BrowseSort): CommunityMapRecord[] {
  return [...maps].sort((left, right) => {
    if (sort === "top-rated") return right.averageRating - left.averageRating || right.ratingCount - left.ratingCount || right.uploadedAt.localeCompare(left.uploadedAt);
    if (sort === "most-downloaded") return right.downloadCount - left.downloadCount || right.uploadedAt.localeCompare(left.uploadedAt);
    if (sort === "recently-updated") return right.updatedAt.localeCompare(left.updatedAt);
    return right.uploadedAt.localeCompare(left.uploadedAt);
  });
}

// ---------------------------------------------------------------------------
// Row-to-card mappers
// ---------------------------------------------------------------------------

interface BrowseListRow {
  id: string;
  owner_id?: string | null;
  slug: string;
  title: string;
  description: string;
  visibility: "public" | "unlisted" | "private";
  status?: string;
  map_width: number;
  map_height: number;
  player_count: number;
  zone_count: number;
  connection_count: number;
  win_condition: string;
  template_name: string;
  template_json?: unknown;
  preview_design_json: unknown;
  preview_renderer_version: number;
  download_count: number;
  rating_count: number;
  rating_average: number;
  created_at: string;
  updated_at: string;
  author_name?: string | null;
  tags?: Array<{ slug: string; label: string; kind: "factual" | "descriptive"; category: string }> | null;
  profiles?: { display_name: string | null } | null;
  map_tags?: Array<{
    tags: { slug: string; label: string; kind: "factual" | "descriptive"; category: string } | null;
  }> | null;
}

interface BrowseDetailRow extends BrowseListRow {
  template_json: unknown;
  design_json: unknown;
}

export function browseRowToCard(row: BrowseListRow): BrowseMapCard {
  const templateDescription = requireOptionalReleaseTemplateDescription(row.template_json);
  return {
    id: row.id,
    ownerId: row.owner_id ?? null,
    slug: row.slug,
    title: row.title,
    // The listing description is what owners edit (template_json is server-derived and read-only to
    // clients), so it wins over the uploaded template's description. The browse RPC only returns the
    // listing description, so this keeps cards, details, and My maps consistent.
    summary: row.description?.trim() ? row.description : templateDescription ?? row.description,
    authorName: resolvePublicAuthorName(row.author_name, row.profiles?.display_name),
    tags: extractRowTags(row),
    visibility: row.visibility === "private" ? "unlisted" : row.visibility,
    mapWidth: row.map_width,
    mapHeight: row.map_height,
    playerCount: row.player_count,
    zoneCount: row.zone_count,
    connectionCount: row.connection_count,
    winCondition: formatWinConditionLabel(row.win_condition),
    templateName: row.template_name,
    previewDesignJson: requireStoredPreviewDesignJson(row.preview_design_json, row.preview_renderer_version),
    previewRendererVersion: row.preview_renderer_version,
    uploadedAt: row.created_at,
    updatedAt: row.updated_at,
    downloadCount: row.download_count,
    averageRating: Number(row.rating_average),
    ratingCount: row.rating_count
  };
}

function browseRowToManagedCard(row: BrowseListRow): ManagedMapCard {
  return {
    ...browseRowToCard(row),
    visibility: row.visibility,
    status: row.status as ManagedMapStatus
  };
}

function browseDetailRowToMapDetail(row: BrowseDetailRow): MapDetail {
  const templateJson = requireReleaseTemplateJson(row.template_json);
  return {
    ...browseRowToCard(row),
    designJson: serializeReleaseJsonField(row.design_json, "design_json"),
    templateJson: serializeReleaseTemplateJson(templateJson)
  };
}

function extractRowTags(row: BrowseListRow): CommunityTag[] {
  const rawTags = row.tags ?? (row.map_tags ?? []).map((mapTag) => mapTag.tags);
  return sortTags(rawTags
    .filter((tag): tag is NonNullable<typeof tag> => Boolean(tag))
    .map((tag) => {
      const normalized = createTagFromSlug(tag.slug, tag.kind);
      return {
        ...normalized,
        label: tag.label || normalized.label,
        category: tag.category as CommunityTag["category"] || normalized.category
      };
    }));
}

function applySupabaseRangeFilters<T extends {
  gte(column: string, value: number): T;
  lte(column: string, value: number): T;
}>(query: T, rangeFilters: BrowseRangeFilters | undefined): T {
  let next = query;
  next = applySupabaseRange(next, "player_count", rangeFilters?.players);
  next = applySupabaseRange(next, "map_width", rangeFilters?.mapWidth);
  next = applySupabaseRange(next, "map_height", rangeFilters?.mapHeight);
  next = applySupabaseRange(next, "zone_count", rangeFilters?.zones);
  next = applySupabaseRange(next, "connection_count", rangeFilters?.connections);
  return next;
}

function applySupabaseRange<T extends {
  gte(column: string, value: number): T;
  lte(column: string, value: number): T;
}>(query: T, column: string, range: { min?: number; max?: number } | undefined): T {
  let next = query;
  if (typeof range?.min === "number" && Number.isFinite(range.min)) next = next.gte(column, range.min);
  if (typeof range?.max === "number" && Number.isFinite(range.max)) next = next.lte(column, range.max);
  return next;
}

function applySupabaseTagFilters<T extends {
  contains(column: string, value: unknown): T;
}>(query: T, selectedTagSlugs: string[] | undefined): T {
  let next = query;
  for (const slug of [...new Set((selectedTagSlugs ?? []).filter(Boolean))]) {
    next = next.contains("tags", [{ slug }]);
  }
  return next;
}

function applySupabaseSearchFilter<T extends {
  or(filters: string): T;
}>(query: T, rawQuery: string | undefined): T {
  const filter = buildBrowseSearchFilter(rawQuery);
  return filter ? query.or(filter) : query;
}

/**
 * PostgREST `or=(...)` filter for the browse search box. The raw term is escaped for ILIKE and
 * double-quoted so reserved characters such as `,` `.` `:` `(` `)` stay part of the value.
 */
export function buildBrowseSearchFilter(rawQuery: string | undefined): string | null {
  const term = rawQuery?.trim() ?? "";
  if (term === "") return null;
  const pattern = quotePostgrestValue(`%${escapeIlikePattern(term)}%`);
  return BROWSE_SEARCH_COLUMNS.map((column) => `${column}.ilike.${pattern}`).join(",");
}

function escapeIlikePattern(value: string): string {
  // Backslash is PostgreSQL's default LIKE escape. PostgREST rewrites `*` to `%`, so a typed `*`
  // becomes the single-character wildcard (which still matches a literal `*`) instead of "anything".
  return value.replace(/[\\%_]/g, (match) => `\\${match}`).replace(/\*/g, "_");
}

function quotePostgrestValue(value: string): string {
  return `"${value.replace(/[\\"]/g, (match) => `\\${match}`)}"`;
}

function getAnonymousId(): string {
  const key = "olden-era-template-generator.anonymous-id";
  try {
    const existing = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
    if (existing) return existing;
  } catch {
    // Storage blocked; fall through to a per-session id.
  }
  const id = `anon-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(key, id);
  } catch {
    // Storage blocked or full.
  }
  return id;
}

async function readFunctionError(error: unknown, fallback: string): Promise<{ message: string; code: string; details: string[] }> {
  const fallbackMessage = error instanceof Error ? error.message : fallback;
  const context = typeof error === "object" && error && "context" in error ? (error as { context?: unknown }).context : undefined;
  if (context instanceof Response) {
    try {
      const body = await context.clone().json() as { error?: string; code?: string; details?: string[] };
      return {
        message: body.error ?? fallbackMessage,
        code: body.code ?? "edge_function_error",
        details: body.details ?? [body.error ?? fallbackMessage]
      };
    } catch {
      return { message: fallbackMessage, code: "edge_function_error", details: [fallbackMessage] };
    }
  }
  return { message: fallbackMessage, code: "edge_function_error", details: [fallbackMessage] };
}
