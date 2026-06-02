import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { templateToDesign } from "../src/design/conversion";
import { validateDesign } from "../src/design/validation";
import { parseRmgTemplate } from "../src/types";
import { expectDirectAndPortalGraphConnected } from "./template-invariants";

const templatePath = resolve(import.meta.dirname, "../generated/last-bastion-sevenfold-siege.rmg.json");
const attackerPlayers = [2, 3, 4, 5, 6, 7] as const;

describe("Last Bastion Sevenfold Siege template", () => {
  it("matches the requested 1v6 central-hold gauntlet layout", () => {
    const template = parseRmgTemplate(readFileSync(templatePath, "utf8"));
    const importedDesign = templateToDesign(template);
    const variant = template.variants?.[0];
    const zones = variant?.zones ?? [];
    const connections = variant?.connections ?? [];

    expect(template.name).toBe("Last Bastion Sevenfold Siege");
    expect(template.sizeX).toBe(240);
    expect(template.sizeZ).toBe(240);
    expect(template.displayWinCondition).toBe("win_condition_5");
    expect(template.gameRules?.winConditions?.cityHold).toBe(true);
    expect(template.gameRules?.winConditions?.cityHoldDays).toBe(90);
    expect(validateDesign(importedDesign).errors).toEqual([]);
    expect(zones).toHaveLength(31);
    expect(connections.filter((connection) => connection.connectionType === "Direct")).toHaveLength(30);
    expectDirectAndPortalGraphConnected(zones, connections);

    const spawnZones = zones.filter((zone) => zone.mainObjects?.some((object) => object.type === "Spawn"));
    expect(spawnZones.map((zone) => zone.name).sort()).toEqual(["Spawn-1", "Spawn-2", "Spawn-3", "Spawn-4", "Spawn-5", "Spawn-6", "Spawn-7"]);

    const bastion = zones.find((zone) => zone.name === "Spawn-1");
    expect(bastion?.size).toBe(2);
    expect(bastion?.layout).toBe("zone_layout_center");
    expect(bastion?.resourcesValue).toBe(160000);
    expect(bastion?.mainObjects?.[0]).toMatchObject({ type: "Spawn", spawn: "Player1" });
    expect(bastion?.mainObjects?.filter((object) => object.holdCityWinCon === true)).toHaveLength(1);
    expect(bastion?.mainObjects?.find((object) => object.holdCityWinCon === true)).toMatchObject({
      type: "City",
      owner: "Player1",
      buildingsConstructionSid: "ultra_rich_buildings_construction"
    });

    for (const player of attackerPlayers) {
      const spawn = zones.find((zone) => zone.name === `Spawn-${player}`);
      const n2 = zones.find((zone) => zone.name === `P${player}-N2`);
      const n3 = zones.find((zone) => zone.name === `P${player}-N3`);
      const n4 = zones.find((zone) => zone.name === `P${player}-N4`);
      const n5 = zones.find((zone) => zone.name === `P${player}-N5`);

      expect(spawn?.mainObjects?.[0]).toMatchObject({ type: "Spawn", spawn: `Player${player}` });
      expect([spawn?.size, n2?.size, n3?.size, n4?.size, n5?.size]).toEqual([0.48, 0.5, 0.64, 0.78, 0.95]);
      expect([spawn?.resourcesValue, n2?.resourcesValue, n3?.resourcesValue, n4?.resourcesValue, n5?.resourcesValue]).toEqual([12000, 18000, 30000, 46000, 68000]);
      expect([spawn?.resourcesValuePerArea, n2?.resourcesValuePerArea, n3?.resourcesValuePerArea, n4?.resourcesValuePerArea, n5?.resourcesValuePerArea]).toEqual([130, 150, 210, 300, 420]);
      expect([spawn?.guardMultiplier, n2?.guardMultiplier, n3?.guardMultiplier, n4?.guardMultiplier, n5?.guardMultiplier]).toEqual([1.08, 1.22, 1.36, 1.52, 1.7]);
      expect([9000, 17000, 28000, 40000, 56000]).toEqual(
        connections
          .filter((connection) => connection.name?.startsWith(`P${player}-`))
          .map((connection) => connection.guardValue)
      );
      expect(n3?.mainObjects?.[0]).toMatchObject({ type: "City", faction: { type: "Match", args: ["0", `Spawn-${player}`] } });
      expect(n5?.mainObjects?.[0]).toMatchObject({ type: "City", faction: { type: "Match", args: ["0", `Spawn-${player}`] } });
      expect(connections).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: `P${player}-S-N2`, from: `Spawn-${player}`, to: `P${player}-N2` }),
        expect.objectContaining({ name: `P${player}-N2-N3`, from: `P${player}-N2`, to: `P${player}-N3` }),
        expect.objectContaining({ name: `P${player}-N3-N4`, from: `P${player}-N3`, to: `P${player}-N4` }),
        expect.objectContaining({ name: `P${player}-N4-N5`, from: `P${player}-N4`, to: `P${player}-N5` }),
        expect.objectContaining({ name: `P${player}-N5-Bastion`, from: `P${player}-N5`, to: "Spawn-1" })
      ]));
    }

    const bastionMandatory = template.mandatoryContent?.find((group) => group.name === "mandatory_content_defender_bastion")?.content ?? [];
    expect(bastionMandatory).toEqual(expect.arrayContaining([
      expect.objectContaining({ sid: "mine_wood", isMine: true }),
      expect.objectContaining({ sid: "mine_ore", isMine: true }),
      expect.objectContaining({ sid: "mine_gold", isMine: true }),
      expect.objectContaining({ sid: "mine_crystals", isMine: true }),
      expect.objectContaining({ sid: "mine_mercury", isMine: true }),
      expect.objectContaining({ sid: "mine_gemstones", isMine: true }),
      expect.objectContaining({ sid: "market" }),
      expect.objectContaining({ sid: "mana_well" })
    ]));
  });
});
