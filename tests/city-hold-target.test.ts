import { describe, expect, it } from "vitest";
import { applyHoldCityTargetToVariant, pickGraphAwareHoldCityNeutralLetter } from "../src/generator/cityHoldTarget";
import type { NeutralZonePlan } from "../src/generator/neutralZonePlanner";
import type { Variant } from "../src/types";

describe("graph-aware City Hold target selection", () => {
  it("prefers the farther, more central target over a richer closer one", () => {
    const neutralZones = [
      { letter: "A", quality: "High", role: "Standard", castleCount: 1 },
      { letter: "B", quality: "Low", role: "Standard", castleCount: 1 }
    ] satisfies NeutralZonePlan[];
    const variant = buildVariant([
      "Spawn-1", "Spawn-2", "Neutral-A", "Neutral-B", "Mid"
    ], [
      ["Spawn-1", "Neutral-A"],
      ["Spawn-2", "Neutral-A"],
      ["Spawn-1", "Mid"],
      ["Spawn-2", "Mid"],
      ["Mid", "Neutral-B"]
    ]);

    expect(pickGraphAwareHoldCityNeutralLetter(neutralZones, variant)).toBe("B");
  });

  it("uses quality after distance fairness", () => {
    const neutralZones = [
      { letter: "A", quality: "High", role: "Standard", castleCount: 1 },
      { letter: "B", quality: "Low", role: "Standard", castleCount: 1 }
    ] satisfies NeutralZonePlan[];
    const variant = buildVariant([
      "Spawn-1", "Spawn-2", "Neutral-A", "Neutral-B"
    ], [
      ["Spawn-1", "Neutral-A"],
      ["Neutral-A", "Spawn-2"],
      ["Spawn-1", "Neutral-B"],
      ["Neutral-B", "Spawn-2"]
    ]);

    expect(pickGraphAwareHoldCityNeutralLetter(neutralZones, variant)).toBe("A");
  });

  it("uses castle presence after distance fairness and quality", () => {
    const neutralZones = [
      { letter: "A", quality: "Medium", role: "Standard", castleCount: 0 },
      { letter: "B", quality: "Medium", role: "Standard", castleCount: 1 }
    ] satisfies NeutralZonePlan[];
    const variant = buildVariant([
      "Spawn-1", "Spawn-2", "Neutral-A", "Neutral-B"
    ], [
      ["Spawn-1", "Neutral-A"],
      ["Neutral-A", "Spawn-2"],
      ["Spawn-1", "Neutral-B"],
      ["Neutral-B", "Spawn-2"]
    ]);

    expect(pickGraphAwareHoldCityNeutralLetter(neutralZones, variant)).toBe("B");
  });
});

describe("applyHoldCityTargetToVariant", () => {
  it("marks an existing City as the hold-city target", () => {
    const variant: Variant = {
      zones: [{ name: "Neutral-A", mainObjects: [{ type: "City" }] }],
      connections: []
    };

    applyHoldCityTargetToVariant(variant, "A");

    const city = variant.zones?.[0].mainObjects?.[0];
    expect(city?.holdCityWinCon).toBe(true);
    expect(city?.placement).toBe("Center");
    expect(city?.guardValue).toBeGreaterThanOrEqual(60000);
  });

  it("materializes a City when the target neutral zone has no castle", () => {
    const variant: Variant = {
      zones: [{ name: "Neutral-A", mainObjects: [] }],
      connections: []
    };

    applyHoldCityTargetToVariant(variant, "A");

    const mainObjects = variant.zones?.[0].mainObjects ?? [];
    expect(mainObjects).toHaveLength(1);
    expect(mainObjects[0].type).toBe("City");
    expect(mainObjects[0].holdCityWinCon).toBe(true);
  });

  it("clears stale hold-city markers from other zones", () => {
    const variant: Variant = {
      zones: [
        { name: "Neutral-A", mainObjects: [{ type: "City" }] },
        { name: "Neutral-B", mainObjects: [{ type: "City", holdCityWinCon: true }] }
      ],
      connections: []
    };

    applyHoldCityTargetToVariant(variant, "A");

    expect(variant.zones?.[0].mainObjects?.[0].holdCityWinCon).toBe(true);
    expect(variant.zones?.[1].mainObjects?.[0].holdCityWinCon).toBeUndefined();
  });
});

function buildVariant(zoneNames: string[], edges: Array<[string, string]>): Variant {
  return {
    zones: zoneNames.map((zoneName) => ({
      name: zoneName,
      mainObjects: zoneName.startsWith("Spawn-")
        ? [{ type: "Spawn", spawn: zoneName.replace("Spawn-", "Player") }]
        : zoneName.startsWith("Neutral-")
          ? [{ type: "City" }]
          : []
    })),
    connections: edges.map(([from, to]) => ({
      name: `${from}-${to}`,
      from,
      to,
      connectionType: "Direct"
    }))
  };
}
