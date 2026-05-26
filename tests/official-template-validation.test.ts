import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { describe, expect, it } from "vitest";
import { designToTemplate, templateToDesign } from "../src/design/conversion";
import { validateDesign } from "../src/design/validation";
import { parseRmgTemplate } from "../src/types";

const detectedCrossOverTemplateDir = join(
  process.env.HOME ?? "",
  "Library/Application Support/CrossOver/Bottles/Steam/drive_c/Program Files (x86)/Steam/steamapps/common/Heroes of Might and Magic Olden Era/HeroesOldenEra_Data/StreamingAssets/map_templates"
);

const officialTemplateDir = process.env.OLDEN_ERA_RMG_TEMPLATE_DIR || detectedCrossOverTemplateDir;
const knownDisconnectedOfficialTemplates = new Set(["Spider.rmg.json"]);
const disconnectedGraphError = "Direct and portal connections must connect every zone.";

describe.skipIf(!existsSync(officialTemplateDir))("official Olden Era template validation", () => {
  const templatePaths = readdirSync(officialTemplateDir)
    .filter((fileName) => fileName.endsWith(".rmg.json"))
    .sort((left, right) => left.localeCompare(right))
    .map((fileName) => join(officialTemplateDir, fileName));

  it.each(templatePaths)("accepts %s", (templatePath) => {
    const templateJson = readFileSync(templatePath, "utf8");
    const design = templateToDesign(parseRmgTemplate(templateJson));
    const validation = validateDesign(design);
    const fileName = basename(templatePath);

    if (knownDisconnectedOfficialTemplates.has(fileName)) {
      expect(validation.errors, fileName).toEqual([disconnectedGraphError]);
      expect(() => designToTemplate(design, { skipValidation: true }), fileName).not.toThrow();
      return;
    }

    expect(validation.errors, fileName).toEqual([]);
    expect(() => designToTemplate(design), fileName).not.toThrow();
  });
});
