import { describe, expect, it } from "vitest";
import { snapPointToBoardSlot } from "../src/boardSlots";
import { createDefaultDesign } from "../src/design";
import { requireStoredPreviewDesignJson } from "../src/community/previewPayload.ts";
import { buildPreviewDesign } from "../src/community/previewDesign";

describe("preview payload helpers", () => {
  it("keeps an existing valid stored preview payload", () => {
    const design = createDefaultDesign();
    const preview = buildPreviewDesign(design);

    expect(requireStoredPreviewDesignJson(preview)).toBe(JSON.stringify(preview, null, 2));
  });

  it("rejects missing stored preview payloads", () => {
    expect(() => requireStoredPreviewDesignJson(null)).toThrow("missing preview_design_json");
  });

  it("rejects legacy stringified preview payloads", () => {
    const preview = JSON.stringify(buildPreviewDesign(createDefaultDesign()));
    expect(() => requireStoredPreviewDesignJson(preview)).toThrow("legacy stringified preview_design_json");
  });

  it("rejects invalid structured preview payloads", () => {
    expect(() => requireStoredPreviewDesignJson({ bad: true })).toThrow("invalid preview_design_json");
  });

  it("rejects stale stored preview renderer versions", () => {
    expect(() => requireStoredPreviewDesignJson(buildPreviewDesign(createDefaultDesign()), 999)).toThrow("stale preview_renderer_version");
  });

  it("serializes stored preview payloads through the normalized release contract", () => {
    const preview = buildPreviewDesign(createDefaultDesign());
    preview.zones[0] = {
      ...preview.zones[0],
      position: { x: 0.12, y: 0.34 }
    };

    const resolved = requireStoredPreviewDesignJson(preview);

    expect(JSON.parse(resolved).zones[0].position).toEqual(snapPointToBoardSlot({ x: 0.12, y: 0.34 }));
    expect(buildPreviewDesign(createDefaultDesign()).zones[0].position).toEqual(snapPointToBoardSlot({ x: 0.18, y: 0.5 }));
  });
});
