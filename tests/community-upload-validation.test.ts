import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { snapPointToBoardSlot } from "../src/boardSlots";
import { addZone, createDefaultDesign, designToTemplate, serializeDesignFile } from "../src/design";
import { serializeTemplate } from "../src/generator";
import {
  validateAndPrepareCommunityUpload,
  UploadValidationError,
  type UploadMapRequest
} from "../src/community/uploadValidation";
import { parsePreviewDesignJson, PREVIEW_RENDERER_VERSION } from "../src/community/previewDesign";

describe("community upload validation", () => {
  it("prepares a valid generated map with server-derived metadata", async () => {
    const design = createDefaultDesign();
    design.templateName = "Validated Upload";
    const prepared = await validateAndPrepareCommunityUpload({
      ...requestFromDesign(design),
      title: "  Validated   Upload  ",
      description: "  Fast   map  \nwith lanes  ",
      descriptiveTagSlugs: ["Competitive", "tempo", "competitive"]
    }, { userId: "user-1" });

    expect(prepared.title).toBe("Validated Upload");
    expect(prepared.description).toBe("Fast map\nwith lanes");
    expect(prepared.metadata).toMatchObject({
      mapWidth: 160,
      mapHeight: 160,
      playerCount: 2,
      zoneCount: 3,
      connectionCount: 2,
      templateName: "Validated Upload"
    });
    expect(prepared.templateSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(prepared.metadata.templateDescription).toBe("Built with www.OldenEraMaps.com");
    expect(prepared.previewRendererVersion).toBe(PREVIEW_RENDERER_VERSION);
    expect(prepared.previewDesignJson).toMatchObject({
      version: PREVIEW_RENDERER_VERSION,
      mapWidth: 160,
      mapHeight: 160,
      templateName: "Validated Upload"
    });
    expect((prepared.designJson as { design: { templateName: string } }).design.templateName).toBe("Validated Upload");
    expect(prepared.factualTagSlugs).toContain("players:2");
    expect(prepared.descriptiveTagSlugs).toEqual(["competitive", "tempo"]);
  });

  it("rejects invalid release design payloads instead of silently falling back", async () => {
    await expect(validateAndPrepareCommunityUpload({
      ...requestFromDesign(createDefaultDesign()),
      designJson: { templateName: "Client Fake", mapWidth: 999 }
    }, { userId: "user-1" })).rejects.toMatchObject({ code: "invalid_design" });
  });

  it("parses existing example fixtures as valid templates", async () => {
    const templateJson = JSON.parse(await readFile(new URL("./fixtures/examples/Central Tollroads.rmg.json", import.meta.url), "utf8"));
    const prepared = await validateAndPrepareCommunityUpload({
      title: "Central Tollroads",
      description: "Fixture upload",
      visibility: "public",
      descriptiveTagSlugs: [],
      templateJson
    }, { userId: "user-1" });

    expect(prepared.metadata.templateName).toBe("Central Tollroads");
    expect(prepared.metadata.zoneCount).toBeGreaterThan(0);
  });

  it("rejects malformed JSON and structurally invalid templates", async () => {
    await expect(validateAndPrepareCommunityUpload({
      title: "Bad",
      description: "",
      visibility: "public",
      descriptiveTagSlugs: [],
      templateJson: "{"
    }, { userId: "user-1" })).rejects.toMatchObject({ code: "malformed_json" });

    await expect(validateAndPrepareCommunityUpload({
      title: "Bad",
      description: "",
      visibility: "public",
      descriptiveTagSlugs: [],
      templateJson: { name: "Missing dimensions" }
    }, { userId: "user-1" })).rejects.toBeInstanceOf(UploadValidationError);
  });

  it("rejects unsafe descriptions", async () => {
    const cases = [
      { value: "https://example.com", detail: "Description cannot contain links or URLs." },
      { value: "www.example.com", detail: "Description cannot contain links or URLs." },
      { value: "[click](https://example.com)", detail: "Description cannot contain links or URLs." },
      { value: "`code`", detail: "Description cannot contain Markdown code formatting." },
      { value: "<b>text</b>", detail: "Description cannot contain HTML tags." },
      { value: "x".repeat(801), detail: "Description must be 800 characters or less." }
    ];

    for (const testCase of cases) {
      await expect(validateAndPrepareCommunityUpload({
        ...requestFromDesign(createDefaultDesign()),
        description: testCase.value
      }, { userId: "user-1" })).rejects.toMatchObject({
        code: "invalid_description",
        details: expect.arrayContaining([testCase.detail])
      });
    }
  });

  it("accepts the OldenEraMaps branding URL in uploaded descriptions", async () => {
    const prepared = await validateAndPrepareCommunityUpload({
      ...requestFromDesign(createDefaultDesign()),
      description: "Built with www.OldenEraMaps.com"
    }, { userId: "user-1" });

    expect(prepared.description).toBe("Built with www.OldenEraMaps.com");
  });

  it("accepts the canonical OldenEraMaps homepage with protocol in uploaded descriptions", async () => {
    const prepared = await validateAndPrepareCommunityUpload({
      ...requestFromDesign(createDefaultDesign()),
      description: "Built with https://www.OldenEraMaps.com/"
    }, { userId: "user-1" });

    expect(prepared.description).toBe("Built with https://www.OldenEraMaps.com/");
  });

  it("turns risky but structurally valid maps into warnings", async () => {
    const design = createDefaultDesign();
    design.mapWidth = 260;
    design.mapHeight = 260;
    design.zones[0]!.castleCount = 2;
    design.zones[1]!.castleCount = 2;
    design.zones[2]!.castleCount = 2;

    const prepared = await validateAndPrepareCommunityUpload(requestFromDesign(design), { userId: "user-1" });

    expect(prepared.warnings.join("\n")).toContain("known official maximum");
    expect(prepared.warnings.join("\n")).toContain("multiple castles");
  });

  it("derives preview design payloads from validated template data", async () => {
    const prepared = await validateAndPrepareCommunityUpload(requestFromDesign(createDefaultDesign()), { userId: "user-1" });
    expect(prepared.previewDesignJson).toMatchObject({
      version: PREVIEW_RENDERER_VERSION,
      zones: expect.any(Array),
      connections: expect.any(Array)
    });
  });

  it("stores canonical board slot coordinates in prepared designs and preview payloads", async () => {
    const design = createDefaultDesign();
    design.zones[0]!.position = { x: 0.14, y: 0.22 };
    design.zones[1]!.position = { x: 0.61, y: 0.71 };
    design.zones[2]!.position = { x: 0.88, y: 0.27 };

    const prepared = await validateAndPrepareCommunityUpload(requestFromDesign(design), { userId: "user-1" });
    const preview = parsePreviewDesignJson(prepared.previewDesignJson);
    const snappedPositions = design.zones.map((zone) => snapPointToBoardSlot(zone.position));

    expect(prepared.design.zones.map((zone) => zone.position)).toEqual(snappedPositions);
    expect(preview?.zones.map((zone) => zone.position)).toEqual(snappedPositions);
  });

  it("handles duplicate same-user hashes and requires authentication", async () => {
    const prepared = await validateAndPrepareCommunityUpload(requestFromDesign(createDefaultDesign()), { userId: "user-1" });

    await expect(validateAndPrepareCommunityUpload(
      requestFromDesign(createDefaultDesign()),
      { userId: "user-1" },
      { existingTemplateHashes: new Set([prepared.templateSha256]) }
    )).rejects.toMatchObject({ code: "duplicate_template" });

    await expect(validateAndPrepareCommunityUpload(requestFromDesign(createDefaultDesign()), { userId: null }))
      .rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("derives the correct factual player-count tags for 2-player and 3-player uploads", async () => {
    const duelPrepared = await validateAndPrepareCommunityUpload(requestFromDesign(createDefaultDesign()), { userId: "user-1" });

    let threePlayer = createDefaultDesign();
    threePlayer = addZone(threePlayer, "Spawn");
    threePlayer.connections.push({
      id: "conn-3-4",
      name: "Path-3-4",
      from: "zone-3",
      to: "zone-4",
      type: "Direct",
      guardStrength: 24000,
      road: true
    });
    const threePlayerPrepared = await validateAndPrepareCommunityUpload(requestFromDesign(threePlayer), { userId: "user-1" });

    expect(duelPrepared.factualTagSlugs).toContain("players:2");
    expect(threePlayerPrepared.factualTagSlugs).toContain("players:3");
  });

  it("rejects descriptive tags that duplicate derived factual metadata", async () => {
    await expect(validateAndPrepareCommunityUpload({
      ...requestFromDesign(createDefaultDesign()),
      descriptiveTagSlugs: ["players:2"]
    }, { userId: "user-1" })).rejects.toMatchObject({
      code: "invalid_tags",
      details: expect.arrayContaining(['Descriptive tag "players:2" duplicates factual map metadata.'])
    });
  });

  it("rejects invalid descriptive tags", async () => {
    await expect(validateAndPrepareCommunityUpload({
      ...requestFromDesign(createDefaultDesign()),
      descriptiveTagSlugs: ["players:3"]
    }, { userId: "user-1" })).rejects.toMatchObject({
      code: "invalid_tags",
      details: expect.arrayContaining(['Unknown descriptive tag "players:3".'])
    });

    await expect(validateAndPrepareCommunityUpload({
      ...requestFromDesign(createDefaultDesign()),
      descriptiveTagSlugs: ["unknown-tag"]
    }, { userId: "user-1" })).rejects.toMatchObject({
      code: "invalid_tags",
      details: expect.arrayContaining(['Unknown descriptive tag "unknown-tag".'])
    });
  });

  it("rejects descriptive tags whose constraints conflict with derived metadata", async () => {
    const design = createDefaultDesign();
    design.gameEndConditions.victoryCondition = "win_condition_5";
    design.gameEndConditions.cityHold = true;
    design.zones[1]!.holdCity = true;

    await expect(validateAndPrepareCommunityUpload({
      ...requestFromDesign(design),
      descriptiveTagSlugs: ["competitive"]
    }, { userId: "user-1" })).rejects.toMatchObject({
      code: "invalid_tags",
      details: expect.arrayContaining(['Descriptive tag "competitive" is not allowed for city hold maps.'])
    });
  });
});

function requestFromDesign(design = createDefaultDesign(), extra: Record<string, unknown> = {}): UploadMapRequest {
  const template = JSON.parse(serializeTemplate(designToTemplate(design)));
  return {
    title: design.templateName,
    description: "",
    visibility: "public",
    descriptiveTagSlugs: [],
    templateJson: {
      ...template,
      ...extra
    },
    designJson: JSON.parse(serializeDesignFile(design))
  };
}
