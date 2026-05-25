import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { templateToDesign } from "../src/design/conversion";
import { validateDesign } from "../src/design/validation";
import { parseRmgTemplate } from "../src/types";
import { expectDirectAndPortalGraphConnected } from "./template-invariants";

const templatePath = resolve(import.meta.dirname, "../generated/4-player-gauntlet-city-hold.rmg.json");

describe("4-player gauntlet city hold template", () => {
  it("matches the requested private-gauntlet city-hold layout", () => {
    const template = parseRmgTemplate(readFileSync(templatePath, "utf8"));
    const importedDesign = templateToDesign(template);
    const variant = template.variants?.[0];
    const zones = variant?.zones ?? [];
    const connections = variant?.connections ?? [];

    expect(template.sizeX).toBe(200);
    expect(template.sizeZ).toBe(200);
    expect(template.displayWinCondition).toBe("win_condition_5");
    expect(template.gameRules?.winConditions?.cityHold).toBe(true);
    expect(template.gameRules?.winConditions?.cityHoldDays).toBe(40);
    expect(validateDesign(importedDesign).errors).toEqual([]);
    expect(zones).toHaveLength(21);
    expect(connections.filter((connection) => connection.connectionType === "Direct")).toHaveLength(20);
    expectDirectAndPortalGraphConnected(zones, connections);

    const center = zones.find((zone) => zone.name === "Center");
    expect(center?.mainObjects?.filter((object) => object.holdCityWinCon === true)).toHaveLength(1);
    expect(center?.mainObjects?.some((object) => object.type === "Ruins")).toBe(true);

    for (let player = 1; player <= 4; player++) {
      const spawn = zones.find((zone) => zone.name === `Spawn-${player}`);
      const n2 = zones.find((zone) => zone.name === `P${player}-N2`);
      const n3 = zones.find((zone) => zone.name === `P${player}-N3`);
      const n4 = zones.find((zone) => zone.name === `P${player}-N4`);
      const n5 = zones.find((zone) => zone.name === `P${player}-N5`);

      expect(spawn?.layout).toBe("zone_layout_sides");
      expect(spawn?.mainObjects?.[0]).toMatchObject({ type: "Spawn", spawn: `Player${player}` });
      expect(spawn?.mandatoryContent).toEqual([`mandatory_content_p${player}_s1`]);
      expect([spawn?.size, n2?.size, n3?.size, n4?.size, n5?.size]).toEqual([0.55, 0.72, 0.86, 1, 1.25]);

      expect(n3?.mainObjects?.[0]).toMatchObject({
        type: "City",
        faction: { type: "Match", args: ["0", `Spawn-${player}`] }
      });
      expect(n5?.mainObjects?.[0]).toMatchObject({
        type: "City",
        faction: { type: "Match", args: ["0", `Spawn-${player}`] }
      });
      expect(n2?.zoneBiome).toEqual({ type: "MatchZone", args: [`Spawn-${player}`] });
      expect(n4?.zoneBiome).toEqual({ type: "MatchZone", args: [`Spawn-${player}`] });

      expect(connections).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: `P${player}-S1-N2`, from: `Spawn-${player}`, to: `P${player}-N2` }),
        expect.objectContaining({ name: `P${player}-N2-N3`, from: `P${player}-N2`, to: `P${player}-N3` }),
        expect.objectContaining({ name: `P${player}-N3-N4`, from: `P${player}-N3`, to: `P${player}-N4` }),
        expect.objectContaining({ name: `P${player}-N4-N5`, from: `P${player}-N4`, to: `P${player}-N5` }),
        expect.objectContaining({ name: `P${player}-N5-Center`, from: `P${player}-N5`, to: "Center" })
      ]));
    }

    const spawnMandatory = template.mandatoryContent?.find((group) => group.name === "mandatory_content_p1_s1")?.content ?? [];
    expect(spawnMandatory).toEqual(expect.arrayContaining([
      expect.objectContaining({ sid: "mine_wood", isMine: true }),
      expect.objectContaining({ sid: "mine_ore", isMine: true })
    ]));
  });
});
