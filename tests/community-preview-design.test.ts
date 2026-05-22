import { describe, expect, it } from "vitest";
import { snapPointToBoardSlot } from "../src/boardSlots";
import { addZone, createDefaultDesign } from "../src/design";
import {
  buildPreviewDesign,
  parsePreviewDesignJson,
  PREVIEW_RENDERER_VERSION,
  serializePreviewDesign,
} from "../src/community/previewDesign";

describe("community preview design", () => {
  it("builds deterministic preview data from a template design", () => {
    const design = createDefaultDesign();
    const first = buildPreviewDesign(design);
    const second = buildPreviewDesign(structuredClone(design));

    expect(second).toEqual(first);
    expect(first).toMatchObject({
      version: PREVIEW_RENDERER_VERSION,
      mapWidth: design.mapWidth,
      mapHeight: design.mapHeight,
      templateName: design.templateName,
    });
    expect(first.zones).toHaveLength(design.zones.length);
    expect(first.connections).toHaveLength(design.connections.length);
  });

  it("excludes unrelated transient UI state and stores only renderer data", () => {
    const design = addZone(createDefaultDesign(), "Neutral");
    const preview = buildPreviewDesign(design);

    expect(preview.zones[0]).not.toHaveProperty("selected");
    expect(preview).not.toHaveProperty("templateJson");
    expect(preview).not.toHaveProperty("designJson");
  });

  it("parses valid preview json and rejects malformed payloads", () => {
    const preview = buildPreviewDesign(createDefaultDesign());

    expect(parsePreviewDesignJson(JSON.stringify(preview))).toEqual(preview);
    expect(parsePreviewDesignJson("{not-json")).toBeNull();
    expect(parsePreviewDesignJson({ ...preview, version: 999 })).toBeNull();
    expect(parsePreviewDesignJson({ ...preview, zones: [{ bad: true }] })).toBeNull();
  });

  it("round-trips projected preview data through the shared release contract", () => {
    const preview = buildPreviewDesign(addZone(createDefaultDesign(), "Neutral"));
    const serialized = serializePreviewDesign(preview);

    expect(parsePreviewDesignJson(serialized)).toEqual(preview);
    expect(Object.keys(preview.zones[0]!)).toEqual([
      "id",
      "name",
      "signature",
      "role",
      "player",
      "quality",
      "castleCount",
      "size",
      "terrainTheme",
      "resourceDensityPercent",
      "structureDensityPercent",
      "neutralStackStrengthPercent",
      "guardMultiplier",
      "guardWeeklyIncrement",
      "resourcesValue",
      "resourcesValuePerArea",
      "roads",
      "footholds",
      "holdCity",
      "neutralCastlesAsRuins",
      "naturalExpansion",
      "zoneBiome",
      "contentBiome",
      "metaObjectsBiome",
      "position",
    ]);
  });

  it("rejects payloads with missing canonical preview fields", () => {
    const preview = buildPreviewDesign(createDefaultDesign());
    const zone = { ...preview.zones[0] };
    delete (zone as Partial<typeof zone>).guardMultiplier;

    expect(parsePreviewDesignJson({ ...preview, zones: [zone, ...preview.zones.slice(1)] })).toBeNull();
  });

  it("snaps legacy off-grid preview positions onto shared board slots", () => {
    const preview = buildPreviewDesign(createDefaultDesign());
    preview.zones[0] = {
      ...preview.zones[0],
      position: { x: 0.12, y: 0.34 }
    };

    const parsed = parsePreviewDesignJson(preview);

    expect(parsed?.zones[0]?.position).toEqual(snapPointToBoardSlot({ x: 0.12, y: 0.34 }));
  });
});
