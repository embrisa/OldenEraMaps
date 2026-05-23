// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  session: null as null | {
    user: {
      id: string;
      email: string;
      user_metadata: Record<string, string>;
    };
  },
  listeners: [] as Array<(event: string, session: unknown) => void>
}));

const communityApiMocks = vi.hoisted(() => ({
  myMaps: [] as Array<Record<string, unknown>>,
  deletedMapIds: [] as string[],
  updatePatches: [] as Array<{ mapId: string; patch: Record<string, unknown> }>,
  deleteAccountCalls: 0
}));

vi.mock("../src/community/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/community/auth")>();
  return {
    ...actual,
    getSession: vi.fn(async () => authMocks.session),
    onAuthStateChange: vi.fn((callback: (event: string, session: unknown) => void) => {
      authMocks.listeners.push(callback);
      return () => {
        authMocks.listeners = authMocks.listeners.filter((listener) => listener !== callback);
      };
    }),
    signInWithProvider: vi.fn(async () => {
      authMocks.session = createAuthSession();
      for (const listener of authMocks.listeners) listener("SIGNED_IN", authMocks.session);
    }),
    signOut: vi.fn(async () => {
      authMocks.session = null;
      for (const listener of authMocks.listeners) listener("SIGNED_OUT", null);
    }),
    deleteCurrentAccount: vi.fn(async () => {
      communityApiMocks.deleteAccountCalls += 1;
      authMocks.session = null;
      for (const listener of authMocks.listeners) listener("SIGNED_OUT", null);
    }),
    syncCurrentUserProfile: vi.fn(async () => {})
  };
});

vi.mock("../src/community/communityApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/community/communityApi")>();
  return {
    ...actual,
    listMyMaps: vi.fn(async () => ({ maps: communityApiMocks.myMaps })),
    updateMapListing: vi.fn(async (mapId: string, patch: Record<string, unknown>) => {
      communityApiMocks.updatePatches.push({ mapId, patch });
      communityApiMocks.myMaps = communityApiMocks.myMaps.map((map) => map.id === mapId ? { ...map, ...patch } : map);
    }),
    deleteMapListing: vi.fn(async (mapId: string) => {
      communityApiMocks.deletedMapIds.push(mapId);
      communityApiMocks.myMaps = communityApiMocks.myMaps.filter((map) => map.id !== mapId);
    })
  };
});

vi.mock("../src/community/uploadApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/community/uploadApi")>();
  return {
    ...actual,
    uploadCommunityMapToServer: vi.fn(async () => {
      throw new actual.ServerUploadError("Test: Supabase not available");
    })
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

import { AppShell } from "../src/components/AppShell";
import { COMMUNITY_MAP_CARD_PREVIEW_SIZE, COMMUNITY_MAP_DETAIL_PREVIEW_SIZE } from "../src/components/community/CommunityMapCanvasPreview";
import { COMMUNITY_TEMPLATE_PREVIEW_IMAGE_SIZE } from "../src/community/communityPreviewImage";
import { buildBoardRenderState } from "../src/components/designBoardRender";
import { hoverCardPosition } from "../src/components/ZoneHoverCard";
import { zoneHoverSections } from "../src/components/zoneHoverContent";
import { Button } from "../src/components/ui/button";
import { NativeSelect } from "../src/components/ui/form-controls";
import {
  SCHEMATIC_BOARD_BACKGROUND_HEIGHT,
  SCHEMATIC_BOARD_BACKGROUND_WIDTH,
} from "../src/boardAssets";
import { snapPointToBoardSlot } from "../src/boardSlots";
import { addZone, createDefaultDesign, parseDesignOrTemplateFile, serializeDesignFile } from "../src/design";
import { buildPreviewDesign, PREVIEW_RENDERER_VERSION } from "../src/community/previewDesign";

const BOARD_TEST_WIDTH = 800;
const BOARD_TEST_HEIGHT = Math.round(
  (BOARD_TEST_WIDTH * SCHEMATIC_BOARD_BACKGROUND_HEIGHT) / SCHEMATIC_BOARD_BACKGROUND_WIDTH
);

function mockDesignBoardLayout(): { restore(): void } {
  const clientWidth = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(BOARD_TEST_WIDTH);
  const clientHeight = vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(BOARD_TEST_HEIGHT);
  const rect = vi.spyOn(HTMLCanvasElement.prototype, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: BOARD_TEST_WIDTH,
    bottom: BOARD_TEST_HEIGHT,
    width: BOARD_TEST_WIDTH,
    height: BOARD_TEST_HEIGHT,
    toJSON: () => ({})
  } as DOMRect);

  return {
    restore() {
      clientWidth.mockRestore();
      clientHeight.mockRestore();
      rect.mockRestore();
    }
  };
}

class ResizeObserverMock {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

Object.defineProperty(globalThis, "ResizeObserver", {
  value: ResizeObserverMock,
  writable: true
});

Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
  value: () => false,
  writable: true,
  configurable: true
});

Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
  value: () => {},
  writable: true,
  configurable: true
});

Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", {
  value: () => {},
  writable: true,
  configurable: true
});

Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
  value: vi.fn(),
  writable: true
});

afterEach(() => {
  cleanup();
  authMocks.session = null;
  authMocks.listeners = [];
  communityApiMocks.myMaps = [];
  communityApiMocks.deletedMapIds = [];
  communityApiMocks.updatePatches = [];
  communityApiMocks.deleteAccountCalls = 0;
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.history.replaceState({}, "", "/");
  delete (window as Window & { showSaveFilePicker?: unknown }).showSaveFilePicker;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  setTransform: vi.fn(),
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  strokeRect: vi.fn(),
  beginPath: vi.fn(),
  closePath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  drawImage: vi.fn(),
  clip: vi.fn(),
  fillText: vi.fn(),
  quadraticCurveTo: vi.fn(),
  setLineDash: vi.fn(),
  strokeText: vi.fn(),
  createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() }))
})) as never;

HTMLCanvasElement.prototype.toBlob = vi.fn(function (
  this: HTMLCanvasElement,
  callback: BlobCallback,
  type?: string
) {
  callback(new Blob(["preview"], { type: type ?? "image/png" }));
}) as never;

describe("React UI shell", () => {
  async function chooseSelectOption(user: ReturnType<typeof userEvent.setup>, label: string, option: string): Promise<void> {
    const field = screen.getByText(label).closest(".config-field");
    const select = field?.querySelector<HTMLSelectElement>("select");
    expect(select).toBeTruthy();
    const nextOption = Array.from((select as HTMLSelectElement).options).find((candidate) => candidate.text === option);
    expect(nextOption).toBeTruthy();
    await user.selectOptions(select as HTMLSelectElement, (nextOption as HTMLOptionElement).value);
  }

  async function chooseSelectOptionInContainer(
    user: ReturnType<typeof userEvent.setup>,
    container: HTMLElement,
    label: string,
    option: string
  ): Promise<void> {
    const field = within(container).getByText(label).closest(".config-field");
    const select = field?.querySelector<HTMLSelectElement>("select");
    expect(select).toBeTruthy();
    const nextOption = Array.from((select as HTMLSelectElement).options).find((candidate) => candidate.text === option);
    expect(nextOption).toBeTruthy();
    await user.selectOptions(select as HTMLSelectElement, (nextOption as HTMLOptionElement).value);
  }

  function getInputForLabel(container: HTMLElement, label: string): HTMLInputElement {
    const field = within(container).getByText(label).closest(".config-field");
    const input = field?.querySelector("input");
    expect(input).toBeTruthy();
    return input as HTMLInputElement;
  }

  function getSelectForLabel(container: HTMLElement, label: string): HTMLSelectElement {
    const field = within(container).getByText(label).closest(".config-field");
    const select = field?.querySelector("select");
    expect(select).toBeTruthy();
    return select as HTMLSelectElement;
  }

  function getSliderValueInputForLabel(container: HTMLElement, label: string): HTMLInputElement {
    const field = within(container).getByText(label).closest(".config-field");
    const inputs = field?.querySelectorAll("input");
    expect(inputs?.length).toBeGreaterThan(1);
    return inputs?.[1] as HTMLInputElement;
  }

  function getRangeInputByLabel(label: string): HTMLInputElement {
    const input = screen.getAllByLabelText(label).find((element): element is HTMLInputElement =>
      element instanceof HTMLInputElement && element.type === "range"
    );
    expect(input).toBeTruthy();
    return input as HTMLInputElement;
  }

  function mockAnchorDownload() {
    const createObjectUrl = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test-export");
    const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const originalCreateElement = document.createElement.bind(document);
    const anchor = originalCreateElement("a");
    const anchorClick = vi.spyOn(anchor, "click").mockImplementation(() => {});
    const createElement = vi.spyOn(document, "createElement").mockImplementation(((tagName: string, options?: ElementCreationOptions) => {
      if (tagName === "a") {
        return anchor;
      }
      return originalCreateElement(tagName, options);
    }) as typeof document.createElement);

    return { anchor, anchorClick, createElement, createObjectUrl, revokeObjectUrl };
  }

  async function openHeaderMenu(user: ReturnType<typeof userEvent.setup>): Promise<void> {
    await user.click(screen.getByRole("button", { name: "Open header menu" }));
  }

  it("renders shadcn-style primitive buttons without string templates", () => {
    render(<Button variant="primary">Export</Button>);

    expect(screen.getByRole("button", { name: "Export" }).className).toContain("oe-button--primary");
  });

  it("keeps page scrolling available when a select dropdown opens", async () => {
    const user = userEvent.setup();
    render(
      <div style={{ height: "200vh" }}>
        <NativeSelect aria-label="Map size" defaultValue="m">
          <option value="s">Small</option>
          <option value="m">Medium</option>
          <option value="l">Large</option>
        </NativeSelect>
      </div>
    );

    expect(document.body.style.overflow).toBe("");

    await user.click(screen.getByRole("combobox", { name: "Map size" }));

    expect(await screen.findByRole("option", { name: "Large" })).toBeTruthy();
    expect(document.body.style.overflow).toBe("");
  });

  it("renders the select chevron inside the select shell instead of as a separate row", () => {
    const { container } = render(
      <NativeSelect aria-label="Map size" defaultValue="m">
        <option value="s">Small</option>
        <option value="m">Medium</option>
      </NativeSelect>
    );

    const shell = container.querySelector(".oe-select-shell");
    expect(shell).toBeTruthy();
    expect(shell?.querySelector("select")).toBeTruthy();
    expect(shell?.querySelector(".oe-select__icon")).toBeTruthy();
    expect((shell as HTMLElement).children.length).toBe(2);
  });

  it("renders the dense builder workflow and can add a neutral zone", async () => {
    const user = userEvent.setup();
    render(<AppShell />);

    expect(screen.getByText("Olden Era RMG Studio")).toBeTruthy();
    expect(screen.getByRole("contentinfo", { name: "Olden Era Maps footer" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "RMG Template Builder" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Browse Community Maps" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "RMG JSON Reference Guide" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Installation Guide" })).toBeTruthy();
    expect(screen.getByText(/Heroes of Might and Magic: Olden Era map templates/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Export/i })).toBeTruthy();
    const boardShell = document.querySelector(".design-board-shell");
    expect(boardShell).toBeTruthy();
    expect(within(boardShell as HTMLElement).getByRole("button", { name: "Spawn" })).toBeTruthy();
    expect(within(boardShell as HTMLElement).getByRole("button", { name: "Neutral" })).toBeTruthy();
    expect(within(boardShell as HTMLElement).getByRole("button", { name: "Hub" })).toBeTruthy();
    expect(within(boardShell as HTMLElement).getByRole("button", { name: "Road Mode" })).toBeTruthy();
    expect(within(boardShell as HTMLElement).getByRole("button", { name: "Connections" })).toBeTruthy();
    const advancedSettings = document.querySelector(".advanced-settings-shell");
    expect(advancedSettings).toBeTruthy();
    expect(within(advancedSettings as HTMLElement).getByRole("heading", { name: "Advanced Settings" })).toBeTruthy();
    expect(within(advancedSettings as HTMLElement).getByRole("button", { name: "Layout Profiles" })).toBeTruthy();
    expect(within(advancedSettings as HTMLElement).getByRole("button", { name: "Balanced Random" })).toBeTruthy();
    const legend = screen.getByRole("list", { name: "Schematic board legend" });
    expect(within(legend).getByText("Badge: role or player")).toBeTruthy();
    expect(within(legend).getByText("Same fill color: matching zone settings")).toBeTruthy();
    expect(within(legend).getByText("Green border: easy zone")).toBeTruthy();
    expect(within(legend).getByText("Orange border: medium zone")).toBeTruthy();
    expect(within(legend).getByText("Red border: hard zone")).toBeTruthy();
    expect(within(legend).getByText("City Hold win condition")).toBeTruthy();
    expect(within(legend).getByText("Natural expansion")).toBeTruthy();
    expect(within(legend).getByText("Guard pressure")).toBeTruthy();
    expect(within(legend).getByText("Resource / eco pressure")).toBeTruthy();
    expect(within(legend).getByText("Structure density")).toBeTruthy();
    expect(within(legend).getByText("Biome override")).toBeTruthy();
    expect(within(legend).getByText("Extra cities")).toBeTruthy();
    expect(within(legend).getByText("Neutral ruins")).toBeTruthy();
    expect(within(legend).getByText("Roads disabled")).toBeTruthy();
    expect(within(legend).getByText("Footholds disabled")).toBeTruthy();
    expect(within(legend).getByText("💰")).toBeTruthy();
    expect(within(legend).getByText("🚫")).toBeTruthy();
    expect(within(legend).getByText("⛔")).toBeTruthy();

    await user.click(screen.getAllByRole("button", { name: "Neutral" })[0]);

    expect(screen.getAllByText("4").length).toBeGreaterThan(0);
    expect(screen.getByText("Neutral-4")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Rules" })).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: "Generate roads in this zone" })).toBeTruthy();
  });

  it("disables add and duplicate controls at the 32-zone limit", async () => {
    const user = userEvent.setup();
    let saved = createDefaultDesign();
    while (saved.zones.length < 32) {
      saved = addZone(saved, "Neutral");
    }
    saved.templateName = "Zone Limit Template";
    window.localStorage.setItem("olden-era-template-generator.autosave", serializeDesignFile(saved));

    render(<AppShell />);

    expect(await screen.findByRole("status", { name: "Autosaved design available" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Recover" }));

    const boardShell = document.querySelector(".design-board-shell") as HTMLElement | null;
    expect(boardShell).toBeTruthy();

    const limitMessage = "Zone limit reached: templates support at most 32 zones, so adding and duplicating zones is disabled.";
    const spawnButton = within(boardShell as HTMLElement).getByRole("button", { name: "Spawn" }) as HTMLButtonElement;
    const neutralButton = within(boardShell as HTMLElement).getByRole("button", { name: "Neutral" }) as HTMLButtonElement;
    const hubButton = within(boardShell as HTMLElement).getByRole("button", { name: "Hub" }) as HTMLButtonElement;
    const duplicateButton = screen.getByRole("button", { name: "Duplicate" }) as HTMLButtonElement;

    expect(await screen.findByText("* Zone Limit Template.oetd.json")).toBeTruthy();
    expect(spawnButton.disabled).toBe(true);
    expect(neutralButton.disabled).toBe(true);
    expect(hubButton.disabled).toBe(true);
    expect(duplicateButton.disabled).toBe(true);
    expect(screen.getAllByText(limitMessage).length).toBeGreaterThan(0);
  });

  it("surfaces release import parser errors for unsupported legacy settings files", async () => {
    render(<AppShell />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(input).toBeTruthy();
    const file = new File([`{
      "templateName": "Legacy Settings",
      "playerCount": 2,
      "neutralZoneCount": 1,
      "topology": "Chain",
      "generateRoads": true
    }`], "legacy-settings.json", { type: "application/json" });

    fireEvent.change(input as HTMLInputElement, { target: { files: [file] } });

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Legacy generator settings files are no longer supported");
    expect(alert.textContent).toContain("design_file");
    expect(alert.textContent).toContain("rmg_template");
  });

  it("separates the layout board and validation JSON editor into workspace tabs", async () => {
    const user = userEvent.setup();
    render(<AppShell />);

    const toolbar = document.querySelector(".studio-toolbar");
    expect(toolbar).toBeTruthy();
    expect(document.querySelector(".studio-board-column")).toBeNull();

    const workspaceTabs = screen.getByRole("tablist", { name: "Builder workspace view" });
    const layoutTab = within(workspaceTabs).getByRole("tab", { name: "Design Board" });
    const jsonTab = within(workspaceTabs).getByRole("tab", { name: "Validation & JSON" });
    expect(within(toolbar as HTMLElement).getByRole("tablist", { name: "Builder workspace view" })).toBeTruthy();

    expect(layoutTab.getAttribute("data-state")).toBe("active");
    expect(jsonTab.getAttribute("data-state")).toBe("inactive");
    expect(screen.getByRole("list", { name: "Schematic board legend" })).toBeTruthy();
    expect(tabPanelDisplay(screen.getByLabelText("RMG JSON editor"))).toBe("none");

    await user.click(jsonTab);

    expect(layoutTab.getAttribute("data-state")).toBe("inactive");
    expect(jsonTab.getAttribute("data-state")).toBe("active");
    expect(tabPanelDisplay(screen.getByRole("list", { name: "Schematic board legend", hidden: true }))).toBe("none");
    expect(screen.getByText("Ready to export.")).toBeTruthy();
    expect(tabPanelDisplay(screen.getByLabelText("RMG JSON editor"))).not.toBe("none");
  });

  it("keeps builder validation errors visible on the design board tab", async () => {
    const user = userEvent.setup();
    render(<AppShell />);

    const workspaceTabs = screen.getByRole("tablist", { name: "Builder workspace view" });
    expect(within(workspaceTabs).getByRole("tab", { name: "Design Board" }).getAttribute("data-state")).toBe("active");
    expect(tabPanelDisplay(screen.getByLabelText("RMG JSON editor"))).toBe("none");

    await user.clear(screen.getByDisplayValue("Custom Template"));

    const validationAlert = screen.getByText("Template name is required.");
    const validationSummary = validationAlert.closest(".builder-validation-summary");
    const layoutPanel = validationAlert.closest(".oe-tab-panel");
    expect(layoutPanel).toBeTruthy();
    expect(layoutPanel?.getAttribute("data-state")).toBe("active");
    expect(validationSummary).toBeTruthy();
    expect((validationSummary as HTMLElement).contains(validationAlert)).toBe(true);
  });

  it("navigates to the in-app RMG JSON reference page from the header menu and footer", async () => {
    const user = userEvent.setup();
    render(<AppShell />);

    await openHeaderMenu(user);
    await user.click(screen.getByRole("button", { name: "Reference" }));

    const referenceRegion = await screen.findByRole("region", { name: "RMG JSON reference guide page" });
    expect(within(referenceRegion).getByText("RMG JSON Reference Guide")).toBeTruthy();
    expect(within(referenceRegion).getAllByText(/Builder to Export/i).length).toBeGreaterThan(0);
    expect(within(referenceRegion).getByText("Plain English Map Terms")).toBeTruthy();
    expect(within(referenceRegion).getByText(/one area of the map, like a player start/i)).toBeTruthy();
    expect(within(referenceRegion).getAllByText("Field Directory").length).toBeGreaterThan(0);
    expect(within(referenceRegion).getByRole("link", { name: "Official Patterns" }).getAttribute("href")).toBe("#official-patterns");
    expect(within(referenceRegion).getByText("zone content values")).toBeTruthy();
    expect(within(referenceRegion).getAllByText("mainObjects").length).toBeGreaterThan(0);
    expect(within(referenceRegion).getAllByText("contentCountLimits").length).toBeGreaterThan(0);
    expect(within(referenceRegion).getByText("What Actually Changes The Match?")).toBeTruthy();
    expect(within(referenceRegion).getByText("Official Template Patterns")).toBeTruthy();
    expect(within(referenceRegion).getByText("Blitz-style pressure")).toBeTruthy();
    expect(within(referenceRegion).getByText("Jebus Cross-style contest center")).toBeTruthy();
    expect(within(referenceRegion).getByText("connectionsPlacement")).toBeTruthy();

    await user.type(within(referenceRegion).getByRole("textbox", { name: "Search reference fields" }), "cityHold");
    expect(within(referenceRegion).getByText("cityHold / cityHoldDays")).toBeTruthy();
    expect(within(referenceRegion).getAllByText("holdCityWinCon").length).toBeGreaterThan(0);
    expect(within(referenceRegion).queryByText("connectionsPlacement")).toBeNull();

    await user.clear(within(referenceRegion).getByRole("textbox", { name: "Search reference fields" }));
    expect(window.location.pathname).toBe("/reference");

    await user.click(screen.getByRole("link", { name: "RMG Template Builder" }));
    expect(window.location.pathname).toBe("/");

    await user.click(screen.getByRole("link", { name: "RMG JSON Reference Guide" }));
    expect(await screen.findByRole("region", { name: "RMG JSON reference guide page" })).toBeTruthy();
    expect(window.location.pathname).toBe("/reference");
  });

  it("navigates to the installation guide and shows OS and launcher paths", async () => {
    const user = userEvent.setup();
    render(<AppShell />);

    await openHeaderMenu(user);
    await user.click(screen.getByRole("button", { name: "Install" }));

    const installRegion = await screen.findByRole("region", { name: "Olden Era installation guide page" });
    expect(within(installRegion).getByRole("heading", { name: "Installation Guide" })).toBeTruthy();
    expect(within(installRegion).getByText("Where to Buy and Install")).toBeTruthy();
    expect(within(installRegion).getAllByRole("link").some((link) => link.getAttribute("href")?.includes("store.steampowered.com"))).toBe(true);
    expect(within(installRegion).getByRole("link", { name: /Ubisoft Store/i }).getAttribute("href")).toContain("store.ubisoft.com");
    expect(within(installRegion).getByText(/Windows: Steam and Ubisoft Connect/i)).toBeTruthy();
    expect(within(installRegion).getByText(/Linux: Steam with Proton/i)).toBeTruthy();
    expect(within(installRegion).getByRole("heading", { name: "Steam Deck" })).toBeTruthy();
    expect(within(installRegion).getByRole("heading", { name: "macOS" })).toBeTruthy();
    expect(within(installRegion).getAllByText(/CrossOver Games/i).length).toBeGreaterThan(0);
    expect(within(installRegion).getByText(/Library\/Application Support\/CrossOver\/Bottles\/Steam/i)).toBeTruthy();
    expect(within(installRegion).getByRole("heading", { name: "Map Preview Images" })).toBeTruthy();
    expect(within(installRegion).getByText("My Template.png")).toBeTruthy();
    expect(within(installRegion).getAllByText(/HeroesOldenEra_Data\/StreamingAssets\/map_templates/i).length).toBeGreaterThan(0);
    expect(window.location.pathname).toBe("/install");

    await user.click(screen.getByRole("link", { name: "RMG Template Builder" }));
    expect(window.location.pathname).toBe("/");

    await user.click(screen.getByRole("link", { name: "Installation Guide" }));
    expect(await screen.findByRole("region", { name: "Olden Era installation guide page" })).toBeTruthy();
    expect(window.location.pathname).toBe("/install");
  });

  it("can deselect a newly added zone by clicking empty board space", async () => {
    const user = userEvent.setup();
    const boardLayout = mockDesignBoardLayout();

    render(<AppShell />);

    await user.click(screen.getAllByRole("button", { name: "Neutral" })[0]);
    expect(screen.getByText("Neutral-4")).toBeTruthy();

    fireEvent.pointerDown(screen.getByLabelText("Schematic design board"), { clientX: 8, clientY: 8, pointerId: 1 });

    expect(screen.queryByText("Neutral-4")).toBeNull();
    expect(screen.getByText("Add a zone to begin.")).toBeTruthy();

    const templateName = screen.getByDisplayValue("Custom Template");
    await user.clear(templateName);
    await user.type(templateName, "Deselected Template");

    expect(screen.queryByText("Neutral-4")).toBeNull();

    boardLayout.restore();
  });

  it("selects only the new zone after adding from an empty board selection", async () => {
    const user = userEvent.setup();
    const boardLayout = mockDesignBoardLayout();

    render(<AppShell />);

    fireEvent.pointerDown(screen.getByLabelText("Schematic design board"), { clientX: 8, clientY: 8, pointerId: 1 });
    expect(screen.getByText("Add a zone to begin.")).toBeTruthy();

    await user.click(screen.getAllByRole("button", { name: "Neutral" })[0]);

    expect(screen.getByText("Neutral-4")).toBeTruthy();
    expect(screen.queryByText("Add a zone to begin.")).toBeNull();

    fireEvent.pointerDown(screen.getByLabelText("Schematic design board"), { clientX: 8, clientY: 8, pointerId: 2 });

    expect(screen.queryByText("Neutral-4")).toBeNull();
    expect(screen.getByText("Add a zone to begin.")).toBeTruthy();

    boardLayout.restore();
  });

  it("clears connection selection when adding a zone from a non-zone selection", async () => {
    const user = userEvent.setup();
    const boardLayout = mockDesignBoardLayout();

    render(<AppShell />);

    const board = screen.getByLabelText("Schematic design board");
    fireEvent.pointerDown(board, {
      clientX: Math.round(BOARD_TEST_WIDTH * 0.34),
      clientY: Math.round(BOARD_TEST_HEIGHT * 0.5),
      pointerId: 1
    });

    expect(screen.getByRole("button", { name: "Edit Path-1-3" })).toBeTruthy();

    await user.click(screen.getAllByRole("button", { name: "Neutral" })[0]);

    expect(screen.getByText("Neutral-4")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Edit Path-1-3" })).toBeNull();

    fireEvent.pointerDown(board, { clientX: 8, clientY: 8, pointerId: 2 });

    expect(screen.queryByText("Neutral-4")).toBeNull();
    expect(screen.getByText("Add a zone to begin.")).toBeTruthy();

    boardLayout.restore();
  });

  it("shows a tidy zone configuration window when hovering a board zone", () => {
    const boardLayout = mockDesignBoardLayout();
    const inspectorRect = {
      left: 920,
      top: 140,
      width: 380,
      height: 620,
      right: 1300,
      bottom: 760,
      x: 920,
      y: 140,
      toJSON: () => ({})
    } as DOMRect;
    const hoverCardWidth = Math.min(Math.max(320, inspectorRect.width), window.innerWidth - 16);
    const expectedLeft = Math.max(8, Math.min(inspectorRect.left + inspectorRect.width - hoverCardWidth, window.innerWidth - hoverCardWidth - 8));

    render(<AppShell />);

    const inspector = document.querySelector(".studio-side .inspector-card") as HTMLElement;
    const inspectorRectSpy = vi.spyOn(inspector, "getBoundingClientRect").mockReturnValue(inspectorRect);

    const boardCenterY = Math.round(BOARD_TEST_HEIGHT * 0.5);
    fireEvent.pointerMove(screen.getByLabelText("Schematic design board"), {
      clientX: Math.round(BOARD_TEST_WIDTH * 0.18),
      clientY: boardCenterY,
      pointerId: 1
    });

    const hover = screen.getByRole("tooltip", { name: "Spawn-1 configuration" });
    const initialLeft = hover.style.left;
    const initialTop = hover.style.top;
    expect(initialLeft).toBe(`${expectedLeft}px`);
    expect(initialTop).toBe("8px");
    expect(hover.style.width).toBe(`${inspectorRect.width}px`);
    expect(hover.closest(".design-board-shell")).toBeNull();
    expect(within(hover).getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual([
      "Highlights",
      "Basics",
      "Terrain",
      "Guards",
      "Rules",
      "Content"
    ]);
    expect(within(hover).queryByText("Guarded Pool")).toBeNull();
    expect(within(hover).getByText("Roads Enabled")).toBeTruthy();
    expect(hover.querySelector(".zone-hover-card__value-grid")).toBeTruthy();
    expect(hover.querySelectorAll(".zone-hover-card__value--right").length).toBeGreaterThan(0);

    fireEvent.pointerMove(screen.getByLabelText("Schematic design board"), {
      clientX: Math.round(BOARD_TEST_WIDTH * 0.18) + 6,
      clientY: boardCenterY + 4,
      pointerId: 1
    });

    const movedHover = screen.getByRole("tooltip", { name: "Spawn-1 configuration" });
    expect(movedHover.style.left).toBe(initialLeft);
    expect(movedHover.style.top).toBe(initialTop);
    expect(within(movedHover).getByText("Highlights")).toBeTruthy();

    fireEvent.pointerMove(screen.getByLabelText("Schematic design board"), {
      clientX: Math.round(BOARD_TEST_WIDTH * 0.82),
      clientY: boardCenterY,
      pointerId: 1
    });

    const nextHover = screen.getByRole("tooltip", { name: "Spawn-2 configuration" });
    expect(nextHover.style.left).toBe(`${expectedLeft}px`);
    expect(nextHover.style.top).toBe("8px");

    inspectorRectSpy.mockRestore();
    boardLayout.restore();
  });

  it("anchors the hover card over the regular zone inspector window", () => {
    const anchorRect = { left: 920, top: 140, width: 380, height: 620 };
    const hoverCardWidth = Math.min(Math.max(320, anchorRect.width), window.innerWidth - 16);
    const expectedLeft = Math.max(8, Math.min(anchorRect.left + anchorRect.width - hoverCardWidth, window.innerWidth - hoverCardWidth - 8));

    const style = hoverCardPosition(anchorRect);

    expect(style.left).toBe(expectedLeft);
    expect(style.top).toBe(8);
    expect(style.width).toBe(anchorRect.width);
    expect(style.maxHeight).toBe(window.innerHeight - 16);
  });

  it("closes the zone hover card immediately after leaving the board", () => {
    const boardLayout = mockDesignBoardLayout();

    render(<AppShell />);

    const board = screen.getByLabelText("Schematic design board");
    fireEvent.pointerMove(board, {
      clientX: Math.round(BOARD_TEST_WIDTH * 0.18),
      clientY: Math.round(BOARD_TEST_HEIGHT * 0.5),
      pointerId: 1
    });

    expect(screen.getByRole("tooltip", { name: "Spawn-1 configuration" })).toBeTruthy();

    fireEvent.pointerLeave(board);

    expect(screen.queryByRole("tooltip", { name: "Spawn-1 configuration" })).toBeNull();

    boardLayout.restore();
  });

  it("closes the zone hover card when clicking a board zone", () => {
    const boardLayout = mockDesignBoardLayout();

    render(<AppShell />);

    const board = screen.getByLabelText("Schematic design board");
    const zonePoint = {
      clientX: Math.round(BOARD_TEST_WIDTH * 0.18),
      clientY: Math.round(BOARD_TEST_HEIGHT * 0.5),
      pointerId: 1
    };
    fireEvent.pointerMove(board, zonePoint);

    expect(screen.getByRole("tooltip", { name: "Spawn-1 configuration" })).toBeTruthy();

    fireEvent.pointerDown(board, zonePoint);
    fireEvent.pointerUp(board, zonePoint);

    expect(screen.queryByRole("tooltip", { name: "Spawn-1 configuration" })).toBeNull();

    fireEvent.pointerMove(board, {
      ...zonePoint,
      clientX: zonePoint.clientX + 4
    });

    expect(screen.getByRole("tooltip", { name: "Spawn-1 configuration" })).toBeTruthy();

    const inspector = screen.getByRole("heading", { name: "Zone Inspector" }).closest("section");
    expect(within(inspector as HTMLElement).getByDisplayValue("Spawn-1")).toBeTruthy();

    boardLayout.restore();
  });

  it("snaps dragged zones onto board slots and persists the slot coordinate", async () => {
    const boardLayout = mockDesignBoardLayout();

    render(<AppShell />);

    const board = screen.getByLabelText("Schematic design board");
    const startPoint = {
      clientX: Math.round(BOARD_TEST_WIDTH * 0.5),
      clientY: Math.round(BOARD_TEST_HEIGHT * 0.5),
      pointerId: 1
    };
    const targetPoint = {
      clientX: Math.round(BOARD_TEST_WIDTH * 0.74),
      clientY: Math.round(BOARD_TEST_HEIGHT * 0.67),
      pointerId: 1
    };

    fireEvent.pointerDown(board, startPoint);
    fireEvent.pointerMove(board, targetPoint);
    fireEvent.pointerUp(board, targetPoint);

    await waitFor(() => {
      const saved = window.localStorage.getItem("olden-era-template-generator.autosave");
      expect(saved).toBeTruthy();
      const design = parseDesignOrTemplateFile(saved ?? "");
      expect(design.zones.find((zone) => zone.name === "Neutral-3")?.position).toEqual(
        snapPointToBoardSlot({
          x: targetPoint.clientX / BOARD_TEST_WIDTH,
          y: targetPoint.clientY / BOARD_TEST_HEIGHT,
        })
      );
    });

    boardLayout.restore();
  });

  it("formats all zone hover sections from the current zone configuration", () => {
    const zone = createDefaultDesign().zones[0];
    zone.guardedContentPool = ["classic_template_pool_random_t2_item", "classic_template_pool_random_t2_pandora"];
    zone.roads = false;

    const sections = zoneHoverSections(zone);
    const labels = sections.flatMap((section) => section.items.map((item) => item.label));

    expect(sections.map((section) => section.title)).toEqual(["Highlights", "Basics", "Terrain", "Guards", "Rules", "Content"]);
    expect(labels).toContain("Standard size");
    expect(labels).toContain("Guarded Pool");
    expect(labels).toContain("Reaction Distribution");
    expect(labels).toContain("Match Adjacent Neutral Castles");
    expect(labels).toContain("Neutral Castles as Ruins");
    expect(sections.flatMap((section) => section.items).find((item) => item.label === "Guarded Pool")?.value).toBe("Guarded: T2 Guarded Items, T2 Guarded Pandora Boxes");
    expect(sections.flatMap((section) => section.items).find((item) => item.label === "Roads")?.value).toBe("Roads Disabled");
  });

  it("keeps neutral castle toggles out of template settings and in the zone inspector", async () => {
    const boardLayout = mockDesignBoardLayout();
    render(<AppShell />);

    expect(screen.queryByRole("checkbox", { name: "Match adjacent neutral castles" })).toBeNull();
    expect(screen.queryByRole("checkbox", { name: "Neutral castles as ruins" })).toBeNull();

    fireEvent.pointerDown(screen.getByLabelText("Schematic design board"), {
      clientX: Math.round(BOARD_TEST_WIDTH * 0.5),
      clientY: Math.round(BOARD_TEST_HEIGHT * 0.5),
      pointerId: 1
    });

    const inspector = screen.getByRole("heading", { name: "Zone Inspector" }).closest("section") as HTMLElement;
    expect(within(inspector).getByDisplayValue("Neutral-3")).toBeTruthy();
    expect(within(inspector).getByRole("checkbox", { name: "Match adjacent neutral castles" })).toBeTruthy();
    expect(within(inspector).getByRole("checkbox", { name: "Make this zone's castles ruins" })).toBeTruthy();

    boardLayout.restore();
  });

  it("keeps the current dirty design when New is canceled", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<AppShell />);

    await user.click(screen.getAllByRole("button", { name: "Neutral" })[0]);
    expect(screen.getByText("Neutral-4")).toBeTruthy();

    await openHeaderMenu(user);
    await user.click(screen.getByRole("button", { name: "New" }));

    expect(confirm).toHaveBeenCalledWith("Discard unsaved changes?");
    expect(screen.getByText("Neutral-4")).toBeTruthy();
    expect(screen.getAllByText("4").length).toBeGreaterThan(0);
  });

  it("recovers a valid autosaved design on initial load", async () => {
    const user = userEvent.setup();
    const saved = addZone(createDefaultDesign(), "Neutral");
    saved.templateName = "Recovered Template";
    window.localStorage.setItem("olden-era-template-generator.autosave", serializeDesignFile(saved));
    const confirm = vi.spyOn(window, "confirm");

    render(<AppShell />);

    expect(confirm).not.toHaveBeenCalled();
    expect(await screen.findByRole("status", { name: "Autosaved design available" })).toBeTruthy();
    expect(screen.getByText("Recovered Template")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Recover" }));

    expect(await screen.findByText("* Recovered Template.oetd.json")).toBeTruthy();
    expect(screen.getAllByText("4").length).toBeGreaterThan(0);
  });

  it("dismisses an autosaved design without prompting again", async () => {
    const user = userEvent.setup();
    const saved = addZone(createDefaultDesign(), "Neutral");
    saved.templateName = "Stale Template";
    window.localStorage.setItem("olden-era-template-generator.autosave", serializeDesignFile(saved));
    const confirm = vi.spyOn(window, "confirm");

    render(<AppShell />);
    expect(await screen.findByRole("status", { name: "Autosaved design available" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(confirm).not.toHaveBeenCalled();
    expect(window.localStorage.getItem("olden-era-template-generator.autosave")).toBeNull();
    expect(screen.queryByRole("status", { name: "Autosaved design available" })).toBeNull();

    cleanup();
    render(<AppShell />);

    expect(screen.queryByRole("status", { name: "Autosaved design available" })).toBeNull();
    expect(confirm).not.toHaveBeenCalled();
  });

  it("uses the OS save dialog for builder saves when the file picker API is available", async () => {
    const user = userEvent.setup();
    const write = vi.fn(async (_chunk: Blob) => {});
    const close = vi.fn(async () => {});
    const createWritable = vi.fn(async () => ({ write, close }));
    const showSaveFilePicker = vi.fn(async () => ({ createWritable }));
    Object.defineProperty(window, "showSaveFilePicker", {
      value: showSaveFilePicker,
      writable: true,
      configurable: true
    });
    const createObjectUrl = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test-save");

    render(<AppShell />);

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(showSaveFilePicker).toHaveBeenCalledWith({
        suggestedName: "Custom Template.oetd.json",
        types: [{
          description: "JSON files",
          accept: { "application/json": [".json", ".rmg.json", ".oetd.json"] }
        }]
      });
      expect(createWritable).toHaveBeenCalled();
      expect(write).toHaveBeenCalledTimes(1);
      expect(close).toHaveBeenCalledTimes(1);
      expect(createObjectUrl).not.toHaveBeenCalled();
    });

    expect(write.mock.calls.length).toBeGreaterThan(0);
    const writtenBlob = write.mock.calls[0][0] as Blob;
    expect(writtenBlob).toBeInstanceOf(Blob);
    expect(writtenBlob.type).toBe("application/json");
  });

  it("falls back to anchor downloads when the file picker API is unavailable", async () => {
    const user = userEvent.setup();
    const createObjectUrl = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test-fallback");
    const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    render(<AppShell />);

    const originalCreateElement = document.createElement.bind(document);
    const anchor = originalCreateElement("a");
    const anchorClick = vi.spyOn(anchor, "click").mockImplementation(() => {});
    const createElement = vi.spyOn(document, "createElement").mockImplementation(((tagName: string, options?: ElementCreationOptions) => {
      if (tagName === "a") {
        return anchor;
      }
      return originalCreateElement(tagName, options);
    }) as typeof document.createElement);

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(createElement).toHaveBeenCalledWith("a");
      expect(createObjectUrl).toHaveBeenCalledTimes(1);
      expect(anchorClick).toHaveBeenCalledTimes(1);
      expect(revokeObjectUrl).toHaveBeenCalledWith("blob:test-fallback");
    });

    expect(anchor.download).toBe("Custom Template.oetd.json");
    expect(anchor.href).toBe("blob:test-fallback");
  });

  it("exports a valid builder template directly", async () => {
    const user = userEvent.setup();
    const { anchor, anchorClick, createObjectUrl } = mockAnchorDownload();

    render(<AppShell />);

    await user.click(screen.getByRole("button", { name: "Export" }));

    await waitFor(() => {
      expect(anchorClick).toHaveBeenCalledTimes(1);
      expect(createObjectUrl).toHaveBeenCalledTimes(1);
    });
    expect(anchor.download).toBe("Custom Template.rmg.json");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens a validation warning dialog before force-exporting an invalid template", async () => {
    const user = userEvent.setup();
    const { anchor, anchorClick, createObjectUrl } = mockAnchorDownload();

    render(<AppShell />);

    fireEvent.change(getInputForLabel(document.body, "Template Name"), { target: { value: "" } });

    expect(await screen.findByText("Template name is required.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Force Export" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Export" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Export with validation errors?" })).toBeTruthy();
    expect(within(dialog).getByText("Template name is required.")).toBeTruthy();
    expect(anchorClick).not.toHaveBeenCalled();
    expect(createObjectUrl).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(anchorClick).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Export" }));
    const reopenedDialog = await screen.findByRole("dialog");
    await user.click(within(reopenedDialog).getByRole("button", { name: "Force Export" }));

    await waitFor(() => {
      expect(anchorClick).toHaveBeenCalledTimes(1);
      expect(createObjectUrl).toHaveBeenCalledTimes(1);
    });
    expect(anchor.download).toBe("Custom Template.rmg.json");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens the connections dialog and keeps validation visible", async () => {
    const user = userEvent.setup();
    render(<AppShell />);

    expect(screen.getByText("Ready to export.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Connections" }));

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Connections" })).toBeTruthy();
    expect(screen.getByDisplayValue("Path-1-3")).toBeTruthy();
  });

  it("edits a content limit max count from the advanced content limits dialog", async () => {
    const user = userEvent.setup();
    render(<AppShell />);

    await user.click(screen.getByRole("button", { name: "Content Limits" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Advanced Content Limits" })).toBeTruthy();
    const firstMaxCountField = within(dialog).getAllByText("Max Count")[0].closest(".config-field") as HTMLElement;
    const firstMaxCount = firstMaxCountField.querySelector("input") as HTMLInputElement;
    fireEvent.change(firstMaxCount, { target: { value: "6" } });

    await waitFor(() => {
      const json = (screen.getByLabelText("RMG JSON editor") as HTMLTextAreaElement).value;
      expect(json).toContain('"sid": "black_tower"');
      expect(json).toContain('"maxCount": 6');
    });
  });

  it("applies top-level content pools and content lists from the advanced content library dialog", async () => {
    const user = userEvent.setup();
    render(<AppShell />);

    await user.click(screen.getByRole("button", { name: "Content Library" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Advanced Content Library" })).toBeTruthy();

    const contentPoolsField = within(dialog).getByText("Content Pools JSON").closest(".config-field") as HTMLElement;
    const contentListsField = within(dialog).getByText("Content Lists JSON").closest(".config-field") as HTMLElement;
    const contentPools = contentPoolsField.querySelector("textarea") as HTMLTextAreaElement;
    const contentLists = contentListsField.querySelector("textarea") as HTMLTextAreaElement;

    fireEvent.change(contentPools, {
      target: {
        value: JSON.stringify([{ name: "pool_rewards", items: [{ sid: "pandora_box", weight: 2 }] }], null, 2)
      }
    });
    fireEvent.change(contentLists, {
      target: {
        value: JSON.stringify([{ name: "list_pickups", entries: ["wood_pile", "ore_pile"] }], null, 2)
      }
    });

    await user.click(within(dialog).getByRole("button", { name: "Apply" }));

    await waitFor(() => {
      const json = (screen.getByLabelText("RMG JSON editor") as HTMLTextAreaElement).value;
      expect(json).toContain('"contentPools": [');
      expect(json).toContain('"name": "pool_rewards"');
      expect(json).toContain('"contentLists": [');
      expect(json).toContain('"name": "list_pickups"');
    });
  });

  it("rejects invalid advanced content library JSON without changing the design", async () => {
    const user = userEvent.setup();
    render(<AppShell />);

    const editor = screen.getByLabelText("RMG JSON editor") as HTMLTextAreaElement;
    expect(editor.value).not.toContain('"pool_rewards"');

    await user.click(screen.getByRole("button", { name: "Content Library" }));

    const dialog = screen.getByRole("dialog");
    const contentPoolsField = within(dialog).getByText("Content Pools JSON").closest(".config-field") as HTMLElement;
    const contentPools = contentPoolsField.querySelector("textarea") as HTMLTextAreaElement;

    fireEvent.change(contentPools, {
      target: {
        value: JSON.stringify({ name: "pool_rewards" }, null, 2)
      }
    });

    await user.click(within(dialog).getByRole("button", { name: "Apply" }));

    expect(within(dialog).getByRole("alert").textContent).toContain("Content Pools JSON: Use a JSON array of content pool blocks.");
    expect((screen.getByLabelText("RMG JSON editor") as HTMLTextAreaElement).value).not.toContain('"pool_rewards"');
  });

  it("applies expert value overrides and global bans from the expert settings dialog", async () => {
    const user = userEvent.setup();
    render(<AppShell />);

    await user.click(screen.getByRole("button", { name: "Expert Settings" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Expert Settings" })).toBeTruthy();

    const valueOverridesField = within(dialog).getByText("Value Overrides JSON").closest(".config-field") as HTMLElement;
    const globalBansField = within(dialog).getByText("Global Bans JSON").closest(".config-field") as HTMLElement;
    const valueOverrides = valueOverridesField.querySelector("textarea") as HTMLTextAreaElement;
    const globalBans = globalBansField.querySelector("textarea") as HTMLTextAreaElement;

    fireEvent.change(valueOverrides, {
      target: {
        value: JSON.stringify([{ sid: "artifact_guard", guardValue: 4200 }], null, 2)
      }
    });
    fireEvent.change(globalBans, {
      target: {
        value: JSON.stringify({ heroes: ["hero_1"], items: ["artifact_1"] }, null, 2)
      }
    });

    await user.click(within(dialog).getByRole("button", { name: "Apply" }));

    await waitFor(() => {
      const json = (screen.getByLabelText("RMG JSON editor") as HTMLTextAreaElement).value;
      expect(json).toContain('"valueOverrides": [');
      expect(json).toContain('"sid": "artifact_guard"');
      expect(json).toContain('"globalBans": {');
      expect(json).toContain('"heroes": [');
      expect(json).toContain('"artifact_1"');
    });
  });

  it("rejects invalid expert settings JSON without changing the design", async () => {
    const user = userEvent.setup();
    render(<AppShell />);

    const editor = screen.getByLabelText("RMG JSON editor") as HTMLTextAreaElement;
    expect(editor.value).not.toContain('"artifact_guard"');

    await user.click(screen.getByRole("button", { name: "Expert Settings" }));

    const dialog = screen.getByRole("dialog");
    const valueOverridesField = within(dialog).getByText("Value Overrides JSON").closest(".config-field") as HTMLElement;
    const valueOverrides = valueOverridesField.querySelector("textarea") as HTMLTextAreaElement;

    fireEvent.change(valueOverrides, {
      target: {
        value: JSON.stringify({ sid: "artifact_guard" }, null, 2)
      }
    });

    await user.click(within(dialog).getByRole("button", { name: "Apply" }));

    expect(within(dialog).getByRole("alert").textContent).toContain("Value Overrides JSON: Use a JSON array of value override objects.");
    expect((screen.getByLabelText("RMG JSON editor") as HTMLTextAreaElement).value).not.toContain('"artifact_guard"');
  });

  it("adds a mandatory content item from the mandatory content dialog", async () => {
    const user = userEvent.setup();
    render(<AppShell />);

    await user.click(screen.getByRole("button", { name: "Mandatory Content" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Mandatory Content" })).toBeTruthy();
    await user.click(within(dialog).getByRole("button", { name: "Add Group" }));
    await user.click(within(dialog).getByRole("button", { name: "Add Item" }));

    const sidFields = within(dialog).getAllByText("SID");
    const sidInput = sidFields.at(-1)?.closest(".config-field")?.querySelector("input") as HTMLInputElement;
    expect(sidInput).toBeTruthy();
    fireEvent.change(sidInput, { target: { value: "custom_shrine" } });

    await waitFor(() => {
      const json = (screen.getByLabelText("RMG JSON editor") as HTMLTextAreaElement).value;
      expect(json).toContain('"name": "mandatory_content_custom_1"');
      expect(json).toContain('"sid": "custom_shrine"');
    });
  });

  it("edits advanced connection toggles from the connections dialog", async () => {
    const user = userEvent.setup();
    render(<AppShell />);

    await user.click(screen.getByRole("button", { name: "Connections" }));

    const connectionRow = screen.getByDisplayValue("Path-1-3").closest(".connection-row") as HTMLElement;
    await user.click(within(connectionRow).getByText("Advanced"));
    await user.click(within(connectionRow).getByRole("checkbox", { name: "Guards can escape" }));

    expect(within(connectionRow).getByRole("checkbox", { name: "Guards can escape" }).getAttribute("aria-checked")).toBe("true");
    await waitFor(() => {
      expect((screen.getByLabelText("RMG JSON editor") as HTMLTextAreaElement).value).toContain('"guardEscape": true');
    });
  });

  it("keeps portal placement rules unchanged when the advanced JSON is invalid", async () => {
    const user = userEvent.setup();
    render(<AppShell />);

    await user.click(screen.getByRole("button", { name: "Connections" }));

    const connectionRow = screen.getByDisplayValue("Path-1-3").closest(".connection-row") as HTMLElement;
    const typeField = within(connectionRow).getByText("Type").closest(".config-field");
    const typeSelect = typeField?.querySelector("select") as HTMLSelectElement;
    await user.selectOptions(typeSelect, "Portal");
    await user.click(within(connectionRow).getByText("Advanced"));

    const rulesFromField = within(connectionRow).getByText("Portal Rules From (JSON)").closest(".config-field");
    const rulesFrom = rulesFromField?.querySelector("textarea") as HTMLTextAreaElement;
    fireEvent.change(rulesFrom, {
      target: {
        value: JSON.stringify([
          { type: "Crossroads", args: [], targetMin: 0.2, targetMax: 0.4, weight: 3 }
        ], null, 2)
      }
    });

    await waitFor(() => {
      expect((screen.getByLabelText("RMG JSON editor") as HTMLTextAreaElement).value).toContain('"targetMin": 0.2');
    });

    fireEvent.change(rulesFrom, { target: { value: "[" } });

    expect(within(connectionRow).getByRole("alert").textContent).toContain("Portal Rules From: Must be valid JSON.");
    expect((screen.getByLabelText("RMG JSON editor") as HTMLTextAreaElement).value).toContain('"targetMin": 0.2');
  });

  it("edits custom zone main objects and validates selector JSON", async () => {
    const user = userEvent.setup();
    render(<AppShell />);

    const inspector = screen.getByRole("heading", { name: "Zone Inspector" }).closest("section") as HTMLElement;
    await user.click(within(inspector).getByText("Main Objects"));
    await user.click(within(inspector).getByRole("checkbox", { name: "Use custom main objects" }));

    const mainObjectRow = within(inspector).getByText("Main Object 1").closest(".main-object-row") as HTMLElement;
    const typeField = within(mainObjectRow).getByText("Type").closest(".config-field");
    const typeInput = typeField?.querySelector("input") as HTMLInputElement;
    await user.clear(typeInput);
    await user.type(typeInput, "Ruins");

    const factionField = within(mainObjectRow).getByText("Faction Selector JSON").closest(".config-field");
    const factionJson = factionField?.querySelector("textarea") as HTMLTextAreaElement;
    fireEvent.change(factionJson, { target: { value: '{ "type": "FromList", "args": ["Temple"] }' } });

    await waitFor(() => {
      const json = (screen.getByLabelText("RMG JSON editor") as HTMLTextAreaElement).value;
      expect(json).toContain('"type": "Ruins"');
      expect(json).toContain('"Temple"');
    });

    fireEvent.change(factionJson, { target: { value: "[" } });

    expect(within(mainObjectRow).getByRole("alert").textContent).toContain("Faction Selector JSON: Must be valid JSON.");
    expect((screen.getByLabelText("RMG JSON editor") as HTMLTextAreaElement).value).toContain('"Temple"');
  });

  it("renders bounded builder numeric fields as sliders and applies updates", async () => {
    render(<AppShell />);

    const width = getInputForLabel(document.body, "Width");
    expect(width.type).toBe("range");
    fireEvent.input(width, { target: { value: "200" } });
    expect(width.value).toBe("200");

    const widthValue = getSliderValueInputForLabel(document.body, "Width");
    expect(widthValue.type).toBe("number");
    fireEvent.change(widthValue, { target: { value: "208" } });
    fireEvent.blur(widthValue);
    expect(width.value).toBe("208");
    expect(widthValue.value).toBe("208");

    const players = getInputForLabel(document.body, "Players");
    expect(players.type).toBe("range");
    fireEvent.input(players, { target: { value: "3" } });
    expect(players.value).toBe("3");
    expect(screen.getByText("Spawn-3")).toBeTruthy();
    expect((screen.getByLabelText("RMG JSON editor") as HTMLTextAreaElement).value).toContain('"spawn": "Player3"');

    const inspector = screen.getByRole("heading", { name: "Zone Inspector" }).closest("section");
    const castles = getInputForLabel(inspector as HTMLElement, "Castles");
    expect(castles.type).toBe("range");
    fireEvent.input(castles, { target: { value: "3" } });
    expect(castles.value).toBe("3");
    expect(within(inspector as HTMLElement).getByText(/3 cities/)).toBeTruthy();

    const castlesValue = getSliderValueInputForLabel(inspector as HTMLElement, "Castles");
    fireEvent.change(castlesValue, { target: { value: "4" } });
    fireEvent.blur(castlesValue);
    expect(castles.value).toBe("4");
    expect(within(inspector as HTMLElement).getByText(/4 cities/)).toBeTruthy();
  });

  it("assigns a player and updates player count when changing a neutral zone into a spawn", async () => {
    const user = userEvent.setup();
    const boardLayout = mockDesignBoardLayout();
    render(<AppShell />);

    const board = screen.getByLabelText("Schematic design board");
    fireEvent.pointerDown(board, {
      clientX: Math.round(BOARD_TEST_WIDTH * 0.5),
      clientY: Math.round(BOARD_TEST_HEIGHT * 0.5),
      pointerId: 1
    });

    const inspector = screen.getByRole("heading", { name: "Zone Inspector" }).closest("section") as HTMLElement;
    expect(getInputForLabel(inspector, "Name").value).toBe("Neutral-3");

    await chooseSelectOptionInContainer(user, inspector, "Role", "Spawn");

    expect(getInputForLabel(inspector, "Name").value).toBe("Spawn-3");
    expect(getSliderValueInputForLabel(inspector, "Player").value).toBe("3");
    expect(getInputForLabel(document.body, "Players").value).toBe("3");
    expect(screen.queryByText(/Spawn player numbers must be integers/)).toBeNull();
    expect(screen.queryByText(/Player count is 2/)).toBeNull();
    expect((screen.getByLabelText("RMG JSON editor") as HTMLTextAreaElement).value).toContain('"spawn": "Player3"');

    boardLayout.restore();
  });

  it("defaults to locking map width and height together", () => {
    render(<AppShell />);

    expect(screen.getByRole("checkbox", { name: "Lock width and height together" }).getAttribute("aria-checked")).toBe("true");

    const width = getInputForLabel(document.body, "Width");
    const height = getInputForLabel(document.body, "Height");

    fireEvent.input(width, { target: { value: "200" } });
    expect(width.value).toBe("200");
    expect(height.value).toBe("200");

    fireEvent.input(height, { target: { value: "240" } });
    expect(width.value).toBe("240");
    expect(height.value).toBe("240");
  });

  it("syncs height back to width when enabling the dimension lock from a rectangular size", async () => {
    const user = userEvent.setup();
    render(<AppShell />);

    const height = getInputForLabel(document.body, "Height");
    await user.click(screen.getByRole("checkbox", { name: "Lock width and height together" }));
    fireEvent.input(height, { target: { value: "216" } });
    expect(height.value).toBe("216");

    await user.click(screen.getByRole("checkbox", { name: "Lock width and height together" }));

    expect(getInputForLabel(document.body, "Width").value).toBe("160");
    expect(getInputForLabel(document.body, "Height").value).toBe("160");
  });

  it("shows edit and delete actions when clicking a board connection", async () => {
    const user = userEvent.setup();
    const boardLayout = mockDesignBoardLayout();
    render(<AppShell />);

    const board = screen.getByLabelText("Schematic design board");
    fireEvent.pointerDown(board, {
      clientX: Math.round(BOARD_TEST_WIDTH * 0.34),
      clientY: Math.round(BOARD_TEST_HEIGHT * 0.5),
      pointerId: 1
    });

    expect(screen.getByRole("button", { name: "Edit Path-1-3" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Delete Path-1-3" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Edit Path-1-3" }));

    const selectedConnectionRow = screen.getByDisplayValue("Path-1-3").closest(".connection-row");
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(selectedConnectionRow?.getAttribute("data-selected")).toBe("true");

    boardLayout.restore();
  });

  it("only enables board connection dragging while Road Mode is active", async () => {
    const user = userEvent.setup();
    const boardLayout = mockDesignBoardLayout();
    render(<AppShell />);

    const board = screen.getByLabelText("Schematic design board");
    const roadModeButton = screen.getByRole("button", { name: "Road Mode" });
    const boardState = buildBoardRenderState(buildPreviewDesign(createDefaultDesign()), BOARD_TEST_WIDTH, BOARD_TEST_HEIGHT);
    const handle = boardState.zoneLayoutsById.get("zone-1")?.handle;
    const targetZone = boardState.zoneLayoutsById.get("zone-2")?.box;
    expect(handle).toBeTruthy();
    expect(targetZone).toBeTruthy();
    const target = {
      clientX: Math.round((targetZone as NonNullable<typeof targetZone>).centerX),
      clientY: Math.round((targetZone as NonNullable<typeof targetZone>).centerY),
      pointerId: 1
    };

    expect(roadModeButton.getAttribute("aria-pressed")).toBe("false");

    fireEvent.pointerDown(board, { clientX: Math.round((handle as NonNullable<typeof handle>).x), clientY: Math.round((handle as NonNullable<typeof handle>).y), pointerId: 1 });
    fireEvent.pointerMove(board, target);
    fireEvent.pointerUp(board, target);

    await user.click(screen.getByRole("button", { name: "Connections" }));
    expect(screen.queryByDisplayValue("Path-Spawn-1-Spawn-2")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    const activeRoadModeButton = screen.getByRole("button", { name: "Road Mode" });
    await user.click(activeRoadModeButton);
    expect(activeRoadModeButton.getAttribute("aria-pressed")).toBe("true");

    fireEvent.pointerDown(board, { clientX: Math.round((handle as NonNullable<typeof handle>).x), clientY: Math.round((handle as NonNullable<typeof handle>).y), pointerId: 2 });
    fireEvent.pointerMove(board, target);
    fireEvent.pointerUp(board, target);

    await user.click(screen.getByRole("button", { name: "Connections" }));
    expect(screen.getByDisplayValue("Path-Spawn-1-Spawn-2")).toBeTruthy();

    boardLayout.restore();
  });

  it("connects roads when dropped on the visible edge of a hub zone", async () => {
    const user = userEvent.setup();
    const boardLayout = mockDesignBoardLayout();
    render(<AppShell />);

    await user.click(screen.getAllByRole("button", { name: "Hub" })[0]);

    const board = screen.getByLabelText("Schematic design board");
    const boardState = buildBoardRenderState(buildPreviewDesign(addZone(createDefaultDesign(), "Hub")), BOARD_TEST_WIDTH, BOARD_TEST_HEIGHT);
    const handle = boardState.zoneLayoutsById.get("zone-1")?.handle;
    const hubLayout = boardState.zoneLayouts.find((layout) => layout.zone.role === "Hub");
    expect(handle).toBeTruthy();
    expect(hubLayout).toBeTruthy();

    const target = {
      clientX: Math.round((hubLayout as NonNullable<typeof hubLayout>).box.left + 2),
      clientY: Math.round((hubLayout as NonNullable<typeof hubLayout>).box.centerY),
      pointerId: 1
    };

    await user.click(screen.getByRole("button", { name: "Road Mode" }));
    fireEvent.pointerDown(board, {
      clientX: Math.round((handle as NonNullable<typeof handle>).x),
      clientY: Math.round((handle as NonNullable<typeof handle>).y),
      pointerId: 1
    });
    fireEvent.pointerMove(board, target);
    fireEvent.pointerUp(board, target);

    await user.click(screen.getByRole("button", { name: "Connections" }));
    expect(screen.getByDisplayValue("Path-Spawn-1-Hub")).toBeTruthy();

    boardLayout.restore();
  });

  it("keeps the selected zone when a capped zone add is a no-op after road edits", async () => {
    const user = userEvent.setup();
    const boardLayout = mockDesignBoardLayout();
    render(<AppShell />);

    const board = screen.getByLabelText("Schematic design board");
    const boardState = buildBoardRenderState(buildPreviewDesign(createDefaultDesign()), BOARD_TEST_WIDTH, BOARD_TEST_HEIGHT);
    const handle = boardState.zoneLayoutsById.get("zone-1")?.handle;
    const targetZone = boardState.zoneLayoutsById.get("zone-2")?.box;
    expect(handle).toBeTruthy();
    expect(targetZone).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Road Mode" }));
    fireEvent.pointerDown(board, { clientX: Math.round((handle as NonNullable<typeof handle>).x), clientY: Math.round((handle as NonNullable<typeof handle>).y), pointerId: 1 });
    fireEvent.pointerMove(board, {
      clientX: Math.round((targetZone as NonNullable<typeof targetZone>).centerX),
      clientY: Math.round((targetZone as NonNullable<typeof targetZone>).centerY),
      pointerId: 1
    });
    fireEvent.pointerUp(board, {
      clientX: Math.round((targetZone as NonNullable<typeof targetZone>).centerX),
      clientY: Math.round((targetZone as NonNullable<typeof targetZone>).centerY),
      pointerId: 1
    });

    for (let index = 0; index < 6; index++) {
      await user.click(screen.getAllByRole("button", { name: "Spawn" })[0]);
    }
    await user.click(screen.getAllByRole("button", { name: "Neutral" })[0]);

    fireEvent.pointerDown(board, {
      clientX: Math.round(BOARD_TEST_WIDTH * 0.18),
      clientY: Math.round(BOARD_TEST_HEIGHT * 0.5),
      pointerId: 2
    });

    const inspector = screen.getByRole("heading", { name: "Zone Inspector" }).closest("section");
    expect(within(inspector as HTMLElement).getByDisplayValue("Spawn-1")).toBeTruthy();

    await user.click(screen.getAllByRole("button", { name: "Spawn" })[0]);

    expect(within(inspector as HTMLElement).getByDisplayValue("Spawn-1")).toBeTruthy();
    expect(within(inspector as HTMLElement).queryByDisplayValue("Neutral-4")).toBeNull();

    boardLayout.restore();
  });

  it("keeps the selected zone when a capped duplicate is a no-op", async () => {
    const user = userEvent.setup();
    const boardLayout = mockDesignBoardLayout();
    render(<AppShell />);

    for (let index = 0; index < 6; index++) {
      await user.click(screen.getAllByRole("button", { name: "Spawn" })[0]);
    }
    await user.click(screen.getAllByRole("button", { name: "Neutral" })[0]);

    const board = screen.getByLabelText("Schematic design board");
    fireEvent.pointerDown(board, {
      clientX: Math.round(BOARD_TEST_WIDTH * 0.18),
      clientY: Math.round(BOARD_TEST_HEIGHT * 0.5),
      pointerId: 1
    });

    const inspector = screen.getByRole("heading", { name: "Zone Inspector" }).closest("section");
    expect(within(inspector as HTMLElement).getByDisplayValue("Spawn-1")).toBeTruthy();

    await user.click(within(inspector as HTMLElement).getByRole("button", { name: "Duplicate" }));

    expect(within(inspector as HTMLElement).getByDisplayValue("Spawn-1")).toBeTruthy();
    expect(within(inspector as HTMLElement).queryByDisplayValue("Neutral-4")).toBeNull();

    boardLayout.restore();
  });

  it("keeps the selected zone when a capped transfer is a no-op", async () => {
    const user = userEvent.setup();
    const boardLayout = mockDesignBoardLayout();
    render(<AppShell />);

    for (let index = 0; index < 6; index++) {
      await user.click(screen.getAllByRole("button", { name: "Spawn" })[0]);
    }

    const board = screen.getByLabelText("Schematic design board");
    fireEvent.pointerDown(board, {
      clientX: Math.round(BOARD_TEST_WIDTH * 0.18),
      clientY: Math.round(BOARD_TEST_HEIGHT * 0.5),
      pointerId: 1
    });

    const inspector = screen.getByRole("heading", { name: "Zone Inspector" }).closest("section");
    expect(getInputForLabel(inspector as HTMLElement, "Name").value).toBe("Spawn-1");

    const transferTarget = within(inspector as HTMLElement).getByLabelText("Transfer settings target") as HTMLSelectElement;
    const neutralTarget = Array.from(transferTarget.options).find((option) => option.text === "Neutral-3");
    expect(neutralTarget).toBeTruthy();
    await user.selectOptions(transferTarget, (neutralTarget as HTMLOptionElement).value);
    await user.click(within(inspector as HTMLElement).getByRole("button", { name: "Transfer Settings" }));

    expect(getInputForLabel(inspector as HTMLElement, "Name").value).toBe("Spawn-1");
    expect(getSelectForLabel(inspector as HTMLElement, "Role").value).toBe("Spawn");

    boardLayout.restore();
  });

  it("keeps the source zone selected when a duplicate board connection is a no-op", async () => {
    const user = userEvent.setup();
    const boardLayout = mockDesignBoardLayout();
    render(<AppShell />);

    const board = screen.getByLabelText("Schematic design board");
    const boardState = buildBoardRenderState(buildPreviewDesign(createDefaultDesign()), BOARD_TEST_WIDTH, BOARD_TEST_HEIGHT);
    const handle = boardState.zoneLayoutsById.get("zone-1")?.handle;
    const targetZone = boardState.zoneLayoutsById.get("zone-3")?.box;
    expect(handle).toBeTruthy();
    expect(targetZone).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Road Mode" }));
    fireEvent.pointerDown(board, { clientX: Math.round((handle as NonNullable<typeof handle>).x), clientY: Math.round((handle as NonNullable<typeof handle>).y), pointerId: 1 });
    fireEvent.pointerMove(board, {
      clientX: Math.round((targetZone as NonNullable<typeof targetZone>).centerX),
      clientY: Math.round((targetZone as NonNullable<typeof targetZone>).centerY),
      pointerId: 1
    });
    fireEvent.pointerUp(board, {
      clientX: Math.round((targetZone as NonNullable<typeof targetZone>).centerX),
      clientY: Math.round((targetZone as NonNullable<typeof targetZone>).centerY),
      pointerId: 1
    });

    const inspector = screen.getByRole("heading", { name: "Zone Inspector" }).closest("section");
    expect(getInputForLabel(inspector as HTMLElement, "Name").value).toBe("Spawn-1");

    await user.click(screen.getByRole("button", { name: "Connections" }));
    expect(screen.getAllByDisplayValue("Path-1-3")).toHaveLength(1);

    boardLayout.restore();
  });

  it("selects a zone instead of an overlapping connection line", () => {
    const boardLayout = mockDesignBoardLayout();
    render(<AppShell />);

    const board = screen.getByLabelText("Schematic design board");
    fireEvent.pointerDown(board, {
      clientX: Math.round(BOARD_TEST_WIDTH * 0.45),
      clientY: Math.round(BOARD_TEST_HEIGHT * 0.5),
      pointerId: 1
    });

    const inspector = screen.getByRole("heading", { name: "Zone Inspector" }).closest("section");
    expect(within(inspector as HTMLElement).getByDisplayValue("Neutral-3")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Edit Path-1-3" })).toBeNull();

    boardLayout.restore();
  });

  it("removes a connection from the board action menu", async () => {
    const user = userEvent.setup();
    const boardLayout = mockDesignBoardLayout();
    render(<AppShell />);

    const board = screen.getByLabelText("Schematic design board");
    fireEvent.pointerDown(board, {
      clientX: Math.round(BOARD_TEST_WIDTH * 0.34),
      clientY: Math.round(BOARD_TEST_HEIGHT * 0.5),
      pointerId: 1
    });

    await user.click(screen.getByRole("button", { name: "Delete Path-1-3" }));
    await user.click(screen.getByRole("button", { name: "Connections" }));

    expect(screen.queryByDisplayValue("Path-1-3")).toBeNull();
    expect(screen.getByDisplayValue("Path-3-2")).toBeTruthy();

    boardLayout.restore();
  });

  it("generates a balanced random map from the dialog", async () => {
    const user = userEvent.setup();
    render(<AppShell />);

    const advancedSettings = document.querySelector(".advanced-settings-shell");
    expect(advancedSettings).toBeTruthy();
    await user.click(within(advancedSettings as HTMLElement).getByRole("button", { name: "Balanced Random" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Balanced Random Map" })).toBeTruthy();
    const templateName = getInputForLabel(dialog, "Template Name");
    const players = getInputForLabel(dialog, "Players");
    const neutralZones = getInputForLabel(dialog, "Neutral Zones");

    await user.clear(templateName);
    await user.type(templateName, "Balanced Siege");
    expect(players.type).toBe("range");
    expect(neutralZones.type).toBe("range");
    fireEvent.input(players, { target: { value: "4" } });
    fireEvent.input(neutralZones, { target: { value: "6" } });
    await user.click(screen.getByText("Enable City Hold objective"));
    await chooseSelectOption(user, "Content Focus", "Town Focused");

    await user.click(within(dialog).getByText("Advanced"));
    await chooseSelectOptionInContainer(user, dialog, "Generation Preset", "King of the Hill");
    await chooseSelectOptionInContainer(user, dialog, "Connection Style", "Portal Heavy");
    const maxPortalConnections = getInputForLabel(dialog, "Max Portal Connections");
    await user.clear(maxPortalConnections);
    await user.type(maxPortalConnections, "5");
    const neutralHighCastle = getInputForLabel(dialog, "Neutral High / Castle");
    await user.clear(neutralHighCastle);
    await user.type(neutralHighCastle, "6");

    await user.click(screen.getByRole("button", { name: "Generate Balanced Map" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByDisplayValue("Balanced Siege")).toBeTruthy();
    expect(screen.getByText("* Balanced Siege.oetd.json")).toBeTruthy();
    expect(screen.getByText("11")).toBeTruthy();
  });

  it("applies JSON editor changes back into visible builder fields", async () => {
    render(<AppShell />);

    const editor = screen.getByLabelText("RMG JSON editor") as HTMLTextAreaElement;
    fireEvent.change(editor, {
      target: {
        value: editor.value.replace('"name": "Custom Template"', '"name": "JSON Applied Template"')
      }
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue("JSON Applied Template")).toBeTruthy();
    });
  });

  it("applies JSON map size changes into the top template settings fields", async () => {
    render(<AppShell />);

    const editor = screen.getByLabelText("RMG JSON editor") as HTMLTextAreaElement;
    fireEvent.change(editor, {
      target: {
        value: editor.value
          .replace('"gameMode": "Classic"', '"gameMode": "Tournament"')
          .replace('"sizeX": 160', '"sizeX": 200')
          .replace('"sizeZ": 160', '"sizeZ": 216')
      }
    });
    const settingsCard = screen.getByDisplayValue("Custom Template").closest(".template-settings-card");
    expect(settingsCard).toBeTruthy();

    await waitFor(() => {
      expect(getSliderValueInputForLabel(settingsCard as HTMLElement, "Width").value).toBe("200");
      expect(getSliderValueInputForLabel(settingsCard as HTMLElement, "Height").value).toBe("216");
      expect(getSelectForLabel(settingsCard as HTMLElement, "Game Mode").value).toBe("Tournament");
    });
    expect(screen.queryByText(/Unexpected identifier "undefined"/i)).toBeNull();
  });

  it("does not show manual JSON sync buttons", () => {
    render(<AppShell />);

    expect(screen.queryByRole("button", { name: "Apply to builder" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Refresh JSON" })).toBeNull();
    expect(screen.queryByText("Win by holding a marked city")).toBeNull();
  });

  it("keeps biome JSON editable while the draft text is temporarily invalid", async () => {
    const user = userEvent.setup();
    render(<AppShell />);

    await user.click(screen.getByRole("tab", { name: "Terrain" }));
    const zoneBiome = screen.getByLabelText("Zone Biome") as HTMLTextAreaElement;

    await user.clear(zoneBiome);
    await user.paste("{");

    expect(zoneBiome.value).toBe("{");
  });

  it("clears the implicit City Hold toggle after switching away from City Hold victory", async () => {
    const user = userEvent.setup();
    render(<AppShell />);

    const settingsCard = screen.getByDisplayValue("Custom Template").closest(".template-settings-card");
    expect(settingsCard).toBeTruthy();

    await chooseSelectOption(user, "Victory", "City Hold");
    expect(screen.getByText("City Hold requires exactly one hold-city zone.")).toBeTruthy();
    expect(within(settingsCard as HTMLElement).getByText("City Hold Days")).toBeTruthy();
    expect(getSliderValueInputForLabel(settingsCard as HTMLElement, "City Hold Days").value).toBe("6");

    await chooseSelectOption(user, "Victory", "Classic");
    expect(screen.queryByText("City Hold requires exactly one hold-city zone.")).toBeNull();
    expect(screen.queryByText("City Hold Days")).toBeNull();
  });

  it("shows Gladiator Arena in the victory selector and keeps the inspector visible after zone actions", async () => {
    const user = userEvent.setup();
    render(<AppShell />);

    const victoryField = screen.getByText("Victory").closest(".config-field");
    const victorySelect = victoryField?.querySelector<HTMLSelectElement>("select");
    expect(victorySelect).toBeTruthy();
    expect(Array.from((victorySelect as HTMLSelectElement).options).some((option) => option.text === "Gladiator Arena")).toBe(true);
    expect(Array.from((victorySelect as HTMLSelectElement).options).some((option) => option.text === "Find artifact")).toBe(false);

    await user.click(screen.getByRole("button", { name: "Duplicate" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(screen.getByText("Olden Era RMG Studio")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Zone Inspector" })).toBeTruthy();
  });

  it("transfers selected zone settings to an existing target zone", async () => {
    const user = userEvent.setup();
    render(<AppShell />);

    await user.click(screen.getByRole("button", { name: "Transfer Settings" }));

    expect(screen.getByDisplayValue("Neutral-3")).toBeTruthy();
    expect(getSelectForLabel(document.body, "Role").value).toBe("Spawn");
  });

  it("shows advanced global rule controls and pushes them into exported json", async () => {
    const user = userEvent.setup();
    render(<AppShell />);

    const settingsCard = screen.getByDisplayValue("Custom Template").closest(".template-settings-card");
    expect(settingsCard).toBeTruthy();

    await chooseSelectOptionInContainer(user, settingsCard as HTMLElement, "Game Mode", "Tournament");

    const factionLaws = getSliderValueInputForLabel(settingsCard as HTMLElement, "Faction Laws XP %");
    fireEvent.input(factionLaws, { target: { value: "125" } });
    fireEvent.blur(factionLaws);

    const astrology = getSliderValueInputForLabel(settingsCard as HTMLElement, "Astrology XP %");
    fireEvent.input(astrology, { target: { value: "75" } });
    fireEvent.blur(astrology);

    await user.click(screen.getByText("Advanced Rules"));
    await user.click(screen.getByRole("checkbox", { name: "Ban hiring extra heroes" }));
    await user.click(screen.getByRole("checkbox", { name: "Enable encounter holes" }));

    const movementBonus = getSliderValueInputForLabel(settingsCard as HTMLElement, "Movement Bonus");
    fireEvent.input(movementBonus, { target: { value: "7" } });
    fireEvent.blur(movementBonus);

    await user.click(screen.getByRole("checkbox", { name: "Lose when starting city is lost" }));
    expect(screen.getByText("Lost Start City Day")).toBeTruthy();

    const lostStartCityDay = getSliderValueInputForLabel(settingsCard as HTMLElement, "Lost Start City Day");
    fireEvent.input(lostStartCityDay, { target: { value: "9" } });
    fireEvent.blur(lostStartCityDay);

    await chooseSelectOption(user, "Victory", "Gladiator Arena");
    expect(screen.getByText("Gladiator Start Delay")).toBeTruthy();

    await user.click(screen.getByRole("checkbox", { name: "Enable Gladiator rules" }));

    const gladiatorDelay = getSliderValueInputForLabel(settingsCard as HTMLElement, "Gladiator Start Delay");
    fireEvent.input(gladiatorDelay, { target: { value: "21" } });
    fireEvent.blur(gladiatorDelay);

    const gladiatorCountDay = getSliderValueInputForLabel(settingsCard as HTMLElement, "Gladiator Count Day");
    fireEvent.input(gladiatorCountDay, { target: { value: "4" } });
    fireEvent.blur(gladiatorCountDay);

    await chooseSelectOption(user, "Victory", "Tournament");
    expect(screen.getByText("First Tournament Day")).toBeTruthy();
    expect(screen.getByText("Gladiator Start Delay")).toBeTruthy();

    await user.click(screen.getByRole("checkbox", { name: "Save tournament army" }));

    const firstTournamentDay = getSliderValueInputForLabel(settingsCard as HTMLElement, "First Tournament Day");
    fireEvent.input(firstTournamentDay, { target: { value: "18" } });
    fireEvent.blur(firstTournamentDay);

    const tournamentInterval = getSliderValueInputForLabel(settingsCard as HTMLElement, "Tournament Interval");
    fireEvent.input(tournamentInterval, { target: { value: "5" } });
    fireEvent.blur(tournamentInterval);

    const pointsToWin = getSliderValueInputForLabel(settingsCard as HTMLElement, "Points To Win");
    fireEvent.input(pointsToWin, { target: { value: "3" } });
    fireEvent.blur(pointsToWin);

    const editor = screen.getByLabelText("RMG JSON editor") as HTMLTextAreaElement;
    await waitFor(() => {
      expect(editor.value).toContain('"gameMode": "Tournament"');
      expect(editor.value).toContain('"heroHireBan": true');
      expect(editor.value).toContain('"encounterHoles": true');
      expect(editor.value).toContain('"parameters": [');
      expect(editor.value).toContain('"movementBonus"');
      expect(editor.value).toContain('"7"');
      expect(editor.value).toContain('"factionLawsExpModifier": 1.25');
      expect(editor.value).toContain('"astrologyExpModifier": 0.75');
      expect(editor.value).toContain('"lostStartCityDay": 9');
      expect(editor.value).toContain('"gladiatorArenaDaysDelayStart": 21');
      expect(editor.value).toContain('"gladiatorArenaCountDay": 4');
      expect(editor.value).toContain('"tournamentDays": [');
      expect(editor.value).toContain('"tournamentPointsToWin": 3');
      expect(editor.value).toContain('"tournamentSaveArmy": false');
    });
  });

  it("edits advanced map geometry controls and pushes them into exported json", async () => {
    const user = userEvent.setup();
    render(<AppShell />);

    const settingsCard = screen.getByDisplayValue("Custom Template").closest(".template-settings-card");
    expect(settingsCard).toBeTruthy();

    await user.click(screen.getByText("Advanced Map Geometry"));

    const waterWidth = getSliderValueInputForLabel(settingsCard as HTMLElement, "Water Width");
    fireEvent.input(waterWidth, { target: { value: "4" } });
    fireEvent.blur(waterWidth);

    const randomAngleAmplitude = getSliderValueInputForLabel(settingsCard as HTMLElement, "Random Angle Amplitude");
    fireEvent.input(randomAngleAmplitude, { target: { value: "120" } });
    fireEvent.blur(randomAngleAmplitude);

    const editor = screen.getByLabelText("RMG JSON editor") as HTMLTextAreaElement;
    await waitFor(() => {
      expect(editor.value).toContain('"randomAngleAmplitude": 120');
      expect(editor.value).toContain('"waterWidth": 4');
    });
  });

  it("edits selected zone rules and pushes them into exported json", async () => {
    const user = userEvent.setup();
    render(<AppShell />);

    await user.click(screen.getByRole("tab", { name: "Rules" }));
    const inspector = screen.getByRole("heading", { name: "Zone Inspector" }).closest("section");
    expect(inspector).toBeTruthy();

    await user.click(within(inspector as HTMLElement).getByRole("checkbox", { name: "Configure encounter holes for this zone" }));
    const affectedEncounters = getSliderValueInputForLabel(inspector as HTMLElement, "Affected Encounters");
    fireEvent.input(affectedEncounters, { target: { value: "7" } });
    fireEvent.blur(affectedEncounters);

    const twoHoleEncounters = getSliderValueInputForLabel(inspector as HTMLElement, "Two-Hole Encounters");
    fireEvent.input(twoHoleEncounters, { target: { value: "3" } });
    fireEvent.blur(twoHoleEncounters);

    await user.click(within(inspector as HTMLElement).getByRole("checkbox", { name: "Enable weekly random hire unit increment" }));
    await user.click(within(inspector as HTMLElement).getByRole("checkbox", { name: "Set initial random hire unit increment" }));
    const initialIncrement = getSliderValueInputForLabel(inspector as HTMLElement, "Initial Unit Increment");
    fireEvent.input(initialIncrement, { target: { value: "4" } });
    fireEvent.blur(initialIncrement);

    const editor = screen.getByLabelText("RMG JSON editor") as HTMLTextAreaElement;
    await waitFor(() => {
      expect(editor.value).toContain('"encounterHolesSettings": {');
      expect(editor.value).toContain('"affectedEncounters": 7');
      expect(editor.value).toContain('"twoHoleEncounters": 3');
      expect(editor.value).toContain('"randomHireEnableWeeklyUnitIncrement": true');
      expect(editor.value).toContain('"randomHireInitialUnitIncrement": 4');
    });
  });

  it("shows imported custom layout profiles in the zone terrain selector", async () => {
    const user = userEvent.setup();
    render(<AppShell />);

    const editor = screen.getByLabelText("RMG JSON editor") as HTMLTextAreaElement;
    const parsed = JSON.parse(editor.value) as { variants: Array<{ zones: Array<{ layout: string }> }>; zoneLayouts: Array<Record<string, unknown>> };
    parsed.zoneLayouts.push({
      name: "custom_layout_alpha",
      obstaclesFill: 0.41,
      obstaclesFillVoid: 0.53,
      lakesFill: 0.12,
      minLakeArea: 11,
      elevationClusterScale: 0.09,
      elevationModes: [{ weight: 1, minElevatedFraction: 0.1, maxElevatedFraction: 0.3 }],
      roadClusterArea: 77,
      guardedEncounterResourceFractions: { countBounds: [1, 2], fractions: [0.5, 0.75] },
      ambientPickupDistribution: { repulsion: 2, noise: 0.2, roadAttraction: -0.1, obstacleAttraction: 0.4, groupSizeWeights: [5, 1] }
    });
    parsed.variants[0].zones[0].layout = "custom_layout_alpha";

    fireEvent.change(editor, { target: { value: JSON.stringify(parsed, null, 2) } });

    await user.click(screen.getByRole("tab", { name: "Terrain" }));

    await waitFor(() => {
      const field = screen.getByText("Layout").closest(".config-field");
      const select = field?.querySelector("select") as HTMLSelectElement;
      expect(select.value).toBe("custom_layout_alpha");
      expect(Array.from(select.options).map((option) => option.value)).toContain("custom_layout_alpha");
    });
  });

  it("edits layout profile numeric fields from the dialog and pushes them into exported json", async () => {
    const user = userEvent.setup();
    render(<AppShell />);

    await user.click(screen.getByRole("button", { name: "Layout Profiles" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Layout Profiles" })).toBeTruthy();

    const obstaclesFillField = within(dialog).getByText("Obstacles Fill").closest(".config-field");
    const obstaclesFillInput = obstaclesFillField?.querySelector("input") as HTMLInputElement;
    fireEvent.change(obstaclesFillInput, { target: { value: "0.31" } });

    const roadClusterAreaField = within(dialog).getByText("Road Cluster Area").closest(".config-field");
    const roadClusterAreaInput = roadClusterAreaField?.querySelector("input") as HTMLInputElement;
    fireEvent.change(roadClusterAreaInput, { target: { value: "175" } });

    await waitFor(() => {
      const json = (screen.getByLabelText("RMG JSON editor") as HTMLTextAreaElement).value;
      expect(json).toContain('"zoneLayouts": [');
      expect(json).toContain('"obstaclesFill": 0.31');
      expect(json).toContain('"roadClusterArea": 175');
    });
  });

  it("applies zone inspector suggestion chips without crashing", async () => {
    const user = userEvent.setup();
    render(<AppShell />);

    await user.click(screen.getByRole("tab", { name: "Terrain" }));
    const inspector = screen.getByRole("heading", { name: "Zone Inspector" }).closest("section");
    expect(inspector).toBeTruthy();

    await user.click(within(inspector as HTMLElement).getByRole("button", { name: "Snow" }));

    const terrain = (inspector as HTMLElement).querySelector('[data-state="active"][role="tabpanel"] select');
    expect(terrain).toBeTruthy();
    expect((terrain as HTMLSelectElement).value).toBe("Snow");
    expect(screen.getByRole("heading", { name: "Zone Inspector" })).toBeTruthy();
  });

  it("shares a valid template into browse and allows rating it", async () => {
    const user = userEvent.setup();
    authMocks.session = createAuthSession();
    render(<AppShell />);

    const templateName = screen.getByDisplayValue("Custom Template");
    await user.clear(templateName);
    await user.type(templateName, "Shared Circuit");

    await user.click(screen.getByRole("button", { name: "Share" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Share map template" })).toBeTruthy();
    await user.click(within(dialog).getByRole("button", { name: "Share map" }));

    expect(await screen.findByRole("heading", { name: "Browse shared maps" })).toBeTruthy();
    expect(screen.getByText('Shared "Shared Circuit" to the browse catalog.')).toBeTruthy();
    expect(await screen.findByRole("heading", { name: "Shared Circuit" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Rate 5 stars for Shared Circuit" }));

    expect(screen.getByText(/your score 5/i)).toBeTruthy();
    expect(screen.getByText(/5\.0 \/ 5/i)).toBeTruthy();
  });

  it("validates the description before sharing", async () => {
    const user = userEvent.setup();
    authMocks.session = createAuthSession();
    render(<AppShell />);

    await user.click(screen.getByRole("button", { name: "Share" }));

    const dialog = screen.getByRole("dialog");
    const description = within(dialog).getByLabelText("Template Description");
    await user.type(description, "https://example.com");

    expect(within(dialog).getByText("Description cannot contain links or URLs.")).toBeTruthy();
    expect(within(dialog).getByText(/\/ 800$/)).toBeTruthy();
    expect((within(dialog).getByRole("button", { name: "Share map" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("prompts signed-out users to sign in before sharing", async () => {
    const user = userEvent.setup();
    render(<AppShell />);

    await user.click(screen.getByRole("button", { name: "Share" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Sign in" })).toBeTruthy();
    expect(within(dialog).getByText("Sign in is required before publishing a map template.")).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Continue with Google" })).toBeTruthy();
  });

  it("resumes the upload flow after provider sign-in", async () => {
    const user = userEvent.setup();
    render(<AppShell />);

    await user.click(screen.getByRole("button", { name: "Share" }));
    await user.click(await screen.findByRole("button", { name: "Continue with Google" }));

    const uploadDialog = await screen.findByRole("dialog");
    expect(within(uploadDialog).getByRole("heading", { name: "Share map template" })).toBeTruthy();
    expect(within(uploadDialog).getByDisplayValue("OAuth Cartographer")).toBeTruthy();
  });

  it("keeps signed-out users from rating shared maps", async () => {
    const user = userEvent.setup();
    render(<AppShell />);

    await openHeaderMenu(user);
    await user.click(screen.getByRole("button", { name: "Browse" }));

    expect(await screen.findByRole("heading", { name: "Browse shared maps" })).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Rate 5 stars for Merchant Ring" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "Rate 5 stars for Merchant Ring" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("filters browse results by all selected factual and descriptive tags", async () => {
    const user = userEvent.setup();
    render(<AppShell />);

    await openHeaderMenu(user);
    await user.click(screen.getByRole("button", { name: "Browse" }));

    expect(await screen.findByRole("heading", { name: "Browse shared maps" })).toBeTruthy();
    expect(await screen.findByRole("heading", { name: "Temple Border Clash" })).toBeTruthy();

    expect(getRangeInputByLabel("Players minimum")).toBeTruthy();
    expect(getRangeInputByLabel("Map width minimum")).toBeTruthy();
    expect(getRangeInputByLabel("Map height minimum")).toBeTruthy();
    expect(getRangeInputByLabel("Zones minimum")).toBeTruthy();
    expect(getRangeInputByLabel("Paths minimum")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Factual ranges" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Factual tags" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Descriptive tags" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Tags" })).toBeTruthy();
    expect(screen.getByText("Audience")).toBeTruthy();
    expect(screen.getByText("Pacing")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Beginner friendly" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Competitive" }));
    fireEvent.input(getRangeInputByLabel("Map width maximum"), { target: { value: "208" } });

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Temple Border Clash" })).toBeTruthy();
    });
    expect(screen.queryByRole("heading", { name: "Crossroads Pressure" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Merchant Ring" })).toBeNull();
    expect(screen.getByRole("button", { name: "Remove filter Competitive" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remove map width range" })).toBeTruthy();
  });

  it("filters browse results with factual range sliders and can remove the active range", async () => {
    const user = userEvent.setup();
    render(<AppShell />);

    await openHeaderMenu(user);
    await user.click(screen.getByRole("button", { name: "Browse" }));

    expect(await screen.findByRole("heading", { name: "Temple Border Clash" })).toBeTruthy();

    fireEvent.input(getRangeInputByLabel("Map width minimum"), { target: { value: "208" } });

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Temple Border Clash" })).toBeNull();
    });
    expect(screen.queryByRole("heading", { name: "Crossroads Pressure" })).toBeNull();
    expect(await screen.findByRole("heading", { name: "Merchant Ring" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Remove map width range" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Temple Border Clash" })).toBeTruthy();
    });
    expect(screen.getByRole("heading", { name: "Crossroads Pressure" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Merchant Ring" })).toBeTruthy();
  });

  it("disables sharing when the current builder does not produce a valid export", async () => {
    const user = userEvent.setup();
    render(<AppShell />);

    await chooseSelectOption(user, "Victory", "City Hold");

    expect(screen.getByText("City Hold requires exactly one hold-city zone.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Share" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows loading state when browse page loads", async () => {
    const user = userEvent.setup();
    render(<AppShell />);

    await openHeaderMenu(user);
    await user.click(screen.getByRole("button", { name: "Browse" }));

    // Browse heading should appear immediately
    expect(await screen.findByRole("heading", { name: "Browse shared maps" })).toBeTruthy();
    // Eventually maps load
    expect(await screen.findByRole("heading", { name: "Temple Border Clash" })).toBeTruthy();
  });

  it("browse cards render static canvas previews", async () => {
    const user = userEvent.setup();
    render(<AppShell />);

    await openHeaderMenu(user);
    await user.click(screen.getByRole("button", { name: "Browse" }));

    expect(await screen.findByRole("heading", { name: "Browse shared maps" })).toBeTruthy();
    await screen.findByRole("heading", { name: "Temple Border Clash" });

    const canvases = document.querySelectorAll(".community-map-card canvas");
    expect(canvases.length).toBeGreaterThan(0);
    await waitFor(() => {
      const preview = canvases[0] as HTMLCanvasElement;
      expect(preview.style.width).toBe(`${COMMUNITY_MAP_CARD_PREVIEW_SIZE.width}px`);
      expect(preview.style.height).toBe(`${COMMUNITY_MAP_CARD_PREVIEW_SIZE.height}px`);
    });
  });

  it("downloads a community template as rmg json", async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn((_blob: Blob | MediaSource) => "blob:test-download");
    const revokeObjectURL = vi.fn();
    const clickedDownloads: string[] = [];
    Object.defineProperty(URL, "createObjectURL", {
      value: createObjectURL,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      value: revokeObjectURL,
      writable: true,
      configurable: true,
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clickedDownloads.push(this.download);
    });

    render(<AppShell />);

    await openHeaderMenu(user);
    await user.click(screen.getByRole("button", { name: "Browse" }));
    expect(await screen.findByRole("heading", { name: "Browse shared maps" })).toBeTruthy();
    await screen.findByRole("heading", { name: "Temple Border Clash" });

    await user.click(screen.getAllByRole("button", { name: "Download template" })[0]);

    await waitFor(() => {
      expect(clickedDownloads).toHaveLength(1);
    });
    expect(clickedDownloads[0]).toBe("Merchant Ring.rmg.json");
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(createObjectURL.mock.calls[0]?.[0]).toBeInstanceOf(Blob);
    expect((createObjectURL.mock.calls[0]?.[0] as Blob).type).toBe("application/json");
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it("downloads a community preview image from a separate button", async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn((_blob: Blob | MediaSource) => "blob:test-download");
    const revokeObjectURL = vi.fn();
    const clickedDownloads: string[] = [];
    const previewCanvases: Array<{ width: number; height: number }> = [];
    Object.defineProperty(URL, "createObjectURL", {
      value: createObjectURL,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      value: revokeObjectURL,
      writable: true,
      configurable: true,
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clickedDownloads.push(this.download);
    });
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (
      this: HTMLCanvasElement,
      callback: BlobCallback,
      type?: string
    ) {
      previewCanvases.push({ width: this.width, height: this.height });
      callback(new Blob(["preview"], { type: type ?? "image/png" }));
    });

    render(<AppShell />);

    await openHeaderMenu(user);
    await user.click(screen.getByRole("button", { name: "Browse" }));
    expect(await screen.findByRole("heading", { name: "Browse shared maps" })).toBeTruthy();
    await screen.findByRole("heading", { name: "Temple Border Clash" });

    await user.click(screen.getAllByRole("button", { name: "Download image" })[0]);

    await waitFor(() => {
      expect(clickedDownloads).toHaveLength(1);
    });
    expect(clickedDownloads[0]).toBe("Merchant Ring.png");
    expect(previewCanvases).toContainEqual(COMMUNITY_TEMPLATE_PREVIEW_IMAGE_SIZE);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(createObjectURL.mock.calls[0]?.[0]).toBeInstanceOf(Blob);
    expect((createObjectURL.mock.calls[0]?.[0] as Blob).type).toBe("image/png");
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it("shows the builder-style preview legend in the community map detail view", async () => {
    const user = userEvent.setup();
    render(<AppShell />);

    await openHeaderMenu(user);
    await user.click(screen.getByRole("button", { name: "Browse" }));

    expect(await screen.findByRole("heading", { name: "Browse shared maps" })).toBeTruthy();
    await screen.findByRole("heading", { name: "Temple Border Clash" });
    expect(screen.queryByRole("list", { name: "Schematic board legend" })).toBeNull();

    const titleButton = screen.getByRole("heading", { name: "Temple Border Clash" }).closest("button");
    expect(titleButton).toBeTruthy();
    await user.click(titleButton as HTMLButtonElement);

    const dialog = await screen.findByRole("dialog");
    const preview = within(dialog).getByRole("img", { name: "Preview of Temple Border Clash" }) as HTMLCanvasElement;
    expect(preview.style.width).toBe(`${COMMUNITY_MAP_DETAIL_PREVIEW_SIZE.width}px`);
    expect(preview.style.height).toBe(`${COMMUNITY_MAP_DETAIL_PREVIEW_SIZE.height}px`);
    const legend = within(dialog).getByRole("list", { name: "Schematic board legend" });
    expect(within(legend).getByText("Badge: role or player")).toBeTruthy();
    expect(within(legend).getByText("Footholds disabled")).toBeTruthy();
  });

  it("text search filters results in browse view", async () => {
    const user = userEvent.setup();
    render(<AppShell />);

    await openHeaderMenu(user);
    await user.click(screen.getByRole("button", { name: "Browse" }));

    expect(await screen.findByRole("heading", { name: "Browse shared maps" })).toBeTruthy();
    await screen.findByRole("heading", { name: "Temple Border Clash" });

    const searchInput = screen.getByLabelText("Search maps");
    await user.type(searchInput, "Merchant");

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Temple Border Clash" })).toBeNull();
    });
    expect(await screen.findByRole("heading", { name: "Merchant Ring" })).toBeTruthy();
  });

  it("signed-out users see disabled rating buttons", async () => {
    const user = userEvent.setup();
    render(<AppShell />);

    await openHeaderMenu(user);
    await user.click(screen.getByRole("button", { name: "Browse" }));

    expect(await screen.findByRole("heading", { name: "Browse shared maps" })).toBeTruthy();
    const rateButton = await screen.findByRole("button", { name: "Rate 5 stars for Temple Border Clash" });
    expect((rateButton as HTMLButtonElement).disabled).toBe(true);
    expect(rateButton.title).toBe("Sign in to rate maps");
  });

  it("signed-in users can navigate to My maps", async () => {
    const user = userEvent.setup();
    authMocks.session = createAuthSession();
    communityApiMocks.myMaps = [
      createManagedMap({ id: "owned-public", title: "Owned Public Map", visibility: "public", status: "published" })
    ];
    render(<AppShell />);

    await openHeaderMenu(user);
    await user.click(screen.getByRole("button", { name: "My maps" }));

    expect(await screen.findByRole("heading", { name: "My maps" })).toBeTruthy();
    expect(await screen.findByRole("heading", { name: "Owned Public Map" })).toBeTruthy();
  });

  it("My maps shows owned hidden, unlisted, private, and public uploads", async () => {
    const user = userEvent.setup();
    authMocks.session = createAuthSession();
    communityApiMocks.myMaps = [
      createManagedMap({ id: "public-map", title: "Public Forge", visibility: "public", status: "published" }),
      createManagedMap({ id: "unlisted-map", title: "Unlisted Harbor", visibility: "unlisted", status: "published" }),
      createManagedMap({ id: "private-map", title: "Private Vault", visibility: "private", status: "published" }),
      createManagedMap({ id: "hidden-map", title: "Hidden Gate", visibility: "public", status: "hidden" })
    ];
    render(<AppShell />);

    await openHeaderMenu(user);
    await user.click(screen.getByRole("button", { name: "My maps" }));

    expect(await screen.findByRole("heading", { name: "Public Forge" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Unlisted Harbor" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Private Vault" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Hidden Gate" })).toBeTruthy();
  });

  it("can hide and restore an owned listing", async () => {
    const user = userEvent.setup();
    authMocks.session = createAuthSession();
    communityApiMocks.myMaps = [
      createManagedMap({ id: "managed-map", title: "Managed Road", visibility: "public", status: "published" })
    ];
    render(<AppShell />);

    await openHeaderMenu(user);
    await user.click(screen.getByRole("button", { name: "My maps" }));
    expect(await screen.findByRole("heading", { name: "Managed Road" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Hide" }));
    await waitFor(() => {
      expect(communityApiMocks.updatePatches).toContainEqual({ mapId: "managed-map", patch: { status: "hidden" } });
    });
    expect(await screen.findByRole("button", { name: "Restore" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Restore" }));
    await waitFor(() => {
      expect(communityApiMocks.updatePatches).toContainEqual({ mapId: "managed-map", patch: { status: "published" } });
    });
  });

  it("can delete an owned listing after confirmation", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    authMocks.session = createAuthSession();
    communityApiMocks.myMaps = [
      createManagedMap({ id: "delete-map", title: "Private Vault", visibility: "private", status: "published" })
    ];
    render(<AppShell />);

    await openHeaderMenu(user);
    await user.click(screen.getByRole("button", { name: "My maps" }));
    expect(await screen.findByRole("heading", { name: "Private Vault" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Delete Private Vault" }));

    expect(confirm).toHaveBeenCalledWith('Permanently delete "Private Vault"? This cannot be undone.');
    await waitFor(() => {
      expect(communityApiMocks.deletedMapIds).toEqual(["delete-map"]);
    });
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Private Vault" })).toBeNull();
    });
  });

  it("prompts signed-out users to sign in for My maps", async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, "", "/my-maps");
    render(<AppShell />);

    expect(await screen.findByRole("heading", { name: "My maps" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Sign in" })).toBeTruthy();
    expect(within(dialog).getByText("Sign in to manage your uploaded maps.")).toBeTruthy();
  });

  it("delete-account dialog requires confirmation before deleting", async () => {
    const user = userEvent.setup();
    authMocks.session = createAuthSession();
    render(<AppShell />);

    await openHeaderMenu(user);
    await user.click(screen.getByRole("button", { name: "Delete account" }));

    const dialog = await screen.findByRole("dialog");
    const deleteButton = within(dialog).getByRole("button", { name: "Delete account" });
    expect((deleteButton as HTMLButtonElement).disabled).toBe(true);

    await user.click(within(dialog).getByLabelText("I understand this cannot be undone."));
    expect((deleteButton as HTMLButtonElement).disabled).toBe(false);

    await user.click(deleteButton);

    await waitFor(() => {
      expect(communityApiMocks.deleteAccountCalls).toBe(1);
    });
  });
});

function tabPanelDisplay(element: HTMLElement): string {
  const panel = element.closest(".oe-tab-panel");
  if (!(panel instanceof HTMLElement)) throw new Error("Expected element inside a tab panel.");
  return getComputedStyle(panel).display;
}

function createManagedMap(overrides: Record<string, unknown> = {}) {
  return {
    id: "managed-map-1",
    ownerId: "auth-user-1",
    slug: "managed-map",
    title: "Managed Map",
    summary: "Owned map for testing.",
    authorName: "OAuth Cartographer",
    tags: [],
    visibility: "public",
    status: "published",
    mapWidth: 160,
    mapHeight: 160,
    playerCount: 2,
    zoneCount: 5,
    connectionCount: 4,
    winCondition: "Classic",
    templateName: "Managed Map",
    previewDesignJson: JSON.stringify(buildPreviewDesign(createDefaultDesign())),
    previewRendererVersion: PREVIEW_RENDERER_VERSION,
    uploadedAt: "2026-05-17T00:00:00.000Z",
    updatedAt: "2026-05-18T00:00:00.000Z",
    downloadCount: 0,
    averageRating: 0,
    ratingCount: 0,
    ...overrides
  };
}

function createAuthSession() {
  return {
    user: {
      id: "auth-user-1",
      email: "cartographer@example.test",
      user_metadata: {
        full_name: "OAuth Cartographer",
        avatar_url: "https://example.test/avatar.png"
      }
    }
  };
}
