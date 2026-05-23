import { describe, expect, it } from "vitest";
import { boardSlots, pointBoardSlotIndex } from "../src/boardSlots";
import { createDefaultDesign } from "../src/design/model";
import { addConnectionBetween, addZone, duplicateZone, moveZone, setDesignPlayerCount } from "../src/design/mutations";
import { validateDesign } from "../src/design/validation";

describe("design mutations", () => {
  it("adds neutral zones without mutating the original design", () => {
    const design = createDefaultDesign();
    const next = addZone(design, "Neutral");

    expect(design.zones).toHaveLength(3);
    expect(next.zones).toHaveLength(4);
    expect(next.zones.at(-1)?.role).toBe("Neutral");
  });

  it("reconciles player count by adding connected spawn zones", () => {
    const design = setDesignPlayerCount(createDefaultDesign(), 4);

    expect(design.playerCount).toBe(4);
    expect(design.zones.filter((zone) => zone.role === "Spawn").map((zone) => zone.player).sort()).toEqual([1, 2, 3, 4]);
    expect(validateDesign(design).errors).toEqual([]);
  });

  it("does not duplicate an existing connection between the same zones", () => {
    const design = createDefaultDesign();
    const next = addConnectionBetween(design, "zone-1", "zone-3");

    expect(next.connections).toHaveLength(design.connections.length);
  });

  it("caps zone additions and duplicates at 32 total zones", () => {
    let design = createDefaultDesign();

    while (design.zones.length < 32) {
      design = addZone(design, "Neutral");
    }

    const addCapped = addZone(design, "Neutral");
    const duplicateCapped = duplicateZone(design, design.zones[0]?.id ?? "");

    expect(addCapped.zones).toHaveLength(32);
    expect(duplicateCapped.zones).toHaveLength(32);
    expect(validateDesign(addCapped).errors).not.toContain("Templates support at most 32 zones.");
    expect(validateDesign(duplicateCapped).errors).not.toContain("Templates support at most 32 zones.");
  });

  it("keeps board slot assignments unique when dragging a zone in a stale overlapping layout", () => {
    let design = addZone(createDefaultDesign(), "Neutral");
    design = structuredClone(design);

    const zoneOne = design.zones.find((zone) => zone.id === "zone-1");
    const zoneTwo = design.zones.find((zone) => zone.id === "zone-2");
    const movedZone = design.zones.find((zone) => zone.id === "zone-3");
    if (!zoneOne || !zoneTwo || !movedZone) throw new Error("expected initial zones");

    zoneTwo.position = zoneOne.position;

    const occupied = new Set(design.zones.map((zone) => pointBoardSlotIndex(zone.position)));
    occupied.delete(pointBoardSlotIndex(movedZone.position));
    const targetSlot = boardSlots().find((slot) => !occupied.has(slot.index));
    if (!targetSlot) throw new Error("expected free board slot");

    const next = moveZone(design, movedZone.id, targetSlot.position);
    const slotIndexes = next.zones.map((zone) => pointBoardSlotIndex(zone.position));

    expect(next.zones.find((zone) => zone.id === movedZone.id)?.position).toEqual(targetSlot.position);
    expect(new Set(slotIndexes).size).toBe(slotIndexes.length);
  });
});
