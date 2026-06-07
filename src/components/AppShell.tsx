import { BookOpenText, Bug, Compass, Download, FileJson, FolderOpen, HardDriveDownload, Link2, ListChecks, Menu, PackageCheck, Plus, RotateCcw, Save, Share2, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from "react";
import { addConnection, designToTemplate, parseDesignOrTemplateFileResult, serializeDesignFile } from "@/design";
import { getViewerRating } from "@/community/maps";
import { getMap } from "@/community/communityApi";
import { serializeTemplate } from "@/generator";
import { collectRmgDiagnostics } from "@/rmgDiagnostics";

// Hook Imports
import { useAppRoute } from "@/hooks/useAppRoute";
import { useBuilderWorkspace } from "@/hooks/useBuilderWorkspace";
import { useBuilderJsonWorkflow } from "@/hooks/useBuilderJsonWorkflow";
import { useCommunityAuth } from "@/hooks/useCommunityAuth";
import { useCommunityBrowse } from "@/hooks/useCommunityBrowse";
import { useMyMaps } from "@/hooks/useMyMaps";
import { useTemplateDownload } from "@/hooks/useTemplateDownload";

// Dialog/Page Component Imports
import { BalancedRandomMapDialog } from "@/components/builder/BalancedRandomMapDialog";
import { ContentLibraryDialog } from "@/components/builder/ContentLibraryDialog";
import { DesignBoardCanvas } from "@/components/DesignBoardCanvas";
import { ConnectionsDialog } from "@/components/builder/ConnectionsDialog";
import { ContentLimitsDialog } from "@/components/builder/ContentLimitsDialog";
import { ExpertTemplateSettingsDialog } from "@/components/builder/ExpertTemplateSettingsDialog";
import { LayoutProfilesDialog } from "@/components/builder/LayoutProfilesDialog";
import { MandatoryContentDialog } from "@/components/builder/MandatoryContentDialog";
import { AccountMenu } from "@/components/community/AccountMenu";
import { BrowsePage } from "@/components/community/BrowsePage";
import { DeleteAccountDialog } from "@/components/community/DeleteAccountDialog";
import { EditAuthorNameDialog } from "@/components/community/EditAuthorNameDialog";
import { MapDetailDialog } from "@/components/community/MapDetailDialog";
import { MyMapsPage } from "@/components/community/MyMapsPage";
import { InstallationGuidePage } from "@/components/install/InstallationGuidePage";
import { RmgJsonReferencePage } from "@/components/reference/RmgJsonReferencePage";
import { SignInDialog } from "@/components/community/SignInDialog";
import { UploadMapDialog } from "@/components/community/UploadMapDialog";
import { TemplateSettingsPanel } from "@/components/builder/TemplateSettingsPanel";
import { Alert } from "@/components/builder/formHelpers";
import { BuilderValidationMessages, ValidationOutputPanel } from "@/components/builder/ValidationOutputPanel";
import { ZoneInspector } from "@/components/builder/ZoneInspector";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle, Tabs, TabsContent, TabsList, TabsTrigger, TooltipProvider } from "@/components/ui/radix";
import { validateDesign } from "@/design/validation";
import { downloadText } from "@/components/appShell/templateDownloads";

const GITHUB_ISSUES_URL = "https://github.com/embrisa/OldenEraMaps/issues";
type BuilderWorkspaceTab = "layout" | "json";

export function AppShell(): JSX.Element {
  const [builderWorkspaceTab, setBuilderWorkspaceTab] = useState<BuilderWorkspaceTab>("layout");
  const [connectionsOpen, setConnectionsOpen] = useState(false);
  const [roadMode, setRoadMode] = useState(false);
  const [contentLimitsOpen, setContentLimitsOpen] = useState(false);
  const [contentLibraryOpen, setContentLibraryOpen] = useState(false);
  const [expertTemplateSettingsOpen, setExpertTemplateSettingsOpen] = useState(false);
  const [layoutProfilesOpen, setLayoutProfilesOpen] = useState(false);
  const [mandatoryContentOpen, setMandatoryContentOpen] = useState(false);
  const [balancedRandomOpen, setBalancedRandomOpen] = useState(false);
  const [designBoardCanvas, setDesignBoardCanvas] = useState<HTMLCanvasElement | null>(null);
  const [topbarMenuOpen, setTopbarMenuOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const topbarMenuRef = useRef<HTMLDivElement>(null);

  // 1. Route state & SEO
  const route = useAppRoute();

  // 2. Auth state
  const auth = useCommunityAuth({
    onUploadOpen: () => browse.setUploadOpen(true)
  });

  // 3. Builder workspace core state (dirty, design history, design mutators)
  const workspace = useBuilderWorkspace({
    getJsonDirty: () => json.jsonDirty,
    requestConfirmation: (confirmation) => download.requestConfirmation(confirmation),
    onEditConnection: () => setConnectionsOpen(true),
    onGenerateSuccess: () => {},
    onSyncJsonSnapshot: (next) => json.syncJsonSnapshot(next),
    onClearJsonMessages: () => json.clearJsonMessages()
  });

  // 4. JSON Validation & Serialization derivation
  const validation = useMemo(() => validateDesign(workspace.design), [workspace.design]);
  const templateDiagnostics = useMemo(() => {
    try {
      return collectRmgDiagnostics(designToTemplate(workspace.design));
    } catch {
      return { diagnostics: [], errors: [], warnings: [], infos: [] };
    }
  }, [workspace.design]);

  const exportJson = useMemo(() => {
    if (validation.errors.length > 0) return "";
    try {
      return serializeTemplate(designToTemplate(workspace.design));
    } catch (error) {
      return error instanceof Error ? error.message : "";
    }
  }, [workspace.design, validation.errors.length]);

  const forceExportJson = useMemo(() => {
    if (validation.errors.length === 0) return "";
    try {
      return serializeTemplate(designToTemplate(workspace.design, { skipValidation: true }));
    } catch {
      return "";
    }
  }, [workspace.design, validation.errors.length]);

  const exportHasBlockingIssues = validation.errors.length > 0 || templateDiagnostics.errors.length > 0;

  // 5. JSON Workflow hook (jsonDraft, jsonSnapshot, manual JSON modifications)
  const json = useBuilderJsonWorkflow({
    design: workspace.design,
    selectedZoneId: workspace.selectedZoneId,
    commit: workspace.commit
  });

  // 6. Template download / file export manager
  const exportFileName = `${workspace.design.templateName.trim() || "Custom Template"}.rmg.json`;
  const exportPreviewFileName = `${workspace.design.templateName.trim() || "Custom Template"}.png`;

  const download = useTemplateDownload({
    design: workspace.design,
    validation,
    templateDiagnostics,
    exportFileName,
    exportJson,
    forceExportJson,
    exportPreviewFileName,
    previewAvailable: validation.errors.length === 0 && exportJson !== "",
    historyRevision: workspace.historyRevision,
    designBoardCanvas
  });

  // 7. Community Browse state hook
  const browse = useCommunityBrowse({
    page: route.page,
    authState: auth.authState,
    design: workspace.design,
    exportJson,
    exportHasBlockingIssues,
    selectedZoneId: workspace.selectedZoneId,
    designBoardCanvas,
    commit: workspace.commit,
    requestSignIn: auth.requestSignIn,
    requestSignInForUpload: auth.requestSignInForUpload,
    requestConfirmation: (conf) => download.requestConfirmation(conf),
    navigate: route.navigate,
    runAfterDiscardingUnsavedChanges: (action) => download.runAfterDiscardingUnsavedChanges(action, workspace.dirty || json.jsonDirty)
  });

  // 8. My Maps management hook
  const myMaps = useMyMaps({
    page: route.page,
    authState: auth.authState,
    requestConfirmation: (conf) => download.requestConfirmation(conf),
    openMapInBuilder: (mapId, mapTitle) => {
      download.runAfterDiscardingUnsavedChanges(() => {
        void (async () => {
          const detail = await getMap(mapId);
          if (!detail) return;
          const designResult = parseDesignOrTemplateFileResult(detail.designJson);
          const templateResult = designResult.ok ? designResult : parseDesignOrTemplateFileResult(detail.templateJson);
          if (!templateResult.ok) {
            browse.setCommunityError(`Failed to load "${mapTitle}" into the builder. ${templateResult.errorMessage}`);
            return;
          }
          const next = templateResult.design;
          browse.setCommunityError(undefined);
          if (!workspace.loadDesign(next, false)) return;
          browse.setCommunityNotice(`Loaded "${mapTitle}" into the builder.`);
          route.navigate("builder");
        })();
      }, workspace.dirty || json.jsonDirty);
    }
  });

  // Global menu outside-click closer
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

  // Undo keyboard shortcut listener
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (!isUndoShortcut(event) || isEditableShortcutTarget(event.target)) return;
      if (!workspace.canUndoDesignChange) return;
      event.preventDefault();
      workspace.undoDesignChange();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [workspace]);

  const handleConnectionsOpenChange = useCallback((open: boolean): void => {
    setConnectionsOpen(open);
    if (!open) workspace.setSelectedConnectionId("");
  }, [workspace]);

  const handleImportFile = useCallback((file: File | undefined): void => {
    if (!file) return;
    download.runAfterDiscardingUnsavedChanges(() => {
      void file.text().then((text) => {
        const result = parseDesignOrTemplateFileResult(text);
        if (!result.ok) {
          browse.setCommunityError(result.errorMessage);
          return;
        }
        const next = result.design;
        browse.setCommunityError(undefined);
        workspace.loadDesign(next, true);
      }).catch((error: unknown) => {
        browse.setCommunityError(error instanceof Error ? error.message : "Failed to read import file.");
      });
    }, workspace.dirty || json.jsonDirty);
  }, [download, workspace, json.jsonDirty, browse]);

  const fileName = `${workspace.dirty || json.jsonDirty ? "* " : ""}${workspace.design.templateName || "Custom Template"}.oetd.json`;

  return (
    <TooltipProvider>
    <main className={`studio-shell studio-shell--${route.page}`}>
      <input ref={fileInputRef} hidden type="file" accept=".json,.rmg.json,.oetd.json,application/json" onChange={(event) => handleImportFile(event.currentTarget.files?.[0])} />
      <header className="studio-topbar">
        <div className="brand-lockup">
          <img src="/assets/olden-era/factions/temple-icon.png" alt="" />
          <div>
            <span>Template Builder</span>
            <strong>Olden Era RMG Studio</strong>
          </div>
        </div>
        <nav className="topbar-nav" aria-label="Main navigation">
          <Button className="topbar-nav__item" variant="ghost" aria-current={route.page === "builder" ? "page" : undefined} onClick={() => route.navigate("builder")}><FileJson size={16} />Builder</Button>
          <Button className="topbar-nav__item" variant="ghost" aria-current={route.page === "browse" ? "page" : undefined} onClick={() => route.navigate("browse")}><Compass size={16} />Browse</Button>
          <Button className="topbar-nav__item" variant="ghost" aria-current={route.page === "reference" ? "page" : undefined} onClick={() => route.navigate("reference")}><BookOpenText size={16} />Reference</Button>
          <Button className="topbar-nav__item" variant="ghost" aria-current={route.page === "install" ? "page" : undefined} onClick={() => route.navigate("install")}><HardDriveDownload size={16} />Install</Button>
        </nav>
        <div className="topbar-context">
          <div className="topbar-stats">
            {route.page === "browse" ? (
              <>
                <span><strong>{browse.communityStats.mapCount}</strong>Maps</span>
                <span><strong>{browse.communityStats.ratingCount}</strong>Ratings</span>
              </>
            ) : null}
          </div>
        </div>
        {route.page === "builder" ? (
          <div className="topbar-file-actions">
            <Button size="sm" onClick={() => fileInputRef.current?.click()}><FolderOpen size={14} />Open</Button>
            <Button size="sm" onClick={() => void downloadText(`${workspace.design.templateName}.oetd.json`, serializeDesignFile(workspace.design), "application/json", { preferSavePicker: true })}><Save size={14} />Save</Button>
            <Button size="sm" onClick={() => void download.handleExportPreviewImageClick()} disabled={validation.errors.length > 0 || exportJson === ""}>Preview PNG</Button>
            <Button size="sm" variant="blue" onClick={browse.handleShareMapClick} disabled={validation.errors.length > 0}><Share2 size={14} />Share</Button>
            <Button size="sm" variant="primary" onClick={download.handleExportClick} disabled={validation.errors.length === 0 ? exportJson === "" : forceExportJson === ""}>
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
              {route.page === "builder" ? (
                <Button onClick={workspace.handleNew}><Plus size={16} />New</Button>
              ) : null}
              <a
                className="oe-button oe-button--md oe-button--ghost report-bug-button"
                href={GITHUB_ISSUES_URL}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => {
                  event.preventDefault();
                  window.open(GITHUB_ISSUES_URL, "_blank", "noopener,noreferrer");
                  setTopbarMenuOpen(false);
                }}
              >
                <Bug size={16} className="bug-icon" />
                <span className="button-text">Report bug or suggestion</span>
              </a>
              <AccountMenu
                status={auth.authState.status}
                profile={auth.authState.profile}
                onSignIn={() => auth.requestSignIn()}
                onSignOut={auth.handleSignOut}
                onMyMaps={() => route.navigate("my-maps")}
                onEditProfile={() => {
                  auth.setEditAuthorNameError(undefined);
                  auth.setEditAuthorNameOpen(true);
                }}
                onDeleteAccount={auth.handleDeleteAccount}
              />
            </div>
          ) : null}
        </div>
        {workspace.autosaveRecovery ? (
          <section className="autosave-recovery" role="status" aria-label="Autosaved design available">
            <div>
              <strong>Autosaved design available</strong>
              <span>{workspace.autosaveRecovery.design.templateName}</span>
            </div>
            <div className="autosave-recovery__actions">
              <Button size="sm" variant="gold" onClick={workspace.handleRecover}><RotateCcw size={14} />Recover</Button>
              <Button size="sm" variant="ghost" onClick={workspace.handleDismissRecovery}>Dismiss</Button>
            </div>
          </section>
        ) : null}
      </header>

      {browse.communityNotice ? (
        <section className="community-notice alert alert--success" role="status">
          {browse.communityNotice}
        </section>
      ) : null}

      {browse.communityError ? (
        <section className="community-notice alert alert--danger" role="alert">
          {browse.communityError}
          <Button size="sm" variant="ghost" onClick={() => browse.setCommunityError(undefined)} aria-label="Dismiss error">
            <X size={14} />
          </Button>
        </section>
      ) : null}

      {route.page === "builder" ? (
        <section className="studio-grid">
          <TemplateSettingsPanel
            design={workspace.design}
            onGlobal={workspace.handleGlobal}
            onPlayerCount={workspace.handlePlayerCount}
            onMapDimension={workspace.handleMapDimension}
            onLockMapDimensions={workspace.handleLockMapDimensions}
            onHero={workspace.handleHero}
            onGameEnd={workspace.handleGameEnd}
          />
          <div className="studio-workspace">
            <div className="studio-main">
              <Tabs value={builderWorkspaceTab} onValueChange={(value) => setBuilderWorkspaceTab(value as BuilderWorkspaceTab)} className="builder-workspace-root">
                <div className="studio-toolbar">
                  <div className="dirty-state">{fileName}</div>
                  <div className="topbar-stats">
                    <span><strong>{workspace.design.zones.length}</strong>Zones</span>
                    <span><strong>{workspace.design.connections.length}</strong>Paths</span>
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
                          disabled={!workspace.canUndoDesignChange}
                          aria-label="Undo last design change"
                          title="Undo last design change (Ctrl+Z)"
                          onClick={workspace.undoDesignChange}
                        >
                          <RotateCcw size={16} />
                        </Button>
                        <Button variant="blue" disabled={workspace.zoneLimitReached} title={workspace.zoneLimitMessage} onClick={() => workspace.handleAddZone("Spawn")}><Plus size={16} />Spawn</Button>
                        <Button variant="gold" disabled={workspace.zoneLimitReached} title={workspace.zoneLimitMessage} onClick={() => workspace.handleAddZone("Neutral")}><Plus size={16} />Neutral</Button>
                        <Button variant="green" disabled={workspace.zoneLimitReached} title={workspace.zoneLimitMessage} onClick={() => workspace.handleAddZone("Hub")}><Plus size={16} />Hub</Button>
                        <Button
                          variant="gold"
                          aria-pressed={roadMode}
                          title="Toggle connection handles on the design board"
                          onClick={() => setRoadMode((enabled) => !enabled)}
                        >
                          <Link2 size={16} />Road Mode
                        </Button>
                        <Button variant="violet" onClick={() => { workspace.setSelectedConnectionId(""); setConnectionsOpen(true); }}><Link2 size={16} />Connections</Button>
                      </div>
                      {workspace.zoneLimitMessage ? <div className="builder-inline-notice">{workspace.zoneLimitMessage}</div> : null}
                    </CardHeader>
                    <CardContent>
                      <DesignBoardCanvas
                        design={workspace.design}
                        selectedZoneId={workspace.selectedZone?.id ?? ""}
                        selectedConnectionId={workspace.selectedConnectionId}
                        roadMode={roadMode}
                        onCanvasChange={setDesignBoardCanvas}
                        onSelectZone={workspace.handleSelectZone}
                        onSelectConnection={workspace.handleSelectConnection}
                        onMoveZone={workspace.handleMoveZone}
                        onConnectZones={(next, nextSelectedZoneId) => workspace.commit(next, nextSelectedZoneId)}
                        onEditConnection={workspace.handleEditConnection}
                        onDeleteConnection={workspace.handleDeleteConnection}
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
                        <Button variant="gold" onClick={() => setBalancedRandomOpen(true)}><Sparkles size={16} />Simple Generator</Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
                <TabsContent value="json" forceMount style={builderWorkspaceTab === "json" ? undefined : { display: "none" }}>
                  <ValidationOutputPanel
                    validation={validation}
                    showBuilderValidationMessages={builderWorkspaceTab === "json"}
                    jsonValue={json.jsonDraft}
                    jsonDirty={json.jsonDirty}
                    jsonParseError={json.jsonParseError}
                    jsonApplyError={json.jsonApplyError}
                    jsonValidationErrors={json.jsonValidationErrors}
                    onJsonChange={json.handleJsonChange}
                  />
                </TabsContent>
              </Tabs>
            </div>
            <aside className="studio-side">
              <ZoneInspector
                zone={workspace.selectedZone}
                onDuplicate={workspace.handleDuplicate}
                duplicateDisabled={workspace.zoneLimitReached}
                duplicateDisabledReason={workspace.zoneLimitMessage}
                onTransferSettings={workspace.handleTransferZoneSettings}
                onDelete={workspace.handleDelete}
                zones={workspace.design.zones}
                layoutProfileNames={workspace.design.zoneLayouts.map((layout) => layout.name).filter((name): name is string => Boolean(name))}
                mandatoryContentNames={workspace.getMandatoryContentNames()}
                contentCountLimitNames={workspace.design.contentCountLimits.map((limit) => limit.name).filter(Boolean)}
                onUpdate={workspace.updateZone}
              />
            </aside>
          </div>
        </section>
      ) : route.page === "browse" ? (
        <BrowsePage
          status={browse.browseStatus}
          result={browse.browseResult}
          maps={browse.browseMaps}
          stats={browse.communityStats}
          errorMessage={browse.browseError}
          query={browse.browseQuery}
          sort={browse.browseSort}
          selectedTagSlugs={browse.browseSelectedTags}
          rangeFilters={browse.browseRangeFilters}
          getViewerRating={(mapId) => getViewerRating(browse.communityCatalog, mapId, browse.communityViewerId)}
          onRate={browse.handleRateMap}
          canRate={auth.authState.status === "signed-in"}
          viewerUserId={auth.authState.profile?.userId ?? null}
          onDownload={browse.handleDownloadBrowseMap}
          onDownloadImage={browse.handleDownloadBrowseMapImage}
          onOpenInBuilder={browse.handleOpenBrowseMap}
          onViewDetail={(map) => void browse.handleViewMapDetail(map)}
          onQueryChange={(q) => { browse.setBrowseQuery(q); browse.setBrowsePage(1); }}
          onSortChange={(s) => { browse.setBrowseSort(s); browse.setBrowsePage(1); }}
          onTagToggle={(slug) => { browse.setBrowseSelectedTags((current) => current.includes(slug) ? current.filter((s) => s !== slug) : [...current, slug]); browse.setBrowsePage(1); }}
          onTagRemove={(slug) => { browse.setBrowseSelectedTags((current) => current.filter((s) => s !== slug)); browse.setBrowsePage(1); }}
          onRangeChange={(key, range) => {
            browse.setBrowseRangeFilters((current) => ({ ...current, [key]: range }));
            browse.setBrowsePage(1);
          }}
          onRangeRemove={(key) => {
            browse.setBrowseRangeFilters((current) => {
              const next = { ...current };
              delete next[key];
              return next;
            });
            browse.setBrowsePage(1);
          }}
          onPageChange={browse.setBrowsePage}
        />
      ) : route.page === "install" ? (
        <InstallationGuidePage />
      ) : route.page === "my-maps" ? (
        auth.authState.status === "signed-in" ? (
          <MyMapsPage
            status={myMaps.myMapsStatus}
            maps={myMaps.myMaps}
            errorMessage={myMaps.myMapsError}
            onRefresh={() => void myMaps.loadMyMaps()}
            onUpdateListing={myMaps.handleUpdateOwnedMapListing}
            onHide={myMaps.handleHideOwnedMap}
            onRestore={myMaps.handleRestoreOwnedMap}
            onDelete={myMaps.handleDeleteOwnedMap}
            onDownload={myMaps.handleDownloadOwnedMap}
            onDownloadImage={myMaps.handleDownloadOwnedMapImage}
            onOpenInBuilder={myMaps.handleOpenOwnedMap}
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
                  <Button variant="primary" onClick={() => auth.requestSignIn("Sign in to manage your uploaded maps.")}>Sign in</Button>
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
          <a href="/" onClick={(event) => { event.preventDefault(); route.navigate("builder"); }}>RMG Template Builder</a>
          <a href="/browse" onClick={(event) => { event.preventDefault(); route.navigate("browse"); }}>Browse Community Maps</a>
          <a href="/reference" onClick={(event) => { event.preventDefault(); route.navigate("reference"); }}>RMG JSON Reference Guide</a>
          <a href="/install" onClick={(event) => { event.preventDefault(); route.navigate("install"); }}>Installation Guide</a>
          <a href="https://github.com/embrisa/OldenEraMaps" rel="noreferrer">GitHub Project</a>
        </nav>
        <p className="site-footer__meta">
          Fan-made tooling for Olden Era map creators. Exported templates still need in-game validation before competitive or public use.
        </p>
      </footer>

      <ConnectionsDialog
        open={connectionsOpen}
        onOpenChange={handleConnectionsOpenChange}
        design={workspace.design}
        selectedConnectionId={workspace.selectedConnectionId}
        onAdd={() => workspace.commit(addConnection(workspace.design))}
        onAddReversePortal={workspace.handleAddReversePortal}
        onUpdate={workspace.updateConnection}
        onDelete={workspace.handleDeleteConnection}
      />
      <ContentLimitsDialog
        open={contentLimitsOpen}
        onOpenChange={setContentLimitsOpen}
        design={workspace.design}
        onUpdate={workspace.updateDesign}
      />
      <LayoutProfilesDialog
        open={layoutProfilesOpen}
        onOpenChange={setLayoutProfilesOpen}
        design={workspace.design}
        onUpdate={workspace.updateDesign}
      />
      <ContentLibraryDialog
        open={contentLibraryOpen}
        onOpenChange={setContentLibraryOpen}
        design={workspace.design}
        onUpdate={workspace.updateDesign}
      />
      <ExpertTemplateSettingsDialog
        open={expertTemplateSettingsOpen}
        onOpenChange={setExpertTemplateSettingsOpen}
        design={workspace.design}
        onUpdate={workspace.updateDesign}
        onGlobal={workspace.handleGlobal}
      />
      <MandatoryContentDialog
        open={mandatoryContentOpen}
        onOpenChange={setMandatoryContentOpen}
        design={workspace.design}
        onUpdate={workspace.updateDesign}
      />
      <BalancedRandomMapDialog
        open={balancedRandomOpen}
        onOpenChange={setBalancedRandomOpen}
        onGenerate={workspace.handleGenerateBalancedRandomMap}
      />
      <Dialog open={download.exportWarningOpen} onOpenChange={download.setExportWarningOpen}>
        <DialogContent className="auth-dialog">
          {validation.errors.length > 0 || templateDiagnostics.errors.length > 0 ? (
            <>
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
                <Button onClick={() => download.setExportWarningOpen(false)}>Cancel</Button>
                <Button variant="danger" onClick={() => void download.handleForceExportClick()} disabled={forceExportJson === ""}>
                  <HardDriveDownload size={14} />Force Export
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="dialog-heading">
                <div>
                  <DialogTitle>Export checklist</DialogTitle>
                  <DialogDescription>
                    File name: {exportFileName}
                  </DialogDescription>
                </div>
              </div>
              <div className="messages">
                <p>Warnings exist, but you can still export the JSON template.</p>
                <p>
                  Refer to the{" "}
                  <a
                    href="/install"
                    onClick={(e) => {
                      e.preventDefault();
                      route.navigate("install");
                      download.setExportWarningOpen(false);
                    }}
                  >
                    Installation Guide
                  </a>{" "}
                  for details on where to place it.
                </p>
              </div>
              <div className="dialog-actions">
                <Button onClick={() => download.setExportWarningOpen(false)}>Cancel</Button>
                <Button variant="primary" onClick={() => void download.handleForceExportClick()}>
                  Export JSON
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <UploadMapDialog
        open={browse.uploadOpen}
        onOpenChange={browse.setUploadOpen}
        templateName={workspace.design.templateName}
        templateDescription={workspace.design.templateDescription}
        zoneCount={workspace.design.zones.length}
        connectionCount={workspace.design.connections.length}
        canShare={validation.errors.length === 0 && exportJson !== ""}
        signedIn={auth.authState.status === "signed-in"}
        defaultAuthorName={auth.authState.profile?.displayName ?? "Anonymous Cartographer"}
        submitting={browse.uploadSubmitting}
        error={browse.uploadError}
        onSubmit={browse.handleShareMap}
      />
      <SignInDialog
        open={auth.signInOpen}
        onOpenChange={auth.setSignInOpen}
        message={auth.signInMessage}
        error={auth.authState.error}
        onProvider={auth.handleSignInWithProvider}
      />
      <DeleteAccountDialog
        open={auth.deleteAccountOpen}
        onOpenChange={auth.setDeleteAccountOpen}
        submitting={auth.deleteAccountSubmitting}
        error={auth.deleteAccountError}
        onConfirm={auth.confirmDeleteAccount}
      />
      <EditAuthorNameDialog
        open={auth.editAuthorNameOpen}
        onOpenChange={auth.setEditAuthorNameOpen}
        currentName={auth.authState.profile?.displayName ?? "Anonymous Cartographer"}
        submitting={auth.editAuthorNameSubmitting}
        error={auth.editAuthorNameError}
        onSubmit={(displayName) => auth.handleEditAuthorName(displayName, () => {
          browse.setCommunityNotice("Author name updated.");
          if (route.page === "browse") void browse.loadBrowseMaps();
          if (route.page === "my-maps") void myMaps.loadMyMaps();
          if (browse.detailMap?.ownerId && browse.detailMap.ownerId === auth.authState.profile?.userId) {
            void getMap(browse.detailMap.id).then((updated) => browse.setDetailMap(updated)).catch(() => {});
          }
        })}
      />
      <MapDetailDialog
        map={browse.detailMap}
        open={browse.detailOpen}
        onOpenChange={browse.setDetailOpen}
        viewerRating={browse.detailMap ? getViewerRating(browse.communityCatalog, browse.detailMap.id, browse.communityViewerId) : undefined}
        canRate={auth.authState.status === "signed-in" && !Boolean(browse.detailMap?.ownerId && auth.authState.profile?.userId === browse.detailMap.ownerId)}
        isOwner={Boolean(browse.detailMap?.ownerId && auth.authState.profile?.userId === browse.detailMap.ownerId)}
        onRate={browse.handleRateMap}
        onDownload={browse.handleDownloadDetailMap}
        onDownloadImage={browse.handleDownloadDetailMapImage}
        onOpenInBuilder={(map) => {
          browse.setDetailOpen(false);
          browse.handleOpenBrowseMap(map);
        }}
        onUpdateListing={browse.handleUpdateMapListing}
        onHide={browse.handleHideMap}
      />
      {/* 9. custom radix confirmation dialog */}
      <Dialog open={Boolean(download.pendingConfirmation)} onOpenChange={(open) => !open && download.setPendingConfirmation(null)}>
        <DialogContent className="auth-dialog">
          <div className="dialog-heading">
            <div>
              <DialogTitle>{download.pendingConfirmation?.title}</DialogTitle>
              <DialogDescription>
                {download.pendingConfirmation?.message}
              </DialogDescription>
            </div>
          </div>
          <div className="dialog-actions">
            <Button variant="ghost" onClick={() => download.setPendingConfirmation(null)}>Cancel</Button>
            <Button
              variant={download.pendingConfirmation?.confirmVariant ?? "primary"}
              onClick={() => {
                download.pendingConfirmation?.onConfirm();
                download.setPendingConfirmation(null);
              }}
            >
              {download.pendingConfirmation?.confirmLabel}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
    </TooltipProvider>
  );
}

function isUndoShortcut(event: KeyboardEvent): boolean {
  return event.key.toLowerCase() === "z" && (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey;
}

function isEditableShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
}
