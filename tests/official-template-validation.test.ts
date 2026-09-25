import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { describe, expect, it } from "vitest";
import { designToTemplate, templateToDesign } from "../src/design/conversion";
import { validateDesign } from "../src/design/validation";
import { parseRmgTemplate } from "../src/types";

const bundledTemplateDir = join(process.cwd(), "docs/reference/olden-era-rmg-templates");

const detectedCrossOverTemplateDir = join(
  process.env.HOME ?? "",
  "Library/Application Support/CrossOver/Bottles/Steam/drive_c/Program Files (x86)/Steam/steamapps/common/Heroes of Might and Magic Olden Era/HeroesOldenEra_Data/StreamingAssets/map_templates"
);

const installedTemplateDir = process.env.OLDEN_ERA_RMG_TEMPLATE_DIR || detectedCrossOverTemplateDir;
const knownDisconnectedOfficialTemplates = new Set(["Spider.rmg.json"]);
const disconnectedGraphError = "Direct and portal connections must connect every zone.";

// Vitest still runs the body of a skipped describe to collect tests, so directory reads must not throw.
function listTemplatePaths(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((fileName) => fileName.endsWith(".rmg.json"))
    .sort((left, right) => left.localeCompare(right))
    .map((fileName) => join(directory, fileName));
}

function expectOfficialTemplateAccepted(templatePath: string): void {
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
}

describe("bundled official Olden Era template validation", () => {
  const templatePaths = listTemplatePaths(bundledTemplateDir);

  it("finds the committed reference templates", () => {
    expect(templatePaths.length).toBeGreaterThan(0);
  });

  it.each(templatePaths)("accepts %s", expectOfficialTemplateAccepted);
});

describe.skipIf(!existsSync(installedTemplateDir))("installed official Olden Era template validation", () => {
  it.each(listTemplatePaths(installedTemplateDir))("accepts %s", expectOfficialTemplateAccepted);
});
