import type { Point } from "./types.ts";

export interface BoardSlot {
  id: string;
  index: number;
  row: number;
  column: number;
  position: Point;
}

const BOARD_SLOT_COLUMNS = 7;
const BOARD_SLOT_ROWS = 5;
const BOARD_SLOT_MIN_X = 0.18;
const BOARD_SLOT_MAX_X = 0.82;
const BOARD_SLOT_MIN_Y = 0.22;
const BOARD_SLOT_MAX_Y = 0.78;
const SLOT_EPSILON = 0.000001;

const slots = createBoardSlots();

export function boardSlots(): BoardSlot[] {
  return slots;
}

export function snapPointToBoardSlot(point: Point): Point {
  return nearestBoardSlot(point).position;
}

export function pointBoardSlotIndex(point: Point): number {
  return nearestBoardSlot(point).index;
}

export function findOpenBoardSlotPosition(existing: Point[]): Point {
  const occupied = new Set(existing.map((point) => nearestBoardSlot(point).index));
  const available = slots.filter((slot) => !occupied.has(slot.index));
  if (available.length === 0) return nearestBoardSlot({ x: 0.5, y: 0.5 }).position;

  return available
    .map((slot) => ({
      slot,
      distance: existing.reduce((min, point) => Math.min(min, squaredDistance(slot.position, point)), Number.POSITIVE_INFINITY)
    }))
    .sort((left, right) => right.distance - left.distance || left.slot.index - right.slot.index)[0]!
    .slot.position;
}

export function nearestAvailableBoardSlot(point: Point, occupied: Iterable<number>): BoardSlot {
  const occupiedIndices = new Set(occupied);
  const candidates = slots.filter((slot) => !occupiedIndices.has(slot.index));
  if (candidates.length === 0) return nearestBoardSlot(point);
  return nearestSlotFromList(point, candidates);
}

export function normalizeBoardZonePositions<T extends { position: Point }>(zones: readonly T[]): T[] {
  const occupied = new Set<number>();
  return zones.map((zone) => {
    const slot = nearestAvailableBoardSlot(zone.position, occupied);
    occupied.add(slot.index);
    if (samePoint(zone.position, slot.position)) return zone;
    return { ...zone, position: slot.position };
  });
}

function nearestBoardSlot(point: Point): BoardSlot {
  return nearestSlotFromList(point, slots);
}

function nearestSlotFromList(point: Point, candidates: readonly BoardSlot[]): BoardSlot {
  return [...candidates]
    .sort((left, right) => squaredDistance(point, left.position) - squaredDistance(point, right.position) || left.index - right.index)[0]!;
}

function createBoardSlots(): BoardSlot[] {
  const built: BoardSlot[] = [];
  const stepX = (BOARD_SLOT_MAX_X - BOARD_SLOT_MIN_X) / (BOARD_SLOT_COLUMNS - 1);
  const stepY = (BOARD_SLOT_MAX_Y - BOARD_SLOT_MIN_Y) / (BOARD_SLOT_ROWS - 1);

  for (let row = 0; row < BOARD_SLOT_ROWS; row++) {
    for (let column = 0; column < BOARD_SLOT_COLUMNS; column++) {
      const index = built.length;
      built.push({
        id: `slot-${row + 1}-${column + 1}`,
        index,
        row,
        column,
        position: {
          x: BOARD_SLOT_MIN_X + column * stepX,
          y: BOARD_SLOT_MIN_Y + row * stepY,
        }
      });
    }
  }

  return built;
}

function squaredDistance(left: Point, right: Point): number {
  const dx = left.x - right.x;
  const dy = left.y - right.y;
  return dx * dx + dy * dy;
}

function samePoint(left: Point, right: Point): boolean {
  return Math.abs(left.x - right.x) <= SLOT_EPSILON && Math.abs(left.y - right.y) <= SLOT_EPSILON;
}