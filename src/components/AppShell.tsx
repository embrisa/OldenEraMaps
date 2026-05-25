import { BookOpenText, Compass, Download, FileJson, FolderOpen, HardDriveDownload, Link2, ListChecks, Menu, PackageCheck, Plus, RotateCcw, Save, Share2, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type JSX } from "react";
import { applyBalancedRandomBoardLayout } from "@/balancedRandomMap";
import {
  addConnection,
  addZone,
  applyRmgJsonToDesign,
  createDefaultDesign,
  deleteZone,
  designToTemplate,
  duplicateZone,
  getDesignMandatoryContentGroups,
  MAX_SPAWN_ZONES,
  moveZone,
  parseDesignOrTemplateFile,
  parseDesignOrTemplateFileResult,
  serializeDesignFile,
  setDesignPlayerCount,
  templateToDesign,
  transferZoneSettings,
  validateDesign,
  type DesignConnection,
  type DesignZone,
  type DesignZoneRole,
  type TemplateDesign
} from "@/design";
import {
  communityAuthReducer,
  deleteCurrentAccount,
  getSession,
  initialCommunityAuthState,
  onAuthStateChange,
  signInWithProvider,
  signOut,
  syncCurrentUserProfile,
  updateCurrentUserDisplayName,
  type CommunityAuthProvider
} from "@/community/auth";
import {
  ensureCommunityViewerId,
  getViewerRating,
  loadCommunityCatalog,
  persistCommunityCatalog,
  rateCommunityMap,
  recordCommunityDownload,
  summarizeCommunityCatalog,
  uploadCommunityMap,
  visibleCommunityMaps,
  type BrowseRangeFilters,
  type CommunityCatalogStats,
  type CommunityUploadDraft
} from "@/community/maps";
import { uploadCommunityMapToServer, ServerUploadError } from "@/community/uploadApi";
import {
  deleteMapListing,
  listMaps,
  listMyMaps,
  getMap,
  rateMap as rateMapApi,
  recordDownload as recordDownloadApi,
  updateMapListing,
  type BrowseMapCard,
  type BrowseResult,
  type BrowseSort,
  type ManagedMapCard,
  type MapDetail
} from "@/community/communityApi";
import { renderCommunityMapPreviewImageBlob } from "@/community/communityPreviewImage";
import { isSupabaseConfigured } from "@/community/supabaseClient";
import { generateTemplate, serializeTemplate } from "@/generator";
import { zoneSuffixes } from "@/generator/math";
import { BalancedRandomMapDialog } from "@/components/builder/BalancedRandomMapDialog";
import { ContentLibraryDialog } from "@/components/builder/ContentLibraryDialog";
import { DesignBoardCanvas } from "@/components/DesignBoardCanvas";
import { ConnectionsDialog } from "@/components/builder/ConnectionsDialog";
import { ContentLimitsDialog } from "@/components/builder/ContentLimitsDialog";
import { ExpertTemplateSettingsDialog } from "@/components/builder/ExpertTemplateSettingsDialog";
import { LayoutProfilesDialog } from "@/components/builder/LayoutProfilesDialog";
import { MandatoryContentDialog } from "@/components/builder/MandatoryContentDialog";
import { AccountMenu } from "@/components/community/AccountMenu";
import { BrowsePage, type BrowseStatus } from "@/components/community/BrowsePage";
import { DeleteAccountDialog } from "@/components/community/DeleteAccountDialog";
import { EditAuthorNameDialog } from "@/components/community/EditAuthorNameDialog";
import { MapDetailDialog } from "@/components/community/MapDetailDialog";
import { MyMapsPage, type MyMapsStatus } from "@/components/community/MyMapsPage";
import { InstallationGuidePage } from "@/components/install/InstallationGuidePage";
import { RmgJsonReferencePage } from "@/components/reference/RmgJsonReferencePage";
import { SignInDialog } from "@/components/community/SignInDialog";
import { UploadMapDialog } from "@/components/community/UploadMapDialog";
import { TemplateSettingsPanel } from "@/components/builder/TemplateSettingsPanel";
import { Alert } from "@/components/builder/formHelpers";
import { BuilderValidationMessages, ValidationOutputPanel } from "@/components/builder/ValidationOutputPanel";
import { ZoneInspector, type ZoneInspectorTab } from "@/components/builder/ZoneInspector";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle, Tabs, TabsContent, TabsList, TabsTrigger, TooltipProvider } from "@/components/ui/radix";
import { serializeRmgTemplate, type GeneratorSettings, type Point } from "@/types";

const AUTOSAVE_KEY = "olden-era-template-generator.autosave";
const POST_SIGN_IN_UPLOAD_KEY = "olden-era-template-generator.post-sign-in-upload";
type AppPage = "builder" | "browse" | "reference" | "install" | "my-maps";
type BuilderWorkspaceTab = "layout" | "json";

interface AutosaveRecovery {
  design: TemplateDesign;
}

interface DesignHistoryEntry {
  design: TemplateDesign;
  selectedZoneId: string;
  selectedConnectionId: string;
  dirty: boolean;
}

interface SaveFilePickerHandle {
  createWritable(): Promise<SaveFilePickerWritable>;
}

interface SaveFilePickerWritable {
  write(data: Blob): Promise<void>;
  close(): Promise<void>;
}

interface SaveFilePickerOptions {
  suggestedName: string;
  types?: Array<{
    description?: string;
    accept: Record<string, string[]>;
  }>;
}

interface DownloadOptions {
  preferSavePicker?: boolean;
}

interface SeoMetadata {
  title: string;
  description: string;
  robots?: string;
  ogType?: string;
}

type SaveFilePickerFunction = (options: SaveFilePickerOptions) => Promise<SaveFilePickerHandle>;

function saveFilePicker(): SaveFilePickerFunction | null {
  if (typeof window === "undefined" || !("showSaveFilePicker" in window)) return null;
  return (window as Window & { showSaveFilePicker?: SaveFilePickerFunction }).showSaveFilePicker ?? null;
}

function pickerTypesForMimeType(type: string): SaveFilePickerOptions["types"] | undefined {
  if (type === "application/json") {
    return [{
      description: "JSON files",
      accept: { "application/json": [".json", ".rmg.json", ".oetd.json"] }
    }];
  }

  if (type === "image/png") {
    return [{
      description: "PNG images",
      accept: { "image/png": [".png"] }
    }];
  }

  return undefined;
}

function ensureHeadMeta(name: string, content: string, attribute: "name" | "property" = "name"): void {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${name}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attribute, name);
    document.head.append(tag);
  }
  tag.setAttribute("content", content);
}

function ensureCanonicalLink(href: string): void {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    document.head.append(link);
  }
  link.setAttribute("href", href);
}

function pageSeoMetadata(page: AppPage): SeoMetadata {
  if (page === "browse") {
    return {
      title: "Browse Community Maps | Olden Era Maps",
      description: "Browse public Heroes of Might and Magic: Olden Era map templates by size, players, tags, ratings, and downloads.",
      ogType: "website"
    };
  }

  if (page === "reference") {
    return {
      title: "RMG JSON Reference | Olden Era Maps",
      description: "Reference fields and terminology for Heroes of Might and Magic: Olden Era .rmg.json map templates.",
      ogType: "article"
    };
  }

  if (page === "install") {
    return {
      title: "Installation Guide | Olden Era Maps",
      description: "Install Heroes of Might and Magic: Olden Era map templates on Windows, Steam, Ubisoft Connect, Linux, Steam Deck, and macOS compatibility setups.",
      ogType: "article"
    };
  }

  if (page === "my-maps") {
    return {
      title: "My Maps | Olden Era Maps",
      description: "Manage your uploaded Olden Era map templates.",
      robots: "noindex,nofollow",
      ogType: "website"
    };
  }

  return {
    title: "Olden Era Maps | RMG Template Builder",
    description: "Build, export, browse, and share Heroes of Might and Magic: Olden Era map templates for the .rmg.json workflow.",
    ogType: "website"
  };
}

function syncSeoMetadata(page: AppPage): void {
  const metadata = pageSeoMetadata(page);
  const canonicalUrl = new URL(window.location.pathname || "/", window.location.origin).toString();

  document.title = metadata.title;
  ensureHeadMeta("description", metadata.description);
  ensureHeadMeta("robots", metadata.robots ?? "index,follow");
  ensureHeadMeta("og:title", metadata.title, "property");
  ensureHeadMeta("og:description", metadata.description, "property");
  ensureHeadMeta("og:type", metadata.ogType ?? "website", "property");
  ensureHeadMeta("og:url", canonicalUrl, "property");
  ensureCanonicalLink(canonicalUrl);
}

function communityDownloadBaseName(map: { title?: string; templateName?: string; slug?: string }): string {
  const candidate = map.title ?? map.templateName ?? map.slug ?? "";
  const normalized = candidate
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1f]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim();
  return normalized || "map";
}

async function writeBlobWithSavePicker(name: string, blob: Blob): Promise<boolean> {
  const showSaveFilePicker = saveFilePicker();
  if (!showSaveFilePicker) return false;

  try {
    const handle = await showSaveFilePicker({
      suggestedName: name,
      types: pickerTypesForMimeType(blob.type)
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return true;
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return true;
    }
    return false;
  }
}

export function AppShell(): JSX.Element {
  const [page, setPage] = useState<AppPage>(() => readPageFromLocation());
  const [design, setDesign] = useState(() => createInitialDesign());
  const [selectedZoneId, setSelectedZoneId] = useState(() => design.zones[0]?.id ?? "");
  const [selectedConnectionId, setSelectedConnectionId] = useState("");
  const [inspectorTab, setInspectorTab] = useState<ZoneInspectorTab>("general");
  const [builderWorkspaceTab, setBuilderWorkspaceTab] = useState<BuilderWorkspaceTab>("layout");
  const [connectionsOpen, setConnectionsOpen] = useState(false);
  const [roadMode, setRoadMode] = useState(false);
  const [contentLimitsOpen, setContentLimitsOpen] = useState(false);
  const [contentLibraryOpen, setContentLibraryOpen] = useState(false);
  const [expertTemplateSettingsOpen, setExpertTemplateSettingsOpen] = useState(false);
  const [layoutProfilesOpen, setLayoutProfilesOpen] = useState(false);
  const [mandatoryContentOpen, setMandatoryContentOpen] = useState(false);
  const [balancedRandomOpen, setBalancedRandomOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [jsonSnapshot, setJsonSnapshot] = useState(() => serializeDesignForBuilder(design) ?? "");
  const [jsonDraft, setJsonDraft] = useState(() => serializeDesignForBuilder(design) ?? "");
  const [jsonParseError, setJsonParseError] = useState<string>();
  const [jsonApplyError, setJsonApplyError] = useState<string>();
  const [jsonValidationErrors, setJsonValidationErrors] = useState<string[]>([]);
  const [autosaveRecovery, setAutosaveRecovery] = useState<AutosaveRecovery | null>(() => readAutosave());
  const [communityCatalog, setCommunityCatalog] = useState(() => loadCommunityCatalog());
  const [communityViewerId] = useState(() => ensureCommunityViewerId());
  const [communityNotice, setCommunityNotice] = useState<string>();
  const [communityError, setCommunityError] = useState<string>();
  const [uploadSubmitting, setUploadSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState<string>();
  const [designBoardCanvas, setDesignBoardCanvas] = useState<HTMLCanvasElement | null>(null);
  const [authState, dispatchAuth] = useReducer(communityAuthReducer, undefined, initialCommunityAuthState);
  const [signInOpen, setSignInOpen] = useState(false);
  const [signInMessage, setSignInMessage] = useState("Sign in with a configured OAuth provider to continue.");
  const [resumeUploadAfterSignIn, setResumeUploadAfterSignIn] = useState(false);
  const [topbarMenuOpen, setTopbarMenuOpen] = useState(false);
  const [browseStatus, setBrowseStatus] = useState<BrowseStatus>("idle");
  const [browseResult, setBrowseResult] = useState<BrowseResult | null>(null);
  const [browseError, setBrowseError] = useState<string>();
  const [browseQuery, setBrowseQuery] = useState("");
  const [browseSort, setBrowseSort] = useState<BrowseSort>("newest");
  const [browseSelectedTags, setBrowseSelectedTags] = useState<string[]>([]);
  const [browseRangeFilters, setBrowseRangeFilters] = useState<BrowseRangeFilters>({});
  const [browsePage, setBrowsePage] = useState(1);
  const [myMapsStatus, setMyMapsStatus] = useState<MyMapsStatus>("idle");
  const [myMaps, setMyMaps] = useState<ManagedMapCard[]>([]);
  const [myMapsError, setMyMapsError] = useState<string>();
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deleteAccountSubmitting, setDeleteAccountSubmitting] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState<string>();
  const [editAuthorNameOpen, setEditAuthorNameOpen] = useState(false);
  const [editAuthorNameSubmitting, setEditAuthorNameSubmitting] = useState(false);
  const [editAuthorNameError, setEditAuthorNameError] = useState<string>();
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailMap, setDetailMap] = useState<MapDetail | null>(null);
  const [exportWarningOpen, setExportWarningOpen] = useState(false);
  const [historyRevision, setHistoryRevision] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const topbarMenuRef = useRef<HTMLDivElement>(null);
  const designHistoryRef = useRef<DesignHistoryEntry[]>([]);

  const selectedZone = design.zones.find((zone) => zone.id === selectedZoneId);
  const zoneLimitReached = design.zones.length >= zoneSuffixes.length;
  const zoneLimitMessage = zoneLimitReached
    ? `Zone limit reached: templates support at most ${zoneSuffixes.length} zones, so adding and duplicating zones is disabled.`
    : undefined;
  const validation = useMemo(() => validateDesign(design), [design]);
  const exportJson = useMemo(() => {
    if (validation.errors.length > 0) return "";
    try {
      return serializeTemplate(designToTemplate(design));
    } catch (error) {
      return error instanceof Error ? error.message : "";
    }
  }, [design, validation.errors.length]);
  const forceExportJson = useMemo(() => {
    if (validation.errors.length === 0) return "";
    try {
      return serializeTemplate(designToTemplate(design, { skipValidation: true }));
    } catch {
      return "";
    }
  }, [design, validation.errors.length]);
  const jsonDirty = jsonDraft !== jsonSnapshot;
  const fileName = `${dirty || jsonDirty ? "* " : ""}${design.templateName || "Custom Template"}.oetd.json`;
  const exportFileName = `${design.templateName.trim() || "Custom Template"}.rmg.json`;
  const localCommunityStats = useMemo(() => summarizeCommunityCatalog(communityCatalog), [communityCatalog]);
  const communityStats = useMemo(() => {
    if (page !== "browse" || !browseResult) return localCommunityStats;
    return summarizeBrowseResult(browseResult);
  }, [browseResult, localCommunityStats, page]);
  const browseMaps = useMemo(() => visibleCommunityMaps(communityCatalog), [communityCatalog]);
  const canUndoDesignChange = historyRevision > 0;

  useEffect(() => {
    if (!dirty) return;
    window.localStorage.setItem(AUTOSAVE_KEY, serializeDesignFile(design));
  }, [design, dirty]);

  useEffect(() => {
    persistCommunityCatalog(communityCatalog);
  }, [communityCatalog]);

  useEffect(() => {
    if (!topbarMenuOpen) return;

    function closeOnPointerDown(event: PointerEvent): void {
      if (event.target instanceof Node && topbarMenuRef.current?.contains(event.target)) return;
      setTopbarMenuOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent): void {
      if (event.key === "Escape") setTopbarMenuOpen(false);
    }

    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [topbarMenuOpen]);

  useEffect(() => {
    let active = true;
    void getSession()
      .then((session) => {
        if (!active) return;
        dispatchAuth({ type: "session", session });
        if (session) {
          void syncCurrentUserProfile(session)
            .then((profile) => {
              if (active && profile) dispatchAuth({ type: "profile", profile });
            })
            .catch((error: unknown) => dispatchAuth({ type: "error", error: authErrorMessage(error) }));
        }
      })
      .catch((error: unknown) => {
        if (active) dispatchAuth({ type: "error", error: authErrorMessage(error) });
      });

    const unsubscribe = onAuthStateChange((_event, session) => {
      dispatchAuth({ type: "session", session });
      if (session) {
        void syncCurrentUserProfile(session)
          .then((profile) => {
            if (profile) dispatchAuth({ type: "profile", profile });
          })
          .catch((error: unknown) => dispatchAuth({ type: "error", error: authErrorMessage(error) }));
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (authState.status !== "signed-in") return;
    if (!resumeUploadAfterSignIn && !readPostSignInUpload()) return;
    clearPostSignInUpload();
    setResumeUploadAfterSignIn(false);
    setSignInOpen(false);
    setUploadOpen(true);
  }, [authState.status, resumeUploadAfterSignIn]);

  useEffect(() => {
    if (!jsonDirty || jsonParseError) return;
    applyJsonText(jsonDraft);
  }, [design, jsonDirty, jsonDraft, jsonParseError, selectedZoneId]);

  useEffect(() => {
    function handlePopstate(): void {
      setPage(readPageFromLocation());
    }

    window.addEventListener("popstate", handlePopstate);
    return () => window.removeEventListener("popstate", handlePopstate);
  }, []);

  useEffect(() => {
    syncSeoMetadata(page);
  }, [page]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (!isUndoShortcut(event) || isEditableShortcutTarget(event.target)) return;
      if (!designHistoryRef.current.length) return;
      event.preventDefault();
      undoDesignChange();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const loadBrowseMaps = useCallback(async (currentPage = browsePage) => {
    setBrowseStatus("loading");
    setBrowseError(undefined);
    try {
      const result = await listMaps({
        query: browseQuery,
        selectedTagSlugs: browseSelectedTags,
        rangeFilters: browseRangeFilters,
        sort: browseSort,
        page: currentPage
      });
      setBrowseResult(result);
      setBrowseStatus("loaded");
    } catch (error) {
      setBrowseError(error instanceof Error ? error.message : "Failed to load maps.");
      setBrowseStatus("error");
    }
  }, [browseQuery, browseSelectedTags, browseRangeFilters, browseSort, browsePage]);

  useEffect(() => {
    if (page !== "browse") return;
    void loadBrowseMaps();
  }, [page, loadBrowseMaps]);

  const loadMyMaps = useCallback(async () => {
    if (authState.status !== "signed-in") {
      setMyMapsStatus("idle");
      setMyMaps([]);
      setMyMapsError(undefined);
      return;
    }

    setMyMapsStatus("loading");
    setMyMapsError(undefined);
    try {
      const result = await listMyMaps();
      setMyMaps(result.maps);
      setMyMapsStatus("loaded");
    } catch (error) {
      setMyMapsError(error instanceof Error ? error.message : "Failed to load your maps.");
      setMyMapsStatus("error");
    }
  }, [authState.status]);

  useEffect(() => {
    if (page !== "my-maps") return;
    void loadMyMaps();
  }, [page, loadMyMaps]);

  function commit(
    next: TemplateDesign,
    nextSelectedZoneId = selectedZoneId,
    options: {
      allowDirtyJsonOverwrite?: boolean;
      markDirty?: boolean;
    } = {}
  ): boolean {
    if (!options.allowDirtyJsonOverwrite && jsonDirty && !window.confirm("Discard unsynced JSON edits?")) {
      return false;
    }

    pushDesignHistory({
      design,
      selectedZoneId,
      selectedConnectionId,
      dirty
    });
    const resolvedZoneId = resolveSelectedZoneId(design, next, nextSelectedZoneId);
    setDesign(next);
    setSelectedZoneId(resolvedZoneId);
    setSelectedConnectionId(resolvedZoneId ? "" : resolveSelectedConnectionId(next, selectedConnectionId));
    setDirty(options.markDirty ?? true);
    clearJsonMessages();
    syncJsonSnapshot(next);
    return true;
  }

  function pushDesignHistory(entry: DesignHistoryEntry): void {
    designHistoryRef.current = [...designHistoryRef.current.slice(-49), structuredClone(entry)];
    setHistoryRevision(designHistoryRef.current.length);
  }

  function resetDesignHistory(): void {
    designHistoryRef.current = [];
    setHistoryRevision(0);
  }

  function undoDesignChange(): void {
    const previous = designHistoryRef.current.at(-1);
    if (!previous) return;

    designHistoryRef.current = designHistoryRef.current.slice(0, -1);
    setDesign(previous.design);
    setSelectedZoneId(previous.selectedZoneId);
    setSelectedConnectionId(previous.selectedConnectionId);
    setDirty(previous.dirty);
    clearJsonMessages();
    syncJsonSnapshot(previous.design);
    setHistoryRevision(designHistoryRef.current.length);
  }

  function handleNew(): void {
    if ((dirty || jsonDirty) && !window.confirm("Discard unsaved changes?")) return;
    const next = createInitialDesign();
    setDesign(next);
    setSelectedZoneId(next.zones[0]?.id ?? "");
    setSelectedConnectionId("");
    setDirty(false);
    clearJsonMessages();
    syncJsonSnapshot(next);
    resetDesignHistory();
  }

  function handleRecover(): void {
    if (!autosaveRecovery) return;
    if ((dirty || jsonDirty) && !window.confirm("Discard unsaved changes?")) return;
    setDesign(autosaveRecovery.design);
    setSelectedZoneId(autosaveRecovery.design.zones[0]?.id ?? "");
    setSelectedConnectionId("");
    setDirty(true);
    clearJsonMessages();
    syncJsonSnapshot(autosaveRecovery.design);
    resetDesignHistory();
    setAutosaveRecovery(null);
  }

  function handleDismissRecovery(): void {
    window.localStorage.removeItem(AUTOSAVE_KEY);
    setAutosaveRecovery(null);
  }

  function handleGlobal<K extends keyof TemplateDesign>(key: K, value: TemplateDesign[K]): void {
    commit({ ...design, [key]: value });
  }

  function handlePlayerCount(playerCount: number): void {
    const next = setDesignPlayerCount(design, playerCount);
    commit(next, next.zones.find((zone) => zone.role === "Spawn" && zone.player === playerCount)?.id ?? selectedZoneId);
  }

  function handleMapDimension(key: "mapWidth" | "mapHeight", value: number): void {
    if (design.lockMapDimensions) {
      commit({ ...design, mapWidth: value, mapHeight: value });
      return;
    }

    commit({ ...design, [key]: value });
  }

  function handleLockMapDimensions(locked: boolean): void {
    commit({
      ...design,
      lockMapDimensions: locked,
      ...(locked ? { mapHeight: design.mapWidth } : {})
    });
  }

  function handleHero(key: keyof TemplateDesign["heroSettings"], value: number): void {
    commit({ ...design, heroSettings: { ...design.heroSettings, [key]: value } });
  }

  function handleGameEnd(key: keyof TemplateDesign["gameEndConditions"], value: boolean | number | string): void {
    const next = { ...design.gameEndConditions, [key]: value };
    if (key === "victoryCondition") {
      next.cityHold = value === "win_condition_5";
    }
    commit({ ...design, gameEndConditions: next });
  }

  function updateZone(mutator: (zone: DesignZone) => void): void {
    const next = structuredClone(design);
    const zone = next.zones.find((candidate) => candidate.id === selectedZoneId);
    if (!zone) return;
    const previousRole = zone.role;
    const previousName = zone.name;
    mutator(zone);
    reconcileRoleChange(next, zone, previousRole, previousName);
    commit(next, zone.id);
  }

  function updateConnection(connectionId: string, mutator: (connection: DesignConnection) => void): void {
    const next = structuredClone(design);
    const connection = next.connections.find((candidate) => candidate.id === connectionId);
    if (!connection) return;
    mutator(connection);
    commit(next);
  }

  function updateDesign(mutator: (design: TemplateDesign) => void): void {
    const next = structuredClone(design);
    mutator(next);
    commit(next);
  }

  function handleAddZone(role: DesignZoneRole): void {
    const next = addZone(design, role);
    const existingZoneIds = new Set(design.zones.map((zone) => zone.id));
    const addedZone = next.zones.find((zone) => !existingZoneIds.has(zone.id));
    commit(next, addedZone?.id ?? selectedZoneId);
  }

  function handleDuplicate(zoneId: string): void {
    const next = duplicateZone(design, zoneId);
    const existingZoneIds = new Set(design.zones.map((zone) => zone.id));
    const duplicatedZone = next.zones.find((zone) => !existingZoneIds.has(zone.id));
    commit(next, duplicatedZone?.id ?? zoneId);
  }

  function handleTransferZoneSettings(sourceZoneId: string, targetZoneId: string): void {
    const next = transferZoneSettings(design, sourceZoneId, targetZoneId);
    if (next === design) return;
    commit(next, targetZoneId);
  }

  function handleDelete(zoneId: string): void {
    commit(deleteZone(design, zoneId));
  }

  function handleMoveZone(zoneId: string, position: Point): void {
    const next = moveZone(design, zoneId, position);
    if (next === design) return;
    commit(next, zoneId);
  }

  function handleSelectZone(zoneId: string): void {
    setSelectedZoneId(zoneId);
    if (selectedConnectionId) setSelectedConnectionId("");
  }

  function handleSelectConnection(connectionId: string): void {
    setSelectedConnectionId(connectionId);
    if (connectionId) setSelectedZoneId("");
  }

  function handleDeleteConnection(connectionId: string): void {
    commit({ ...design, connections: design.connections.filter((connection) => connection.id !== connectionId) });
  }

  function handleEditConnection(connectionId: string): void {
    setSelectedConnectionId(connectionId);
    setConnectionsOpen(true);
  }

  function handleConnectionsOpenChange(open: boolean): void {
    setConnectionsOpen(open);
    if (!open) setSelectedConnectionId("");
  }

  function handleImportFile(file: File | undefined): void {
    if (!file) return;
    if ((dirty || jsonDirty) && !window.confirm("Discard unsaved changes?")) return;
    void file.text().then((text) => {
      const result = parseDesignOrTemplateFileResult(text);
      if (!result.ok) {
        setCommunityError(result.errorMessage);
        return;
      }
      const next = result.design;
      setCommunityError(undefined);
      commit(next, next.zones[0]?.id ?? "", { allowDirtyJsonOverwrite: true });
    }).catch((error: unknown) => {
      setCommunityError(error instanceof Error ? error.message : "Failed to read import file.");
    });
  }

  function handleGenerateBalancedRandomMap(settings: GeneratorSettings): boolean {
    if ((dirty || jsonDirty) && !window.confirm("Discard unsaved changes?")) return false;
    const next = applyBalancedRandomBoardLayout(templateToDesign(generateTemplate(settings)));
    return commit(next, next.zones[0]?.id ?? "", { allowDirtyJsonOverwrite: true, markDirty: true });
  }

  function navigate(nextPage: AppPage): void {
    const nextPath = nextPage === "browse"
      ? "/browse"
      : nextPage === "reference"
        ? "/reference"
        : nextPage === "install"
          ? "/install"
          : nextPage === "my-maps"
            ? "/my-maps"
            : "/";
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, "", nextPath);
    }
    setPage(nextPage);
  }

  async function handleShareMap(draft: CommunityUploadDraft): Promise<void> {
    if (authState.status !== "signed-in") {
      requestSignInForUpload();
      return;
    }
    if (validation.errors.length > 0 || exportJson === "") return;

    const uploadDesign = draft.summary === design.templateDescription
      ? design
      : { ...design, templateDescription: draft.summary };

    if (uploadDesign !== design) {
      commit(uploadDesign, selectedZoneId, { allowDirtyJsonOverwrite: true, markDirty: true });
    }

    setUploadSubmitting(true);
    setUploadError(undefined);
    try {
      let updatedCatalog: typeof communityCatalog;
      if (isSupabaseConfigured) {
        const result = await uploadCommunityMapToServer(uploadDesign, draft, undefined, designBoardCanvas ? { previewSource: designBoardCanvas } : {});
        updatedCatalog = {
          ...communityCatalog,
          maps: [result.map, ...communityCatalog.maps.filter((map) => map.id !== result.map.id)]
        };
      } else {
        updatedCatalog = uploadCommunityMap(communityCatalog, uploadDesign, draft);
      }
      setCommunityCatalog(updatedCatalog);
      persistCommunityCatalog(updatedCatalog);
      setUploadOpen(false);
      setCommunityNotice(`Shared "${draft.title}"${draft.visibility === "unlisted" ? " as an unlisted map." : " to the browse catalog."}`);
      if (draft.visibility === "public") {
        navigate("browse");
      }
    } catch (error) {
      setUploadError(uploadErrorMessage(error));
    } finally {
      setUploadSubmitting(false);
    }
  }

  function handleRateMap(mapId: string, value: number): void {
    if (authState.status !== "signed-in") {
      requestSignIn("Sign in to rate shared maps with a stable beta identity.");
      return;
    }
    setCommunityError(undefined);
    const updated = rateCommunityMap(communityCatalog, mapId, communityViewerId, value);
    setCommunityCatalog(updated);
    void rateMapApi(mapId, value).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Failed to save rating.";
      setCommunityError(message);
    });

    // Optimistically update browse result cards with new rating aggregates
    const ratedMap = updated.maps.find((m) => m.id === mapId);
    if (ratedMap && browseResult) {
      setBrowseResult((prev) => prev ? {
        ...prev,
        maps: prev.maps.map((card) => card.id === mapId ? {
          ...card,
          averageRating: ratedMap.averageRating,
          ratingCount: ratedMap.ratingCount
        } : card)
      } : prev);
    }
  }

  function handleDownloadBrowseMap(map: BrowseMapCard): void {
    void (async () => {
      setCommunityError(undefined);
      const detail = await getMap(map.id);
      if (!detail) return;
      await downloadCommunityTemplateFile(detail);
      setCommunityCatalog((current) => recordCommunityDownload(current, map.id));
      try {
        await recordDownloadApi(map.id);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to record download.";
        setCommunityError(message);
      }
    })();
  }

  function handleDownloadBrowseMapImage(map: BrowseMapCard): void {
    void (async () => {
      setCommunityError(undefined);
      await downloadCommunityPreviewImage(map);
    })();
  }

  function openMapInBuilder(mapId: string, mapTitle: string): void {
    if ((dirty || jsonDirty) && !window.confirm("Discard unsaved changes?")) return;
    void (async () => {
      const detail = await getMap(mapId);
      if (!detail) return;
      const designResult = parseDesignOrTemplateFileResult(detail.designJson);
      const templateResult = designResult.ok ? designResult : parseDesignOrTemplateFileResult(detail.templateJson);
      if (!templateResult.ok) {
        setCommunityError(`Failed to load "${mapTitle}" into the builder. ${templateResult.errorMessage}`);
        return;
      }
      const next = templateResult.design;
      setCommunityError(undefined);
      if (!commit(next, next.zones[0]?.id ?? "", { allowDirtyJsonOverwrite: true, markDirty: false })) return;
      setCommunityNotice(`Loaded "${mapTitle}" into the builder.`);
      navigate("builder");
    })();
  }

  function handleOpenBrowseMap(map: BrowseMapCard): void {
    openMapInBuilder(map.id, map.title);
  }

  function handleOpenOwnedMap(map: ManagedMapCard): void {
    openMapInBuilder(map.id, map.title);
  }

  async function handleViewMapDetail(map: BrowseMapCard): Promise<void> {
    setDetailOpen(true);
    setDetailMap(null);
    try {
      const detail = await getMap(map.id);
      setDetailMap(detail);
    } catch {
      setDetailMap(null);
    }
  }

  function handleUpdateMapListing(mapId: string, patch: import("@/community/communityApi").MapListingPatch): void {
    void updateMapListing(mapId, patch).then(() => {
      void loadBrowseMaps();
      if (detailMap?.id === mapId) {
        void getMap(mapId).then((updated) => setDetailMap(updated));
      }
    }).catch(() => {});
  }

  function handleHideMap(mapId: string): void {
    void updateMapListing(mapId, { status: "hidden" }).then(() => {
      setDetailOpen(false);
      void loadBrowseMaps();
    }).catch(() => {});
  }

  function handleShareMapClick(): void {
    if (authState.status !== "signed-in") {
      requestSignInForUpload();
      return;
    }
    setUploadError(undefined);
    setUploadOpen(true);
  }

  function requestSignInForUpload(): void {
    setResumeUploadAfterSignIn(true);
    writePostSignInUpload();
    requestSignIn("Sign in is required before publishing a map template.");
  }

  function requestSignIn(message = "Sign in with a configured OAuth provider to continue."): void {
    setSignInMessage(message);
    dispatchAuth({ type: "clear-error" });
    setSignInOpen(true);
  }

  function handleSignInWithProvider(provider: CommunityAuthProvider): void {
    dispatchAuth({ type: "loading" });
    void signInWithProvider(provider).catch((error: unknown) => {
      dispatchAuth({ type: "error", error: authErrorMessage(error) });
    });
  }

  function handleSignOut(): void {
    void signOut().catch((error: unknown) => dispatchAuth({ type: "error", error: authErrorMessage(error) }));
  }

  function handleEditAuthorName(displayName: string): void {
    if (!authState.profile) return;
    setEditAuthorNameSubmitting(true);
    setEditAuthorNameError(undefined);
    void updateCurrentUserDisplayName(authState.profile, displayName)
      .then((profile) => {
        dispatchAuth({ type: "profile", profile });
        setCommunityNotice("Author name updated.");
        setEditAuthorNameOpen(false);
        if (page === "browse") void loadBrowseMaps();
        if (page === "my-maps") void loadMyMaps();
        if (detailMap?.ownerId && detailMap.ownerId === profile.userId) {
          void getMap(detailMap.id).then((updated) => setDetailMap(updated)).catch(() => {});
        }
      })
      .catch((error: unknown) => setEditAuthorNameError(authErrorMessage(error)))
      .finally(() => setEditAuthorNameSubmitting(false));
  }

  function handleOpenMyMaps(): void {
    navigate("my-maps");
  }

  function patchMyMap(mapId: string, patch: Partial<ManagedMapCard>): void {
    setMyMaps((current) => current.map((map) => map.id === mapId ? { ...map, ...patch } : map));
  }

  function handleUpdateOwnedMapListing(mapId: string, patch: import("@/community/communityApi").MapListingPatch): void {
    void updateMapListing(mapId, patch)
      .then(() => {
        patchMyMap(mapId, {
          ...(patch.title !== undefined ? { title: patch.title } : {}),
          ...(patch.authorName !== undefined ? { authorName: patch.authorName.trim() || "Anonymous Cartographer" } : {}),
          ...(patch.description !== undefined ? { summary: patch.description } : {}),
          ...(patch.visibility !== undefined ? { visibility: patch.visibility } : {}),
          ...(patch.status !== undefined ? { status: patch.status } : {})
        });
      })
      .catch((error: unknown) => {
        setMyMapsError(error instanceof Error ? error.message : "Failed to update map listing.");
      });
  }

  function handleHideOwnedMap(mapId: string): void {
    handleUpdateOwnedMapListing(mapId, { status: "hidden" });
  }

  function handleRestoreOwnedMap(mapId: string): void {
    handleUpdateOwnedMapListing(mapId, { status: "published" });
  }

  function handleDeleteOwnedMap(map: ManagedMapCard): void {
    if (!window.confirm(`Permanently delete "${map.title}"? This cannot be undone.`)) return;

    void deleteMapListing(map.id)
      .then(() => {
        setMyMaps((current) => current.filter((entry) => entry.id !== map.id));
      })
      .catch((error: unknown) => {
        setMyMapsError(error instanceof Error ? error.message : "Failed to delete map listing.");
      });
  }

  function handleDownloadOwnedMap(map: ManagedMapCard): void {
    void (async () => {
      const detail = await getMap(map.id);
      if (!detail) return;
      await downloadCommunityTemplateFile(detail);
    })();
  }

  function handleDownloadOwnedMapImage(map: ManagedMapCard): void {
    void (async () => {
      setCommunityError(undefined);
      await downloadCommunityPreviewImage(map);
    })();
  }

  function handleDownloadDetailMap(map: MapDetail): void {
    void (async () => {
      setCommunityError(undefined);
      await downloadCommunityTemplateFile(map);
      setCommunityCatalog((current) => recordCommunityDownload(current, map.id));
      void recordDownloadApi(map.id).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Failed to record download.";
        setCommunityError(message);
      });
    })();
  }

  function handleDownloadDetailMapImage(map: MapDetail): void {
    void (async () => {
      setCommunityError(undefined);
      await downloadCommunityPreviewImage(map);
    })();
  }

  function handleDeleteAccount(): void {
    setDeleteAccountError(undefined);
    setDeleteAccountOpen(true);
  }

  function confirmDeleteAccount(): void {
    setDeleteAccountSubmitting(true);
    setDeleteAccountError(undefined);
    void deleteCurrentAccount()
      .then(() => {
        setDeleteAccountOpen(false);
      })
      .catch((error: unknown) => {
        setDeleteAccountError(error instanceof Error ? error.message : "Failed to delete account.");
      })
      .finally(() => {
        setDeleteAccountSubmitting(false);
      });
  }

  function handleJsonChange(nextText: string, nextParseError?: string): void {
    setJsonDraft(nextText);
    setJsonParseError(nextParseError);
    setJsonApplyError(undefined);
    setJsonValidationErrors([]);
  }

  function syncJsonSnapshot(next: TemplateDesign): void {
    const nextSnapshot = serializeDesignForBuilder(next);
    if (!nextSnapshot) return;
    setJsonSnapshot(nextSnapshot);
    setJsonDraft(nextSnapshot);
    setJsonParseError(undefined);
  }

  function clearJsonMessages(): void {
    setJsonApplyError(undefined);
    setJsonValidationErrors([]);
  }

  function applyJsonText(text: string): void {
    const result = applyRmgJsonToDesign(text, design);
    if (!result.ok) {
      setJsonApplyError(result.parseError);
      setJsonValidationErrors(result.validation?.errors ?? []);
      return;
    }

    setJsonParseError(undefined);
    setJsonApplyError(undefined);
    setJsonValidationErrors([]);
    commit(result.design, selectedZoneId, { allowDirtyJsonOverwrite: true, markDirty: true });
  }

  async function download(name: string, content: string, type: string, options?: DownloadOptions): Promise<void> {
    await downloadBlob(name, new Blob([content], { type }), options);
  }

  function handleExportClick(): void {
    if (validation.errors.length === 0) {
      if (exportJson === "") return;
      void download(exportFileName, exportJson, "application/json", { preferSavePicker: true });
      return;
    }

    if (forceExportJson === "") return;
    setExportWarningOpen(true);
  }

  async function handleForceExportClick(): Promise<void> {
    if (forceExportJson === "") return;
    setExportWarningOpen(false);
    await download(exportFileName, forceExportJson, "application/json", { preferSavePicker: true });
  }

  async function downloadBlob(name: string, blob: Blob, options?: DownloadOptions): Promise<void> {
    if (options?.preferSavePicker && await writeBlobWithSavePicker(name, blob)) {
      return;
    }

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function downloadCommunityTemplateFile(
    map: Pick<MapDetail, "slug" | "title" | "templateName" | "templateJson">
  ): Promise<void> {
    await download(`${communityDownloadBaseName(map)}.rmg.json`, map.templateJson, "application/json");
  }

  async function downloadCommunityPreviewImage(
    map: Pick<MapDetail, "slug" | "title" | "templateName" | "previewDesignJson">
  ): Promise<void> {
    try {
      const previewBlob = await renderCommunityMapPreviewImageBlob(map.previewDesignJson);
      await downloadBlob(`${communityDownloadBaseName(map)}.png`, previewBlob, { preferSavePicker: true });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to create preview image.";
      setCommunityError(message);
    }
  }

  return (
    <TooltipProvider>
    <main className={`studio-shell studio-shell--${page}`}>
      <input ref={fileInputRef} hidden type="file" accept=".json,.rmg.json,.oetd.json,application/json" onChange={(event) => handleImportFile(event.currentTarget.files?.[0])} />
      <header className="studio-topbar">
        <div className="brand-lockup">
          <img src="/assets/olden-era/factions/temple-icon.png" alt="" />
          <div>
            <span>Template Builder</span>
            <strong>Olden Era RMG Studio</strong>
          </div>
        </div>
        <div className="faction-mark-strip" aria-hidden="true">
          {["temple", "grove", "dungeon", "hive", "necropolis", "schism"].map((name) => (
            <img key={name} src={`/assets/olden-era/factions/${name}-icon.png`} alt="" />
          ))}
        </div>
        <div className="topbar-stats">
          {page === "browse" ? (
            <>
              <span><strong>{communityStats.mapCount}</strong>Maps</span>
              <span><strong>{communityStats.ratingCount}</strong>Ratings</span>
            </>
          ) : null}
        </div>
        {page === "builder" ? (
          <div className="topbar-file-actions">
            <Button size="sm" onClick={() => fileInputRef.current?.click()}><FolderOpen size={14} />Open</Button>
            <Button size="sm" onClick={() => void download(`${design.templateName}.oetd.json`, serializeDesignFile(design), "application/json", { preferSavePicker: true })}><Save size={14} />Save</Button>
            <Button size="sm" variant="blue" onClick={handleShareMapClick} disabled={validation.errors.length > 0}><Share2 size={14} />Share</Button>
            <Button size="sm" variant="primary" onClick={handleExportClick} disabled={validation.errors.length === 0 ? exportJson === "" : forceExportJson === ""}>
              <Download size={14} />Export
            </Button>
          </div>
        ) : null}
        <div className="topbar-menu" ref={topbarMenuRef}>
          <Button
            className="topbar-menu__trigger"
            size="icon"
            aria-label={topbarMenuOpen ? "Close header menu" : "Open header menu"}
            aria-controls="topbar-action-menu"
            aria-expanded={topbarMenuOpen}
            onClick={() => setTopbarMenuOpen((open) => !open)}
          >
            {topbarMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </Button>
          {topbarMenuOpen ? (
            <div id="topbar-action-menu" className="topbar-actions" aria-label="Header actions" onClick={() => setTopbarMenuOpen(false)}>
              <Button variant={page === "builder" ? "gold" : "ghost"} onClick={() => navigate("builder")}><FileJson size={16} />Builder</Button>
              <Button variant={page === "browse" ? "primary" : "ghost"} onClick={() => navigate("browse")}><Compass size={16} />Browse</Button>
              <Button variant={page === "reference" ? "blue" : "ghost"} onClick={() => navigate("reference")}><BookOpenText size={16} />Reference</Button>
              <Button variant={page === "install" ? "green" : "ghost"} onClick={() => navigate("install")}><HardDriveDownload size={16} />Install</Button>
              <AccountMenu
                status={authState.status}
                profile={authState.profile}
                onSignIn={() => requestSignIn()}
                onSignOut={handleSignOut}
                onMyMaps={handleOpenMyMaps}
                onEditProfile={() => {
                  setEditAuthorNameError(undefined);
                  setEditAuthorNameOpen(true);
                }}
                onDeleteAccount={handleDeleteAccount}
              />
              {page === "builder" ? (
                <>
                  <Button onClick={handleNew}><FileJson size={16} />New</Button>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
        {autosaveRecovery ? (
          <section className="autosave-recovery" role="status" aria-label="Autosaved design available">
            <div>
              <strong>Autosaved design available</strong>
              <span>{autosaveRecovery.design.templateName}</span>
            </div>
            <div className="autosave-recovery__actions">
              <Button size="sm" variant="gold" onClick={handleRecover}><RotateCcw size={14} />Recover</Button>
              <Button size="sm" variant="ghost" onClick={handleDismissRecovery}>Dismiss</Button>
            </div>
          </section>
        ) : null}
      </header>

      {communityNotice ? (
        <section className="community-notice alert alert--success" role="status">
          {communityNotice}
        </section>
      ) : null}

      {communityError ? (
        <section className="community-notice alert alert--danger" role="alert">
          {communityError}
          <Button size="sm" variant="ghost" onClick={() => setCommunityError(undefined)} aria-label="Dismiss error">
            <X size={14} />
          </Button>
        </section>
      ) : null}

      {page === "builder" ? (
        <section className="studio-grid">
          <TemplateSettingsPanel
            design={design}
            onGlobal={handleGlobal}
            onPlayerCount={handlePlayerCount}
            onMapDimension={handleMapDimension}
            onLockMapDimensions={handleLockMapDimensions}
            onHero={handleHero}
            onGameEnd={handleGameEnd}
          />
          <div className="studio-workspace">
            <div className="studio-main">
              <Tabs value={builderWorkspaceTab} onValueChange={(value) => setBuilderWorkspaceTab(value as BuilderWorkspaceTab)} className="builder-workspace-root">
                <div className="studio-toolbar">
                  <div className="dirty-state">{fileName}</div>
                  <div className="topbar-stats">
                    <span><strong>{design.zones.length}</strong>Zones</span>
                    <span><strong>{design.connections.length}</strong>Paths</span>
                  </div>
                  <TabsList aria-label="Builder workspace view" className="builder-workspace-tabs">
                    <TabsTrigger value="layout" className="oe-tab--gold">
                      <Sparkles size={15} />Design Board
                    </TabsTrigger>
                    <TabsTrigger value="json" className="oe-tab--violet">
                      <FileJson size={15} />Validation & JSON
                    </TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent value="layout" forceMount style={builderWorkspaceTab === "layout" ? undefined : { display: "none" }}>
                  <BuilderValidationMessages validation={validation} />
                  <Card className="design-board-shell">
                    <CardHeader className="design-board-shell__header">
                      <CardTitle><Sparkles size={17} />Template Layout</CardTitle>
                      <div className="board-widget-actions" aria-label="Design board actions">
                        <Button
                          size="icon"
                          variant="blue"
                          disabled={!canUndoDesignChange}
                          aria-label="Undo last design change"
                          title="Undo last design change (Ctrl+Z)"
                          onClick={undoDesignChange}
                        >
                          <RotateCcw size={16} />
                        </Button>
                        <Button variant="blue" disabled={zoneLimitReached} title={zoneLimitMessage} onClick={() => handleAddZone("Spawn")}><Plus size={16} />Spawn</Button>
                        <Button variant="gold" disabled={zoneLimitReached} title={zoneLimitMessage} onClick={() => handleAddZone("Neutral")}><Plus size={16} />Neutral</Button>
                        <Button variant="green" disabled={zoneLimitReached} title={zoneLimitMessage} onClick={() => handleAddZone("Hub")}><Plus size={16} />Hub</Button>
                        <Button
                          variant="gold"
                          aria-pressed={roadMode}
                          title="Toggle connection handles on the design board"
                          onClick={() => setRoadMode((enabled) => !enabled)}
                        >
                          <Link2 size={16} />Road Mode
                        </Button>
                        <Button variant="violet" onClick={() => { setSelectedConnectionId(""); setConnectionsOpen(true); }}><Link2 size={16} />Connections</Button>
                      </div>
                      {zoneLimitMessage ? <div className="builder-inline-notice">{zoneLimitMessage}</div> : null}
                    </CardHeader>
                    <CardContent>
                      <DesignBoardCanvas
                        design={design}
                        selectedZoneId={selectedZone?.id ?? ""}
                        selectedConnectionId={selectedConnectionId}
                        roadMode={roadMode}
                        onCanvasChange={setDesignBoardCanvas}
                        onSelectZone={handleSelectZone}
                        onSelectConnection={handleSelectConnection}
                        onMoveZone={handleMoveZone}
                        onConnectZones={(next, nextSelectedZoneId) => commit(next, nextSelectedZoneId)}
                        onEditConnection={handleEditConnection}
                        onDeleteConnection={handleDeleteConnection}
                      />
                    </CardContent>
                  </Card>
                  <Card className="advanced-settings-shell">
                    <CardHeader>
                      <CardTitle><Compass size={17} />Advanced Settings</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="advanced-settings-actions" aria-label="Advanced settings actions">
                        <Button variant="blue" onClick={() => setLayoutProfilesOpen(true)}><Compass size={16} />Layout Profiles</Button>
                        <Button variant="blue" onClick={() => setContentLimitsOpen(true)}><ListChecks size={16} />Content Limits</Button>
                        <Button variant="violet" onClick={() => setContentLibraryOpen(true)}><FileJson size={16} />Content Library</Button>
                        <Button variant="violet" onClick={() => setExpertTemplateSettingsOpen(true)}><FileJson size={16} />Expert Settings</Button>
                        <Button variant="green" onClick={() => setMandatoryContentOpen(true)}><PackageCheck size={16} />Mandatory Content</Button>
                        <Button variant="gold" onClick={() => setBalancedRandomOpen(true)}><Sparkles size={16} />Balanced Random</Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
                <TabsContent value="json" forceMount style={builderWorkspaceTab === "json" ? undefined : { display: "none" }}>
                  <ValidationOutputPanel
                    validation={validation}
                    showBuilderValidationMessages={builderWorkspaceTab === "json"}
                    jsonValue={jsonDraft}
                    jsonDirty={jsonDirty}
                    jsonParseError={jsonParseError}
                    jsonApplyError={jsonApplyError}
                    jsonValidationErrors={jsonValidationErrors}
                    onJsonChange={handleJsonChange}
                  />
                </TabsContent>
              </Tabs>
            </div>
            <aside className="studio-side">
              <ZoneInspector
                zone={selectedZone}
                tab={inspectorTab}
                onTabChange={setInspectorTab}
                onDuplicate={handleDuplicate}
                duplicateDisabled={zoneLimitReached}
                duplicateDisabledReason={zoneLimitMessage}
                onTransferSettings={handleTransferZoneSettings}
                onDelete={handleDelete}
                zones={design.zones}
                layoutProfileNames={design.zoneLayouts.map((layout) => layout.name).filter((name): name is string => Boolean(name))}
                mandatoryContentNames={getMandatoryContentNames(design)}
                contentCountLimitNames={design.contentCountLimits.map((limit) => limit.name).filter(Boolean)}
                onUpdate={updateZone}
              />
            </aside>
          </div>
        </section>
      ) : page === "browse" ? (
        <BrowsePage
          status={browseStatus}
          result={browseResult}
          maps={browseMaps}
          stats={communityStats}
          errorMessage={browseError}
          query={browseQuery}
          sort={browseSort}
          selectedTagSlugs={browseSelectedTags}
          rangeFilters={browseRangeFilters}
          getViewerRating={(mapId) => getViewerRating(communityCatalog, mapId, communityViewerId)}
          onRate={handleRateMap}
          canRate={authState.status === "signed-in"}
          viewerUserId={authState.profile?.userId ?? null}
          onDownload={handleDownloadBrowseMap}
          onDownloadImage={handleDownloadBrowseMapImage}
          onOpenInBuilder={handleOpenBrowseMap}
          onViewDetail={(map) => void handleViewMapDetail(map)}
          onQueryChange={(q) => { setBrowseQuery(q); setBrowsePage(1); }}
          onSortChange={(s) => { setBrowseSort(s); setBrowsePage(1); }}
          onTagToggle={(slug) => { setBrowseSelectedTags((current) => current.includes(slug) ? current.filter((s) => s !== slug) : [...current, slug]); setBrowsePage(1); }}
          onTagRemove={(slug) => { setBrowseSelectedTags((current) => current.filter((s) => s !== slug)); setBrowsePage(1); }}
          onRangeChange={(key, range) => {
            setBrowseRangeFilters((current) => ({ ...current, [key]: range }));
            setBrowsePage(1);
          }}
          onRangeRemove={(key) => {
            setBrowseRangeFilters((current) => {
              const next = { ...current };
              delete next[key];
              return next;
            });
            setBrowsePage(1);
          }}
          onPageChange={setBrowsePage}
        />
      ) : page === "install" ? (
        <InstallationGuidePage />
      ) : page === "my-maps" ? (
        authState.status === "signed-in" ? (
          <MyMapsPage
            status={myMapsStatus}
            maps={myMaps}
            errorMessage={myMapsError}
            onRefresh={() => void loadMyMaps()}
            onUpdateListing={handleUpdateOwnedMapListing}
            onHide={handleHideOwnedMap}
            onRestore={handleRestoreOwnedMap}
            onDelete={handleDeleteOwnedMap}
            onDownload={handleDownloadOwnedMap}
            onDownloadImage={handleDownloadOwnedMapImage}
            onOpenInBuilder={handleOpenOwnedMap}
          />
        ) : (
          <section className="community-layout my-maps-page">
            <Card className="community-stats-card">
              <CardHeader>
                <div>
                  <CardTitle><FileJson size={18} />My maps</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="reference-stack">
                <p className="reference-note">Manage your uploaded map templates after signing in.</p>
                <div className="dialog-actions">
                  <Button variant="primary" onClick={() => requestSignIn("Sign in to manage your uploaded maps.")}>Sign in</Button>
                </div>
              </CardContent>
            </Card>
          </section>
        )
      ) : (
        <RmgJsonReferencePage />
      )}

      <footer className="site-footer" aria-label="Olden Era Maps footer">
        <div className="site-footer__brand">
          <img src="/assets/olden-era/factions/temple-icon.png" alt="" />
          <div>
            <strong>Olden Era Maps</strong>
            <p>
              Create, export, and share Heroes of Might and Magic: Olden Era map templates for the .rmg.json generator workflow.
            </p>
          </div>
        </div>
        <nav className="site-footer__nav" aria-label="Footer navigation">
          <a href="/" onClick={(event) => { event.preventDefault(); navigate("builder"); }}>RMG Template Builder</a>
          <a href="/browse" onClick={(event) => { event.preventDefault(); navigate("browse"); }}>Browse Community Maps</a>
          <a href="/reference" onClick={(event) => { event.preventDefault(); navigate("reference"); }}>RMG JSON Reference Guide</a>
          <a href="/install" onClick={(event) => { event.preventDefault(); navigate("install"); }}>Installation Guide</a>
          <a href="https://github.com/embrisa/OldenEraMaps" rel="noreferrer">GitHub Project</a>
        </nav>
        <p className="site-footer__meta">
          Fan-made tooling for Olden Era map creators. Exported templates still need in-game validation before competitive or public use.
        </p>
      </footer>

      <ConnectionsDialog
        open={connectionsOpen}
        onOpenChange={handleConnectionsOpenChange}
        design={design}
        selectedConnectionId={selectedConnectionId}
        onAdd={() => commit(addConnection(design))}
        onUpdate={updateConnection}
        onDelete={handleDeleteConnection}
      />
      <ContentLimitsDialog
        open={contentLimitsOpen}
        onOpenChange={setContentLimitsOpen}
        design={design}
        onUpdate={updateDesign}
      />
      <LayoutProfilesDialog
        open={layoutProfilesOpen}
        onOpenChange={setLayoutProfilesOpen}
        design={design}
        onUpdate={updateDesign}
      />
      <ContentLibraryDialog
        open={contentLibraryOpen}
        onOpenChange={setContentLibraryOpen}
        design={design}
        onUpdate={updateDesign}
      />
      <ExpertTemplateSettingsDialog
        open={expertTemplateSettingsOpen}
        onOpenChange={setExpertTemplateSettingsOpen}
        design={design}
        onUpdate={updateDesign}
        onGlobal={handleGlobal}
      />
      <MandatoryContentDialog
        open={mandatoryContentOpen}
        onOpenChange={setMandatoryContentOpen}
        design={design}
        onUpdate={updateDesign}
      />
      <BalancedRandomMapDialog
        open={balancedRandomOpen}
        onOpenChange={setBalancedRandomOpen}
        onGenerate={handleGenerateBalancedRandomMap}
      />
      <Dialog open={exportWarningOpen} onOpenChange={setExportWarningOpen}>
        <DialogContent className="auth-dialog">
          <div className="dialog-heading">
            <div>
              <DialogTitle>Export with validation errors?</DialogTitle>
              <DialogDescription>
                This file can be exported, but these issues may prevent it from working in game.
              </DialogDescription>
            </div>
          </div>
          <div className="messages">
            {validation.errors.map((message) => <Alert key={message} tone="danger">{message}</Alert>)}
          </div>
          <div className="dialog-actions">
            <Button onClick={() => setExportWarningOpen(false)}>Cancel</Button>
            <Button variant="danger" onClick={() => void handleForceExportClick()} disabled={forceExportJson === ""}>
              <HardDriveDownload size={14} />Force Export
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <UploadMapDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        templateName={design.templateName}
        templateDescription={design.templateDescription}
        zoneCount={design.zones.length}
        connectionCount={design.connections.length}
        canShare={validation.errors.length === 0 && exportJson !== ""}
        signedIn={authState.status === "signed-in"}
        defaultAuthorName={authState.profile?.displayName ?? "Anonymous Cartographer"}
        submitting={uploadSubmitting}
        error={uploadError}
        onSubmit={handleShareMap}
      />
      <SignInDialog
        open={signInOpen}
        onOpenChange={setSignInOpen}
        message={signInMessage}
        error={authState.error}
        onProvider={handleSignInWithProvider}
      />
      <DeleteAccountDialog
        open={deleteAccountOpen}
        onOpenChange={setDeleteAccountOpen}
        submitting={deleteAccountSubmitting}
        error={deleteAccountError}
        onConfirm={confirmDeleteAccount}
      />
      <EditAuthorNameDialog
        open={editAuthorNameOpen}
        onOpenChange={setEditAuthorNameOpen}
        currentName={authState.profile?.displayName ?? "Anonymous Cartographer"}
        submitting={editAuthorNameSubmitting}
        error={editAuthorNameError}
        onSubmit={handleEditAuthorName}
      />
      <MapDetailDialog
        map={detailMap}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        viewerRating={detailMap ? getViewerRating(communityCatalog, detailMap.id, communityViewerId) : undefined}
        canRate={authState.status === "signed-in" && !Boolean(detailMap?.ownerId && authState.profile?.userId === detailMap.ownerId)}
        isOwner={Boolean(detailMap?.ownerId && authState.profile?.userId === detailMap.ownerId)}
        onRate={handleRateMap}
        onDownload={handleDownloadDetailMap}
        onDownloadImage={handleDownloadDetailMapImage}
        onOpenInBuilder={(map) => {
          setDetailOpen(false);
          handleOpenBrowseMap(map);
        }}
        onUpdateListing={handleUpdateMapListing}
        onHide={handleHideMap}
      />
    </main>
    </TooltipProvider>
  );
}

function createInitialDesign(): TemplateDesign {
  return createDefaultDesign();
}

function readAutosave(): AutosaveRecovery | null {
  const text = window.localStorage.getItem(AUTOSAVE_KEY);
  if (!text) return null;
  try {
    const design = parseDesignOrTemplateFile(text);
    return { design };
  } catch {
    window.localStorage.removeItem(AUTOSAVE_KEY);
    return null;
  }
}

function resolveSelectedZoneId(previous: TemplateDesign, next: TemplateDesign, selectedZoneId: string): string {
  if (selectedZoneId === "" || next.zones.some((zone) => zone.id === selectedZoneId)) return selectedZoneId;

  const previousSelectedZone = previous.zones.find((zone) => zone.id === selectedZoneId);
  if (previousSelectedZone) {
    const remapped = next.zones.find((zone) => zone.name === previousSelectedZone.name);
    if (remapped) return remapped.id;
  }

  return next.zones[0]?.id ?? "";
}

function reconcileRoleChange(
  design: TemplateDesign,
  zone: DesignZone,
  previousRole: DesignZoneRole,
  previousName: string
): void {
  if (zone.role === previousRole) return;

  if (zone.role === "Spawn") {
    const usedPlayers = new Set(design.zones
      .filter((candidate) => candidate.id !== zone.id && candidate.role === "Spawn")
      .map((candidate) => candidate.player)
      .filter((player): player is number => typeof player === "number" && Number.isInteger(player) && player >= 1 && player <= MAX_SPAWN_ZONES));
    const playerIsAvailable = Number.isInteger(zone.player)
      && zone.player! >= 1
      && zone.player! <= MAX_SPAWN_ZONES
      && !usedPlayers.has(zone.player!);
    if (!playerIsAvailable) {
      zone.player = firstAvailableSpawnPlayer(usedPlayers) ?? zone.player;
    }

    if (shouldRenameRoleChangedZone(previousRole, previousName, zone.name) && Number.isInteger(zone.player)) {
      zone.name = uniqueZoneName(design, zone.id, `Spawn-${zone.player}`);
    }
  } else {
    zone.player = undefined;
  }

  const spawnCount = design.zones.filter((candidate) => candidate.role === "Spawn").length;
  if (spawnCount >= 2 && spawnCount <= MAX_SPAWN_ZONES) {
    design.playerCount = spawnCount;
  }
}

function firstAvailableSpawnPlayer(usedPlayers: Set<number>): number | undefined {
  for (let player = 1; player <= MAX_SPAWN_ZONES; player++) {
    if (!usedPlayers.has(player)) return player;
  }
  return undefined;
}

function shouldRenameRoleChangedZone(previousRole: DesignZoneRole, previousName: string, currentName: string): boolean {
  const trimmed = currentName.trim();
  if (!trimmed) return true;
  if (previousRole === "Hub" && trimmed === "Hub") return true;
  return trimmed === previousName && trimmed.startsWith(`${previousRole}-`);
}

function uniqueZoneName(design: TemplateDesign, zoneId: string, baseName: string): string {
  const used = new Set(design.zones.filter((zone) => zone.id !== zoneId).map((zone) => zone.name));
  if (!used.has(baseName)) return baseName;
  for (let suffix = 2; ; suffix++) {
    const candidate = `${baseName}-${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
}

function resolveSelectedConnectionId(next: TemplateDesign, selectedConnectionId: string): string {
  return next.connections.some((connection) => connection.id === selectedConnectionId) ? selectedConnectionId : "";
}

function serializeDesignForBuilder(design: TemplateDesign): string | null {
  try {
    return serializeRmgTemplate(designToTemplate(design), { includeGeneratorPositions: true });
  } catch {
    return null;
  }
}

function getMandatoryContentNames(design: TemplateDesign): string[] {
  return getDesignMandatoryContentGroups(design).map((group) => group.name).filter(Boolean);
}

function summarizeBrowseResult(result: BrowseResult): CommunityCatalogStats {
  const ratingCount = result.maps.reduce((sum, map) => sum + map.ratingCount, 0);
  const ratingTotal = result.maps.reduce((sum, map) => sum + map.averageRating * map.ratingCount, 0);
  return {
    mapCount: result.total,
    ratingCount,
    averageRating: ratingCount === 0 ? 0 : Math.round((ratingTotal / ratingCount) * 10) / 10
  };
}

function readPageFromLocation(): AppPage {
  if (window.location.pathname === "/browse") return "browse";
  if (window.location.pathname === "/reference") return "reference";
  if (window.location.pathname === "/install") return "install";
  if (window.location.pathname === "/my-maps") return "my-maps";
  return "builder";
}

function isUndoShortcut(event: KeyboardEvent): boolean {
  return event.key.toLowerCase() === "z" && (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey;
}

function isEditableShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
}

function writePostSignInUpload(): void {
  window.sessionStorage.setItem(POST_SIGN_IN_UPLOAD_KEY, "1");
}

function readPostSignInUpload(): boolean {
  return window.sessionStorage.getItem(POST_SIGN_IN_UPLOAD_KEY) === "1";
}

function clearPostSignInUpload(): void {
  window.sessionStorage.removeItem(POST_SIGN_IN_UPLOAD_KEY);
}

function authErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Sign-in failed. Check the provider configuration and try again.";
}

function uploadErrorMessage(error: unknown): string {
  if (error instanceof ServerUploadError) {
    return error.details.length > 1 ? error.details.join(" ") : error.message;
  }
  if (error instanceof Error) return error.message;
  return "Upload validation failed. Review the map and try again.";
}
