// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/community/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/community/auth")>();
  return {
    ...actual,
    getSession: vi.fn(async () => null),
    onAuthStateChange: vi.fn(() => () => {}),
    syncCurrentUserProfile: vi.fn(async () => {})
  };
});

vi.mock("../src/community/supabaseClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/community/supabaseClient")>();
  return {
    ...actual,
    isSupabaseConfigured: false,
    supabase: null
  };
});

import { analyzeTemplate } from "../src/analysis/templateAnalysis";
import { downloadBlob } from "../src/components/appShell/templateDownloads";
import { AppShell } from "../src/components/AppShell";
import { ValidationOutputPanel } from "../src/components/builder/ValidationOutputPanel";
import { showsTemplateNameBadge } from "../src/components/community/listingDisplay";
import { RatingSummary, StarRatingButtons, formatRatingCount } from "../src/components/community/RatingControls";
import { HelpIcon } from "../src/components/ui/form-controls";
import { Dialog, DialogContent, DialogDescription, DialogTitle, TooltipProvider } from "../src/components/ui/radix";
import { createDefaultDesign, designToTemplate, moveZone, serializeDesignFile } from "../src/design";
import { pageFromPathname } from "../src/hooks/useAppRoute";
import { AUTOSAVE_KEY, useBuilderWorkspace } from "../src/hooks/useBuilderWorkspace";
import { useTemplateDownload } from "../src/hooks/useTemplateDownload";
import type { RmgDiagnosticSummary } from "../src/rmgDiagnostics";

class ResizeObserverMock {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

Object.defineProperty(globalThis, "ResizeObserver", { value: ResizeObserverMock, writable: true });
for (const method of ["hasPointerCapture", "setPointerCapture", "releasePointerCapture", "scrollIntoView"] as const) {
  Object.defineProperty(HTMLElement.prototype, method, { value: vi.fn(() => false), writable: true, configurable: true });
}

HTMLCanvasElement.prototype.getContext = vi.fn(() => new Proxy({}, {
  get: (_target, property) => (property === "createRadialGradient" || property === "createLinearGradient")
    ? () => ({ addColorStop: vi.fn() })
    : vi.fn()
})) as never;

HTMLCanvasElement.prototype.toBlob = vi.fn(function (this: HTMLCanvasElement, callback: BlobCallback, type?: string) {
  callback(new Blob(["preview"], { type: type ?? "image/png" }));
}) as never;

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.history.replaceState({}, "", "/");
  delete (window as Window & { showSaveFilePicker?: unknown }).showSaveFilePicker;
  vi.restoreAllMocks();
});

function getInputForLabel(container: HTMLElement, label: string): HTMLInputElement {
  const input = within(container).getByText(label).closest(".config-field")?.querySelector("input");
  expect(input).toBeTruthy();
  return input as HTMLInputElement;
}

function mockAnchorDownloads(): string[] {
  const downloads: string[] = [];
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    downloads.push(this.download);
  });
  return downloads;
}

function emptyDiagnostics(overrides: Partial<RmgDiagnosticSummary> = {}): RmgDiagnosticSummary {
  return { diagnostics: [], errors: [], warnings: [], infos: [], ...overrides };
}

describe("builder save and open", () => {
  it("saves under a filesystem-safe name and clears the unsaved marker", async () => {
    const user = userEvent.setup();
    const downloads = mockAnchorDownloads();
    render(<AppShell />);

    fireEvent.change(getInputForLabel(document.body, "Template Name"), { target: { value: "Duel: A/B?" } });
    expect(await screen.findByText("* Duel A B.oetd.json")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(downloads).toEqual(["Duel A B.oetd.json"]));
    expect(await screen.findByText("Duel A B.oetd.json")).toBeTruthy();
    expect(screen.queryByText("* Duel A B.oetd.json")).toBeNull();
    expect(await screen.findByText("Downloading Duel A B.oetd.json")).toBeTruthy();
    expect(window.localStorage.getItem(AUTOSAVE_KEY)).toBeNull();
  });

  it("keeps the unsaved marker when the save picker is cancelled", async () => {
    const user = userEvent.setup();
    Object.defineProperty(window, "showSaveFilePicker", {
      value: vi.fn(async () => { throw new DOMException("cancelled", "AbortError"); }),
      writable: true,
      configurable: true
    });
    render(<AppShell />);

    fireEvent.change(getInputForLabel(document.body, "Template Name"), { target: { value: "Picker Design" } });
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect((window as Window & { showSaveFilePicker?: unknown }).showSaveFilePicker).toHaveBeenCalled());
    expect(screen.getByText("* Picker Design.oetd.json")).toBeTruthy();
  });

  it("can open the same file twice in a row", async () => {
    const user = userEvent.setup();
    render(<AppShell />);

    const design = createDefaultDesign();
    design.templateName = "Reopened Design";
    const file = new File([serializeDesignFile(design)], "reopened.oetd.json", { type: "application/json" });
    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).toBeTruthy();

    await user.upload(input as HTMLInputElement, file);
    expect(await screen.findByDisplayValue("Reopened Design")).toBeTruthy();
    expect((input as HTMLInputElement).value).toBe("");

    fireEvent.change(getInputForLabel(document.body, "Template Name"), { target: { value: "Changed Afterwards" } });
    await user.upload(input as HTMLInputElement, file);
    await user.click(await screen.findByRole("button", { name: "Discard changes" }));

    expect(await screen.findByDisplayValue("Reopened Design")).toBeTruthy();
  });

  it("keeps working when browser storage is blocked", () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("The operation is insecure.", "SecurityError");
      }
    });
    try {
      render(<AppShell />);
      fireEvent.change(getInputForLabel(document.body, "Template Name"), { target: { value: "No Storage" } });
      expect(screen.getByText("* No Storage.oetd.json")).toBeTruthy();
    } finally {
      if (descriptor) Object.defineProperty(window, "localStorage", descriptor);
    }
  });
});

describe("builder JSON workflow", () => {
  it("survives clearing the JSON editor instead of looping until React gives up", async () => {
    render(<AppShell />);

    const editor = screen.getByLabelText("RMG JSON editor") as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: "" } });

    expect(await screen.findByDisplayValue("Custom Template")).toBeTruthy();
    expect(screen.queryByText("Ready to export.")).toBeNull();
  });

  it("survives a JSON edit that fails builder validation", async () => {
    render(<AppShell />);

    const editor = screen.getByLabelText("RMG JSON editor") as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: editor.value.replace('"name": "Custom Template"', '"name": ""') } });

    expect(await screen.findByDisplayValue("Custom Template")).toBeTruthy();
    expect(screen.queryByText("Ready to export.")).toBeNull();
  });

  it("makes the JSON editor read-only while the builder has validation errors", async () => {
    render(<AppShell />);

    const editor = screen.getByLabelText("RMG JSON editor") as HTMLTextAreaElement;
    expect(editor.readOnly).toBe(false);

    fireEvent.change(getInputForLabel(document.body, "Template Name"), { target: { value: "" } });

    await waitFor(() => expect((screen.getByLabelText("RMG JSON editor") as HTMLTextAreaElement).readOnly).toBe(true));
  });
});

describe("builder export", () => {
  it("offers export when only template diagnostics block it", () => {
    const design = createDefaultDesign();
    const exportJson = JSON.stringify(designToTemplate(design));
    const { result } = renderHook(() => useTemplateDownload({
      design,
      validation: { errors: [], warnings: [] },
      templateDiagnostics: emptyDiagnostics({
        errors: [{ code: "test_error", severity: "error", message: "Blocking diagnostic." } as RmgDiagnosticSummary["errors"][number]]
      }),
      exportFileName: "Custom Template.rmg.json",
      exportJson,
      forceExportJson: "",
      exportPreviewFileName: "Custom Template.png",
      previewAvailable: true,
      designBoardCanvas: null
    }));

    expect(result.current.exportPayload).toBe(exportJson);
    act(() => result.current.handleExportClick());
    expect(result.current.exportWarningOpen).toBe(true);
  });

  it("confirms builder exports with a toast", async () => {
    const user = userEvent.setup();
    const downloads = mockAnchorDownloads();
    render(<AppShell />);

    await user.click(screen.getByRole("button", { name: "Export" }));

    await waitFor(() => expect(downloads).toEqual(["Custom Template.rmg.json"]));
    expect(await screen.findByText("Downloading Custom Template.rmg.json")).toBeTruthy();
  });
});

describe("download helpers", () => {
  it("reports whether a file was saved, downloaded or cancelled", async () => {
    mockAnchorDownloads();
    const blob = new Blob(["{}"], { type: "application/json" });

    expect(await downloadBlob("a.json", blob, { preferSavePicker: true })).toBe("downloaded");

    const write = vi.fn(async () => {});
    const close = vi.fn(async () => {});
    Object.defineProperty(window, "showSaveFilePicker", {
      value: vi.fn(async () => ({ createWritable: async () => ({ write, close }) })),
      writable: true,
      configurable: true
    });
    expect(await downloadBlob("a.json", blob, { preferSavePicker: true })).toBe("saved");

    Object.defineProperty(window, "showSaveFilePicker", {
      value: vi.fn(async () => { throw new DOMException("cancelled", "AbortError"); }),
      writable: true,
      configurable: true
    });
    expect(await downloadBlob("a.json", blob, { preferSavePicker: true })).toBe("cancelled");
  });
});

describe("keyboard undo", () => {
  it("only undoes builder changes while the builder is showing", async () => {
    const user = userEvent.setup();
    render(<AppShell />);

    fireEvent.change(getInputForLabel(document.body, "Template Name"), { target: { value: "Kept Name" } });
    await user.click(within(screen.getByRole("navigation", { name: "Main navigation" })).getByRole("button", { name: "Browse" }));

    fireEvent.keyDown(document.body, { key: "z", ctrlKey: true });

    await user.click(within(screen.getByRole("navigation", { name: "Main navigation" })).getByRole("button", { name: "Builder" }));
    expect(screen.getByDisplayValue("Kept Name")).toBeTruthy();
  });

  it("undoes from sliders and checkboxes but leaves text fields to the browser", () => {
    render(<AppShell />);

    const nameInput = getInputForLabel(document.body, "Template Name");
    fireEvent.change(nameInput, { target: { value: "Undo Me" } });

    fireEvent.keyDown(nameInput, { key: "z", ctrlKey: true });
    expect(screen.getByDisplayValue("Undo Me")).toBeTruthy();

    const slider = document.querySelector<HTMLInputElement>('input[type="range"]');
    expect(slider).toBeTruthy();
    fireEvent.keyDown(slider as HTMLInputElement, { key: "z", ctrlKey: true });
    expect(screen.getByDisplayValue("Custom Template")).toBeTruthy();
  });
});

describe("routing", () => {
  it("tolerates trailing slashes and unknown paths", () => {
    expect(pageFromPathname("/browse/")).toBe("browse");
    expect(pageFromPathname("/reference//")).toBe("reference");
    expect(pageFromPathname("/install")).toBe("install");
    expect(pageFromPathname("/my-maps/")).toBe("my-maps");
    expect(pageFromPathname("/")).toBe("builder");
    expect(pageFromPathname("/nope")).toBe("builder");
  });
});

describe("dialog focus", () => {
  it("focuses the dialog itself so help tooltips do not pop open", async () => {
    render(
      <TooltipProvider>
        <Dialog open>
          <DialogContent>
            <DialogTitle>Rules</DialogTitle>
            <DialogDescription>Rules and victory.</DialogDescription>
            <HelpIcon tooltip="Explains the first field." />
            <input aria-label="First field" />
          </DialogContent>
        </Dialog>
      </TooltipProvider>
    );

    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(document.activeElement).toBe(dialog));
    expect(screen.queryByText("Explains the first field.")).toBeNull();
  });
});

describe("validation panel", () => {
  it("renders the balance score and its scale separately", () => {
    const analysis = analyzeTemplate(designToTemplate(createDefaultDesign()));
    render(
      <ValidationOutputPanel
        validation={{ errors: [], warnings: [] }}
        templateDiagnostics={emptyDiagnostics()}
        analysis={analysis}
        jsonValue="{}"
        jsonDirty={false}
        jsonValidationErrors={[]}
        onJsonChange={() => {}}
      />
    );

    expect(analysis.balanceScore).not.toBeNull();
    const gauge = screen.getByRole("img", { name: `Balance score ${analysis.balanceScore}/100` });
    expect(within(gauge).getByText(String(analysis.balanceScore))).toBeTruthy();
    expect(within(gauge).getByText("/ 100")).toBeTruthy();
  });

  it("does not claim the template is ready while JSON has errors", () => {
    render(
      <ValidationOutputPanel
        validation={{ errors: [], warnings: [] }}
        templateDiagnostics={emptyDiagnostics()}
        jsonValue="{}"
        jsonDirty
        jsonApplyError="Unexpected end of JSON input"
        jsonValidationErrors={[]}
        onJsonChange={() => {}}
      />
    );

    expect(screen.getByText("Unexpected end of JSON input")).toBeTruthy();
    expect(screen.queryByText("Ready to export.")).toBeNull();
  });
});

describe("rating controls", () => {
  it("pluralizes rating counts", () => {
    expect(formatRatingCount(0)).toBe("0 ratings");
    expect(formatRatingCount(1)).toBe("1 rating");
    expect(formatRatingCount(12)).toBe("12 ratings");
  });

  it("shows the average, the count and the viewer's own score", () => {
    render(<RatingSummary averageRating={4.5} ratingCount={1} viewerRating={4} />);

    expect(screen.getByText("4.5 / 5")).toBeTruthy();
    expect(screen.getByText("1 rating · your score 4")).toBeTruthy();
  });

  it("fills stars up to the viewer's rating and reports the chosen value", async () => {
    const user = userEvent.setup();
    const onRate = vi.fn();
    render(<StarRatingButtons mapTitle="Merchant Ring" viewerRating={3} disabled={false} onRate={onRate} />);

    const stars = screen.getAllByRole("button");
    expect(stars.map((star) => star.classList.contains("star-rating__star--filled"))).toEqual([true, true, true, false, false]);
    expect(screen.getByRole("button", { name: "Rate 3 stars for Merchant Ring" }).getAttribute("aria-pressed")).toBe("true");

    await user.click(screen.getByRole("button", { name: "Rate 5 stars for Merchant Ring" }));
    expect(onRate).toHaveBeenCalledWith(5);
  });

  it("explains why rating is disabled", () => {
    render(<StarRatingButtons mapTitle="Merchant Ring" disabled disabledReason="Sign in to rate maps" onRate={() => {}} />);

    const star = screen.getByRole("button", { name: "Rate 1 stars for Merchant Ring" }) as HTMLButtonElement;
    expect(star.disabled).toBe(true);
    expect(star.title).toBe("Sign in to rate maps");
  });
});

describe("community listing display", () => {
  it("only shows the template name badge when it adds information", () => {
    expect(showsTemplateNameBadge({ title: "Ice vs Fire", templateName: "Ice vs Fire" })).toBe(false);
    expect(showsTemplateNameBadge({ title: "Ice vs Fire", templateName: "  ice VS fire " })).toBe(false);
    expect(showsTemplateNameBadge({ title: "Ice vs Fire", templateName: "" })).toBe(false);
    expect(showsTemplateNameBadge({ title: "Ice vs Fire", templateName: undefined })).toBe(false);
    expect(showsTemplateNameBadge({ title: "Temple Border Clash", templateName: "Custom Template" })).toBe(true);
  });
});

describe("zone renames", () => {
  function renderWorkspace() {
    return renderHook(() => useBuilderWorkspace({ getJsonDirty: () => false, requestConfirmation: vi.fn() }));
  }

  it("moves guard-zone and orientation references to the new name, even after clearing the field", () => {
    const { result } = renderWorkspace();
    const spawn = result.current.design.zones.find((zone) => zone.name === "Spawn-1");
    const connection = result.current.design.connections[0];
    expect(spawn).toBeTruthy();
    expect(result.current.design.orientation.zeroAngleZone).toBe("Spawn-1");

    act(() => result.current.updateConnection(connection.id, (draft) => { draft.guardZone = "Spawn-1"; }));
    act(() => result.current.handleSelectZone(spawn!.id));
    act(() => result.current.updateZone((zone) => { zone.name = "Home"; }));

    expect(result.current.design.connections[0].guardZone).toBe("Home");
    expect(result.current.design.orientation.zeroAngleZone).toBe("Home");

    act(() => result.current.updateZone((zone) => { zone.name = ""; }));
    expect(result.current.design.connections[0].guardZone).toBe("Home");
    act(() => result.current.updateZone((zone) => { zone.name = "B"; }));
    act(() => result.current.updateZone((zone) => { zone.name = "Base"; }));

    expect(result.current.design.connections[0].guardZone).toBe("Base");
    expect(result.current.design.orientation.zeroAngleZone).toBe("Base");
  });

  it("leaves references to other zones alone", () => {
    const { result } = renderWorkspace();
    const spawn = result.current.design.zones.find((zone) => zone.name === "Spawn-1");
    const connection = result.current.design.connections[0];

    act(() => result.current.updateConnection(connection.id, (draft) => { draft.guardZone = "Neutral-3"; }));
    act(() => result.current.handleSelectZone(spawn!.id));
    act(() => result.current.updateZone((zone) => { zone.name = "Home"; }));

    expect(result.current.design.connections[0].guardZone).toBe("Neutral-3");
  });
});

describe("board moves", () => {
  it("treats a drop back onto the zone's own slot as no change", () => {
    const design = createDefaultDesign();
    const zone = design.zones[0];

    expect(moveZone(design, zone.id, { ...zone.position })).toBe(design);
  });
});
