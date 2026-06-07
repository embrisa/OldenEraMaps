import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  collectRmgDiagnostics,
  recommendGuardRewardScaling,
  recommendTemplateSizeAndPacing,
  validateCityHoldObjective,
  validateTemplateStructure
} from "../src/rmgDiagnostics";
import { parseRmgTemplate, type RmgTemplate } from "../src/types";

const fixtureDir = join(process.cwd(), "tests/fixtures/rmg-validation");

describe("rmg diagnostics", () => {
  it("accepts known-safe structural sizes", () => {
    for (const size of [160, 176, 208]) {
      const template = minimalTemplate({ sizeX: size, sizeZ: size });
      expect(validateTemplateStructure(template).filter((diagnostic) => diagnostic.code === "size_grid_invalid")).toEqual([]);
    }
  });

  it("rejects non-16 grid sizes and flags 214x214 as suspicious", () => {
    const template = minimalTemplate({ sizeX: 214, sizeZ: 214 });
    const diagnostics = validateTemplateStructure(template);

    expect(diagnostics).toContainEqual(expect.objectContaining({ code: "size_grid_invalid", severity: "error" }));
    expect(diagnostics).toContainEqual(expect.objectContaining({ code: "size_214_suspicious", severity: "warning" }));
  });

  it("accepts a valid random-faction hold city", () => {
    const template = minimalTemplate({
      displayWinCondition: "win_condition_5",
      gameRules: { winConditions: { cityHold: true, cityHoldDays: 6 } },
      variants: [{
        zones: [
          { name: "Spawn-1", mainObjects: [{ type: "Spawn", spawn: "Player1" }] },
          { name: "Spawn-2", mainObjects: [{ type: "Spawn", spawn: "Player2" }] },
          { name: "Center", mainObjects: [{ type: "City", holdCityWinCon: true, faction: { type: "FromList", args: [] } }] }
        ],
        connections: [
          { name: "Spawn-1-Center", from: "Spawn-1", to: "Center", connectionType: "Direct" },
          { name: "Spawn-2-Center", from: "Spawn-2", to: "Center", connectionType: "Direct" }
        ]
      }]
    });

    expect(validateCityHoldObjective(template)).toEqual([]);
  });

  it("warns when a hold-city marker remains after City Hold is disabled", () => {
    const template = minimalTemplate({
      displayWinCondition: "win_condition_1",
      variants: [{
        zones: [
          { name: "Center", mainObjects: [{ type: "City", holdCityWinCon: true }] }
        ],
        connections: []
      }]
    });

    expect(validateCityHoldObjective(template)).toContainEqual(expect.objectContaining({
      code: "city_hold_stale_target",
      severity: "warning"
    }));
  });

  it("recommends BattleCity sizes and pacing retests", () => {
    const template = loadFixture("valid-battlecity-2p-160.rmg.json");
    const recommended = recommendTemplateSizeAndPacing(template);
    expect(recommended).toEqual([]);

    const oversized = structuredClone(template);
    oversized.sizeX = 208;
    oversized.sizeZ = 208;
    expect(recommendTemplateSizeAndPacing(oversized)).toContainEqual(expect.objectContaining({
      code: "size_recommendation_duel",
      severity: "warning"
    }));
  });

  it("warns when high-tier rewards do not have matching late guard scaling", () => {
    const template = loadFixture("valid-battlecity-2p-160.rmg.json");
    template.mandatoryContent ??= [];
    template.mandatoryContent[0]!.content = [{ sid: "random_item_legendary" }];
    const center = template.variants?.[0].zones?.find((zone) => zone.name === "Center");
    if (center) center.guardWeeklyIncrement = 0.2;
    for (const connection of template.variants?.[0].connections ?? []) {
      if (connection.name?.endsWith("-Center")) connection.guardWeeklyIncrement = 0.2;
    }

    expect(recommendGuardRewardScaling(template)).toContainEqual(expect.objectContaining({
      code: "guard_reward_scaling_low",
      severity: "warning"
    }));
  });

  it("keeps concrete entity references on diagnostics", () => {
    const diagnostics = collectRmgDiagnostics(loadFixture("invalid-road-missing-connection.rmg.json"));
    expect(diagnostics.diagnostics).toContainEqual(expect.objectContaining({
      code: "road_missing_connection",
      zoneName: "Spawn-1",
      roadEndpoint: "Missing-Connection"
    }));
  });
});

describe("rmg fixture regression pack", () => {
  const validFixtures = [
    "valid-battlecity-2p-160.rmg.json",
    "valid-batthlehem-3p-208.rmg.json"
  ] as const;

  const invalidFixtures = [
    ["invalid-empty-zone-crossroads.rmg.json", "crossroads_empty_zone"],
    ["invalid-city-hold-no-city.rmg.json", "city_hold_missing_city"],
    ["invalid-city-hold-only-ruins.rmg.json", "city_hold_missing_city"],
    ["invalid-missing-mandatory-content-ref.rmg.json", "zone_missing_mandatory_content"],
    ["invalid-missing-content-count-limit-ref.rmg.json", "zone_missing_content_count_limit"],
    ["invalid-road-missing-connection.rmg.json", "road_missing_connection"],
    ["invalid-branch-third-mandatory-not-cloned.rmg.json", "branch_mandatory_content_mismatch"],
    ["invalid-branch-wrong-spawn-match.rmg.json", "branch_faction_match_mismatch"]
  ] as const;

  it.each(validFixtures)("keeps %s free of blocking diagnostics", (fixtureName) => {
    const diagnostics = collectRmgDiagnostics(loadFixture(fixtureName));
    expect(diagnostics.errors, fixtureName).toEqual([]);
  });

  it.each(invalidFixtures)("reports %s with code %s", (fixtureName, code) => {
    const diagnostics = collectRmgDiagnostics(loadFixture(fixtureName));
    expect(diagnostics.diagnostics.some((diagnostic) => diagnostic.code === code), fixtureName).toBe(true);
  });
});

function loadFixture(fileName: string): RmgTemplate {
  return parseRmgTemplate(readFileSync(join(fixtureDir, fileName), "utf8"));
}

function minimalTemplate(overrides: Partial<RmgTemplate>): RmgTemplate {
  return {
    name: "Minimal Template",
    displayWinCondition: "win_condition_1",
    sizeX: 160,
    sizeZ: 160,
    variants: [{ zones: [], connections: [] }],
    ...overrides
  };
}
