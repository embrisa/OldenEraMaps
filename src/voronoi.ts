import type { Point } from "./types";

export interface WeightedSite {
  x: number;
  y: number;
  weight: number;
}

export type Polygon = Point[];

/**
 * Compute a power diagram (additively weighted Voronoi) for the given sites,
 * clipped to the rectangle [0, 0] × [width, height].
 *
 * Each site's cell is the set of points closer to that site in the
 * power-distance metric: d_pow(p, s) = |p - s|² - s.weight
 *
 * Returns one polygon per site (may be empty if the site is fully occluded).
 */
export function computePowerDiagram(
  sites: WeightedSite[],
  width: number,
  height: number
): Polygon[] {
  if (sites.length === 0) return [];
  if (sites.length === 1) {
    return [
      [
        { x: 0, y: 0 },
        { x: width, y: 0 },
        { x: width, y: height },
        { x: 0, y: height },
      ],
    ];
  }

  // Initial clip rectangle as polygon (CCW)
  const clipRect: Polygon = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];

  const result: Polygon[] = [];

  for (let i = 0; i < sites.length; i++) {
    let cell = clipRect.slice();
    const si = sites[i];

    for (let j = 0; j < sites.length; j++) {
      if (i === j) continue;
      if (cell.length === 0) break;
      const sj = sites[j];
      // Clip cell to the half-plane where power-distance to si <= power-distance to sj
      // Power bisector: 2(sj.x-si.x)*x + 2(sj.y-si.y)*y = (sj.x²+sj.y²-si.x²-si.y²) - (sj.weight-si.weight)
      cell = clipPolygonByHalfPlane(cell, si, sj);
    }

    result.push(cell);
  }

  return result;
}

/**
 * Clip a convex polygon to the half-plane where the power distance
 * to site `a` is less than or equal to the power distance to site `b`.
 *
 * The bisector line for power distance is:
 *   2(bx-ax)*x + 2(by-ay)*y <= (bx²+by² - ax²-ay²) - (bw - aw)
 *
 * We keep the side containing site `a`.
 */
function clipPolygonByHalfPlane(
  poly: Polygon,
  a: WeightedSite,
  b: WeightedSite
): Polygon {
  if (poly.length === 0) return poly;

  // Normal vector pointing from b toward a side
  const nx = 2 * (b.x - a.x);
  const ny = 2 * (b.y - a.y);
  const d =
    b.x * b.x +
    b.y * b.y -
    a.x * a.x -
    a.y * a.y -
    (b.weight - a.weight);

  // Keep points where nx*x + ny*y <= d  (i.e. closer to a in power metric)
  const result: Point[] = [];
  const n = poly.length;

  for (let i = 0; i < n; i++) {
    const curr = poly[i];
    const next = poly[(i + 1) % n];
    const currVal = nx * curr.x + ny * curr.y - d;
    const nextVal = nx * next.x + ny * next.y - d;
    const currInside = currVal <= 1e-10;
    const nextInside = nextVal <= 1e-10;

    if (currInside) {
      result.push(curr);
    }

    if (currInside !== nextInside) {
      // Edge crosses the bisector — compute intersection
      const t = currVal / (currVal - nextVal);
      result.push({
        x: curr.x + t * (next.x - curr.x),
        y: curr.y + t * (next.y - curr.y),
      });
    }
  }

  return result;
}

/**
 * Compute the centroid of a polygon. Returns the center of the bounding box
 * if the polygon is degenerate (area ≈ 0).
 */
export function polygonCentroid(poly: Polygon): Point {
  if (poly.length === 0) return { x: 0, y: 0 };
  if (poly.length <= 2) {
    const sx = poly.reduce((s, p) => s + p.x, 0);
    const sy = poly.reduce((s, p) => s + p.y, 0);
    return { x: sx / poly.length, y: sy / poly.length };
  }

  let area = 0;
  let cx = 0;
  let cy = 0;

  for (let i = 0; i < poly.length; i++) {
    const curr = poly[i];
    const next = poly[(i + 1) % poly.length];
    const cross = curr.x * next.y - next.x * curr.y;
    area += cross;
    cx += (curr.x + next.x) * cross;
    cy += (curr.y + next.y) * cross;
  }

  area *= 0.5;
  if (Math.abs(area) < 1e-12) {
    const sx = poly.reduce((s, p) => s + p.x, 0);
    const sy = poly.reduce((s, p) => s + p.y, 0);
    return { x: sx / poly.length, y: sy / poly.length };
  }

  return { x: cx / (6 * area), y: cy / (6 * area) };
}

/**
 * Compute the area of a simple polygon using the shoelace formula.
 */
export function polygonArea(poly: Polygon): number {
  if (poly.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < poly.length; i++) {
    const curr = poly[i];
    const next = poly[(i + 1) % poly.length];
    area += curr.x * next.y - next.x * curr.y;
  }
  return Math.abs(area) * 0.5;
}
