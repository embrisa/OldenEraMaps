import { describe, expect, it } from "vitest";
import { computePowerDiagram, polygonArea, polygonCentroid, type WeightedSite } from "../src/voronoi";

describe("computePowerDiagram", () => {
  it("returns the full rectangle for a single site", () => {
    const sites: WeightedSite[] = [{ x: 50, y: 50, weight: 100 }];
    const cells = computePowerDiagram(sites, 100, 100);
    expect(cells).toHaveLength(1);
    expect(cells[0]).toHaveLength(4);
    expect(polygonArea(cells[0])).toBeCloseTo(10000, 1);
  });

  it("returns empty array for no sites", () => {
    expect(computePowerDiagram([], 100, 100)).toEqual([]);
  });

  it("splits space between two equal-weight sites", () => {
    const sites: WeightedSite[] = [
      { x: 25, y: 50, weight: 0 },
      { x: 75, y: 50, weight: 0 },
    ];
    const cells = computePowerDiagram(sites, 100, 100);
    expect(cells).toHaveLength(2);

    const a1 = polygonArea(cells[0]);
    const a2 = polygonArea(cells[1]);
    // Should be roughly equal halves
    expect(a1).toBeCloseTo(5000, -2);
    expect(a2).toBeCloseTo(5000, -2);
  });

  it("gives more area to higher-weight site", () => {
    const sites: WeightedSite[] = [
      { x: 25, y: 50, weight: 0 },
      { x: 75, y: 50, weight: 5000 },
    ];
    const cells = computePowerDiagram(sites, 100, 100);
    const a1 = polygonArea(cells[0]);
    const a2 = polygonArea(cells[1]);
    expect(a2).toBeGreaterThan(a1);
  });

  it("produces non-empty cells for three sites in a triangle", () => {
    const sites: WeightedSite[] = [
      { x: 50, y: 10, weight: 0 },
      { x: 10, y: 90, weight: 0 },
      { x: 90, y: 90, weight: 0 },
    ];
    const cells = computePowerDiagram(sites, 100, 100);
    expect(cells).toHaveLength(3);
    for (const cell of cells) {
      expect(cell.length).toBeGreaterThanOrEqual(3);
      expect(polygonArea(cell)).toBeGreaterThan(100);
    }
    // Total area should sum to the bounding rectangle
    const totalArea = cells.reduce((s, c) => s + polygonArea(c), 0);
    expect(totalArea).toBeCloseTo(10000, -1);
  });

  it("handles many sites without error", () => {
    const sites: WeightedSite[] = [];
    for (let i = 0; i < 20; i++) {
      sites.push({
        x: 10 + (i % 5) * 20,
        y: 10 + Math.floor(i / 5) * 25,
        weight: i * 100,
      });
    }
    const cells = computePowerDiagram(sites, 100, 100);
    expect(cells).toHaveLength(20);
    // Every cell should have non-negative area
    for (const cell of cells) {
      expect(polygonArea(cell)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("polygonCentroid", () => {
  it("returns center of a square", () => {
    const sq = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    const c = polygonCentroid(sq);
    expect(c.x).toBeCloseTo(5);
    expect(c.y).toBeCloseTo(5);
  });

  it("handles an empty polygon", () => {
    const c = polygonCentroid([]);
    expect(c.x).toBe(0);
    expect(c.y).toBe(0);
  });

  it("handles a single point", () => {
    const c = polygonCentroid([{ x: 7, y: 3 }]);
    expect(c.x).toBe(7);
    expect(c.y).toBe(3);
  });
});

describe("polygonArea", () => {
  it("computes area of a unit square", () => {
    const sq = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ];
    expect(polygonArea(sq)).toBeCloseTo(1);
  });

  it("returns 0 for degenerate polygons", () => {
    expect(polygonArea([])).toBe(0);
    expect(polygonArea([{ x: 0, y: 0 }])).toBe(0);
    expect(polygonArea([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBe(0);
  });
});
