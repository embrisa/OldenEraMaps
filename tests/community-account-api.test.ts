import { describe, expect, it, vi } from "vitest";
import { deleteCurrentAccount } from "../src/community/auth";
import { deleteMapListing, listMyMaps, updateMapListing } from "../src/community/communityApi";
import { createDefaultDesign, designToTemplate, serializeDesignFile } from "../src/design";
import { buildPreviewDesign, PREVIEW_RENDERER_VERSION } from "../src/community/previewDesign";

function createMapRow(overrides: Record<string, unknown> = {}) {
  const design = createDefaultDesign();
  design.templateName = "Hidden Private Map";
  return {
    id: "map-1",
    owner_id: "user-1",
    slug: "hidden-private-map",
    title: "Hidden Private Map",
    author_name: "Owner",
    description: "Owned map.",
    visibility: "private",
    status: "hidden",
    map_width: 160,
    map_height: 160,
    player_count: 2,
    zone_count: design.zones.length,
    connection_count: design.connections.length,
    win_condition: "Classic",
    template_name: "Hidden Private Map",
    template_json: designToTemplate(design),
    design_json: JSON.parse(serializeDesignFile(design)),
    preview_design_json: buildPreviewDesign(design),
    preview_renderer_version: PREVIEW_RENDERER_VERSION,
    download_count: 0,
    rating_count: 0,
    rating_average: 0,
    created_at: "2026-05-17T00:00:00.000Z",
    updated_at: "2026-05-18T00:00:00.000Z",
    profiles: { display_name: "Owner" },
    map_tags: [],
    ...overrides
  };
}

describe("signed-in map management API", () => {
  it("lists owned maps without applying public browse filters", async () => {
    const eqCalls: Array<[string, unknown]> = [];
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn((column: string, value: unknown) => {
        eqCalls.push([column, value]);
        return builder;
      }),
      order: vi.fn(async () => ({ data: [createMapRow()], error: null }))
    };
    const client = {
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } }, error: null }))
      },
      from: vi.fn(() => builder)
    };

    const result = await listMyMaps(client as never);

    expect(client.from).toHaveBeenCalledWith("maps");
    expect(eqCalls).toEqual([["owner_id", "user-1"]]);
    expect(eqCalls).not.toContainEqual(["status", "published"]);
    expect(eqCalls).not.toContainEqual(["visibility", "public"]);
    expect(result.maps[0]).toMatchObject({
      id: "map-1",
      visibility: "private",
      status: "hidden"
    });
  });

  it("invokes the delete-map edge function with the map id", async () => {
    const invoke = vi.fn(async () => ({ data: { ok: true }, error: null }));
    const client = { functions: { invoke } };

    await deleteMapListing("map-123", client as never);

    expect(invoke).toHaveBeenCalledWith("delete-map", { body: { mapId: "map-123" } });
  });

  it("surfaces delete-map edge function errors", async () => {
    const invoke = vi.fn(async () => ({ data: { error: "Nope" }, error: null }));
    const client = { functions: { invoke } };

    await expect(deleteMapListing("map-123", client as never)).rejects.toThrow("Nope");
  });

  it("falls back to direct owner deletion when delete-map edge function is unavailable", async () => {
    const invoke = vi.fn(async () => ({
      data: null,
      error: Object.assign(new Error("Failed to fetch"), { context: new Response(null, { status: 404 }) })
    }));
    const selectBuilder = {
      select: vi.fn(() => selectBuilder),
      eq: vi.fn(() => selectBuilder),
      maybeSingle: vi.fn(async () => ({
        data: {
          id: "map-123"
        },
        error: null
      }))
    };
    const deleteBuilder = {
      delete: vi.fn(() => deleteBuilder),
      eq: vi.fn(async () => ({ error: null }))
    };
    const client = {
      functions: { invoke },
      from: vi.fn((table: string) => {
        expect(table).toBe("maps");
        return client.from.mock.calls.length === 1 ? selectBuilder : deleteBuilder;
      })
    };

    await deleteMapListing("map-123", client as never);

    expect(invoke).toHaveBeenCalledWith("delete-map", { body: { mapId: "map-123" } });
    expect(deleteBuilder.delete).toHaveBeenCalled();
    expect(deleteBuilder.eq).toHaveBeenCalledWith("id", "map-123");
  });

  // The maps_prevent_direct_metadata_update trigger rejects client writes to template_json, which used to
  // fail every description save (and any title/visibility change sent with it). Descriptions now update
  // the listing column only and never read or rewrite the stored template/design JSON.
  it("updates descriptions through the listing column without touching template_json or design_json", async () => {
    const updateBuilder = {
      select: vi.fn(),
      update: vi.fn(() => updateBuilder),
      eq: vi.fn(async () => ({ error: null }))
    };
    const client = {
      from: vi.fn(() => updateBuilder)
    };

    await updateMapListing("map-1", { description: "  Updated   description.  " }, client as never);

    expect(client.from).toHaveBeenCalledTimes(1);
    expect(updateBuilder.select).not.toHaveBeenCalled();
    expect(updateBuilder.update).toHaveBeenCalledWith({ description: "Updated description." });
    expect(updateBuilder.eq).toHaveBeenCalledWith("id", "map-1");
  });

  it("normalizes listing titles before update", async () => {
    const updateBuilder = {
      update: vi.fn(() => updateBuilder),
      eq: vi.fn(async () => ({ error: null }))
    };
    const client = {
      from: vi.fn(() => updateBuilder)
    };

    await updateMapListing("map-1", { title: "  New   Listing   Title  " }, client as never);

    expect(updateBuilder.update).toHaveBeenCalledWith(expect.objectContaining({
      title: "New Listing Title"
    }));
  });

  it("rejects invalid listing titles and descriptions before update", async () => {
    const client = {
      from: vi.fn()
    };

    await expect(updateMapListing("map-1", { title: "Bad <b>Title</b>" }, client as never))
      .rejects.toThrow("Title cannot contain HTML tags.");
    await expect(updateMapListing("map-1", { description: "Read https://example.com" }, client as never))
      .rejects.toThrow("Description cannot contain links or URLs.");
    expect(client.from).not.toHaveBeenCalled();
  });

  it("updates a listing-specific author name", async () => {
    const updateBuilder = {
      update: vi.fn(() => updateBuilder),
      eq: vi.fn(async () => ({ error: null }))
    };
    const client = {
      from: vi.fn(() => updateBuilder)
    };

    await updateMapListing("map-1", { authorName: "  New   Author  " }, client as never);

    expect(updateBuilder.update).toHaveBeenCalledWith(expect.objectContaining({
      author_name: "New Author"
    }));
    expect(updateBuilder.eq).toHaveBeenCalledWith("id", "map-1");
  });

  it("sends only the patched listing columns in a single update", async () => {
    const updateBuilder = {
      update: vi.fn(() => updateBuilder),
      eq: vi.fn(async () => ({ error: null }))
    };
    const client = {
      from: vi.fn(() => updateBuilder)
    };

    await updateMapListing("map-1", { title: "Renamed", visibility: "unlisted", description: "New text." }, client as never);

    expect(updateBuilder.update).toHaveBeenCalledTimes(1);
    expect(updateBuilder.update).toHaveBeenCalledWith({ title: "Renamed", description: "New text.", visibility: "unlisted" });
  });

  it("invokes delete-account and signs out after success", async () => {
    const invoke = vi.fn(async () => ({ data: { ok: true }, error: null }));
    const signOut = vi.fn(async () => ({ error: null }));
    const client = {
      functions: { invoke },
      auth: { signOut }
    };

    await deleteCurrentAccount(client as never);

    expect(invoke).toHaveBeenCalledWith("delete-account", { body: {} });
    expect(signOut).toHaveBeenCalled();
  });
});
