import { describe, expect, it } from "vitest";
import { createDefaultDesign } from "../src/design/model";
import { designToTemplate, serializeDesignFile, templateToDesign } from "../src/design/conversion";
import { parseRmgTemplate, serializeRmgTemplate } from "../src/types";

describe("design conversion", () => {
  it("converts a design to parseable release RMG JSON", () => {
    const design = createDefaultDesign();
    design.templateName = "Focused Conversion";

    const serialized = serializeRmgTemplate(designToTemplate(design));
    const parsed = parseRmgTemplate(serialized);

    expect(parsed.name).toBe("Focused Conversion");
    expect(parsed.variants?.[0]?.zones?.map((zone) => zone.name)).toEqual(["Spawn-1", "Neutral-3", "Spawn-2"]);
  });

  it("imports current RMG templates into release design shape", () => {
    const template = designToTemplate(createDefaultDesign());
    template.name = "Imported Current Template";

    const design = templateToDesign(template);

    expect(design.format).toBe("olden-era-template-design");
    expect(design.version).toBe(1);
    expect(design.templateName).toBe("Imported Current Template");
  });

  it("serializes release design files with the release marker", () => {
    const serialized = JSON.parse(serializeDesignFile(createDefaultDesign())) as { format?: string; version?: number };

    expect(serialized).toMatchObject({ format: "olden-era-template-design", version: 1 });
  });
});
