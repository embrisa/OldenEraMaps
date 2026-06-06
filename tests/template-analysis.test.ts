import { describe, expect, it } from "vitest";
import { analyzeTemplate } from "../src/analysis/templateAnalysis";
import { buildBalancedRandomMapSettings, createBalancedRandomMapDraft } from "../src/balancedRandomMap";
import { generateTemplate } from "../src/generator";
import type { Connection, RmgTemplate, Zone } from "../src/types";

describe("template analysis", () => {
  it("scores a symmetric two-player map at 100 and reports a well-balanced finding", () => {
    const analysis = analyzeTemplate(buildTemplate({
      zones: [
        spawnZone("Spawn-1", "Player1"),
        spawnZone("Spawn-2", "Player2"),
        neutralCastleZone("Neutral-3")
      ],
      connections: [
        connection("Spawn-1", "Neutral-3"),
        connection("Spawn-2", "Neutral-3")
      ]
    }));

    expect(analysis.balanceApplicable).toBe(true);
    expect(analysis.balanceScore).toBe(100);
    expect(analysis.findings).toContainEqual(expect.objectContaining({
      severity: "positive",
      message: expect.stringContaining("well balanced")
    }));
    expect(analysis.summary).toMatchObject({
      zoneCount: 3,
      playerZoneCount: 2,
      neutralCastleZoneCount: 1,
      connectionCount: 2
    });
  });

  it("lowers the score and names the poorer player for lopsided starts", () => {
    const analysis = analyzeTemplate(buildTemplate({
      zones: [
        spawnZone("Spawn-1", "Player1", { guardedContentValue: 300000, unguardedContentValue: 45000, resourcesValue: 30000 }),
        spawnZone("Spawn-2", "Player2", { guardedContentValue: 150000, unguardedContentValue: 20000, resourcesValue: 10000 }),
        neutralCastleZone("Neutral-3")
      ],
      connections: [
        connection("Spawn-1", "Neutral-3"),
        connection("Spawn-2", "Neutral-3")
      ]
    }));

    expect(analysis.balanceScore).toBeLessThan(100);
    expect(analysis.findings[0]).toEqual(expect.objectContaining({
      severity: "warning",
      message: expect.stringContaining("Player 2")
    }));
  });

  it("flags uneven neutral castle access", () => {
    const analysis = analyzeTemplate(buildTemplate({
      zones: [
        spawnZone("Spawn-1", "Player1"),
        spawnZone("Spawn-2", "Player2"),
        neutralCastleZone("Neutral-3")
      ],
      connections: [
        connection("Spawn-1", "Neutral-3")
      ]
    }));

    expect(analysis.balanceApplicable).toBe(true);
    expect(analysis.findings).toContainEqual(expect.objectContaining({
      severity: "warning",
      message: expect.stringContaining("Player 2 cannot reach a neutral city")
    }));
  });

  it("treats single-player or malformed templates as not applicable without throwing", () => {
    const analysis = analyzeTemplate(buildTemplate({
      zones: [spawnZone("Spawn-1", "Player1")],
      connections: []
    }));
    const emptyAnalysis = analyzeTemplate({ name: "Empty", sizeX: 96, sizeZ: 96, variants: [{ zones: [], connections: [] }] });

    expect(analysis.balanceApplicable).toBe(false);
    expect(analysis.balanceScore).toBeNull();
    expect(analysis.findings[0]?.message).toContain("at least two player spawn zones");
    expect(emptyAnalysis.balanceApplicable).toBe(false);
    expect(emptyAnalysis.balanceScore).toBeNull();
  });

  it("analyzes generated balanced random maps within expected ranges", () => {
    const draft = createBalancedRandomMapDraft();
    draft.playerCount = 4;
    draft.neutralZoneCount = 6;
    draft.seed = "7";
    const template = generateTemplate(buildBalancedRandomMapSettings(draft));
    const analysis = analyzeTemplate(template);

    expect(analysis.balanceApplicable).toBe(true);
    expect(analysis.balanceScore).toBeGreaterThanOrEqual(80);
    expect(analysis.balanceScore).toBeLessThanOrEqual(100);
    expect(analysis.playerStarts).toHaveLength(4);
    expect(analysis.summary.zoneCount).toBeGreaterThanOrEqual(analysis.summary.playerZoneCount + analysis.summary.neutralCastleZoneCount);
    expect(analysis.zoneRows.some((row) => row.role === "Player")).toBe(true);
  });
});

function buildTemplate({ zones, connections }: { zones: Zone[]; connections: Connection[] }): RmgTemplate {
  return {
    name: "Analysis Test",
    sizeX: 96,
    sizeZ: 96,
    variants: [{ zones, connections }]
  };
}

function spawnZone(name: string, player: string, values: Partial<Zone> = {}): Zone {
  return {
    name,
    layout: "zone_layout_spawns",
    guardedContentValue: 300000,
    unguardedContentValue: 45000,
    resourcesValue: 30000,
    mainObjects: [{ type: "Spawn", spawn: player }],
    ...values
  };
}

function neutralCastleZone(name: string): Zone {
  return {
    name,
    layout: "zone_layout_treasure_zone",
    guardedContentValue: 180000,
    unguardedContentValue: 20000,
    resourcesValue: 10000,
    mainObjects: [{ type: "City" }]
  };
}

function connection(from: string, to: string): Connection {
  return { name: `${from}-${to}`, from, to, connectionType: "Direct" };
}
