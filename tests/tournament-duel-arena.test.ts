import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { templateToDesign } from "../src/design/conversion";
import { validateDesign } from "../src/design/validation";
import { parseRmgTemplate } from "../src/types";
import { expectDirectAndPortalGraphConnected } from "./template-invariants";

const templatePath = resolve(import.meta.dirname, "../generated/tournament-duel-arena.rmg.json");

describe("Tournament Duel Arena template", () => {
  it("matches all tournament, schedule, and zone layout requirements", () => {
    const template = parseRmgTemplate(readFileSync(templatePath, "utf8"));
    const importedDesign = templateToDesign(template);
    const variant = template.variants?.[0];
    const zones = variant?.zones ?? [];
    const connections = variant?.connections ?? [];

    // 1. Basic properties
    expect(template.name).toBe("Tournament Duel Arena");
    expect(template.gameMode).toBe("Tournament");
    expect(template.displayWinCondition).toBe("win_condition_6");
    expect(template.sizeX).toBe(176);
    expect(template.sizeZ).toBe(176);

    // 2. Win & Tournament rules
    const winConditions = template.gameRules?.winConditions;
    expect(winConditions?.tournament).toBe(true);
    expect(winConditions?.tournamentPointsToWin).toBe(7);
    expect(winConditions?.tournamentSaveArmy).toBe(true);

    // First fight on Week 3 Day 5 (Day 19)
    // Recurring every other week on Day 5 (e.g. Day 33, Day 47, Day 61, etc.)
    // Announce days: [14, 28, 42, 56, 70, 84, 98, 112, 126, 140, 154, 168, 182, 196, 210]
    // Days delay array: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5]
    expect(winConditions?.tournamentAnnounceDays).toEqual([
      14, 28, 42, 56, 70, 84, 98, 112, 126, 140, 154, 168, 182, 196, 210
    ]);
    expect(winConditions?.tournamentDays).toEqual([
      5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5
    ]);

    // 3. Design validation (graph connectivity, matching factions, etc.)
    const validation = validateDesign(importedDesign);
    expect(validation.errors).toEqual([]);
    expect(zones).toHaveLength(7);
    expect(connections).toHaveLength(6);
    expectDirectAndPortalGraphConnected(zones, connections);

    // 4. Center Zone verification
    const center = zones.find((zone) => zone.name === "Center");
    expect(center).toBeDefined();
    expect(center?.size).toBe(0.35);
    expect(center?.layout).toBe("zone_layout_center");
    expect(center?.guardMultiplier).toBe(3.5);

    // Connections to center have insanely high guards to block early invasion
    const centerConnections = connections.filter((conn) => conn.to === "Center");
    expect(centerConnections).toHaveLength(2);
    for (const conn of centerConnections) {
      expect(conn.guardValue).toBe(450000);
      expect(conn.guardZone).toBe("Center");
    }

    // 5. Spawn Zones verification
    const spawnA = zones.find((zone) => zone.name === "Spawn-A");
    const spawnB = zones.find((zone) => zone.name === "Spawn-B");
    expect(spawnA).toBeDefined();
    expect(spawnB).toBeDefined();
    expect(spawnA?.mainObjects?.[0]).toMatchObject({ type: "Spawn", spawn: "Player1" });
    expect(spawnB?.mainObjects?.[0]).toMatchObject({ type: "Spawn", spawn: "Player2" });

    // 6. Expansion Zones verification (medium farm, matched faction)
    const expA = zones.find((zone) => zone.name === "Expansion-A");
    const expB = zones.find((zone) => zone.name === "Expansion-B");
    expect(expA).toBeDefined();
    expect(expB).toBeDefined();

    expect(expA?.size).toBe(1.15);
    expect(expB?.size).toBe(1.15);
    expect(expA?.resourcesValue).toBe(24000);
    expect(expB?.resourcesValue).toBe(24000);

    expect(expA?.mainObjects?.[0]).toMatchObject({
      type: "City",
      faction: { type: "Match", args: ["0", "Spawn-A"] }
    });
    expect(expB?.mainObjects?.[0]).toMatchObject({
      type: "City",
      faction: { type: "Match", args: ["0", "Spawn-B"] }
    });

    // 7. Treasure Zones verification (high level gear farm)
    const treasureA = zones.find((zone) => zone.name === "Treasure-A");
    const treasureB = zones.find((zone) => zone.name === "Treasure-B");
    expect(treasureA).toBeDefined();
    expect(treasureB).toBeDefined();

    expect(treasureA?.size).toBe(1.4);
    expect(treasureB?.size).toBe(1.4);
    expect(treasureA?.guardedContentValue).toBe(900000);
    expect(treasureB?.guardedContentValue).toBe(900000);
    expect(treasureA?.resourcesValue).toBe(60000);
    expect(treasureB?.resourcesValue).toBe(60000);
  });
});
