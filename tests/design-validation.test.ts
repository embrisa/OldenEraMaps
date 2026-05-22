import { describe, expect, it } from "vitest";
import { createDefaultDesign } from "../src/design/model";
import { validateDesign, designValidationAsSettingsValidation } from "../src/design/validation";

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
});
