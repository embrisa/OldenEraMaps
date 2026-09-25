// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type JSX, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDefaultDesign, type DesignConnection, type DesignZone, type TemplateDesign } from "../src/design";
import { SteppedValueSlider } from "../src/components/ui/form-controls";
import { TooltipProvider } from "../src/components/ui/radix";
import { AdvancedConfigurationDialog, type AdvancedConfigurationTab } from "../src/components/builder/AdvancedConfigurationDialog";
import { ConnectionsDialog } from "../src/components/builder/ConnectionsDialog";
import { ContentLimitsPanel } from "../src/components/builder/ContentLimitsDialog";
import { ExpertTemplateSettingsPanel } from "../src/components/builder/ExpertTemplateSettingsDialog";
import { LayoutProfilesPanel } from "../src/components/builder/LayoutProfilesDialog";
import { MandatoryContentPanel } from "../src/components/builder/MandatoryContentDialog";
import { TemplateSettingsPanel } from "../src/components/builder/TemplateSettingsPanel";
import { ZoneInspector } from "../src/components/builder/ZoneInspector";
import { currentJsonDraft, jsonDraftBase, LineListTextarea, removeIndexedDrafts } from "../src/components/builder/formHelpers";

class ResizeObserverMock {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

Object.defineProperty(globalThis, "ResizeObserver", { value: ResizeObserverMock, writable: true });
Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { value: vi.fn(), writable: true });

afterEach(() => {
  cleanup();
});

function fieldFor(container: HTMLElement, label: string): HTMLElement {
  const labels = within(container).getAllByText(label, { selector: ".oe-field__label" });
  const field = labels[0].closest(".config-field");
  expect(field).toBeTruthy();
  return field as HTMLElement;
}

function numberBoxFor(container: HTMLElement, label: string): HTMLInputElement {
  return fieldFor(container, label).querySelector("input[type='number']") as HTMLInputElement;
}

function textInputFor(container: HTMLElement, label: string): HTMLInputElement {
  return fieldFor(container, label).querySelector("input") as HTMLInputElement;
}

function textareaFor(container: HTMLElement, label: string): HTMLTextAreaElement {
  return fieldFor(container, label).querySelector("textarea") as HTMLTextAreaElement;
}

function zoneByName(design: TemplateDesign, name: string): DesignZone {
  const zone = design.zones.find((candidate) => candidate.name === name);
  expect(zone).toBeTruthy();
  return zone as DesignZone;
}

/** Holds a design like useBuilderWorkspace: every update re-clones it (structuredClone) or spreads it (globals). */
function useDesignState(initial: TemplateDesign, onDesign: (design: TemplateDesign) => void) {
  const [design, setDesign] = useState(initial);
  onDesign(design);
  return {
    design,
    updateDesign(mutator: (draft: TemplateDesign) => void): void {
      const next = structuredClone(design);
      mutator(next);
      setDesign(next);
    },
    updateGlobal<K extends keyof TemplateDesign>(key: K, value: TemplateDesign[K]): void {
      setDesign({ ...design, [key]: value });
    },
    setDesign
  };
}

describe("SteppedValueSlider typed values", () => {
  function ControlledSlider({ initial, min, max, step, onCommit }: { initial: number; min?: number; max?: number; step?: number; onCommit(value: string): void }): JSX.Element {
    const [value, setValue] = useState(initial);
    return (
      <SteppedValueSlider
        aria-label="Amount"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => {
          onCommit(event.currentTarget.value);
          setValue(Number(event.currentTarget.value));
        }}
      />
    );
  }

  it("commits a typed value while typing instead of waiting for blur", () => {
    const onCommit = vi.fn();
    render(<ControlledSlider initial={1} min={0} max={8} onCommit={onCommit} />);
    const box = screen.getByRole("spinbutton", { name: "Amount" }) as HTMLInputElement;

    fireEvent.change(box, { target: { value: "5" } });

    expect(onCommit).toHaveBeenCalledWith("5");
    expect(box.value).toBe("5");
  });

  it("does not rewrite or round the stored value when an untouched box is tabbed through", () => {
    const onCommit = vi.fn();
    render(<ControlledSlider initial={1.125} min={0} max={10} step={0.05} onCommit={onCommit} />);
    const box = screen.getByRole("spinbutton", { name: "Amount" }) as HTMLInputElement;

    fireEvent.focus(box);
    fireEvent.blur(box);
    fireEvent.keyDown(box, { key: "Enter" });

    expect(onCommit).not.toHaveBeenCalled();
  });

  it("waits for blur to clamp values below the minimum and keeps equivalent typed text", () => {
    const onCommit = vi.fn();
    render(<ControlledSlider initial={1} min={0.25} max={3} step={0.05} onCommit={onCommit} />);
    const box = screen.getByRole("spinbutton", { name: "Amount" }) as HTMLInputElement;

    fireEvent.change(box, { target: { value: "0" } });
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.blur(box);
    expect(onCommit).toHaveBeenLastCalledWith("0.25");
    expect(box.value).toBe("0.25");

    fireEvent.change(box, { target: { value: "2.0" } });
    expect(onCommit).toHaveBeenLastCalledWith("2");
    expect(box.value).toBe("2.0");
  });

  it("restores the stored value when the box is cleared and left", () => {
    const onCommit = vi.fn();
    render(<ControlledSlider initial={4} min={1} max={8} onCommit={onCommit} />);
    const box = screen.getByRole("spinbutton", { name: "Amount" }) as HTMLInputElement;

    fireEvent.change(box, { target: { value: "" } });
    fireEvent.blur(box);

    expect(onCommit).not.toHaveBeenCalled();
    expect(box.value).toBe("4");
  });
});

describe("ZoneInspector drafts follow the zone being edited", () => {
  function InspectorHarness({ initial, onDesign }: { initial: TemplateDesign; onDesign(design: TemplateDesign): void }): JSX.Element {
    const { design, setDesign } = useDesignState(initial, onDesign);
    const [selectedZoneId, setSelectedZoneId] = useState(initial.zones[0].id);
    const zone = design.zones.find((candidate) => candidate.id === selectedZoneId);
    return (
      <TooltipProvider>
        {design.zones.map((candidate) => (
          <button key={candidate.id} type="button" onPointerDown={() => setSelectedZoneId(candidate.id)}>{`Board ${candidate.name}`}</button>
        ))}
        <ZoneInspector
          zone={zone}
          zones={design.zones}
          onDuplicate={() => undefined}
          onTransferSettings={() => undefined}
          onDelete={() => undefined}
          layoutProfileNames={design.zoneLayouts.map((layout) => layout.name)}
          mandatoryContentNames={[]}
          contentCountLimitNames={[]}
          onUpdate={(mutator) => {
            // Mirrors useBuilderWorkspace.updateZone: bound to the zone selected when the handler was rendered.
            const next = structuredClone(design);
            const target = next.zones.find((candidate) => candidate.id === selectedZoneId);
            if (!target) return;
            mutator(target);
            setDesign(next);
          }}
        />
      </TooltipProvider>
    );
  }

  function renderInspector(initial = createDefaultDesign()) {
    let latest = initial;
    render(<InspectorHarness initial={initial} onDesign={(design) => { latest = design; }} />);
    const inspector = screen.getByRole("heading", { name: "Zone Inspector" }).closest(".inspector-card") as HTMLElement;
    return { inspector, design: () => latest };
  }

  function selectOnBoard(name: string): void {
    fireEvent.pointerDown(screen.getByRole("button", { name: `Board ${name}` }));
  }

  it("switches zones on every tab without React duplicate-key warnings", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const { inspector } = renderInspector();
      for (const tab of ["General", "Guards & Rules", "Content"]) {
        fireEvent.click(within(inspector).getByRole("button", { name: tab }));
        selectOnBoard("Spawn-2");
        selectOnBoard("Neutral-3");
        selectOnBoard("Spawn-1");
      }
      const keyWarnings = consoleError.mock.calls.filter((args) => args.some((arg) => typeof arg === "string" && arg.includes("same key")));
      expect(keyWarnings).toEqual([]);
    } finally {
      consoleError.mockRestore();
    }
  });

  it("keeps a typed castle count on the zone it was typed for when the board selects another zone first", () => {
    const { inspector, design } = renderInspector();
    const castles = numberBoxFor(inspector, "Castles");
    castles.focus();
    fireEvent.change(castles, { target: { value: "5" } });

    // The board switches zones on pointerdown, before the number box blurs.
    selectOnBoard("Spawn-2");
    fireEvent.blur(castles);

    expect(zoneByName(design(), "Spawn-1").castleCount).toBe(5);
    expect(zoneByName(design(), "Spawn-2").castleCount).toBe(1);
    expect(numberBoxFor(inspector, "Castles").value).toBe("1");
  });

  it("does not clamp a pending below-minimum draft onto the next zone", () => {
    const { inspector, design } = renderInspector();
    const size = numberBoxFor(inspector, "Size");
    fireEvent.change(size, { target: { value: "0" } });

    selectOnBoard("Spawn-2");
    fireEvent.blur(size);
    fireEvent.blur(numberBoxFor(inspector, "Size"));

    expect(zoneByName(design(), "Spawn-1").size).toBe(1);
    expect(zoneByName(design(), "Spawn-2").size).toBe(1);
    expect(numberBoxFor(inspector, "Size").value).toBe("1");
  });

  it("stores valid biome JSON on the typed zone and does not show a pending draft on the next zone", () => {
    const initial = createDefaultDesign();
    const spawn2Biome = structuredClone(zoneByName(initial, "Spawn-2").zoneBiome);
    const neutralBiome = structuredClone(zoneByName(initial, "Neutral-3").zoneBiome);
    const formatBiome = (value: unknown) => value === undefined ? "" : JSON.stringify(value, null, 2);
    const { inspector, design } = renderInspector(initial);
    const biome = within(inspector).getByLabelText("Zone Biome") as HTMLTextAreaElement;

    fireEvent.change(biome, { target: { value: '{ "type": "FromList", "args": ["Snow"] }' } });
    selectOnBoard("Spawn-2");
    expect(zoneByName(design(), "Spawn-1").zoneBiome).toEqual({ type: "FromList", args: ["Snow"] });
    expect(zoneByName(design(), "Spawn-2").zoneBiome).toEqual(spawn2Biome);
    expect((within(inspector).getByLabelText("Zone Biome") as HTMLTextAreaElement).value).toBe(formatBiome(spawn2Biome));

    fireEvent.change(within(inspector).getByLabelText("Zone Biome"), { target: { value: "{" } });
    selectOnBoard("Neutral-3");
    expect((within(inspector).getByLabelText("Zone Biome") as HTMLTextAreaElement).value).toBe(formatBiome(neutralBiome));
    expect(zoneByName(design(), "Spawn-2").zoneBiome).toEqual(spawn2Biome);
  });

  it("keeps separators in the guard reaction distribution while typing", () => {
    const { inspector, design } = renderInspector();
    fireEvent.click(within(inspector).getByRole("button", { name: "Guards & Rules" }));
    const distribution = textareaFor(inspector, "Guard Reaction Distribution");

    fireEvent.change(distribution, { target: { value: "1," } });
    expect(distribution.value).toBe("1,");
    fireEvent.change(distribution, { target: { value: "1, 2" } });

    expect(distribution.value).toBe("1, 2");
    expect(zoneByName(design(), "Spawn-1").guardReactionDistribution).toEqual([1, 2]);
  });

  it("gives a zone switched to Hub a unique name", () => {
    const initial = createDefaultDesign();
    const neutral = zoneByName(initial, "Neutral-3");
    neutral.name = "Hub";
    neutral.role = "Hub";
    const { inspector, design } = renderInspector(initial);
    const role = fieldFor(inspector, "Role").querySelector("select") as HTMLSelectElement;

    fireEvent.change(role, { target: { value: "Hub" } });

    const names = design().zones.map((zone) => zone.name);
    expect(names.filter((name) => name === "Hub")).toHaveLength(1);
    expect(zoneByName(design(), "Hub-2").id).toBe("zone-1");
  });

  it("lists generated low/high-tier dwellings in the summary of a Specific dwelling zone", () => {
    const initial = createDefaultDesign();
    const spawn = zoneByName(initial, "Spawn-1");
    spawn.dwellingSettings = {
      mode: "Specific",
      lowTierCount: 1,
      highTierCount: 1,
      specific: [{ id: "human-3", sid: "random_hire_3", count: 1, title: "Human Dwelling 3", image: "", faction: "Human", tier: 3 }]
    };
    spawn.dwellingCount = 3;
    const { inspector } = renderInspector(initial);
    fireEvent.click(within(inspector).getByRole("button", { name: "Content" }));

    const summary = inspector.querySelector(".dwelling-cards-list") as HTMLElement;
    expect(within(summary).getByText("Low-tier")).toBeTruthy();
    expect(within(summary).getByText("High-tier")).toBeTruthy();
    expect(within(summary).getByText("Human Dwelling 3")).toBeTruthy();
  });

  it("routes suggestion chips to checkboxes and skips disabled controls", () => {
    const { inspector, design } = renderInspector();

    fireEvent.click(within(fieldFor(inspector, "Player")).getByRole("button", { name: "P4" }));
    expect(zoneByName(design(), "Spawn-1").player).toBe(4);

    selectOnBoard("Neutral-3");
    fireEvent.click(within(fieldFor(inspector, "Player")).getByRole("button", { name: "P2" }));
    expect(zoneByName(design(), "Neutral-3").player).toBeUndefined();

    fireEvent.click(within(inspector).getByRole("button", { name: "Guards & Rules" }));
    const holes = fieldFor(inspector, "Encounter Holes");
    fireEvent.click(within(holes).getByRole("button", { name: "On" }));
    expect(zoneByName(design(), "Neutral-3").encounterHolesSettings).toEqual({ affectedEncounters: 0, twoHoleEncounters: 0 });
    fireEvent.click(within(holes).getByRole("button", { name: "On" }));
    expect(zoneByName(design(), "Neutral-3").encounterHolesSettings).toBeDefined();
    fireEvent.click(within(holes).getByRole("button", { name: "Off" }));
    expect(zoneByName(design(), "Neutral-3").encounterHolesSettings).toBeUndefined();
  });
});

describe("TemplateSettingsPanel suggestion chips", () => {
  it("applies the Small map size chip as a size the builder can store", () => {
    const design = createDefaultDesign();
    const onMapDimension = vi.fn();
    render(
      <TooltipProvider>
        <TemplateSettingsPanel
          design={design}
          onGlobal={() => undefined}
          onPlayerCount={() => undefined}
          onMapDimension={onMapDimension}
          onLockMapDimensions={() => undefined}
          onHero={() => undefined}
          onGameEnd={() => undefined}
        />
      </TooltipProvider>
    );

    fireEvent.click(within(fieldFor(document.body, "Width")).getByRole("button", { name: "Small" }));

    expect(onMapDimension).toHaveBeenLastCalledWith("mapWidth", 128);
  });
});

describe("form helper drafts", () => {
  it("re-keys position-keyed drafts after a delete", () => {
    const drafts = { "0:0": "a", "0:1": "b", "0:2": "c", "1:0": "d", "2:1": "e" };

    expect(removeIndexedDrafts(drafts, [0], 1)).toEqual({ "0:0": "a", "0:1": "c", "1:0": "d", "2:1": "e" });
    expect(removeIndexedDrafts(drafts, [], 1)).toEqual({ "0:0": "a", "0:1": "b", "0:2": "c", "1:1": "e" });
    expect(removeIndexedDrafts({ 0: "x", 1: "y" }, [], 0)).toEqual({ 0: "y" });
  });

  it("ignores a JSON draft once the model value it was written against has changed", () => {
    const draft = { value: "[1,", error: "Must be valid JSON.", base: jsonDraftBase([1]) };

    expect(currentJsonDraft(draft, [1])).toBe(draft);
    expect(currentJsonDraft(draft, [2])).toBeUndefined();
    expect(currentJsonDraft(undefined, [1])).toBeUndefined();
  });

  it("keeps line breaks in list textareas while typing", () => {
    const onValuesChange = vi.fn();
    function Harness(): JSX.Element {
      const [values, setValues] = useState<string[]>([]);
      return <LineListTextarea aria-label="Lists" values={values} onValuesChange={(next) => { onValuesChange(next); setValues(next); }} />;
    }
    render(<Harness />);
    const textarea = screen.getByLabelText("Lists") as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: "list_a\n" } });
    expect(textarea.value).toBe("list_a\n");
    fireEvent.change(textarea, { target: { value: "list_a\nlist_b" } });

    expect(textarea.value).toBe("list_a\nlist_b");
    expect(onValuesChange).toHaveBeenLastCalledWith(["list_a", "list_b"]);
    expect(onValuesChange).toHaveBeenCalledTimes(2);
  });
});

describe("Expert settings panel", () => {
  function ExpertHarness({ initial, onDesign, onClose }: { initial: TemplateDesign; onDesign(design: TemplateDesign): void; onClose(): void }): JSX.Element {
    const { design, updateDesign, updateGlobal, setDesign } = useDesignState(initial, onDesign);
    return (
      <TooltipProvider>
        <button type="button" onClick={() => setDesign(initial)}>Undo to initial</button>
        <ExpertTemplateSettingsPanel active design={design} onUpdate={updateDesign} onGlobal={updateGlobal} onClose={onClose} />
      </TooltipProvider>
    );
  }

  function renderExpert() {
    let latest = createDefaultDesign();
    const onClose = vi.fn();
    const view = render(<ExpertHarness initial={latest} onDesign={(design) => { latest = design; }} onClose={onClose} />);
    return { container: view.container, design: () => latest, onClose };
  }

  it("keeps staged ban edits when a live noise entry is added", () => {
    const { container, design } = renderExpert();
    const bannedHeroes = fieldFor(container, "Banned Heroes");
    fireEvent.change(within(bannedHeroes).getByLabelText("Search heroes or add a custom hero ID"), { target: { value: "hero_custom" } });
    fireEvent.click(within(bannedHeroes).getByRole("button", { name: "Add hero" }));
    expect(within(bannedHeroes).getByRole("button", { name: "Remove hero_custom" })).toBeTruthy();

    fireEvent.click(within(fieldFor(container, "Obstacle Noise")).getByRole("button", { name: "Add entry" }));

    expect(design().border.obstaclesNoise).toHaveLength(2);
    expect(within(fieldFor(container, "Banned Heroes")).getByRole("button", { name: "Remove hero_custom" })).toBeTruthy();
    fireEvent.click(within(container).getByRole("button", { name: "Apply" }));
    expect(design().globalBans.heroes).toEqual(["hero_custom"]);
  });

  it("stores decimal noise values without snapping partial input to zero", () => {
    const { container, design } = renderExpert();
    const amplitude = within(container).getAllByLabelText("Noise amplitude 1")[0] as HTMLInputElement;

    // A number input reports "" while its text is a partial number such as "1.".
    fireEvent.change(amplitude, { target: { value: "" } });
    expect(design().border.obstaclesNoise[0].amp).toBe(1);
    expect(amplitude.value).toBe("");

    fireEvent.change(amplitude, { target: { value: "1.5" } });
    expect(design().border.obstaclesNoise[0].amp).toBe(1.5);
    fireEvent.blur(amplitude);
    expect(amplitude.value).toBe("1.5");
  });

  it("shows live noise values restored by an undo while the panel is open", () => {
    const { container, design } = renderExpert();
    const amplitude = () => within(container).getAllByLabelText("Noise amplitude 1")[0] as HTMLInputElement;
    fireEvent.change(amplitude(), { target: { value: "2.5" } });
    expect(design().border.obstaclesNoise[0].amp).toBe(2.5);

    fireEvent.click(within(container).getByRole("button", { name: "Undo to initial" }));
    expect(amplitude().value).toBe("1");

    fireEvent.click(within(fieldFor(container, "Obstacle Noise")).getByRole("button", { name: "Add entry" }));
    expect(design().border.obstaclesNoise).toEqual([{ amp: 1, freq: 12 }, { amp: 0.2, freq: 1 }]);
  });

  it("labels the close button as discarding only the staged edits", () => {
    const { container, onClose } = renderExpert();

    expect(within(container).queryByRole("button", { name: "Cancel" })).toBeNull();
    fireEvent.click(within(container).getByRole("button", { name: "Discard Staged Changes" }));
    expect(onClose).toHaveBeenCalled();
    expect(within(container).getByText(/apply immediately/)).toBeTruthy();
  });
});

describe("Advanced configuration dialog", () => {
  function AdvancedHarness({ onDesign }: { onDesign(design: TemplateDesign): void }): JSX.Element {
    const { design, updateDesign, updateGlobal } = useDesignState(createDefaultDesign(), onDesign);
    const [tab, setTab] = useState<AdvancedConfigurationTab>("content");
    return (
      <TooltipProvider>
        <AdvancedConfigurationDialog open activeTab={tab} onOpenChange={() => undefined} onActiveTabChange={setTab} design={design} onUpdate={updateDesign} onGlobal={updateGlobal} />
      </TooltipProvider>
    );
  }

  it("keeps staged content library JSON when switching tabs and editing another section", async () => {
    const user = userEvent.setup();
    let latest = createDefaultDesign();
    render(<AdvancedHarness onDesign={(design) => { latest = design; }} />);
    const dialog = screen.getByRole("dialog");
    const pools = within(dialog).getByLabelText("Content Pools JSON editor") as HTMLTextAreaElement;
    const staged = JSON.stringify([{ name: "pool_staged" }]);
    fireEvent.change(pools, { target: { value: staged } });

    await user.click(within(dialog).getByRole("tab", { name: "Layout & Profiles" }));
    const obstaclesFill = within(dialog).getAllByText("Obstacles Fill")[0].closest(".config-field")?.querySelector("input") as HTMLInputElement;
    fireEvent.change(obstaclesFill, { target: { value: "0.31" } });
    expect(latest.zoneLayouts[0].obstaclesFill).toBe(0.31);
    await user.click(within(dialog).getByRole("tab", { name: "Content Pools" }));

    expect((within(dialog).getByLabelText("Content Pools JSON editor") as HTMLTextAreaElement).value).toBe(staged);
  });
});

describe("Layout profile, content limit and mandatory content editors", () => {
  function PanelHarness({ initial, onDesign, children }: { initial: TemplateDesign; onDesign(design: TemplateDesign): void; children(design: TemplateDesign, update: (mutator: (draft: TemplateDesign) => void) => void): ReactNode }): JSX.Element {
    const { design, updateDesign } = useDesignState(initial, onDesign);
    return <TooltipProvider>{children(design, updateDesign)}</TooltipProvider>;
  }

  function renderPanel(initial: TemplateDesign, panel: (design: TemplateDesign, update: (mutator: (draft: TemplateDesign) => void) => void) => ReactNode) {
    let latest = initial;
    const view = render(<PanelHarness initial={initial} onDesign={(design) => { latest = design; }}>{panel}</PanelHarness>);
    return { container: view.container, design: () => latest };
  }

  function twoLayoutDesign(): TemplateDesign {
    const design = createDefaultDesign();
    const [first] = design.zoneLayouts;
    design.zoneLayouts = [
      { ...structuredClone(first), name: "layout_a", elevationModes: [{ weight: 1, minElevatedFraction: 0.1, maxElevatedFraction: 0.2 }] },
      { ...structuredClone(first), name: "layout_b", elevationModes: [{ weight: 2, minElevatedFraction: 0.3, maxElevatedFraction: 0.4 }] }
    ];
    for (const zone of design.zones) zone.layout = "layout_a";
    return design;
  }

  it("keeps the layout name input mounted and zone references in sync while retyping a cleared name", () => {
    const { container, design } = renderPanel(twoLayoutDesign(), (current, update) => <LayoutProfilesPanel active design={current} onUpdate={update} />);
    const name = textInputFor(container, "Layout Name");

    fireEvent.change(name, { target: { value: "" } });
    fireEvent.change(textInputFor(container, "Layout Name"), { target: { value: "l" } });
    fireEvent.change(textInputFor(container, "Layout Name"), { target: { value: "layout_new" } });

    expect(textInputFor(container, "Layout Name")).toBe(name);
    expect(design().zoneLayouts[0].name).toBe("layout_new");
    expect(design().zones.every((zone) => zone.layout === "layout_new")).toBe(true);
  });

  it("does not show a deleted layout profile's JSON draft on the next profile", () => {
    const { container, design } = renderPanel(twoLayoutDesign(), (current, update) => <LayoutProfilesPanel active design={current} onUpdate={update} />);
    const elevation = within(container).getByLabelText("Elevation Modes JSON editor") as HTMLTextAreaElement;
    fireEvent.change(elevation, { target: { value: "[{" } });
    expect(within(container).getByRole("alert").textContent).toContain("Elevation Modes JSON");

    fireEvent.click(within(container).getByRole("button", { name: "Delete" }));

    expect(design().zoneLayouts.map((layout) => layout.name)).toEqual(["layout_b"]);
    expect(JSON.parse((within(container).getByLabelText("Elevation Modes JSON editor") as HTMLTextAreaElement).value)).toEqual(design().zoneLayouts[0].elevationModes);
    expect(within(container).queryByRole("alert")).toBeNull();
  });

  function contentLimitDesign(): TemplateDesign {
    const design = createDefaultDesign();
    design.contentCountLimits = [{
      name: "content_limits_test",
      limits: [
        { sid: "sid_a", maxCount: 1, content: [{ sid: "content_a" }] },
        { sid: "sid_b", maxCount: 2, content: [{ sid: "content_b" }] }
      ]
    }];
    for (const zone of design.zones) zone.contentCountLimits = ["content_limits_test"];
    return design;
  }

  it("keeps content limit SID inputs mounted, list separators and zone references while editing", () => {
    const { container, design } = renderPanel(contentLimitDesign(), (current, update) => <ContentLimitsPanel active design={current} onUpdate={update} />);
    const sid = within(container).getAllByText("SID", { selector: ".oe-field__label" })[0].closest(".config-field")?.querySelector("input") as HTMLInputElement;

    fireEvent.change(sid, { target: { value: "sid_a2" } });
    expect(within(container).getAllByText("SID", { selector: ".oe-field__label" })[0].closest(".config-field")?.querySelector("input")).toBe(sid);

    const includeLists = within(container).getAllByText("Include Lists", { selector: ".oe-field__label" })[0].closest(".config-field")?.querySelector("textarea") as HTMLTextAreaElement;
    fireEvent.change(includeLists, { target: { value: "list_a\n" } });
    fireEvent.change(includeLists, { target: { value: "list_a\nlist_b" } });
    expect(includeLists.value).toBe("list_a\nlist_b");
    expect(design().contentCountLimits[0].limits?.[0].includeLists).toEqual(["list_a", "list_b"]);

    const name = textInputFor(container, "Limit Name");
    fireEvent.change(name, { target: { value: "" } });
    fireEvent.change(textInputFor(container, "Limit Name"), { target: { value: "content_limits_renamed" } });
    expect(textInputFor(container, "Limit Name")).toBe(name);
    expect(design().zones.every((zone) => zone.contentCountLimits.includes("content_limits_renamed"))).toBe(true);
  });

  it("does not move a deleted SID limit's JSON draft onto the next limit", () => {
    const { container, design } = renderPanel(contentLimitDesign(), (current, update) => <ContentLimitsPanel active design={current} onUpdate={update} />);
    fireEvent.change(within(container).getByLabelText("Content JSON editor for sid_a"), { target: { value: "[{" } });

    fireEvent.click(within(container).getAllByRole("button", { name: "Delete SID" })[0]);

    const editor = within(container).getByLabelText("Content JSON editor for sid_b") as HTMLTextAreaElement;
    expect(JSON.parse(editor.value)).toEqual([{ sid: "content_b" }]);
    fireEvent.change(editor, { target: { value: JSON.stringify([{ sid: "content_b2" }]) } });
    expect(design().contentCountLimits[0].limits).toEqual([{ sid: "sid_b", maxCount: 2, content: [{ sid: "content_b2" }] }]);
  });

  function mandatoryDesign(): TemplateDesign {
    const design = createDefaultDesign();
    design.useCustomMandatoryContent = true;
    design.mandatoryContent = [{
      name: "mandatory_content_test",
      content: [
        { sid: "item_a", rules: [{ type: "Crossroads", args: [] }] },
        { sid: "item_b", rules: [{ type: "Road", args: [] }] }
      ]
    }];
    for (const zone of design.zones) zone.mandatoryContent = ["mandatory_content_test"];
    return design;
  }

  it("keeps mandatory content inputs mounted, re-keys drafts on delete and follows renamed groups", () => {
    const { container, design } = renderPanel(mandatoryDesign(), (current, update) => <MandatoryContentPanel active design={current} onUpdate={update} />);
    const sid = within(container).getAllByText("SID", { selector: ".oe-field__label" })[1].closest(".config-field")?.querySelector("input") as HTMLInputElement;
    fireEvent.change(sid, { target: { value: "item_b2" } });
    expect(within(container).getAllByText("SID", { selector: ".oe-field__label" })[1].closest(".config-field")?.querySelector("input")).toBe(sid);

    fireEvent.change(within(container).getByLabelText("Rules JSON editor for item_a"), { target: { value: "[{" } });
    fireEvent.click(within(container).getAllByRole("button", { name: "Delete Item" })[0]);
    const rules = within(container).getByLabelText("Rules JSON editor for item_b2") as HTMLTextAreaElement;
    expect(JSON.parse(rules.value)).toEqual([{ type: "Road", args: [] }]);

    const name = textInputFor(container, "Group Name");
    fireEvent.change(name, { target: { value: "" } });
    fireEvent.change(textInputFor(container, "Group Name"), { target: { value: "mandatory_content_renamed" } });
    expect(textInputFor(container, "Group Name")).toBe(name);
    expect(design().zones.every((zone) => zone.mandatoryContent.includes("mandatory_content_renamed"))).toBe(true);
  });
});

describe("Connections dialog", () => {
  function ConnectionsHarness({ initial, onDesign }: { initial: TemplateDesign; onDesign(design: TemplateDesign): void }): JSX.Element {
    const { design, setDesign } = useDesignState(initial, onDesign);
    return (
      <TooltipProvider>
        <ConnectionsDialog
          open
          onOpenChange={() => undefined}
          design={design}
          selectedConnectionId=""
          onAdd={() => undefined}
          onAddReversePortal={() => undefined}
          onDelete={() => undefined}
          onUpdate={(connectionId: string, mutator: (connection: DesignConnection) => void) => {
            const next = structuredClone(design);
            const connection = next.connections.find((candidate) => candidate.id === connectionId);
            if (!connection) return;
            mutator(connection);
            setDesign(next);
          }}
        />
      </TooltipProvider>
    );
  }

  function renderConnections(mutate: (design: TemplateDesign) => void = () => undefined) {
    let latest = createDefaultDesign();
    mutate(latest);
    render(<ConnectionsHarness initial={latest} onDesign={(design) => { latest = design; }} />);
    const row = screen.getByDisplayValue(latest.connections[0].name).closest(".connection-row") as HTMLElement;
    return { row, design: () => latest };
  }

  it("keeps an in-progress portal rules draft when another connection setting changes", () => {
    const { row, design } = renderConnections((initial) => { initial.connections[0].type = "Portal"; });
    const rulesFrom = within(row).getByLabelText(/Portal Rules From JSON editor/) as HTMLTextAreaElement;
    fireEvent.change(rulesFrom, { target: { value: "[{" } });

    fireEvent.click(within(row).getByRole("button", { name: /Road/ }));

    expect(design().connections[0].road).toBe(!createDefaultDesign().connections[0].road);
    expect((within(row).getByLabelText(/Portal Rules From JSON editor/) as HTMLTextAreaElement).value).toBe("[{");
    expect(within(row).getByRole("alert").textContent).toContain("Portal Rules From");
  });

  it("shows a stale guard zone instead of Default and keeps spaces in the match group", () => {
    const { row, design } = renderConnections((initial) => { initial.connections[0].guardZone = "Renamed-Away"; });
    const guardZone = fieldFor(row, "Guard Zone").querySelector("select") as HTMLSelectElement;

    expect(guardZone.value).toBe("Renamed-Away");
    expect(guardZone.selectedOptions[0].textContent).toBe("(missing: Renamed-Away)");

    const matchGroup = textInputFor(row, "Guard Match Group");
    fireEvent.change(matchGroup, { target: { value: "north " } });
    fireEvent.change(matchGroup, { target: { value: "north gate " } });
    expect(matchGroup.value).toBe("north gate ");
    fireEvent.blur(matchGroup);
    expect(design().connections[0].guardMatchGroup).toBe("north gate");
  });
});

describe("Zone main objects editor", () => {
  it("keeps JSON drafts across unrelated zone edits and allows spaces in text fields", () => {
    const initial = createDefaultDesign();
    const spawn = zoneByName(initial, "Spawn-1");
    spawn.useCustomMainObjects = true;
    spawn.customMainObjects = [{ type: "Spawn", spawn: "Player1", faction: { type: "FromList", args: [] } }];
    let latest = initial;

    function Harness(): JSX.Element {
      const { design, setDesign } = useDesignState(initial, (next) => { latest = next; });
      return (
        <TooltipProvider>
          <ZoneInspector
            zone={design.zones[0]}
            zones={design.zones}
            onDuplicate={() => undefined}
            onTransferSettings={() => undefined}
            onDelete={() => undefined}
            layoutProfileNames={[]}
            mandatoryContentNames={[]}
            contentCountLimitNames={[]}
            onUpdate={(mutator) => {
              const next = structuredClone(design);
              mutator(next.zones[0]);
              setDesign(next);
            }}
          />
        </TooltipProvider>
      );
    }

    render(<Harness />);
    const row = screen.getByText("Main Object 1").closest(".main-object-row") as HTMLElement;
    const faction = within(row).getByLabelText("Faction Selector JSON editor for main object 1") as HTMLTextAreaElement;
    fireEvent.change(faction, { target: { value: '{ "type": ' } });

    const placement = textInputFor(row, "Placement");
    fireEvent.change(placement, { target: { value: "Uniform " } });
    fireEvent.change(placement, { target: { value: "Uniform Spread " } });
    expect(placement.value).toBe("Uniform Spread ");

    expect((within(row).getByLabelText("Faction Selector JSON editor for main object 1") as HTMLTextAreaElement).value).toBe('{ "type": ');
    fireEvent.blur(placement);
    expect(latest.zones[0].customMainObjects[0].placement).toBe("Uniform Spread");
    expect(latest.zones[0].customMainObjects[0].faction).toEqual({ type: "FromList", args: [] });
  });
});

describe("Dwelling settings mode switch", () => {
  it("asks before Generated Mix drops specific dwelling picks", async () => {
    const user = userEvent.setup();
    const initial = createDefaultDesign();
    let latest = initial;

    function Harness(): JSX.Element {
      const { design, setDesign } = useDesignState(initial, (next) => { latest = next; });
      return (
        <TooltipProvider>
          <ZoneInspector
            zone={design.zones[0]}
            zones={design.zones}
            onDuplicate={() => undefined}
            onTransferSettings={() => undefined}
            onDelete={() => undefined}
            layoutProfileNames={[]}
            mandatoryContentNames={[]}
            contentCountLimitNames={[]}
            onUpdate={(mutator) => {
              const next = structuredClone(design);
              mutator(next.zones[0]);
              setDesign(next);
            }}
          />
        </TooltipProvider>
      );
    }

    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Content" }));
    await user.click(screen.getByRole("button", { name: "Dwelling Settings" }));
    const dialog = screen.getAllByRole("dialog").find((candidate) => within(candidate).queryByText("Dwelling Settings")) as HTMLElement;
    await user.click(within(dialog).getByRole("tab", { name: /Specific Dwellings/ }));
    await user.click(within(dialog).getByRole("button", { name: "Add Human Dwelling 3" }));
    expect(latest.zones[0].dwellingSettings?.specific).toHaveLength(1);

    await user.click(within(dialog).getByRole("tab", { name: /Generated Mix/ }));
    expect(latest.zones[0].dwellingSettings?.mode).toBe("Specific");
    expect(latest.zones[0].dwellingSettings?.specific).toHaveLength(1);
    await user.click(within(dialog).getByRole("button", { name: "Keep Specific Dwellings" }));
    expect(latest.zones[0].dwellingSettings?.specific).toHaveLength(1);

    await user.click(within(dialog).getByRole("tab", { name: /Generated Mix/ }));
    await user.click(within(dialog).getByRole("button", { name: "Remove Picks & Switch" }));
    expect(latest.zones[0].dwellingSettings?.mode).toBe("Generated");
    expect(latest.zones[0].dwellingSettings?.specific).toEqual([]);
  });
});

