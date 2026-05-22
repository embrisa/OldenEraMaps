export { generateTemplate, serializeTemplate } from "./generator/templateGenerator";
export type { Point, Zone } from "./types";

import type { Point, Zone } from "./types";

export function getZonePosition(zone: Zone): Point {
  return zone.generatorPosition ?? { x: 0.5, y: 0.5 };
}
