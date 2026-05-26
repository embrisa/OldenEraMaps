import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { templateToDesign } from "../src/design/conversion";
import { validateDesign } from "../src/design/validation";
import { parseRmgTemplate } from "../src/types";
import { expectDirectAndPortalGraphConnected } from "./template-invariants";

const packDir = resolve(import.meta.dirname, "../generated/player-size-map-pack");

const mapCases = [
  ["2p-twin-crown-rift.rmg.json", 2, "Twin Crown Rift"],
  ["3p-obsidian-triad.rmg.json", 3, "Obsidian Triad"],
  ["4p-compass-keep.rmg.json", 4, "Compass Keep"],
  ["5p-starfall-web.rmg.json", 5, "Starfall Web"],
  ["6p-iron-petal-ring.rmg.json", 6, "Iron Petal Ring"],
  ["7p-sevenfold-ladder.rmg.json", 7, "Sevenfold Ladder"],
  ["8p-octant-storm.rmg.json", 8, "Octant Storm"]
] as const;

describe("player-size generated map pack", () => {
  it("contains one rmg template for every player count from 2 through 8", () => {
    const files = readdirSync(packDir).filter((fileName) => fileName.endsWith(".rmg.json")).sort();

    expect(files).toEqual(mapCases.map(([fileName]) => fileName).sort());
  });

  it.each(mapCases)("%s is structurally valid and capped at 2 heroes", (fileName, playerCount, templateName) => {
    const template = parseRmgTemplate(readFileSync(join(packDir, fileName), "utf8"));
    const design = templateToDesign(template);
    const zones = template.variants?.[0]?.zones ?? [];
    const connections = template.variants?.[0]?.connections ?? [];
    const spawnPlayers = zones
      .filter((zone) => zone.name.startsWith("Spawn-"))
      .map((zone) => Number(zone.mainObjects?.find((object) => object.type === "Spawn")?.spawn?.replace("Player", "")))
      .sort((a, b) => a - b);

    expect(template.name).toBe(templateName);
    expect(template.description).toContain("Strict 2-hero limit");
    expect(template.gameRules?.heroCountMin).toBe(2);
    expect(template.gameRules?.heroCountMax).toBe(2);
    expect(template.gameRules?.heroCountIncrement).toBe(0);
    expect(spawnPlayers).toEqual(Array.from({ length: playerCount }, (_, index) => index + 1));
    expect(zones.length).toBeLessThanOrEqual(32);
    expect(validateDesign(design).errors).toEqual([]);
    expectDirectAndPortalGraphConnected(zones, connections);
  });
});
