import { describe, expect, it } from "vitest";
import { createDefaultDesign } from "../src/design/model";
import { designToTemplate, parseDesignOrTemplateFileResult, serializeDesignFile } from "../src/design/conversion";
import { serializeRmgTemplate } from "../src/types";

describe("release design import boundary", () => {
  it("imports current design files", () => {
    const design = createDefaultDesign();
    const result = parseDesignOrTemplateFileResult(serializeDesignFile(design));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.strategy).toBe("design_file");
    expect(result.design.templateName).toBe(design.templateName);
  });

  it("imports current RMG templates", () => {
    const design = createDefaultDesign();
    design.templateName = "Release Template Import";
    const result = parseDesignOrTemplateFileResult(serializeRmgTemplate(designToTemplate(design)));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.strategy).toBe("rmg_template");
    expect(result.design.templateName).toBe("Release Template Import");
  });

  it("rejects legacy settings files instead of parsing them", () => {
    const result = parseDesignOrTemplateFileResult(`{
      "templateName": "Old Settings",
      "playerCount": 2,
      "neutralZoneCount": 1,
      "topology": "Ring",
      "generateRoads": true
    }`);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.attempts).toContainEqual(expect.objectContaining({
      strategy: "rmg_template",
      ok: false,
      category: "unsupported_legacy_settings"
    }));
  });
});
