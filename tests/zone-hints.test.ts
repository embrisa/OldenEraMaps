import { describe, expect, it } from "vitest";
import { createZone } from "../src/design";
import { zoneHoverSections } from "../src/components/zoneHoverContent";
import { zoneBoardMarkers, zoneHints, zoneHintStyle } from "../src/zoneHints";

describe("zone hints", () => {
  it("summarizes size, guard, resources, and structure density", () => {
    const zone = createZone("zone-x", "Neutral-X", "Neutral", {
      size: 1.4,
      neutralStackStrengthPercent: 150,
      guardMultiplier: 1.5,
      guardWeeklyIncrement: 0.4,
      resourceDensityPercent: 180,
      resourcesValue: 120,
      resourcesValuePerArea: 12,
      structureDensityPercent: 150,
    });

    const hints = zoneHints(zone);

    expect(hints.map((hint) => hint.label)).toEqual(expect.arrayContaining([
      "Large",
      "Brutal guards",
      "Resource heavy",
      "Structure dense",
      "Cities",
    ]));
    expect(zoneHintStyle(zone).border).toBe("#ff8877");
  });

  it("shows only notable markers on the schematic board", () => {
    const quiet = createZone("zone-quiet", "Spawn-A", "Spawn", {
      player: 1,
      resourceDensityPercent: 100,
      resourcesValue: 40,
      resourcesValuePerArea: 4,
    });
    expect(zoneBoardMarkers(quiet)).toEqual([]);

    const busy = createZone("zone-busy", "Neutral-Y", "Neutral", {
      size: 1.4,
      neutralStackStrengthPercent: 150,
      guardMultiplier: 1.5,
      resourceDensityPercent: 100,
      resourcesValue: 40,
      resourcesValuePerArea: 4,
      holdCity: true,
      roads: false,
      footholds: false,
      naturalExpansion: true,
      neutralCastlesAsRuins: true,
    });

    const markerIds = zoneBoardMarkers(busy).map((marker) => marker.hint.id);
    expect(markerIds).toEqual(["hold-city", "ruins", "natural-expansion"]);
    expect(markerIds).toHaveLength(3);
    expect(markerIds).not.toContain("guards");
    expect(markerIds).not.toContain("structures");
  });

  it("focuses a single hint in the hover card when a board marker is targeted", () => {
    const zone = createZone("zone-hold", "Neutral-H", "Neutral", { holdCity: true });
    const sections = zoneHoverSections(zone, "hold-city");
    expect(sections[0]?.title).toBe("Hint");
    expect(sections[0]?.items[0]?.label).toBe("Hold city");
  });

  it("marks light, sparse, and rule-specific zones without losing baseline hints", () => {
    const zone = createZone("zone-y", "Neutral-Y", "Neutral", {
      size: 0.7,
      neutralStackStrengthPercent: 50,
      guardMultiplier: 0.8,
      guardWeeklyIncrement: 0,
      resourceDensityPercent: 45,
      resourcesValue: 12,
      resourcesValuePerArea: 1,
      structureDensityPercent: 40,
      castleCount: 2,
      neutralCastlesAsRuins: true,
      holdCity: true,
      roads: false,
      footholds: false,
    });

    const hints = zoneHints(zone);

    expect(hints.map((hint) => hint.label)).toEqual(expect.arrayContaining([
      "Compact",
      "Light guards",
      "Resource light",
      "Sparse structures",
      "Neutral ruins",
      "Hold city",
      "No roads",
      "No footholds",
    ]));
    expect(zoneHintStyle(zone).border).toBe("#8fdb85");
  });

  it("keeps normal guard zones visually distinct from stronger and lighter ones", () => {
    const zone = createZone("zone-normal", "Neutral-N", "Neutral", {
      neutralStackStrengthPercent: 100,
      guardMultiplier: 1,
      guardWeeklyIncrement: 0.4,
    });

    expect(zoneHintStyle(zone).border).toBe("#8dbde8");
  });

  it("spreads common generated guard profiles across green, orange, and red", () => {
    const spawnLike = createZone("zone-spawn", "Spawn-1", "Spawn", {
      quality: "Low",
      neutralStackStrengthPercent: 100,
      guardMultiplier: 1,
      guardWeeklyIncrement: 0.2,
    });
    const mediumNeutralLike = createZone("zone-medium", "Neutral-M", "Neutral", {
      neutralStackStrengthPercent: 100,
      guardMultiplier: 1.4,
      guardWeeklyIncrement: 0.2,
    });
    const highNeutralLike = createZone("zone-high", "Neutral-H", "Neutral", {
      neutralStackStrengthPercent: 100,
      guardMultiplier: 1.8,
      guardWeeklyIncrement: 0.2,
    });

    expect(zoneHints(spawnLike).find((hint) => hint.id === "guards")?.label).toBe("Light guards");
    expect(zoneHintStyle(spawnLike).border).toBe("#8fdb85");

    expect(zoneHints(mediumNeutralLike).find((hint) => hint.id === "guards")?.label).toBe("Tough guards");
    expect(zoneHintStyle(mediumNeutralLike).border).toBe("#ffc46b");

    expect(zoneHints(highNeutralLike).find((hint) => hint.id === "guards")?.label).toBe("Brutal guards");
    expect(zoneHintStyle(highNeutralLike).border).toBe("#ff8877");
  });
});
