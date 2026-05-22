import { describe, expect, it } from "vitest";
import { configHelp } from "../src/configHelp";
import { displayNameForSid, formatSidListForDisplay } from "../src/displayNames";

describe("config help suggestions", () => {
  it("offers a Blank suggestion for optional biome selectors", () => {
    expect(configHelp["zone.zoneBiome"]?.suggestions?.[0]).toEqual({ label: "Blank", value: "", description: "Clear this field" });
    expect(configHelp["zone.contentBiome"]?.suggestions?.[0]).toEqual({ label: "Blank", value: "", description: "Clear this field" });
    expect(configHelp["zone.metaObjectsBiome"]?.suggestions?.[0]).toEqual({ label: "Blank", value: "", description: "Clear this field" });
  });

  it("does not add Blank to required suggestion sets", () => {
    expect(configHelp["zone.layout"]?.suggestions?.[0]?.label).toBe("Spawn");
    expect(configHelp["connection.guardStrength"]?.suggestions?.some((suggestion) => suggestion.label === "Blank")).toBe(false);
  });

  it("formats internal template SIDs as readable labels", () => {
    expect(displayNameForSid("classic_template_pool_random_t2_item")).toBe("T2 Guarded Items");
    expect(displayNameForSid("classic_template_pool_random_unguarded_t3_unit_bank")).toBe("T3 Unguarded Unit Banks");
    expect(displayNameForSid("content_pool_general_resources_start_zone_poor")).toBe("Poor Starting Resources");
    expect(displayNameForSid("content_limits_side")).toBe("Standard Neutral Zone Preset");
    expect(displayNameForSid("content_limits_side_1_2")).toBe("Neutral Zone Between Player 1 and Player 2");
    expect(formatSidListForDisplay(["content_limits_side_1_2", "content_limits_side_2_4"])).toBe(
      "Neutral Zone Between Player 1 and Player 2, Neutral Zone Between Player 2 and Player 4"
    );
  });

  it("collapses the full player-border preset list into a readable label", () => {
    const allPlayerBorders = configHelp["zone.contentCountLimits"]?.suggestions?.find((suggestion) => suggestion.label === "Every Player Border")?.value;

    expect(typeof allPlayerBorders).toBe("string");
    expect(formatSidListForDisplay(String(allPlayerBorders).split("\n"))).toBe("Every Player-to-Player Neutral Zone Preset");
  });
});
