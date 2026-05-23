import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createDefaultDesign } from "../src/design/model";
import { designToTemplate, templateToDesign } from "../src/design/conversion";
import { validateDesign, designValidationAsSettingsValidation } from "../src/design/validation";
import { parseRmgTemplate } from "../src/types";

describe("design validation", () => {
  it("accepts the default release design", () => {
    expect(validateDesign(createDefaultDesign())).toEqual({ errors: [], warnings: [] });
  });

  it("reports disconnected graphs and invalid settings through the settings bridge", () => {
    const design = createDefaultDesign();
    design.templateName = "";
    design.connections = [];

    const validation = designValidationAsSettingsValidation(design);

    expect(validation.errors).toContain("Template name is required.");
    expect(validation.errors).toContain("Direct and portal connections must connect every zone.");
  });

  it("accepts official Exodus-style template structures for export", () => {
    const templateJson = readFileSync(join(process.cwd(), "docs/reference/olden-era-rmg-templates/Exodus.rmg.json"), "utf8");
    const design = templateToDesign(parseRmgTemplate(templateJson));
    const validation = validateDesign(design);

    expect(validation.errors).toEqual([]);
    expect(design.zones.filter((zone) => zone.naturalExpansion).map((zone) => zone.name)).toEqual([]);
    expect(() => designToTemplate(design)).not.toThrow();
  });

  it("allows content count limits that target include lists instead of a single SID", () => {
    const design = createDefaultDesign();
    design.contentCountLimits = [{
      name: "content_limits_custom",
      limits: [{ sid: "", includeLists: ["basic_content_list_building_guarded_units_banks"], maxCount: 6 }]
    }];

    expect(validateDesign(design).errors).not.toContain("content_limits_custom has a content SID limit without a SID.");
  });
});
