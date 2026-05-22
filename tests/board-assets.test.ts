import { describe, expect, it } from "vitest";
import {
  BOARD_CONNECTION_HANDLE_HIT_RADIUS,
  BOARD_CONNECTION_HANDLE_SIZE,
  SCHEMATIC_BOARD_BACKGROUND_HEIGHT,
  SCHEMATIC_BOARD_BACKGROUND_WIDTH,
  boardConnectionHandlePoint,
} from "../src/boardAssets";
import {
  boardZoneBadgeLabel,
  boardZoneBox,
  boardZoneDimensions,
  boardZoneFooterCityLabel,
  boardZoneFooterLayout,
  boardZoneFooterMarkers,
  boardZoneFooterName,
  boardZoneFooterStatusLabel,
  boardZoneNameY,
  boardZoneLayoutScale,
  boardZoneShortName,
} from "../src/designBoardGeometry";
import { createZone } from "../src/design";

describe("board asset mapping", () => {
  it("matches the schematic board background aspect ratio to the source image", () => {
    const width = 724;
    const height = Math.round((width * SCHEMATIC_BOARD_BACKGROUND_HEIGHT) / SCHEMATIC_BOARD_BACKGROUND_WIDTH);
    expect(height).toBe(543);
    expect(SCHEMATIC_BOARD_BACKGROUND_WIDTH / SCHEMATIC_BOARD_BACKGROUND_HEIGHT).toBeCloseTo(width / height, 5);
  });

  it("labels schematic zones with player and role codes", () => {
    expect(boardZoneBadgeLabel({ role: "Spawn", name: "Spawn-1", player: 1 })).toBe("S-1");
    expect(boardZoneBadgeLabel({ role: "Spawn", name: "Spawn-2", player: 2 })).toBe("S-2");
    expect(boardZoneBadgeLabel({ role: "Spawn", name: "Spawn-3", player: undefined })).toBe("S-3");
    expect(boardZoneBadgeLabel({ role: "Neutral", name: "Neutral-4", player: undefined })).toBe("N-4");
    expect(boardZoneBadgeLabel({ role: "Spawn", name: "Spawn-A", player: 1 })).toBe("S-1");
    expect(boardZoneBadgeLabel({ role: "Neutral", name: "Neutral-C", player: undefined })).toBe("N-C");
    expect(boardZoneBadgeLabel({ role: "Hub", name: "Hub", player: undefined })).toBe("Hub");
  });

  it("places the connection handle outside the zone body and keeps the hit target larger than the icon", () => {
    const zone = { role: "Neutral" as const, position: { x: 0.5, y: 0.5 } };
    const box = boardZoneBox(zone, 800, 600);
    const handle = boardConnectionHandlePoint(zone, 800, 600);

    expect(handle.x).toBeGreaterThan(box.right);
    expect(handle.y).toBe(box.top + 16);
    expect(BOARD_CONNECTION_HANDLE_HIT_RADIUS).toBeGreaterThanOrEqual(BOARD_CONNECTION_HANDLE_SIZE / 2);
  });

  it("scales schematic zone geometry with the configured zone size", () => {
    const baseZone = { role: "Neutral" as const, position: { x: 0.5, y: 0.5 }, size: 1 };
    const compactZone = { ...baseZone, size: 0.7 };
    const largeZone = { ...baseZone, size: 1.4 };
    const compactBox = boardZoneBox(compactZone, 800, 600);
    const baseBox = boardZoneBox(baseZone, 800, 600);
    const largeBox = boardZoneBox(largeZone, 800, 600);
    const compactHandle = boardConnectionHandlePoint(compactZone, 800, 600);
    const baseHandle = boardConnectionHandlePoint(baseZone, 800, 600);
    const largeHandle = boardConnectionHandlePoint(largeZone, 800, 600);

    expect(boardZoneDimensions(compactZone).width).toBeLessThan(boardZoneDimensions(baseZone).width);
    expect(boardZoneDimensions(largeZone).width).toBeGreaterThan(boardZoneDimensions(baseZone).width);
    expect(compactBox.width).toBeLessThan(baseBox.width);
    expect(compactBox.height).toBeLessThan(baseBox.height);
    expect(largeBox.width).toBeGreaterThan(baseBox.width);
    expect(largeBox.height).toBeGreaterThan(baseBox.height);
    expect(compactHandle.x).toBeLessThan(baseHandle.x);
    expect(largeHandle.x).toBeGreaterThan(baseHandle.x);
  });

  it("applies a small global downscale so close roads remain visible", () => {
    const zones = [
      { role: "Spawn" as const, position: { x: 0.2, y: 0.2 } },
      { role: "Neutral" as const, position: { x: 0.8, y: 0.8 } },
    ];

    expect(boardZoneLayoutScale(zones, 800, 600)).toBeCloseTo(0.96, 2);
  });

  it("formats schematic zone footer labels", () => {
    const quiet = createZone("zone-quiet", "Spawn-1", "Spawn", {
      player: 1,
      resourceDensityPercent: 100,
      resourcesValue: 40,
      resourcesValuePerArea: 4,
    });
    const busy = createZone("zone-ruins", "Neutral-R", "Neutral", {
      holdCity: true,
      neutralStackStrengthPercent: 180,
      neutralCastlesAsRuins: true,
    });

    expect(boardZoneFooterName("Spawn-1")).toBe("Spawn-1");
    expect(boardZoneFooterName("Neutral-12")).toBe("Neutral-12");
    expect(boardZoneFooterName("VeryLongZoneName")).toBe("VeryLongZoneN…");
    expect(boardZoneFooterCityLabel(0)).toBe("No cities");
    expect(boardZoneFooterCityLabel(1)).toBe("1 city");
    expect(boardZoneFooterCityLabel(3)).toBe("3 cities");
    expect(boardZoneFooterMarkers(quiet)).toEqual([]);
    expect(boardZoneFooterStatusLabel(quiet)).toBe("Standard");
    expect(boardZoneFooterMarkers(busy)).toEqual([
      { icon: "🏰", kind: "diamond", tone: "treasure" },
      { icon: "🏚", kind: "square", tone: "warning" },
      { icon: "⚔", kind: "ring", tone: "danger" },
    ]);
    expect(boardZoneFooterStatusLabel(busy)).toBe("🏰 · 🏚 · ⚔");
  });

  it("positions zone names above zones and gives footer markers room to read", () => {
    const box = boardZoneBox({ role: "Spawn", position: { x: 0.5, y: 0.5 } }, 800, 600);
    const footer = boardZoneFooterLayout(box);

    expect(boardZoneNameY(box)).toBeLessThan(box.top);
    expect(footer.left).toBe(box.left + 16);
    expect(footer.width).toBe(box.width - 32);
    expect(footer.height).toBe(36);
    expect(footer.top).toBe(box.bottom - 38);
    expect(footer.statusY - footer.cityY).toBeGreaterThan(10);
  });

  it("places lower-half zone names below the zone when a canvas height is provided", () => {
    const upperBox = boardZoneBox({ role: "Spawn", position: { x: 0.5, y: 0.2 } }, 800, 600);
    const lowerBox = boardZoneBox({ role: "Neutral", position: { x: 0.5, y: 0.72 } }, 800, 600);

    expect(boardZoneNameY(upperBox, 600)).toBeLessThan(upperBox.top);
    expect(boardZoneNameY(lowerBox, 600)).toBeGreaterThan(lowerBox.bottom);
  });

  it("keeps zone boxes inside the board and abbreviates zone labels consistently", () => {
    const box = boardZoneBox({ role: "Hub", position: { x: 0.99, y: 0.02 } }, 240, 180);

    expect(box.left).toBeGreaterThanOrEqual(10);
    expect(box.top).toBeGreaterThanOrEqual(10);
    expect(box.right).toBeLessThanOrEqual(230);
    expect(box.bottom).toBeLessThanOrEqual(170);
    expect(boardZoneShortName("Spawn-1")).toBe("S-1");
    expect(boardZoneShortName("Neutral-3")).toBe("N-3");
    expect(boardZoneShortName("Spawn-A")).toBe("S-1");
    expect(boardZoneShortName("Neutral-C")).toBe("N-C");
    expect(boardZoneShortName("VeryLongZoneName")).toBe("VeryLongZ...");
  });
});
