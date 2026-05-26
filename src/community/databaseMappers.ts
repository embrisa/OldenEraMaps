import type { SupabaseClient } from "@supabase/supabase-js";
import type { CommunityMapRecord } from "./maps";
import { resolvePublicAuthorName } from "./authorNames";
import { requireStoredPreviewDesignJson } from "./previewPayload.ts";
import { extractReleaseTemplateDescription, requireReleaseTemplateJson, serializeReleaseJsonField, serializeReleaseTemplateJson } from "./releaseRowJson.ts";
import { createTagFromSlug, sortTags, type CommunityTag } from "./tags";
import type { Database } from "./databaseTypes";
import { requireSupabaseClient } from "./supabaseClient";

type MapRow = Database["public"]["Tables"]["maps"]["Row"];

export interface CommunityMapDatabaseRecord extends MapRow {
  profiles?: {
    display_name: string | null;
  } | null;
  map_tags?: Array<{
    tags: {
      slug: string;
      label: string;
      kind: "factual" | "descriptive";
      category: string;
    } | null;
  }> | null;
}

export const PUBLIC_BROWSE_MAP_FILTER = {
  status: "published",
  visibility: "public"
} as const;

export function mapDatabaseRecordToCommunityMapRecord(row: CommunityMapDatabaseRecord): CommunityMapRecord {
  const templateJson = requireReleaseTemplateJson(row.template_json);
  const templateDescription = extractReleaseTemplateDescription(templateJson);
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: templateDescription ?? row.description,
    authorName: resolvePublicAuthorName(row.author_name, row.profiles?.display_name),
    tags: extractTags(row),
    visibility: row.visibility === "private" ? "unlisted" : row.visibility,
    mapWidth: row.map_width,
    mapHeight: row.map_height,
    playerCount: row.player_count,
    zoneCount: row.zone_count,
    connectionCount: row.connection_count,
    templateName: row.template_name,
    previewDesignJson: requireStoredPreviewDesignJson(row.preview_design_json, row.preview_renderer_version),
    previewRendererVersion: row.preview_renderer_version,
    designJson: serializeReleaseJsonField(row.design_json, "design_json"),
    templateJson: serializeReleaseTemplateJson(templateJson),
    uploadedAt: row.created_at,
    updatedAt: row.updated_at,
    downloadCount: row.download_count,
    averageRating: Number(row.rating_average),
    ratingCount: row.rating_count
  };
}

export function publicPublishedMapsQuery(client?: SupabaseClient<Database>) {
  return requireSupabaseClient(client)
    .rpc("public_browse_maps", {})
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
      download_count,
      rating_count,
      rating_average,
      created_at,
      updated_at,
      author_name,
      tags
    `)
    .eq("visibility", PUBLIC_BROWSE_MAP_FILTER.visibility)
    .order("created_at", { ascending: false });
}

function extractTags(row: CommunityMapDatabaseRecord): CommunityTag[] {
  return sortTags((row.map_tags ?? [])
    .map((mapTag) => mapTag.tags)
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
