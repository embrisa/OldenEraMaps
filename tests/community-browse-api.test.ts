import { describe, expect, it, vi } from "vitest";

vi.mock("../src/community/supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabase: null
}));

import {
  browseRowToCard,
  getMap,
  listMaps,
  type BrowseMapCard,
  type BrowseResult,
  BROWSE_DEFAULT_PAGE_SIZE
} from "../src/community/communityApi";
import { createDefaultDesign } from "../src/design";
import { buildPreviewDesign, PREVIEW_RENDERER_VERSION } from "../src/community/previewDesign";

function createMockCard(overrides: Partial<BrowseMapCard> = {}): BrowseMapCard {
  return {
    id: "test-map-1",
    ownerId: "owner-1",
    slug: "test-map",
    title: "Test Map",
    summary: "A test map for units.",
    authorName: "Tester",
    tags: [
      { slug: "players:2", label: "2 players", kind: "factual", category: "players" },
      { slug: "competitive", label: "Competitive", kind: "descriptive", category: "audience" }
    ],
    visibility: "public",
    mapWidth: 160,
    mapHeight: 160,
    playerCount: 2,
    zoneCount: 5,
    connectionCount: 4,
    winCondition: "Classic",
    templateName: "Test Template",
    previewDesignJson: JSON.stringify(buildPreviewDesign(createDefaultDesign())),
    previewRendererVersion: PREVIEW_RENDERER_VERSION,
    uploadedAt: "2026-05-17T00:00:00.000Z",
    updatedAt: "2026-05-17T00:00:00.000Z",
    downloadCount: 10,
    averageRating: 4.5,
    ratingCount: 2,
    ...overrides
  };
}

describe("community API types", () => {
  it("BrowseMapCard does not include template_json or design_json", () => {
    const card = createMockCard();
    expect(card).not.toHaveProperty("templateJson");
    expect(card).not.toHaveProperty("designJson");
    expect(card).toHaveProperty("id");
    expect(card).toHaveProperty("title");
    expect(card).toHaveProperty("previewDesignJson");
  });

  it("has a default page size of 24", () => {
    expect(BROWSE_DEFAULT_PAGE_SIZE).toBe(24);
  });

  it("BrowseMapCard supports ownerId for owner-only views", () => {
    const owned = createMockCard({ ownerId: "user-abc" });
    const anonymous = createMockCard({ ownerId: null });
    expect(owned.ownerId).toBe("user-abc");
    expect(anonymous.ownerId).toBeNull();
  });

  it("BrowseMapCard has winCondition field", () => {
    const card = createMockCard({ winCondition: "City Hold" });
    expect(card.winCondition).toBe("City Hold");
  });

  it("BrowseResult includes pagination metadata", () => {
    const result: BrowseResult = {
      maps: [createMockCard()],
      total: 50,
      page: 2,
      pageSize: 24,
      pageCount: 3
    };
    expect(result.page).toBe(2);
    expect(result.pageCount).toBe(3);
    expect(result.total).toBe(50);
  });
});

describe("browse API filters", () => {
  it("passes numeric range filters into Supabase map predicates", async () => {
    const calls: Array<[string, string, unknown?]> = [];
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn((column: string, value: unknown) => {
        calls.push(["eq", column, value]);
        return query;
      }),
      gte: vi.fn((column: string, value: unknown) => {
        calls.push(["gte", column, value]);
        return query;
      }),
      lte: vi.fn((column: string, value: unknown) => {
        calls.push(["lte", column, value]);
        return query;
      }),
      order: vi.fn(() => query),
      range: vi.fn((from: number, to: number) => {
        calls.push(["range", `${from}`, to]);
        return query;
      }),
      then: (resolve: (value: { data: unknown[]; error: null; count: number }) => void) => Promise.resolve(resolve({ data: [], error: null, count: 0 }))
    };
    const client = {
      rpc: vi.fn(() => query)
    };

    await listMaps({
      rangeFilters: {
        players: { min: 2, max: 4 },
        mapWidth: { min: 160 },
        mapHeight: { max: 240 },
        zones: { min: 5, max: 12 },
        connections: { max: 20 }
      }
    }, client as never);

    expect(client.rpc).toHaveBeenCalledWith("public_browse_maps", {}, { count: "exact" });
    expect(calls).toContainEqual(["gte", "player_count", 2]);
    expect(calls).toContainEqual(["lte", "player_count", 4]);
    expect(calls).toContainEqual(["gte", "map_width", 160]);
    expect(calls).toContainEqual(["lte", "map_height", 240]);
    expect(calls).toContainEqual(["gte", "zone_count", 5]);
    expect(calls).toContainEqual(["lte", "zone_count", 12]);
    expect(calls).toContainEqual(["lte", "connection_count", 20]);
  });

  it("loads public browse rows through the narrow public RPC without template or design JSON", async () => {
    let selectedColumns = "";
    const query = {
      select: vi.fn((columns: string) => {
        selectedColumns = columns;
        return query;
      }),
      eq: vi.fn(() => query),
      order: vi.fn(() => query),
      range: vi.fn(() => query),
      then: (resolve: (value: { data: unknown[]; error: null; count: number }) => void) => Promise.resolve(resolve({ data: [], error: null, count: 0 }))
    };
    const client = {
      rpc: vi.fn(() => query),
      from: vi.fn()
    };

    await listMaps({}, client as never);

    expect(client.rpc).toHaveBeenCalledWith("public_browse_maps", {}, { count: "exact" });
    expect(client.from).not.toHaveBeenCalledWith("maps");
    expect(selectedColumns).not.toMatch(/(^|\s|,)template_json(\s|,|$)/);
    expect(selectedColumns).not.toMatch(/(^|\s|,)design_json(\s|,|$)/);
    expect(selectedColumns).not.toMatch(/(^|\s|,)template_sha256(\s|,|$)/);
  });

  it("loads public map detail through the narrow public detail RPC", async () => {
    let selectedColumns = "";
    const query = {
      select: vi.fn((columns: string) => {
        selectedColumns = columns;
        return query;
      }),
      maybeSingle: vi.fn(async () => ({
        data: {
          id: "test-map-1",
          owner_id: null,
          slug: "test-map",
          title: "Test Map",
          description: "A test map for units.",
          visibility: "public",
          map_width: 160,
          map_height: 160,
          player_count: 2,
          zone_count: 5,
          connection_count: 4,
          win_condition: "win_condition_1",
          template_name: "Test Template",
          template_json: { name: "Test Template" },
          design_json: { templateName: "Test Template" },
          preview_design_json: { version: PREVIEW_RENDERER_VERSION, zones: [], connections: [], mapWidth: 160, mapHeight: 160, templateName: "Test Template" },
          preview_renderer_version: PREVIEW_RENDERER_VERSION,
          download_count: 10,
          rating_count: 2,
          rating_average: 4.5,
          created_at: "2026-05-17T00:00:00.000Z",
          updated_at: "2026-05-17T00:00:00.000Z",
          author_name: "Tester",
          tags: []
        },
        error: null
      }))
    };
    const client = {
      rpc: vi.fn(() => query),
      from: vi.fn()
    };

    const detail = await getMap("test-map-1", client as never);

    expect(client.rpc).toHaveBeenCalledWith("public_map_detail", { p_map_id: "test-map-1" });
    expect(client.from).not.toHaveBeenCalledWith("maps");
    expect(selectedColumns).toContain("template_json");
    expect(selectedColumns).toContain("design_json");
    expect(selectedColumns).not.toMatch(/(^|\s|,)template_sha256(\s|,|$)/);
    expect(detail?.templateJson).toContain('"name": "Test Template"');
  });

});

describe("browse owner controls visibility", () => {
  it("identifies owner when ownerId matches", () => {
    const card = createMockCard({ ownerId: "user-123" });
    const isOwner = card.ownerId === "user-123";
    expect(isOwner).toBe(true);
  });

  it("non-owners do not match", () => {
    const card = createMockCard({ ownerId: "user-123" });
    const isOwner = card.ownerId === "other-user";
    expect(isOwner).toBe(false);
  });

  it("anonymous maps have no owner", () => {
    const card = createMockCard({ ownerId: null });
    const isOwner = Boolean(card.ownerId && card.ownerId === "user-123");
    expect(isOwner).toBe(false);
  });
});

describe("browse card preview payloads", () => {
  it("stores preview design json for canvas rendering", () => {
    const card = createMockCard({
      previewDesignJson: JSON.stringify({ version: PREVIEW_RENDERER_VERSION, zones: [], connections: [], mapWidth: 160, mapHeight: 160, templateName: "Test Template" })
    });
    expect(card.previewDesignJson).toContain('"version":1');
    expect(card.previewRendererVersion).toBe(PREVIEW_RENDERER_VERSION);
  });

  it("rejects missing stored preview payloads", () => {
    expect(() => browseRowToCard({
      id: "test-map-1",
      slug: "test-map",
      title: "Test Map",
      description: "A test map for units.",
      visibility: "public",
      status: "published",
      map_width: 160,
      map_height: 160,
      player_count: 2,
      zone_count: 5,
      connection_count: 4,
      win_condition: "win_condition_1",
      template_name: "Test Template",
      template_json: { name: "Test Template" },
      preview_design_json: null,
      preview_renderer_version: PREVIEW_RENDERER_VERSION,
      download_count: 10,
      rating_count: 2,
      rating_average: 4.5,
      created_at: "2026-05-17T00:00:00.000Z",
      updated_at: "2026-05-17T00:00:00.000Z",
      profiles: { display_name: "Tester" },
      map_tags: []
    })).toThrow("missing preview_design_json");
  });

  it("formats raw win condition codes for browse cards", () => {
    const card = browseRowToCard({
      id: "test-map-1",
      slug: "test-map",
      title: "Test Map",
      description: "A test map for units.",
      visibility: "public",
      status: "published",
      map_width: 160,
      map_height: 160,
      player_count: 2,
      zone_count: 5,
      connection_count: 4,
      win_condition: "win_condition_1",
      template_name: "Test Template",
      template_json: { name: "Test Template" },
      preview_design_json: { version: PREVIEW_RENDERER_VERSION, zones: [], connections: [], mapWidth: 160, mapHeight: 160, templateName: "Test Template" },
      preview_renderer_version: PREVIEW_RENDERER_VERSION,
      download_count: 10,
      rating_count: 2,
      rating_average: 4.5,
      created_at: "2026-05-17T00:00:00.000Z",
      updated_at: "2026-05-17T00:00:00.000Z",
      profiles: { display_name: "Tester" },
      map_tags: []
    });

    expect(card.winCondition).toBe("Classic");
  });

  it("rejects legacy stringified template_json rows when present", () => {
    expect(() => browseRowToCard({
      id: "test-map-1",
      slug: "test-map",
      title: "Test Map",
      description: "A test map for units.",
      visibility: "public",
      status: "published",
      map_width: 160,
      map_height: 160,
      player_count: 2,
      zone_count: 5,
      connection_count: 4,
      win_condition: "win_condition_1",
      template_name: "Test Template",
      template_json: JSON.stringify({ name: "Test Template" }),
      preview_design_json: { version: PREVIEW_RENDERER_VERSION, zones: [], connections: [], mapWidth: 160, mapHeight: 160, templateName: "Test Template" },
      preview_renderer_version: PREVIEW_RENDERER_VERSION,
      download_count: 10,
      rating_count: 2,
      rating_average: 4.5,
      created_at: "2026-05-17T00:00:00.000Z",
      updated_at: "2026-05-17T00:00:00.000Z",
      profiles: { display_name: "Tester" },
      map_tags: []
    })).toThrow("legacy stringified template_json");
  });

  it("rejects invalid scalar template_json rows when present", () => {
    expect(() => browseRowToCard({
      id: "test-map-1",
      slug: "test-map",
      title: "Test Map",
      description: "A test map for units.",
      visibility: "public",
      status: "published",
      map_width: 160,
      map_height: 160,
      player_count: 2,
      zone_count: 5,
      connection_count: 4,
      win_condition: "win_condition_1",
      template_name: "Test Template",
      template_json: true,
      preview_design_json: { version: PREVIEW_RENDERER_VERSION, zones: [], connections: [], mapWidth: 160, mapHeight: 160, templateName: "Test Template" },
      preview_renderer_version: PREVIEW_RENDERER_VERSION,
      download_count: 10,
      rating_count: 2,
      rating_average: 4.5,
      created_at: "2026-05-17T00:00:00.000Z",
      updated_at: "2026-05-17T00:00:00.000Z",
      profiles: { display_name: "Tester" },
      map_tags: []
    })).toThrow("invalid template_json");
  });
});
