import { describe, expect, it } from "vitest";
import { createDefaultDesign, designToTemplate, serializeDesignFile, type TemplateDesign } from "../src/design";
import { serializeTemplate } from "../src/generator";
import {
  COMMUNITY_UPLOAD_MAX_JSON_BYTES,
  COMMUNITY_UPLOAD_MAX_JSON_DEPTH,
  prepareCommunityUploadCore,
  type PreparedCommunityUploadCore,
  type UploadMapRequest
} from "../src/community/uploadCore";
import { buildPreviewDesign, PREVIEW_RENDERER_VERSION } from "../src/community/previewDesign";
import { validateAndPrepareCommunityUpload } from "../src/community/uploadValidation";

describe("community upload core", () => {
  it("matches the browser upload wrapper preparation output for release-era inputs", async () => {
    const request = requestFromDesign(createDefaultDesign(), {
      title: "  Shared   Upload  ",
      description: "  Tested   upload  ",
      descriptiveTagSlugs: ["competitive", "tempo", "competitive"]
    });

    const corePrepared = await prepareCommunityUploadCore(request);
    const browserPrepared = await validateAndPrepareCommunityUpload(request, { userId: "user-1" });

    expect(stripOwner(browserPrepared)).toEqual(corePrepared);
  });

  it("uses a canonical template hash independent of input object key order", async () => {
    const request = requestFromDesign(createDefaultDesign());
    const reorderedTemplate = Object.fromEntries(
      Object.entries(request.templateJson as Record<string, unknown>).reverse()
    );

    const original = await prepareCommunityUploadCore(request);
    const reordered = await prepareCommunityUploadCore({
      ...request,
      templateJson: reorderedTemplate
    });

    expect(reordered.templateSha256).toBe(original.templateSha256);
    expect(reordered.templateJson).toEqual(original.templateJson);
  });

  it("rejects non-release design payloads instead of accepting legacy fallback shapes", async () => {
    await expect(prepareCommunityUploadCore({
      ...requestFromDesign(createDefaultDesign()),
      designJson: { templateName: "Client Fake", mapWidth: 999 }
    })).rejects.toMatchObject({
      code: "invalid_design",
      details: ["Design JSON must be a release design file."]
    });
  });

  it("rejects preview payloads that do not match the validated release design", async () => {
    const design = createDefaultDesign();
    const preview = buildPreviewDesign(design);
    preview.templateName = "Client Fake";

    await expect(prepareCommunityUploadCore({
      ...requestFromDesign(design),
      previewDesignJson: preview,
      previewRendererVersion: PREVIEW_RENDERER_VERSION
    })).rejects.toMatchObject({
      code: "invalid_preview_design",
      details: ["Preview design JSON does not match the uploaded design JSON."]
    });
  });

  it("rejects stale upload preview renderer versions", async () => {
    await expect(prepareCommunityUploadCore({
      ...requestFromDesign(createDefaultDesign()),
      previewDesignJson: buildPreviewDesign(createDefaultDesign()),
      previewRendererVersion: 999
    })).rejects.toMatchObject({ code: "invalid_preview_design" });
  });

  it("enforces release upload JSON size and depth guardrails", async () => {
    await expect(prepareCommunityUploadCore({
      ...requestFromDesign(createDefaultDesign()),
      templateJson: "{"
    })).rejects.toMatchObject({ code: "malformed_json" });

    await expect(prepareCommunityUploadCore({
      ...requestFromDesign(createDefaultDesign()),
      templateJson: nestedJson(COMMUNITY_UPLOAD_MAX_JSON_DEPTH + 1)
    })).rejects.toMatchObject({ code: "payload_too_deep" });

    await expect(prepareCommunityUploadCore({
      ...requestFromDesign(createDefaultDesign()),
      templateJson: `"${"x".repeat(COMMUNITY_UPLOAD_MAX_JSON_BYTES)}"`
    })).rejects.toMatchObject({ code: "payload_too_large" });
  });
});

function requestFromDesign(design: TemplateDesign, overrides: Partial<UploadMapRequest> = {}): UploadMapRequest {
  return {
    title: design.templateName,
    description: "",
    visibility: "public",
    descriptiveTagSlugs: [],
    templateJson: JSON.parse(serializeTemplate(designToTemplate(design))),
    designJson: JSON.parse(serializeDesignFile(design)),
    ...overrides
  };
}

function stripOwner(value: PreparedCommunityUploadCore & { ownerId: string }): PreparedCommunityUploadCore {
  const { ownerId: _ownerId, ...prepared } = value;
  void _ownerId;
  return prepared;
}

function nestedJson(depth: number): string {
  let value: unknown = "leaf";
  for (let index = 0; index < depth; index += 1) {
    value = { child: value };
  }
  return JSON.stringify(value);
}
