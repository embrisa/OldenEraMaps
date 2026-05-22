import { afterEach, describe, expect, it, vi } from "vitest";
import { createDefaultDesign } from "../src/design";
import {
  buildCommunityTagFilterSections,
  filterCommunityMaps,
  loadCommunityCatalog,
  persistCommunityCatalog,
  getViewerRating,
  rateCommunityMap,
  summarizeCommunityCatalog,
  uploadCommunityMap,
  visibleCommunityMaps,
  type CommunityCatalog
} from "../src/community/maps";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("community catalog", () => {
  it("adds uploaded designs as public browseable maps", () => {
    const design = createDefaultDesign();
    design.templateName = "Ladder Forge";
    design.templateDescription = "Aggressive neutral pacing.";

    const catalog = uploadCommunityMap(emptyCatalog(), design, {
      title: "Ladder Forge",
      summary: "Aggressive neutral pacing.",
      authorName: "Anonymous Cartographer",
      descriptiveTagSlugs: ["competitive", "tempo"],
      visibility: "public"
    }, "2026-05-17T00:00:00.000Z");

    expect(visibleCommunityMaps(catalog)).toHaveLength(1);
    expect(catalog.maps[0]?.title).toBe("Ladder Forge");
    expect(catalog.maps[0]?.summary).toBe("Aggressive neutral pacing.");
    expect(catalog.maps[0]?.templateJson).toContain('"name": "Ladder Forge"');
    expect(catalog.maps[0]?.templateJson).toContain('"description": "Aggressive neutral pacing."');
    expect(catalog.maps[0]?.tags.map((tag) => tag.slug)).toContain("players:2");
    expect(catalog.maps[0]?.tags.map((tag) => tag.slug)).toContain("competitive");
  });

  it("stores one rating per viewer and recomputes aggregates", () => {
    const design = createDefaultDesign();
    const uploaded = uploadCommunityMap(emptyCatalog(), design, {
      title: "Arena Split",
      summary: "Four-lane skirmish.",
      authorName: "Anonymous Cartographer",
      descriptiveTagSlugs: ["casual"],
      visibility: "public"
    }, "2026-05-17T00:00:00.000Z");

    const mapId = uploaded.maps[0]!.id;
    const once = rateCommunityMap(uploaded, mapId, "viewer-1", 4, "2026-05-17T00:10:00.000Z");
    const updated = rateCommunityMap(once, mapId, "viewer-1", 5, "2026-05-17T00:20:00.000Z");

    expect(updated.ratings).toHaveLength(1);
    expect(getViewerRating(updated, mapId, "viewer-1")).toBe(5);
    expect(updated.maps[0]?.averageRating).toBe(5);
    expect(updated.maps[0]?.ratingCount).toBe(1);

    const stats = summarizeCommunityCatalog(updated);
    expect(stats.ratingCount).toBe(1);
    expect(stats.averageRating).toBe(5);
  });

  it("rejects unsafe local descriptions", () => {
    const design = createDefaultDesign();

    expect(() => uploadCommunityMap(emptyCatalog(), design, {
      title: "Arena Split",
      summary: "https://example.com",
      authorName: "Anonymous Cartographer",
      descriptiveTagSlugs: ["casual"],
      visibility: "public"
    }, "2026-05-17T00:00:00.000Z")).toThrow("Description cannot contain links or URLs.");
  });

  it("matches only maps containing every selected tag filter", () => {
    const duel = createDefaultDesign();
    duel.templateName = "Temple Ring";

    let threePlayer = createDefaultDesign();
    threePlayer.templateName = "Council Paths";
    threePlayer = {
      ...threePlayer,
      playerCount: 3,
      zones: [
        ...threePlayer.zones,
        {
          ...threePlayer.zones[0]!,
          id: "zone-4",
          name: "Spawn-4",
          player: 3,
          position: { x: 0.5, y: 0.15 }
        }
      ],
      connections: [
        ...threePlayer.connections,
        {
          id: "conn-3-4",
          name: "Path-3-4",
          from: "zone-3",
          to: "zone-4",
          type: "Direct",
          guardStrength: 28000,
          road: true
        }
      ]
    };

    const catalog = uploadCommunityMap(uploadCommunityMap(emptyCatalog(), duel, {
      title: "Temple Ring",
      summary: "Fast classic match.",
      authorName: "Anonymous Cartographer",
      descriptiveTagSlugs: ["competitive"],
      visibility: "public"
    }, "2026-05-17T00:00:00.000Z"), threePlayer, {
      title: "Council Paths",
      summary: "Three-player macro map.",
      authorName: "Anonymous Cartographer",
      descriptiveTagSlugs: ["macro"],
      visibility: "public"
    }, "2026-05-17T01:00:00.000Z");

    const filtered = filterCommunityMaps(catalog.maps, {
      selectedTagSlugs: ["players:2", "competitive"]
    });

    expect(filtered.map((map) => map.title)).toEqual(["Temple Ring"]);
    expect(buildCommunityTagFilterSections(catalog.maps).some((section) => section.kind === "factual")).toBe(true);
  });

  it("matches maps by combined tag and numeric range filters", () => {
    const duel = createDefaultDesign();
    duel.templateName = "Temple Ring";
    duel.mapWidth = 160;
    duel.mapHeight = 160;

    const wide = createDefaultDesign();
    wide.templateName = "Wide Council";
    wide.mapWidth = 216;
    wide.mapHeight = 160;

    const catalog = uploadCommunityMap(uploadCommunityMap(emptyCatalog(), duel, {
      title: "Temple Ring",
      summary: "Fast classic match.",
      authorName: "Anonymous Cartographer",
      descriptiveTagSlugs: ["competitive"],
      visibility: "public"
    }, "2026-05-17T00:00:00.000Z"), wide, {
      title: "Wide Council",
      summary: "Wide macro map.",
      authorName: "Anonymous Cartographer",
      descriptiveTagSlugs: ["macro", "wide"],
      visibility: "public"
    }, "2026-05-17T01:00:00.000Z");

    const filtered = filterCommunityMaps(catalog.maps, {
      selectedTagSlugs: ["macro"],
      rangeFilters: {
        mapWidth: { min: 200, max: 240 },
        players: { min: 2, max: 2 },
        zones: { min: 3 }
      }
    });

    expect(filtered.map((map) => map.title)).toEqual(["Wide Council"]);
  });

  it("does not expose seeded demo maps in production", () => {
    vi.stubEnv("PROD", true);
    const storage = new MemoryStorage();

    const seeded = loadCommunityCatalog(storage);
    expect(summarizeCommunityCatalog(seeded)).toEqual({
      mapCount: 0,
      ratingCount: 0,
      averageRating: 0
    });

    vi.stubEnv("PROD", false);
    persistCommunityCatalog(loadCommunityCatalog(new MemoryStorage()), storage);
    vi.stubEnv("PROD", true);

    const migrated = loadCommunityCatalog(storage);
    expect(migrated.maps.map((map) => map.id)).not.toContain("seed-map-1");
    expect(summarizeCommunityCatalog(migrated)).toEqual({
      mapCount: 0,
      ratingCount: 0,
      averageRating: 0
    });
  });
});

function emptyCatalog(): CommunityCatalog {
  return {
    version: 2,
    maps: [],
    ratings: []
  };
}

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}
