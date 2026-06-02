import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { templateToDesign } from "../src/design/conversion";
import { validateDesign } from "../src/design/validation";
import { parseRmgTemplate } from "../src/types";
import { expectDirectAndPortalGraphConnected } from "./template-invariants";

const templatePath = resolve(import.meta.dirname, "../generated/duel-gauntlet-city-hold.rmg.json");

describe("Duel Gauntlet City Hold template", () => {
  it("matches the requested 1v1 four-zone gauntlet city-hold layout", () => {
    const template = parseRmgTemplate(readFileSync(templatePath, "utf8"));
    const importedDesign = templateToDesign(template);
    const variant = template.variants?.[0];
    const zones = variant?.zones ?? [];
    const connections = variant?.connections ?? [];

    expect(template.name).toBe("Duel Gauntlet City Hold");
    expect(template.sizeX).toBe(176);
    expect(template.sizeZ).toBe(176);
    expect(template.displayWinCondition).toBe("win_condition_5");
    expect(template.gameRules?.winConditions?.cityHold).toBe(true);
    expect(template.gameRules?.winConditions?.cityHoldDays).toBe(50);
    expect(validateDesign(importedDesign).errors).toEqual([]);
    expect(zones).toHaveLength(9);
    expect(connections.filter((connection) => connection.connectionType === "Direct")).toHaveLength(8);
    expectDirectAndPortalGraphConnected(zones, connections);

    const center = zones.find((zone) => zone.name === "Center");
    expect(center?.size).toBe(1.08);
    expect(center?.guardedContentValue).toBe(300000);
    expect(center?.guardedContentValuePerArea).toBe(2400);
    expect(center?.mandatoryContent ?? []).toHaveLength(0);
    expect(center?.mainObjects?.filter((object) => object.holdCityWinCon === true)).toHaveLength(1);
    expect(center?.mainObjects?.[0]).toMatchObject({
      type: "City",
      guardValue: 70000,
      buildingsConstructionSid: "ultra_rich_buildings_construction",
      holdCityWinCon: true
    });

    for (const player of [1, 2]) {
      const spawn = zones.find((zone) => zone.name === `Spawn-${player}`);
      const n2 = zones.find((zone) => zone.name === `P${player}-N2`);
      const n3 = zones.find((zone) => zone.name === `P${player}-N3`);
      const n4 = zones.find((zone) => zone.name === `P${player}-N4`);

      expect(spawn?.mainObjects?.[0]).toMatchObject({ type: "Spawn", spawn: `Player${player}` });
      expect(n3?.mainObjects ?? []).toHaveLength(0);
      expect(n4?.mainObjects?.[0]).toMatchObject({
        type: "City",
        faction: { type: "Match", args: ["0", `Spawn-${player}`] },
        buildingsConstructionSid: "rich_buildings_construction"
      });
      expect([spawn?.size, n2?.size, n3?.size, n4?.size]).toEqual([0.68, 0.86, 1.08, 1.38]);
      expect([spawn?.resourcesValue, n2?.resourcesValue, n3?.resourcesValue, n4?.resourcesValue]).toEqual([12000, 24000, 38000, 62000]);
      expect([spawn?.resourcesValuePerArea, n2?.resourcesValuePerArea, n3?.resourcesValuePerArea, n4?.resourcesValuePerArea]).toEqual([130, 190, 260, 390]);
      expect([spawn?.guardMultiplier, n2?.guardMultiplier, n3?.guardMultiplier, n4?.guardMultiplier]).toEqual([1.08, 1.32, 1.46, 1.62]);
      expect([10000, 22000, 34000, 58000]).toEqual(
        connections
          .filter((connection) => connection.name?.startsWith(`P${player}-`))
          .map((connection) => connection.guardValue)
      );

      expect(connections).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: `P${player}-S1-N2`, from: `Spawn-${player}`, to: `P${player}-N2` }),
        expect.objectContaining({ name: `P${player}-N2-N3`, from: `P${player}-N2`, to: `P${player}-N3` }),
        expect.objectContaining({ name: `P${player}-N3-N4`, from: `P${player}-N3`, to: `P${player}-N4` }),
        expect.objectContaining({ name: `P${player}-N4-Center`, from: `P${player}-N4`, to: "Center" })
      ]));
    }

    const spawnMandatory = template.mandatoryContent?.find((group) => group.name === "mandatory_content_p1_s1")?.content ?? [];
    expect(spawnMandatory).toEqual(expect.arrayContaining([
      expect.objectContaining({ sid: "mine_wood", isMine: true }),
      expect.objectContaining({ sid: "mine_ore", isMine: true }),
      expect.objectContaining({ sid: "market" })
    ]));
  });
});
