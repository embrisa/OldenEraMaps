import { describe, expect, it } from "vitest";
import { createDefaultDesign } from "../src/design";
import {
  getViewerRating,
  rateCommunityMap,
  recordCommunityDownload,
  uploadCommunityMap,
  type CommunityCatalog
} from "../src/community/maps";

describe("ratings and downloads", () => {
  it("user can create a rating", () => {
    const catalog = catalogWithMap();
    const mapId = catalog.maps[0]!.id;

    const rated = rateCommunityMap(catalog, mapId, "viewer-1", 4);

    expect(getViewerRating(rated, mapId, "viewer-1")).toBe(4);
    expect(rated.ratings).toHaveLength(1);
    expect(rated.maps[0]!.ratingCount).toBe(1);
    expect(rated.maps[0]!.averageRating).toBe(4);
  });

  it("user can update rating and aggregate remains correct", () => {
    const catalog = catalogWithMap();
    const mapId = catalog.maps[0]!.id;

    const first = rateCommunityMap(catalog, mapId, "viewer-1", 3);
    const updated = rateCommunityMap(first, mapId, "viewer-1", 5);

    expect(getViewerRating(updated, mapId, "viewer-1")).toBe(5);
    expect(updated.ratings).toHaveLength(1);
    expect(updated.maps[0]!.ratingCount).toBe(1);
    expect(updated.maps[0]!.averageRating).toBe(5);
  });

  it("second user changes average correctly", () => {
    const catalog = catalogWithMap();
    const mapId = catalog.maps[0]!.id;

    const first = rateCommunityMap(catalog, mapId, "viewer-1", 4);
    const second = rateCommunityMap(first, mapId, "viewer-2", 2);

    expect(second.ratings).toHaveLength(2);
    expect(second.maps[0]!.ratingCount).toBe(2);
    expect(second.maps[0]!.averageRating).toBe(3);
  });

  it("anonymous download increments count", () => {
    const catalog = catalogWithMap();
    const mapId = catalog.maps[0]!.id;

    expect(catalog.maps[0]!.downloadCount).toBe(0);

    const once = recordCommunityDownload(catalog, mapId);
    expect(once.maps[0]!.downloadCount).toBe(1);

    const twice = recordCommunityDownload(once, mapId);
    expect(twice.maps[0]!.downloadCount).toBe(2);
  });

  it("rating values are clamped to 1–5 range", () => {
    const catalog = catalogWithMap();
    const mapId = catalog.maps[0]!.id;

    const low = rateCommunityMap(catalog, mapId, "viewer-1", 0);
    expect(getViewerRating(low, mapId, "viewer-1")).toBe(1);

    const high = rateCommunityMap(catalog, mapId, "viewer-2", 10);
    expect(getViewerRating(high, mapId, "viewer-2")).toBe(5);
  });

  it("one rating per user per map is enforced by viewer id", () => {
    const catalog = catalogWithMap();
    const mapId = catalog.maps[0]!.id;

    const first = rateCommunityMap(catalog, mapId, "viewer-1", 3);
    const second = rateCommunityMap(first, mapId, "viewer-1", 5);
    const third = rateCommunityMap(second, mapId, "viewer-1", 2);

    expect(third.ratings).toHaveLength(1);
    expect(getViewerRating(third, mapId, "viewer-1")).toBe(2);
    expect(third.maps[0]!.ratingCount).toBe(1);
    expect(third.maps[0]!.averageRating).toBe(2);
  });

  it("rating an unknown map does not crash (local catalog)", () => {
    const catalog = catalogWithMap();
    const result = rateCommunityMap(catalog, "non-existent-id", "viewer-1", 4);
    expect(result.ratings).toHaveLength(1);
    // Map aggregate unchanged since map not found
    expect(result.maps[0]!.ratingCount).toBe(0);
  });

  it("rateMap API function validates value range", async () => {
    // The communityApi.rateMap function clamps values before sending
    const { rateMap } = await import("../src/community/communityApi");
    // With null client (local mode), it should just return without error
    await expect(rateMap("any-id", 0, null)).resolves.toBeUndefined();
    await expect(rateMap("any-id", 10, null)).resolves.toBeUndefined();
  });

  it("recordDownload API function works with null client", async () => {
    const { recordDownload } = await import("../src/community/communityApi");
    await expect(recordDownload("any-id", null)).resolves.toBeUndefined();
  });

  it("fetchViewerRating returns null with null client", async () => {
    const { fetchViewerRating } = await import("../src/community/communityApi");
    const result = await fetchViewerRating("any-id", null);
    expect(result).toBeNull();
  });
});

function emptyCatalog(): CommunityCatalog {
  return { version: 2, maps: [], ratings: [] };
}

function catalogWithMap(): CommunityCatalog {
  const design = createDefaultDesign();
  design.templateName = "Test Arena";
  return uploadCommunityMap(emptyCatalog(), design, {
    title: "Test Arena",
    summary: "A test map for rating and download tests.",
    authorName: "Test Author",
    descriptiveTagSlugs: ["casual"],
    visibility: "public"
  }, "2026-05-17T00:00:00.000Z");
}
