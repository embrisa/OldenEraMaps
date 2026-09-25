// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Supabase is "configured" unless a test flips this; there is never a real client (no network).
const supabaseState = vi.hoisted(() => ({ configured: true }));

vi.mock("../src/community/supabaseClient", () => ({
  get isSupabaseConfigured() {
    return supabaseState.configured;
  },
  supabase: null,
  requireSupabaseClient: (client: unknown) => {
    if (!client) throw new Error("Supabase is not configured.");
    return client;
  }
}));

vi.mock("../src/community/communityApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/community/communityApi")>();
  return {
    ...actual,
    listMaps: vi.fn(),
    getMap: vi.fn(),
    rateMap: vi.fn(),
    fetchBrowseStats: vi.fn(),
    fetchMapRatingStats: vi.fn(),
    fetchViewerRating: vi.fn(),
    fetchViewerRatings: vi.fn(),
    updateMapListing: vi.fn(),
    deleteMapListing: vi.fn(),
    listMyMaps: vi.fn()
  };
});

vi.mock("../src/community/uploadApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/community/uploadApi")>();
  return { ...actual, uploadCommunityMapToServer: vi.fn() };
});

import * as communityApi from "../src/community/communityApi";
import type { BrowseMapCard, BrowseResult, ManagedMapCard } from "../src/community/communityApi";
import { communityAuthReducer, initialCommunityAuthState, type CommunityAuthState } from "../src/community/auth";
import { summarizeCommunityMaps, uploadCommunityMap, type CommunityCatalog } from "../src/community/maps";
import { PREVIEW_RENDERER_VERSION, buildPreviewDesign } from "../src/community/previewDesign";
import { DESCRIPTIVE_TAG_SELECTION_LIMIT, getAllowedDescriptiveTags } from "../src/community/tags";
import * as uploadApi from "../src/community/uploadApi";
import { EditAuthorNameDialog } from "../src/components/community/EditAuthorNameDialog";
import { MyMapsPage } from "../src/components/community/MyMapsPage";
import { UploadMapDialog } from "../src/components/community/UploadMapDialog";
import { createDefaultDesign } from "../src/design";
import { SHARE_BLOCKED_BY_TEMPLATE_ERRORS_MESSAGE, useCommunityBrowse } from "../src/hooks/useCommunityBrowse";
import { useMyMaps } from "../src/hooks/useMyMaps";

const api = vi.mocked(communityApi);
const actualApi = await vi.importActual<typeof import("../src/community/communityApi")>("../src/community/communityApi");

// jsdom has no canvas; map previews skip drawing when there is no 2D context.
HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as never;

beforeEach(() => {
  supabaseState.configured = true;
  api.listMaps.mockReset().mockResolvedValue(browseResult([]));
  api.getMap.mockReset().mockResolvedValue(null);
  api.rateMap.mockReset().mockResolvedValue(undefined);
  api.fetchBrowseStats.mockReset().mockResolvedValue(null);
  api.fetchMapRatingStats.mockReset().mockResolvedValue(null);
  api.fetchViewerRating.mockReset().mockResolvedValue(null);
  api.fetchViewerRatings.mockReset().mockResolvedValue({});
  api.updateMapListing.mockReset().mockResolvedValue(undefined);
  api.deleteMapListing.mockReset().mockResolvedValue(undefined);
  api.listMyMaps.mockReset().mockResolvedValue({ maps: [] });
  vi.mocked(uploadApi.uploadCommunityMapToServer).mockReset();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

// ---------------------------------------------------------------------------
// API layer
// ---------------------------------------------------------------------------

describe("browse search filter", () => {
  it("quotes and escapes search terms so commas and parentheses stay part of the value", () => {
    expect(actualApi.buildBrowseSearchFilter("  Temple, 1v1 (50%_off) \"x\"\\ *  ")).toBe(
      ["title", "description", "template_name", "author_name"]
        .map((column) => `${column}.ilike."%Temple, 1v1 (50\\\\%\\\\_off) \\"x\\"\\\\\\\\ _%"`)
        .join(",")
    );
    expect(actualApi.buildBrowseSearchFilter("   ")).toBeNull();
  });

  it("sends the sanitized filter (including author names) through a single or() predicate", async () => {
    const orCalls: string[] = [];
    const query = createQueryMock({ data: [], count: 0 }, { or: (filter: string) => orCalls.push(filter) });
    const client = { rpc: vi.fn(() => query) };

    await actualApi.listMaps({ query: "Temple, 1v1" }, client as never);

    expect(orCalls).toEqual([actualApi.buildBrowseSearchFilter("Temple, 1v1")]);
    expect(orCalls[0]).toContain('author_name.ilike."%Temple, 1v1%"');
  });

  it("skips the search predicate for blank queries", async () => {
    const orCalls: string[] = [];
    const query = createQueryMock({ data: [], count: 0 }, { or: (filter: string) => orCalls.push(filter) });

    await actualApi.listMaps({ query: "   " }, { rpc: vi.fn(() => query) } as never);

    expect(orCalls).toEqual([]);
  });
});

describe("listing edits", () => {
  const current = { title: "Iron Pass", authorName: "Map Maker", summary: "Two lanes.", visibility: "public" as const };

  it("only includes the fields that changed", () => {
    expect(actualApi.buildMapListingPatch(current, {
      title: " Iron  Pass ",
      authorName: "Map Maker",
      description: "Two lanes.\n",
      visibility: "public"
    })).toEqual({});

    expect(actualApi.buildMapListingPatch(current, {
      title: "Iron Pass Remastered",
      authorName: "Map Maker",
      description: "Three lanes.",
      visibility: "unlisted"
    })).toEqual({ title: "Iron Pass Remastered", description: "Three lanes.", visibility: "unlisted" });
  });

  it("keeps the current title when the field is cleared and treats a blank author as anonymous", () => {
    expect(actualApi.buildMapListingPatch(current, { ...draftOf(current), title: "  " })).toEqual({});
    expect(actualApi.buildMapListingPatch(
      { ...current, authorName: "Anonymous Cartographer" },
      { ...draftOf(current), authorName: "" }
    )).toEqual({});
    expect(actualApi.buildMapListingPatch(current, { ...draftOf(current), authorName: "  " })).toEqual({ authorName: "" });
  });

  it("shows the owner-edited listing description instead of the uploaded template description", () => {
    const row = browseRow({ description: "Edited listing text.", template_json: { name: "T", description: "Uploaded text." } });
    expect(actualApi.browseRowToCard(row).summary).toBe("Edited listing text.");
    expect(actualApi.browseRowToCard({ ...row, description: "" }).summary).toBe("Uploaded text.");
  });
});

describe("rating and stats API", () => {
  it("loads the viewer's own ratings for a page in one query", async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    const builder = {
      select: vi.fn((columns: string) => { calls.push(["select", columns]); return builder; }),
      eq: vi.fn((column: string, value: unknown) => { calls.push(["eq", column, value]); return builder; }),
      in: vi.fn(async (column: string, values: unknown) => {
        calls.push(["in", column, values]);
        return { data: [{ map_id: "map-1", value: 4 }], error: null };
      })
    };
    const client = { from: vi.fn(() => builder) };

    const ratings = await actualApi.fetchViewerRatings(["map-1", "map-2", "map-1"], "viewer-1", client as never);

    expect(client.from).toHaveBeenCalledWith("ratings");
    expect(calls).toEqual([
      ["select", "map_id, value"],
      ["eq", "user_id", "viewer-1"],
      ["in", "map_id", ["map-1", "map-2"]]
    ]);
    expect(ratings).toEqual({ "map-1": 4 });
    await expect(actualApi.fetchViewerRatings([], "viewer-1", client as never)).resolves.toEqual({});
    expect(client.from).toHaveBeenCalledTimes(1);
  });

  it("refreshes one map's rating aggregates from the public browse RPC", async () => {
    const eqCalls: Array<[string, unknown]> = [];
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn((column: string, value: unknown) => { eqCalls.push([column, value]); return builder; }),
      maybeSingle: vi.fn(async () => ({ data: { id: "map-1", rating_count: 3, rating_average: "4.33" }, error: null }))
    };
    const client = { rpc: vi.fn(() => builder) };

    await expect(actualApi.fetchMapRatingStats("map-1", client as never)).resolves.toEqual({ averageRating: 4.33, ratingCount: 3 });
    expect(client.rpc).toHaveBeenCalledWith("public_browse_maps", {});
    expect(eqCalls).toEqual([["id", "map-1"]]);
  });

  it("summarizes the whole filtered result set without paginating", async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    const query = createQueryMock(
      { data: [{ rating_count: 2, rating_average: 4.5 }, { rating_count: 1, rating_average: 3 }, { rating_count: 0, rating_average: 0 }], count: 3 },
      {
        select: (columns: string) => calls.push(["select", columns]),
        or: (filter: string) => calls.push(["or", filter]),
        gte: (column: string, value: unknown) => calls.push(["gte", column, value]),
        contains: (column: string, value: unknown) => calls.push(["contains", column, value]),
        range: () => calls.push(["range"])
      }
    );
    const client = { rpc: vi.fn(() => query) };

    const stats = await actualApi.fetchBrowseStats({
      query: "ring",
      selectedTagSlugs: ["competitive"],
      rangeFilters: { players: { min: 2 } }
    }, client as never);

    expect(client.rpc).toHaveBeenCalledWith("public_browse_maps", {}, { count: "exact" });
    expect(calls).toContainEqual(["select", "rating_count, rating_average"]);
    expect(calls).toContainEqual(["or", actualApi.buildBrowseSearchFilter("ring")]);
    expect(calls).toContainEqual(["gte", "player_count", 2]);
    expect(calls).toContainEqual(["contains", "tags", [{ slug: "competitive" }]]);
    expect(calls).not.toContainEqual(["range"]);
    expect(stats).toEqual({ mapCount: 3, ratingCount: 3, averageRating: 4 });
  });

  it("estimates optimistic aggregates for new and replaced votes", () => {
    expect(actualApi.estimateRatingStatsAfterVote({ averageRating: 4, ratingCount: 2 }, undefined, 5)).toEqual({ averageRating: 4.33, ratingCount: 3 });
    expect(actualApi.estimateRatingStatsAfterVote({ averageRating: 4, ratingCount: 2 }, 3, 5)).toEqual({ averageRating: 5, ratingCount: 2 });
    expect(actualApi.estimateRatingStatsAfterVote({ averageRating: 0, ratingCount: 0 }, 2, 4)).toEqual({ averageRating: 4, ratingCount: 1 });
  });

  it("summarizes local catalog stats over the same subset of maps", () => {
    const catalog = localCatalogWithRatings();
    const first = catalog.maps.find((map) => map.title === "First")!;
    expect(summarizeCommunityMaps(catalog, [first])).toEqual({ mapCount: 1, ratingCount: 2, averageRating: 3.5 });
    expect(summarizeCommunityMaps(catalog, catalog.maps)).toEqual({ mapCount: 2, ratingCount: 3, averageRating: 4 });
  });
});

// ---------------------------------------------------------------------------
// Browse hook
// ---------------------------------------------------------------------------

describe("useCommunityBrowse loading", () => {
  it("ignores an older response that resolves after a newer one", async () => {
    const older = deferred<BrowseResult>();
    const newer = deferred<BrowseResult>();
    api.listMaps.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
    const { result } = renderHook(() => useCommunityBrowse(hookProps));

    await waitFor(() => expect(api.listMaps).toHaveBeenCalledTimes(1));
    act(() => result.current.setBrowseSort("top-rated"));
    await waitFor(() => expect(api.listMaps).toHaveBeenCalledTimes(2));

    await act(async () => newer.resolve(browseResult([card({ id: "newer" })])));
    await act(async () => older.resolve(browseResult([card({ id: "older" })])));

    expect(result.current.browseResult?.maps.map((map) => map.id)).toEqual(["newer"]);
    expect(result.current.browseStatus).toBe("loaded");
  });

  it("debounces typing into one search request", async () => {
    const { result } = renderHook(() => useCommunityBrowse(hookProps));
    await waitFor(() => expect(api.listMaps).toHaveBeenCalledTimes(1));

    act(() => result.current.setBrowseQuery("T"));
    act(() => result.current.setBrowseQuery("Temple,"));
    act(() => result.current.setBrowseQuery("Temple, 1v1"));

    await waitFor(() => expect(api.listMaps).toHaveBeenCalledTimes(2));
    expect(api.listMaps.mock.calls.map(([filters]) => filters?.query)).toEqual(["", "Temple, 1v1"]);
  });

  it("moves back to the last page when the current page no longer exists", async () => {
    api.listMaps.mockImplementation(async (filters) => {
      if (filters?.page === 3) return browseResult([], { total: 3, page: 3, pageSize: 2, pageCount: 2 });
      return browseResult([card({ id: `page-${filters?.page}` })], { total: 3, page: filters?.page ?? 1, pageSize: 2, pageCount: 2 });
    });
    const { result } = renderHook(() => useCommunityBrowse(hookProps));
    await waitFor(() => expect(result.current.browseStatus).toBe("loaded"));

    act(() => result.current.setBrowsePage(3));

    await waitFor(() => expect(result.current.browseResult?.page).toBe(2));
    expect(result.current.browsePage).toBe(2);
    expect(result.current.browseResult?.maps.map((map) => map.id)).toEqual(["page-2"]);
    expect(result.current.browseStatus).toBe("loaded");
  });

  it("returns to page 1 when a later page comes back empty with no matches at all", async () => {
    api.listMaps.mockImplementation(async (filters) => browseResult([], { total: 0, page: filters?.page ?? 1, pageCount: 1 }));
    const { result } = renderHook(() => useCommunityBrowse(hookProps));
    await waitFor(() => expect(result.current.browseStatus).toBe("loaded"));

    act(() => result.current.setBrowsePage(4));

    await waitFor(() => expect(result.current.browsePage).toBe(1));
    await waitFor(() => expect(result.current.browseStatus).toBe("loaded"));
    expect(result.current.browseResult?.page).toBe(1);
  });

  it("reports stats for the whole filtered set and reuses them while paging", async () => {
    api.listMaps.mockImplementation(async (filters) => browseResult(
      [card({ id: `page-${filters?.page}`, averageRating: 5, ratingCount: 1 })],
      { total: 30, page: filters?.page ?? 1, pageCount: 2 }
    ));
    api.fetchBrowseStats.mockResolvedValue({ mapCount: 30, ratingCount: 41, averageRating: 3.9 });
    const { result } = renderHook(() => useCommunityBrowse(hookProps));

    await waitFor(() => expect(result.current.communityStats).toEqual({ mapCount: 30, ratingCount: 41, averageRating: 3.9 }));
    act(() => result.current.setBrowsePage(2));
    await waitFor(() => expect(result.current.browseResult?.page).toBe(2));

    expect(result.current.communityStats).toEqual({ mapCount: 30, ratingCount: 41, averageRating: 3.9 });
    expect(api.fetchBrowseStats).toHaveBeenCalledTimes(1);
  });

  it("computes offline stats over the maps matching the filters", async () => {
    supabaseState.configured = false;
    const { result } = renderHook(() => useCommunityBrowse(hookProps));
    await waitFor(() => expect(result.current.browseStatus).toBe("loaded"));

    act(() => result.current.setBrowseQuery("Merchant"));

    // Seed catalog: only "Merchant Ring" matches, with a single 3-star rating.
    await waitFor(() => expect(result.current.communityStats).toEqual({ mapCount: 1, ratingCount: 1, averageRating: 3 }));
  });

  it("derives filter chips and range bounds from server results and keeps them while filtering", async () => {
    const competitive = { slug: "competitive", label: "Competitive", kind: "descriptive" as const, category: "audience" as const };
    const tempo = { slug: "tempo", label: "Tempo", kind: "descriptive" as const, category: "pacing" as const };
    api.listMaps
      .mockResolvedValueOnce(browseResult([card({ id: "wide", mapWidth: 256, tags: [competitive] })]))
      .mockResolvedValueOnce(browseResult([card({ id: "small", mapWidth: 128, tags: [tempo] })]));
    const { result } = renderHook(() => useCommunityBrowse(hookProps));
    await waitFor(() => expect(result.current.browseMaps).toHaveLength(1));

    act(() => result.current.setBrowseSelectedTags(["tempo"]));

    await waitFor(() => expect(result.current.browseMaps).toHaveLength(2));
    expect(result.current.browseMaps.flatMap((map) => map.tags.map((tag) => tag.slug)).sort()).toEqual(["competitive", "tempo"]);
    expect(result.current.browseMaps.map((map) => map.mapWidth).sort()).toEqual([128, 256]);
  });
});

describe("useCommunityBrowse ratings", () => {
  it("shows the server rating and rolls an optimistic rating back when saving fails", async () => {
    api.listMaps.mockResolvedValue(browseResult([card({ id: "map-1", averageRating: 4, ratingCount: 2 })]));
    api.fetchViewerRatings.mockResolvedValue({ "map-1": 3 });
    const rating = deferred<void>();
    api.rateMap.mockReturnValue(rating.promise);
    const { result } = renderHook(() => useCommunityBrowse(hookProps));
    await waitFor(() => expect(result.current.getViewerRating("map-1")).toBe(3));
    expect(api.fetchViewerRatings).toHaveBeenCalledWith(["map-1"], "viewer-1");

    act(() => result.current.handleRateMap("map-1", 5));

    expect(result.current.getViewerRating("map-1")).toBe(5);
    expect(result.current.browseResult?.maps[0]).toMatchObject({ averageRating: 5, ratingCount: 2 });

    await act(async () => rating.reject(new Error("Rating service unavailable.")));

    expect(result.current.getViewerRating("map-1")).toBe(3);
    expect(result.current.browseResult?.maps[0]).toMatchObject({ averageRating: 4, ratingCount: 2 });
    expect(result.current.communityError).toBe("Rating service unavailable.");
  });

  it("refreshes the card and stats from the server after a rating is saved", async () => {
    api.listMaps.mockResolvedValue(browseResult([card({ id: "map-1", averageRating: 4, ratingCount: 2 })]));
    api.fetchBrowseStats.mockResolvedValueOnce({ mapCount: 1, ratingCount: 2, averageRating: 4 })
      .mockResolvedValueOnce({ mapCount: 1, ratingCount: 3, averageRating: 4.3 });
    // Someone else rated meanwhile, so the server's numbers differ from the optimistic estimate (4.33 / 3).
    api.fetchMapRatingStats.mockResolvedValue({ averageRating: 4.5, ratingCount: 4 });
    const { result } = renderHook(() => useCommunityBrowse(hookProps));
    await waitFor(() => expect(result.current.browseStatus).toBe("loaded"));

    act(() => result.current.handleRateMap("map-1", 5));
    expect(result.current.browseResult?.maps[0]).toMatchObject({ averageRating: 4.33, ratingCount: 3 });

    await waitFor(() => expect(result.current.browseResult?.maps[0]).toMatchObject({ averageRating: 4.5, ratingCount: 4 }));
    await waitFor(() => expect(result.current.communityStats).toEqual({ mapCount: 1, ratingCount: 3, averageRating: 4.3 }));
    expect(api.rateMap).toHaveBeenCalledWith("map-1", 5);
    expect(result.current.getViewerRating("map-1")).toBe(5);
    expect(result.current.communityError).toBeUndefined();
  });

  it("does not show a per-browser rating to a signed-out viewer when Supabase is configured", async () => {
    const { result, rerender } = renderHook((props: typeof hookProps) => useCommunityBrowse(props), { initialProps: hookProps });
    await waitFor(() => expect(result.current.browseStatus).toBe("loaded"));
    act(() => result.current.handleRateMap("map-1", 4));
    expect(result.current.getViewerRating("map-1")).toBe(4);

    rerender({ ...hookProps, authState: { status: "signed-out", session: null, profile: null, error: null } });

    expect(result.current.getViewerRating("map-1")).toBeUndefined();
  });
});

describe("useCommunityBrowse sharing", () => {
  const draft = {
    title: "Shared Pass",
    summary: "",
    authorName: "Viewer",
    descriptiveTagSlugs: [],
    visibility: "public" as const
  };

  it("explains why sharing is blocked instead of silently doing nothing", async () => {
    const { result } = renderHook(() => useCommunityBrowse({ ...hookProps, exportHasBlockingIssues: true }));

    await act(async () => result.current.handleShareMap(draft));

    expect(result.current.uploadError).toMatch(/Fix the template errors listed under Validation & JSON before sharing/);
    expect(result.current.uploadError).toBe(SHARE_BLOCKED_BY_TEMPLATE_ERRORS_MESSAGE);
    expect(uploadApi.uploadCommunityMapToServer).not.toHaveBeenCalled();
  });

  it("surfaces server upload warnings with the success notice", async () => {
    const uploaded = uploadCommunityMap({ version: 2, maps: [], ratings: [] }, hookProps.design, draft).maps[0]!;
    vi.mocked(uploadApi.uploadCommunityMapToServer).mockResolvedValue({
      map: uploaded,
      warnings: ["Estimated area per zone is very small and may increase in-game generation risk."]
    });
    const { result } = renderHook(() => useCommunityBrowse(hookProps));

    await act(async () => result.current.handleShareMap(draft));

    expect(result.current.communityNotice).toBe(
      'Shared "Shared Pass" to the browse catalog. Upload warnings: Estimated area per zone is very small and may increase in-game generation risk.'
    );
    expect(result.current.uploadError).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// My maps
// ---------------------------------------------------------------------------

describe("My maps errors", () => {
  it("shows action errors above a loaded list and lets the user dismiss them", async () => {
    const onDismissError = vi.fn();
    const user = userEvent.setup();
    render(<MyMapsPage {...myMapsPageProps} status="loaded" maps={[managedMap()]} errorMessage="Delete failed." onDismissError={onDismissError} />);

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Delete failed.");
    expect(screen.getByRole("heading", { name: "Owned Pass" })).toBeTruthy();

    await user.click(within(alert).getByRole("button", { name: "Dismiss error" }));
    expect(onDismissError).toHaveBeenCalledTimes(1);
  });

  it("keeps load failures in the error card without a duplicate banner", () => {
    render(<MyMapsPage {...myMapsPageProps} status="error" maps={[]} errorMessage="Could not load." />);

    expect(screen.getAllByText("Could not load.")).toHaveLength(1);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("reports download and update failures from the hook", async () => {
    api.getMap.mockRejectedValueOnce(new Error("Network down")).mockResolvedValueOnce(null);
    api.updateMapListing.mockRejectedValueOnce(new Error("Update rejected"));
    const { result } = renderHook(() => useMyMaps({
      page: "my-maps",
      authState: signedInState(),
      requestConfirmation: vi.fn(),
      openMapInBuilder: vi.fn()
    }));
    await waitFor(() => expect(result.current.myMapsStatus).toBe("loaded"));

    act(() => result.current.handleDownloadOwnedMap(managedMap()));
    await waitFor(() => expect(result.current.myMapsError).toBe("Network down"));

    act(() => result.current.handleDownloadOwnedMap(managedMap()));
    await waitFor(() => expect(result.current.myMapsError).toBe('Failed to find "Owned Pass".'));

    act(() => result.current.handleUpdateOwnedMapListing("owned-1", { title: "New" }));
    await waitFor(() => expect(result.current.myMapsError).toBe("Update rejected"));
    expect(result.current.myMapsStatus).toBe("loaded");

    act(() => result.current.dismissMyMapsError());
    expect(result.current.myMapsError).toBeUndefined();
  });

  it("saves only the listing fields the owner changed", async () => {
    const onUpdateListing = vi.fn();
    const user = userEvent.setup();
    render(<MyMapsPage {...myMapsPageProps} status="loaded" maps={[managedMap()]} onUpdateListing={onUpdateListing} />);

    await user.click(screen.getByRole("button", { name: "Edit listing" }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(onUpdateListing).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Edit listing" }));
    const title = screen.getByLabelText("Title");
    await user.clear(title);
    await user.type(title, "Owned Pass II");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(onUpdateListing).toHaveBeenCalledWith("owned-1", { title: "Owned Pass II" });
  });
});

// ---------------------------------------------------------------------------
// Auth-driven dialogs
// ---------------------------------------------------------------------------

describe("auth events and dialog drafts", () => {
  it("keeps the loaded profile object when Supabase re-emits a session for the same user", () => {
    const session = { user: { id: "user-1" } } as never;
    const signedIn = communityAuthReducer(initialCommunityAuthState(), { type: "session", session });
    const withProfile = communityAuthReducer(signedIn, {
      type: "profile",
      profile: { userId: "user-1", displayName: "Map Handle", avatarUrl: null }
    });

    const refocused = communityAuthReducer(withProfile, { type: "session", session: { user: { id: "user-1" } } as never });
    expect(refocused.profile).toBe(withProfile.profile);

    const resynced = communityAuthReducer(refocused, {
      type: "profile",
      profile: { userId: "user-1", displayName: "Map Handle", avatarUrl: null }
    });
    expect(resynced).toBe(refocused);

    const otherUser = communityAuthReducer(refocused, { type: "session", session: { user: { id: "user-2" } } as never });
    expect(otherUser.profile).toEqual({ userId: "user-2", displayName: "Anonymous Cartographer", avatarUrl: null });
  });

  it("keeps what the user typed in the share dialog when auth props change while it is open", async () => {
    const user = userEvent.setup();
    const props = uploadDialogProps();
    const { rerender } = render(<UploadMapDialog {...props} defaultAuthorName="Anonymous Cartographer" />);

    const title = screen.getByLabelText("Listing title");
    await user.clear(title);
    await user.type(title, "My Custom Title");
    await user.click(screen.getByRole("checkbox", { name: "Tempo" }));

    // The profile finishes loading (or is rebuilt by an auth event) and the description gets committed.
    rerender(<UploadMapDialog {...props} templateDescription="Committed description." defaultAuthorName="Map Handle" />);

    expect((screen.getByLabelText("Listing title") as HTMLInputElement).value).toBe("My Custom Title");
    expect(screen.getByRole("checkbox", { name: "Tempo" }).getAttribute("aria-checked")).toBe("true");
    // The untouched author field adopts the loaded name.
    expect((screen.getByLabelText("Author") as HTMLInputElement).value).toBe("Map Handle");

    rerender(<UploadMapDialog {...props} open={false} templateDescription="Committed description." defaultAuthorName="Map Handle" />);
    rerender(<UploadMapDialog {...props} templateDescription="Committed description." defaultAuthorName="Map Handle" />);

    expect((screen.getByLabelText("Listing title") as HTMLInputElement).value).toBe("Iron Pass");
    expect((screen.getByLabelText("Template Description") as HTMLTextAreaElement).value).toBe("Committed description.");
  });

  it("does not replace an author name the user already edited", async () => {
    const user = userEvent.setup();
    const props = uploadDialogProps();
    const { rerender } = render(<UploadMapDialog {...props} defaultAuthorName="Anonymous Cartographer" />);

    const author = screen.getByLabelText("Author");
    await user.clear(author);
    await user.type(author, "Typed Name");
    rerender(<UploadMapDialog {...props} defaultAuthorName="Map Handle" />);

    expect((screen.getByLabelText("Author") as HTMLInputElement).value).toBe("Typed Name");
  });

  it("keeps a typed author name when the profile is rebuilt while the dialog is open", async () => {
    const user = userEvent.setup();
    const props = { onOpenChange: vi.fn(), onSubmit: vi.fn() };
    const { rerender } = render(<EditAuthorNameDialog {...props} open currentName="Map Handle" />);

    const input = screen.getByLabelText("Public author name");
    expect((input as HTMLInputElement).value).toBe("Map Handle");
    await user.clear(input);
    await user.type(input, "New Handle");

    rerender(<EditAuthorNameDialog {...props} open currentName="Anonymous Cartographer" />);
    rerender(<EditAuthorNameDialog {...props} open currentName="Map Handle" />);

    expect((screen.getByLabelText("Public author name") as HTMLInputElement).value).toBe("New Handle");
  });

  it(`caps descriptive tags at ${DESCRIPTIVE_TAG_SELECTION_LIMIT} and shows the count`, async () => {
    const user = userEvent.setup();
    render(<UploadMapDialog {...uploadDialogProps()} />);
    const tags = getAllowedDescriptiveTags().filter((tag) => !["casual", "low-resource"].includes(tag.slug));
    expect(tags.length).toBeGreaterThan(DESCRIPTIVE_TAG_SELECTION_LIMIT);

    for (const tag of tags.slice(0, DESCRIPTIVE_TAG_SELECTION_LIMIT)) {
      await user.click(screen.getByRole("checkbox", { name: tag.label }));
    }

    expect(screen.getByText(`${DESCRIPTIVE_TAG_SELECTION_LIMIT} / ${DESCRIPTIVE_TAG_SELECTION_LIMIT} tags`)).toBeTruthy();
    const extra = screen.getByRole("checkbox", { name: tags[DESCRIPTIVE_TAG_SELECTION_LIMIT]!.label }) as HTMLButtonElement;
    expect(extra.disabled).toBe(true);
    fireEvent.click(extra);
    expect(extra.getAttribute("aria-checked")).toBe("false");

    await user.click(screen.getByRole("checkbox", { name: tags[0]!.label }));
    expect(extra.disabled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function signedInState(userId = "viewer-1"): CommunityAuthState {
  return {
    status: "signed-in",
    session: null,
    profile: { userId, displayName: "Viewer", avatarUrl: null },
    error: null
  };
}

const hookDesign = createDefaultDesign();
const hookProps: Parameters<typeof useCommunityBrowse>[0] = {
  page: "browse",
  authState: signedInState(),
  design: hookDesign,
  exportJson: "{}",
  exportHasBlockingIssues: false,
  selectedZoneId: hookDesign.zones[0]?.id ?? "",
  designBoardCanvas: null,
  commit: () => true,
  requestSignIn: () => {},
  requestSignInForUpload: () => {},
  requestConfirmation: () => {},
  navigate: () => {},
  runAfterDiscardingUnsavedChanges: (action) => action()
};

const myMapsPageProps = {
  onRefresh: () => {},
  onUpdateListing: () => {},
  onHide: () => {},
  onRestore: () => {},
  onDelete: () => {},
  onDownload: () => {},
  onDownloadImage: () => {},
  onOpenInBuilder: () => {}
};

function uploadDialogProps() {
  return {
    open: true,
    onOpenChange: vi.fn(),
    templateName: "Iron Pass",
    templateDescription: "",
    zoneCount: 5,
    connectionCount: 4,
    canShare: true,
    signedIn: true,
    defaultAuthorName: "Map Handle",
    onSubmit: vi.fn()
  };
}

function card(overrides: Partial<BrowseMapCard> = {}): BrowseMapCard {
  return {
    id: "map-1",
    ownerId: null,
    slug: "map-one",
    title: "Map One",
    summary: "A map.",
    authorName: "Author",
    tags: [],
    visibility: "public",
    mapWidth: 160,
    mapHeight: 160,
    playerCount: 2,
    zoneCount: 5,
    connectionCount: 4,
    winCondition: "Classic",
    templateName: "Map One",
    previewDesignJson: JSON.stringify(buildPreviewDesign(createDefaultDesign())),
    previewRendererVersion: PREVIEW_RENDERER_VERSION,
    uploadedAt: "2026-05-17T00:00:00.000Z",
    updatedAt: "2026-05-17T00:00:00.000Z",
    downloadCount: 0,
    averageRating: 0,
    ratingCount: 0,
    ...overrides
  };
}

function managedMap(overrides: Partial<ManagedMapCard> = {}): ManagedMapCard {
  return { ...card({ id: "owned-1", title: "Owned Pass", templateName: "Owned Pass", summary: "Owned." }), status: "published", ...overrides };
}

function browseResult(maps: BrowseMapCard[], overrides: Partial<BrowseResult> = {}): BrowseResult {
  return { maps, total: maps.length, page: 1, pageSize: 24, pageCount: 1, ...overrides };
}

function draftOf(current: { title: string; authorName: string; summary: string; visibility: "public" }) {
  return { title: current.title, authorName: current.authorName, description: current.summary, visibility: current.visibility };
}

function browseRow(overrides: Record<string, unknown>) {
  return {
    id: "map-1",
    slug: "map-one",
    title: "Map One",
    description: "Listing text.",
    visibility: "public" as const,
    map_width: 160,
    map_height: 160,
    player_count: 2,
    zone_count: 5,
    connection_count: 4,
    win_condition: "win_condition_1",
    template_name: "Map One",
    preview_design_json: buildPreviewDesign(createDefaultDesign()),
    preview_renderer_version: PREVIEW_RENDERER_VERSION,
    download_count: 0,
    rating_count: 0,
    rating_average: 0,
    created_at: "2026-05-17T00:00:00.000Z",
    updated_at: "2026-05-17T00:00:00.000Z",
    author_name: "Author",
    tags: [],
    ...overrides
  } as Parameters<typeof actualApi.browseRowToCard>[0];
}

function localCatalogWithRatings(): CommunityCatalog {
  const design = createDefaultDesign();
  const base = uploadCommunityMap({ version: 2, maps: [], ratings: [] }, design, {
    title: "First", summary: "", authorName: "A", descriptiveTagSlugs: [], visibility: "public"
  }, "2026-05-01T00:00:00.000Z");
  const withSecond = uploadCommunityMap(base, design, {
    title: "Second", summary: "", authorName: "A", descriptiveTagSlugs: [], visibility: "public"
  }, "2026-05-02T00:00:00.000Z");
  const first = withSecond.maps.find((map) => map.title === "First")!;
  const second = withSecond.maps.find((map) => map.title === "Second")!;
  const at = "2026-05-03T00:00:00.000Z";
  return {
    ...withSecond,
    ratings: [
      { id: "r1", mapId: first.id, viewerId: "a", value: 3, createdAt: at, updatedAt: at },
      { id: "r2", mapId: first.id, viewerId: "b", value: 4, createdAt: at, updatedAt: at },
      { id: "r3", mapId: second.id, viewerId: "a", value: 5, createdAt: at, updatedAt: at }
    ]
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

/** A thenable PostgREST query builder stub; `spies` observe chained calls. */
function createQueryMock(
  response: { data: unknown[]; count: number },
  spies: Partial<Record<"select" | "eq" | "or" | "gte" | "lte" | "contains" | "order" | "range", (...args: never[]) => unknown>> = {}
) {
  const query: Record<string, unknown> = {};
  for (const method of ["select", "eq", "or", "gte", "lte", "contains", "order", "range"] as const) {
    query[method] = vi.fn((...args: never[]) => {
      spies[method]?.(...args);
      return query;
    });
  }
  query.then = (resolve: (value: { data: unknown[]; error: null; count: number }) => void) =>
    Promise.resolve(resolve({ data: response.data, error: null, count: response.count }));
  return query;
}
