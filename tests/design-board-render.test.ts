import { describe, expect, it } from "vitest";
import { buildPreviewDesign } from "../src/community/previewDesign";
import { renderSchematicBoardPreview, buildBoardRenderState } from "../src/components/designBoardRender";
import { createDefaultDesign, createZone } from "../src/design";

interface DrawCall {
  method: string;
  args: unknown[];
}

function createStubContext(): { ctx: CanvasRenderingContext2D; calls: DrawCall[] } {
  const calls: DrawCall[] = [];
  const target: Record<string, unknown> = {
    canvas: { width: 800, height: 600 },
    createLinearGradient: () => ({ addColorStop: () => undefined }),
  };
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(object, prop) {
      if (prop in object) return object[prop as string];
      return (...args: unknown[]) => {
        calls.push({ method: String(prop), args });
      };
    },
    set(object, prop, value) {
      calls.push({ method: `set:${String(prop)}`, args: [value] });
      object[prop as string] = value;
      return true;
    },
  };
  return { ctx: new Proxy(target, handler) as unknown as CanvasRenderingContext2D, calls };
}

describe("design board renderer", () => {
  it("surrounds selected zones with a centered shadow without replacing their danger border color", () => {
    const design = createDefaultDesign();
    const dangerousZone = design.zones.find((zone) => zone.role === "Neutral");
    expect(dangerousZone).toBeTruthy();
    dangerousZone!.neutralStackStrengthPercent = 200;
    const preview = buildPreviewDesign(design);
    const state = buildBoardRenderState(preview, 800, 600);
    const { ctx, calls } = createStubContext();

    renderSchematicBoardPreview(ctx, state, {
      width: 800,
      height: 600,
      dpr: 1,
      selectedZoneId: dangerousZone!.id,
    });

    const strokeStyles = calls
      .filter((call) => call.method === "set:strokeStyle")
      .map((call) => call.args[0]);
    const shadowColors = calls
      .filter((call) => call.method === "set:shadowColor")
      .map((call) => call.args[0]);
    const fillStyles = calls
      .filter((call) => call.method === "set:fillStyle")
      .map((call) => call.args[0]);
    const shadowOffsetYs = calls
      .filter((call) => call.method === "set:shadowOffsetY")
      .map((call) => call.args[0]);
    const shadowArc = calls.find((call) =>
      call.method === "arc"
      && call.args[0] === state.zoneLayoutsById.get(dangerousZone!.id)?.box.centerX
      && call.args[2] === (state.zoneLayoutsById.get(dangerousZone!.id)?.badgeSize ?? 0) / 2 + 13
    );

    expect(strokeStyles).toContain("#ff8877");
    expect(strokeStyles).not.toContain("rgba(255, 244, 198, 0.56)");
    expect(strokeStyles).not.toContain("#d8ba64");
    expect(shadowColors).toContain("rgba(0, 0, 0, 0.34)");
    expect(shadowOffsetYs).toContain(0);
    expect(shadowArc?.args[1]).toBe(state.zoneLayoutsById.get(dangerousZone!.id)?.box.centerY);
    expect(fillStyles).toContain("rgba(0, 0, 0, 0.2)");
  });

  it("assigns a distinct schematic color to each road connection", () => {
    const design = createDefaultDesign();
    design.connections.forEach((connection) => { connection.road = true; });
    const preview = buildPreviewDesign(design);
    const state = buildBoardRenderState(preview, 800, 600);
    const { ctx, calls } = createStubContext();

    renderSchematicBoardPreview(ctx, state, { width: 800, height: 600, dpr: 1 });

    const roadColors = state.connectionLayouts.map((layout) => layout.color);
    const drawnRoadColors = calls
      .filter((call) => call.method === "set:strokeStyle")
      .map((call) => call.args[0])
      .filter((value): value is string => typeof value === "string" && value.startsWith("hsl("));

    expect(roadColors).toHaveLength(design.connections.length);
    expect(new Set(roadColors).size).toBe(roadColors.length);
    expect(drawnRoadColors).toEqual(roadColors);
  });

  it("keeps non-road connections on the normal type color", () => {
    const design = createDefaultDesign();
    design.connections[0]!.road = false;
    design.connections[1]!.road = true;
    const preview = buildPreviewDesign(design);
    const state = buildBoardRenderState(preview, 800, 600);

    expect(state.connectionLayouts[0]?.color).toBe("#d6b45e");
    expect(state.connectionLayouts[1]?.color.startsWith("hsl(")).toBe(true);
  });

  it("renders builder zone names, city counts, and shared keep markers without community-only spawn labels", () => {
    const design = createDefaultDesign();
    const neutral = design.zones.find((zone) => zone.role === "Neutral");
    expect(neutral).toBeTruthy();
    neutral!.castleCount = 2;
    neutral!.holdCity = true;
    neutral!.neutralStackStrengthPercent = 180;
    neutral!.guardMultiplier = 1.4;
    neutral!.neutralCastlesAsRuins = true;

    const preview = buildPreviewDesign(design);
    const state = buildBoardRenderState(preview, 800, 600);
    const { ctx, calls } = createStubContext();

    renderSchematicBoardPreview(ctx, state, { width: 800, height: 600, dpr: 1 });

    const drawnTexts = calls
      .filter((call) => call.method === "fillText" || call.method === "strokeText")
      .map((call) => call.args[0]);
    const keepFills = calls
      .filter((call) => call.method === "set:fillStyle")
      .map((call) => call.args[0]);

    expect(drawnTexts).toContain("Spawn-1");
    expect(drawnTexts).toContain("1 city");
    expect(drawnTexts).toContain("2 cities");
    expect(drawnTexts).not.toContain("🏰");
    expect(drawnTexts).not.toContain("🏚");
    expect(drawnTexts).not.toContain("⚔");
    expect(drawnTexts).not.toContain("💰");
    expect(drawnTexts).not.toContain("S-1");
    expect(drawnTexts).not.toContain("S1");
    expect(drawnTexts).not.toContain("N-3");
    expect(drawnTexts).not.toContain("Standard");
    expect(keepFills).toContain("#f3d778");
    expect(calls).not.toContainEqual({ method: "set:fillStyle", args: ["rgba(16, 24, 32, 0.48)"] });
  });

  it("renders community previews with spawn labels and city keep markers without zone text or hint emojis", () => {
    const design = createDefaultDesign();
    const spawn = design.zones.find((zone) => zone.role === "Spawn" && zone.player === 1);
    const neutral = design.zones.find((zone) => zone.role === "Neutral");
    expect(spawn).toBeTruthy();
    expect(neutral).toBeTruthy();
    spawn!.castleCount = 1;
    neutral!.castleCount = 2;
    neutral!.holdCity = true;
    neutral!.neutralStackStrengthPercent = 180;
    neutral!.guardMultiplier = 1.4;
    neutral!.neutralCastlesAsRuins = true;
    neutral!.roads = false;
    neutral!.footholds = false;

    const preview = buildPreviewDesign(design);
    const state = buildBoardRenderState(preview, 640, 426);
    const { ctx, calls } = createStubContext();

    renderSchematicBoardPreview(ctx, state, {
      width: 640,
      height: 426,
      dpr: 1,
      presentation: "community",
    });

    const drawnTexts = calls
      .filter((call) => call.method === "fillText" || call.method === "strokeText")
      .map((call) => call.args[0]);
    const keepFills = calls
      .filter((call) => call.method === "set:fillStyle")
      .map((call) => call.args[0]);
    const strokeStyles = calls
      .filter((call) => call.method === "set:strokeStyle")
      .map((call) => call.args[0]);

    expect(drawnTexts).toContain("S1");
    expect(drawnTexts).not.toContain("Spawn-1");
    expect(drawnTexts).not.toContain("Neutral-3");
    expect(drawnTexts).not.toContain("1 city");
    expect(drawnTexts).not.toContain("2 cities");
    expect(drawnTexts).not.toContain("🏰");
    expect(drawnTexts).not.toContain("🏚");
    expect(drawnTexts).not.toContain("⚔");
    expect(drawnTexts).not.toContain("🚫");
    expect(drawnTexts).not.toContain("⛔");
    expect(keepFills).toContain("#f3d778");
    expect(strokeStyles).toContain("#8fdb85");
    expect(strokeStyles).toContain("#ff8877");
    expect(strokeStyles).not.toContain("rgba(150, 174, 199, 0.46)");
  });

  it("shrinks dense layouts on small community preview canvases", () => {
    const design = createDefaultDesign();
    const positions = [
      { x: 0.18, y: 0.25 },
      { x: 0.36, y: 0.2 },
      { x: 0.54, y: 0.18 },
      { x: 0.72, y: 0.22 },
      { x: 0.82, y: 0.4 },
      { x: 0.72, y: 0.66 },
      { x: 0.5, y: 0.78 },
      { x: 0.28, y: 0.68 },
      { x: 0.16, y: 0.46 },
    ];

    design.zones = positions.map((position, index) => createZone(
      `zone-${index + 1}`,
      index < 4 ? `Spawn-${index + 1}` : `Neutral-${index + 1}`,
      index < 4 ? "Spawn" : "Neutral",
      {
        player: index < 4 ? index + 1 : undefined,
        castleCount: index % 3 === 0 ? 1 : 0,
        position,
      }
    ));

    const preview = buildPreviewDesign(design);
    const compactState = buildBoardRenderState(preview, 320, 213);
    const fullState = buildBoardRenderState(preview, 800, 600);
    const compactWidth = Math.max(...compactState.zoneLayouts.map((layout) => layout.box.width));
    const fullWidth = Math.max(...fullState.zoneLayouts.map((layout) => layout.box.width));

    expect(compactWidth).toBeLessThan(fullWidth);
    expect(compactWidth).toBeLessThanOrEqual(60);
    expect(fullWidth).toBeGreaterThanOrEqual(88);
  });

  it("keeps adjacent snapped zones from overlapping in community preview sizes", () => {
    const design = createDefaultDesign();
    design.zones[0]!.position = { x: 0.42, y: 0.22 };
    design.zones[1]!.position = { x: 0.5, y: 0.22 };
    design.zones[2]!.position = { x: 0.5, y: 0.64 };

    const preview = buildPreviewDesign(design);

    for (const [width, height] of [[320, 213], [640, 426]]) {
      const state = buildBoardRenderState(preview, width, height);
      for (let leftIndex = 0; leftIndex < state.zoneLayouts.length; leftIndex++) {
        const left = state.zoneLayouts[leftIndex]!;
        for (let rightIndex = leftIndex + 1; rightIndex < state.zoneLayouts.length; rightIndex++) {
          const right = state.zoneLayouts[rightIndex]!;
          const leftRadius = left.badgeSize / 2 + 4;
          const rightRadius = right.badgeSize / 2 + 4;
          const distance = Math.hypot(left.box.centerX - right.box.centerX, left.box.centerY - right.box.centerY);
          expect(distance).toBeGreaterThanOrEqual(leftRadius + rightRadius + 13);
        }
      }
    }
  });

  it("places stacked zone names outside the circles instead of between them", () => {
    const design = createDefaultDesign();
    const spawn = design.zones.find((zone) => zone.role === "Spawn");
    const neutral = design.zones.find((zone) => zone.role === "Neutral");
    expect(spawn).toBeTruthy();
    expect(neutral).toBeTruthy();

    spawn!.position = { x: 0.5, y: 0.2 };
    neutral!.position = { x: 0.5, y: 0.72 };

    const preview = buildPreviewDesign(design);
    const state = buildBoardRenderState(preview, 800, 600);
    const { ctx, calls } = createStubContext();

    renderSchematicBoardPreview(ctx, state, { width: 800, height: 600, dpr: 1 });

    const spawnLayout = state.zoneLayoutsById.get(spawn!.id);
    const neutralLayout = state.zoneLayoutsById.get(neutral!.id);
    expect(spawnLayout).toBeTruthy();
    expect(neutralLayout).toBeTruthy();

    const spawnLabelY = calls
      .find((call) => call.method === "fillText" && call.args[0] === spawn!.name)?.args[2] as number | undefined;
    const neutralLabelY = calls
      .find((call) => call.method === "fillText" && call.args[0] === neutral!.name)?.args[2] as number | undefined;

    expect(spawnLabelY).toBeDefined();
    expect(neutralLabelY).toBeDefined();
    expect(spawnLabelY!).toBeLessThan(spawnLayout!.box.top);
    expect(neutralLabelY!).toBeGreaterThan(neutralLayout!.box.bottom);
  });
});
