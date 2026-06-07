import { describe, expect, it } from "vitest";
import { templateToDesign, validateDesign } from "../src/design";
import { generateTemplate } from "../src/generator";
import { createDefaultSettings, normalizeSettings, presetOptions } from "../src/settings";
import type { MapGenerationPreset } from "../src/types";

const expandedPresets: Array<{
  preset: MapGenerationPreset;
  playerCount: number;
  assert?(template: ReturnType<typeof generateTemplate>, settings: ReturnType<typeof createDefaultSettings>): void;
}> = [
  { preset: "PvE1v2", playerCount: 3 },
  { preset: "PvE1v4", playerCount: 5 },
  { preset: "PvE1v7", playerCount: 8 },
  {
    preset: "Islands",
    playerCount: 4,
    assert: (_template, settings) => {
      expect(settings.borderWaterWidth).toBeGreaterThan(0);
      expect(settings.randomPortals).toBe(true);
    }
  },
  {
    preset: "DeepWater",
    playerCount: 4,
    assert: (_template, settings) => {
      expect(settings.borderWaterWidth).toBeGreaterThanOrEqual(18);
      expect(settings.randomPortals).toBe(true);
    }
  },
  { preset: "PeacefulEconomy", playerCount: 4 },
  { preset: "AsceticSurvival", playerCount: 2 },
  {
    preset: "TwoTowns",
    playerCount: 2,
    assert: (_template, settings) => {
      expect(settings.zoneCfg.playerZoneCastles).toBe(2);
      expect(settings.matchPlayerCastleFactions).toBe(true);
    }
  },
  {
    preset: "HubTreasury",
    playerCount: 4,
    assert: (template, settings) => {
      expect(settings.topology).toBe("HubAndSpoke");
      expect(template.variants?.[0].zones?.find((zone) => zone.name === "Hub")?.mainObjects?.some((object) => object.type === "City")).toBe(true);
    }
  }
];

describe("expanded preset library", () => {
  it("exposes the first-wave presets in the preset options", () => {
    const visiblePresets = new Set(presetOptions.map((option) => option.value));
    for (const preset of expandedPresets) {
      expect(visiblePresets.has(preset.preset), preset.preset).toBe(true);
    }
  });

  it.each(expandedPresets)("generates a valid template for $preset", ({ preset, playerCount, assert }) => {
    const settings = createDefaultSettings();
    settings.preset = preset;
    settings.seed = 42;
    const normalized = normalizeSettings(settings);

    const template = generateTemplate(settings);
    const design = templateToDesign(template);

    expect(normalized.preset).toBe(preset);
    expect(design.playerCount).toBe(playerCount);
    expect(validateDesign(design).errors, preset).toEqual([]);
    assert?.(template, normalized);
  });
});
