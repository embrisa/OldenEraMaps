import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultDesign } from "../src/design";
import type { CommunityMapDatabaseRecord } from "../src/community/databaseMappers";
import type { Database } from "../src/community/databaseTypes";
import { buildPreviewDesign, PREVIEW_RENDERER_VERSION } from "../src/community/previewDesign";

import { ServerUploadError, uploadCommunityMapToServer } from "../src/community/uploadApi";

describe("community upload API preview payloads", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://project-ref.supabase.co");
  });

  it("sends preview design data to the edge function and maps it back into the saved record", async () => {
    let functionBody: Record<string, unknown> = {};
    const client = createMockClient((body) => {
      functionBody = body;
    });
    const design = createDefaultDesign();
    design.templateDescription = "Shared upload description.";

    const result = await uploadCommunityMapToServer(design, uploadDraft(), client);

    expect(functionBody.description).toBe("Shared upload description.");
    expect(functionBody.authorName).toBe("Test Author");
    expect(functionBody.previewRendererVersion).toBe(PREVIEW_RENDERER_VERSION);
    expect(functionBody.previewDesignJson).toEqual(buildPreviewDesign(design));
    expect(JSON.parse(result.map.previewDesignJson)).toEqual(buildPreviewDesign(design));
    expect(result.map.previewRendererVersion).toBe(PREVIEW_RENDERER_VERSION);
  });

  it("surfaces edge function validation errors from the upload endpoint", async () => {
    const client = createErrorClient();

    await expect(uploadCommunityMapToServer(createDefaultDesign(), uploadDraft(), client)).rejects.toMatchObject({
      name: "ServerUploadError",
      code: "invalid_preview_design",
      message: "Upload requires a valid preview design payload.",
    } satisfies Partial<ServerUploadError>);
  });
});

function uploadDraft() {
  return {
    title: "Shared Map",
    summary: "A compact test map.",
    authorName: "Test Author",
    descriptiveTagSlugs: [],
    visibility: "public" as const,
  };
}

function createMockClient(
  onFunctionBody?: (body: Record<string, unknown>) => void,
) {
  return {
    functions: {
      invoke: vi.fn(async (_name: string, options: { body: Record<string, unknown> }) => {
        onFunctionBody?.(options.body);
        return { data: { map: mapRecord(options.body), warnings: [] }, error: null };
      }),
    },
  } as unknown as import("@supabase/supabase-js").SupabaseClient<Database>;
}

function createErrorClient() {
  return {
    functions: {
      invoke: vi.fn(async () => ({
        data: null,
        error: {
          message: "Edge function returned a non-2xx status code",
          context: new Response(JSON.stringify({
            error: "Upload requires a valid preview design payload.",
            code: "invalid_preview_design",
            details: ["Upload requires a valid preview design payload."]
          }), {
            status: 400,
            headers: { "content-type": "application/json" }
          })
        }
      })),
    },
  } as unknown as import("@supabase/supabase-js").SupabaseClient<Database>;
}

function mapRecord(body: Record<string, unknown>): CommunityMapDatabaseRecord {
  return {
    id: "map-1",
    owner_id: "user-1",
    slug: "shared-map",
    title: "Shared Map",
    author_name: body.authorName as string,
    description: body.description as string,
    visibility: "public",
    status: "published",
    map_width: 160,
    map_height: 160,
    player_count: 2,
    zone_count: 3,
    connection_count: 2,
    win_condition: "win_condition_1",
    terrain_theme: null,
    template_name: "Shared Map",
    template_json: { description: String(body.description ?? "") },
    design_json: body.designJson as Database["public"]["Tables"]["maps"]["Row"]["design_json"],
    preview_design_json: body.previewDesignJson as Database["public"]["Tables"]["maps"]["Row"]["preview_design_json"],
    preview_renderer_version: body.previewRendererVersion as number,
    template_sha256: "abc",
    upload_warnings: [],
    factual_metadata: {},
    download_count: 0,
    rating_count: 0,
    rating_average: 0,
    created_at: "2026-05-18T00:00:00.000Z",
    updated_at: "2026-05-18T00:00:00.000Z",
  };
}
