import { describe, expect, it } from "vitest";
import {
  PUBLIC_BROWSE_MAP_FILTER,
  mapDatabaseRecordToCommunityMapRecord,
  type CommunityMapDatabaseRecord
} from "../src/community/databaseMappers";
import { PREVIEW_RENDERER_VERSION } from "../src/community/previewDesign";

describe("community database mappers", () => {
  it("maps Supabase rows into the current browse record shape", () => {
    const record = mapDatabaseRecordToCommunityMapRecord({
      id: "4f968113-8bdb-4dd3-8b53-6782d2ca7ea7",
      owner_id: "59cfdd97-19ac-4d31-87df-306b0f863b61",
      slug: "temple-border-clash",
      title: "Temple Border Clash",
      description: "Fast 1v1 with a central neutral breakpoint.",
      visibility: "public",
      status: "published",
      map_width: 160,
      map_height: 160,
      player_count: 2,
      zone_count: 5,
      connection_count: 4,
      win_condition: "win_condition_1",
      terrain_theme: "Grass",
      template_name: "Temple Border Clash",
      template_json: { name: "Temple Border Clash", description: "Template description shown in browse." },
      design_json: { templateName: "Temple Border Clash" },
      preview_image_path: null,
      preview_image_url: null,
      preview_thumbnail_path: null,
      preview_thumbnail_url: null,
      preview_image_width: null,
      preview_image_height: null,
      preview_thumbnail_width: null,
      preview_thumbnail_height: null,
      preview_design_json: { version: PREVIEW_RENDERER_VERSION, mapWidth: 160, mapHeight: 160, templateName: "Temple Border Clash", zones: [], connections: [] },
      preview_renderer_version: PREVIEW_RENDERER_VERSION,
      template_sha256: "a".repeat(64),
      upload_warnings: [],
      factual_metadata: {},
      download_count: 12,
      rating_count: 3,
      rating_average: 4.67,
      created_at: "2026-05-17T09:00:00.000Z",
      updated_at: "2026-05-17T10:00:00.000Z",
      profiles: { display_name: "Olden Era Studio" },
      map_tags: [
        { tags: { slug: "players:2", label: "2 players", kind: "factual", category: "players" } },
        { tags: { slug: "competitive", label: "Competitive", kind: "descriptive", category: "audience" } },
        { tags: null }
      ]
    } satisfies CommunityMapDatabaseRecord);

    expect(record).toMatchObject({
      id: "4f968113-8bdb-4dd3-8b53-6782d2ca7ea7",
      slug: "temple-border-clash",
      title: "Temple Border Clash",
      summary: "Template description shown in browse.",
      authorName: "Olden Era Studio",
      tags: [
        { slug: "competitive", label: "Competitive", kind: "descriptive", category: "audience" },
        { slug: "players:2", label: "2 players", kind: "factual", category: "players" }
      ],
      visibility: "public",
      mapWidth: 160,
      mapHeight: 160,
      playerCount: 2,
      zoneCount: 5,
      connectionCount: 4,
      templateName: "Temple Border Clash",
      previewDesignJson: JSON.stringify({ version: PREVIEW_RENDERER_VERSION, mapWidth: 160, mapHeight: 160, templateName: "Temple Border Clash", zones: [], connections: [] }, null, 2),
      previewRendererVersion: PREVIEW_RENDERER_VERSION,
      uploadedAt: "2026-05-17T09:00:00.000Z",
      updatedAt: "2026-05-17T10:00:00.000Z",
      downloadCount: 12,
      averageRating: 4.67,
      ratingCount: 3
    });
    expect(record.templateJson).toBe(JSON.stringify({ name: "Temple Border Clash", description: "Template description shown in browse." }, null, 2));
    expect(record.designJson).toBe(JSON.stringify({ templateName: "Temple Border Clash" }, null, 2));
  });

  it("keeps public browsing restricted to published public maps", () => {
    expect(PUBLIC_BROWSE_MAP_FILTER).toEqual({
      status: "published",
      visibility: "public"
    });
  });

  it("rejects rows that are missing preview_design_json", () => {
    expect(() => mapDatabaseRecordToCommunityMapRecord({
      id: "4f968113-8bdb-4dd3-8b53-6782d2ca7ea7",
      owner_id: "59cfdd97-19ac-4d31-87df-306b0f863b61",
      slug: "temple-border-clash",
      title: "Temple Border Clash",
      description: "Fast 1v1 with a central neutral breakpoint.",
      visibility: "public",
      status: "published",
      map_width: 160,
      map_height: 160,
      player_count: 2,
      zone_count: 5,
      connection_count: 4,
      win_condition: "win_condition_1",
      terrain_theme: "Grass",
      template_name: "Temple Border Clash",
      template_json: { name: "Temple Border Clash", description: "Template description shown in browse." },
      design_json: { format: "olden-era-template-design", version: 1, templateName: "Temple Border Clash" },
      preview_image_path: null,
      preview_image_url: null,
      preview_thumbnail_path: null,
      preview_thumbnail_url: null,
      preview_image_width: null,
      preview_image_height: null,
      preview_thumbnail_width: null,
      preview_thumbnail_height: null,
      preview_design_json: null,
      preview_renderer_version: PREVIEW_RENDERER_VERSION,
      template_sha256: "a".repeat(64),
      upload_warnings: [],
      factual_metadata: {},
      download_count: 12,
      rating_count: 3,
      rating_average: 4.67,
      created_at: "2026-05-17T09:00:00.000Z",
      updated_at: "2026-05-17T10:00:00.000Z",
      profiles: { display_name: "Olden Era Studio" },
      map_tags: []
    } satisfies CommunityMapDatabaseRecord)).toThrow("missing preview_design_json");
  });

  it("rejects rows whose preview renderer version is stale", () => {
    expect(() => mapDatabaseRecordToCommunityMapRecord({
      id: "4f968113-8bdb-4dd3-8b53-6782d2ca7ea7",
      owner_id: "59cfdd97-19ac-4d31-87df-306b0f863b61",
      slug: "temple-border-clash",
      title: "Temple Border Clash",
      description: "Fast 1v1 with a central neutral breakpoint.",
      visibility: "public",
      status: "published",
      map_width: 160,
      map_height: 160,
      player_count: 2,
      zone_count: 5,
      connection_count: 4,
      win_condition: "win_condition_1",
      terrain_theme: "Grass",
      template_name: "Temple Border Clash",
      template_json: { name: "Temple Border Clash", description: "Template description shown in browse." },
      design_json: { format: "olden-era-template-design", version: 1, templateName: "Temple Border Clash" },
      preview_image_path: null,
      preview_image_url: null,
      preview_thumbnail_path: null,
      preview_thumbnail_url: null,
      preview_image_width: null,
      preview_image_height: null,
      preview_thumbnail_width: null,
      preview_thumbnail_height: null,
      preview_design_json: { version: PREVIEW_RENDERER_VERSION, mapWidth: 160, mapHeight: 160, templateName: "Temple Border Clash", zones: [], connections: [] },
      preview_renderer_version: 999,
      template_sha256: "a".repeat(64),
      upload_warnings: [],
      factual_metadata: {},
      download_count: 12,
      rating_count: 3,
      rating_average: 4.67,
      created_at: "2026-05-17T09:00:00.000Z",
      updated_at: "2026-05-17T10:00:00.000Z",
      profiles: { display_name: "Olden Era Studio" },
      map_tags: []
    } satisfies CommunityMapDatabaseRecord)).toThrow("stale preview_renderer_version");
  });

  it("rejects legacy stringified template_json rows", () => {
    expect(() => mapDatabaseRecordToCommunityMapRecord({
      id: "4f968113-8bdb-4dd3-8b53-6782d2ca7ea7",
      owner_id: "59cfdd97-19ac-4d31-87df-306b0f863b61",
      slug: "temple-border-clash",
      title: "Temple Border Clash",
      description: "Fast 1v1 with a central neutral breakpoint.",
      visibility: "public",
      status: "published",
      map_width: 160,
      map_height: 160,
      player_count: 2,
      zone_count: 5,
      connection_count: 4,
      win_condition: "win_condition_1",
      terrain_theme: "Grass",
      template_name: "Temple Border Clash",
      template_json: JSON.stringify({ name: "Temple Border Clash", description: "Template description shown in browse." }),
      design_json: { format: "olden-era-template-design", version: 1, templateName: "Temple Border Clash" },
      preview_image_path: null,
      preview_image_url: null,
      preview_thumbnail_path: null,
      preview_thumbnail_url: null,
      preview_image_width: null,
      preview_image_height: null,
      preview_thumbnail_width: null,
      preview_thumbnail_height: null,
      preview_design_json: { version: PREVIEW_RENDERER_VERSION, mapWidth: 160, mapHeight: 160, templateName: "Temple Border Clash", zones: [], connections: [] },
      preview_renderer_version: PREVIEW_RENDERER_VERSION,
      template_sha256: "a".repeat(64),
      upload_warnings: [],
      factual_metadata: {},
      download_count: 12,
      rating_count: 3,
      rating_average: 4.67,
      created_at: "2026-05-17T09:00:00.000Z",
      updated_at: "2026-05-17T10:00:00.000Z",
      profiles: { display_name: "Olden Era Studio" },
      map_tags: []
    } satisfies CommunityMapDatabaseRecord)).toThrow("legacy stringified template_json");
  });

  it("rejects invalid scalar template_json rows", () => {
    expect(() => mapDatabaseRecordToCommunityMapRecord({
      id: "4f968113-8bdb-4dd3-8b53-6782d2ca7ea7",
      owner_id: "59cfdd97-19ac-4d31-87df-306b0f863b61",
      slug: "temple-border-clash",
      title: "Temple Border Clash",
      description: "Fast 1v1 with a central neutral breakpoint.",
      visibility: "public",
      status: "published",
      map_width: 160,
      map_height: 160,
      player_count: 2,
      zone_count: 5,
      connection_count: 4,
      win_condition: "win_condition_1",
      terrain_theme: "Grass",
      template_name: "Temple Border Clash",
      template_json: 42,
      design_json: { format: "olden-era-template-design", version: 1, templateName: "Temple Border Clash" },
      preview_image_path: null,
      preview_image_url: null,
      preview_thumbnail_path: null,
      preview_thumbnail_url: null,
      preview_image_width: null,
      preview_image_height: null,
      preview_thumbnail_width: null,
      preview_thumbnail_height: null,
      preview_design_json: { version: PREVIEW_RENDERER_VERSION, mapWidth: 160, mapHeight: 160, templateName: "Temple Border Clash", zones: [], connections: [] },
      preview_renderer_version: PREVIEW_RENDERER_VERSION,
      template_sha256: "a".repeat(64),
      upload_warnings: [],
      factual_metadata: {},
      download_count: 12,
      rating_count: 3,
      rating_average: 4.67,
      created_at: "2026-05-17T09:00:00.000Z",
      updated_at: "2026-05-17T10:00:00.000Z",
      profiles: { display_name: "Olden Era Studio" },
      map_tags: []
    } satisfies CommunityMapDatabaseRecord)).toThrow("invalid template_json");
  });
});
