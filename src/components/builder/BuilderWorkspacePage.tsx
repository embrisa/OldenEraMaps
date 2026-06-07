import { Compass, FileJson, Link2, ListChecks, PackageCheck, Plus, RotateCcw, Sparkles } from "lucide-react";
import { useState, type JSX } from "react";
import { addConnection, type DesignConnection, type DesignZone, type DesignZoneRole, type TemplateDesign } from "@/design";
import { AdvancedConfigurationDialog, type AdvancedConfigurationTab } from "@/components/builder/AdvancedConfigurationDialog";
import { BalancedRandomMapDialog } from "@/components/builder/BalancedRandomMapDialog";
import { DesignBoardCanvas } from "@/components/DesignBoardCanvas";
import { ConnectionsDialog } from "@/components/builder/ConnectionsDialog";
import { TemplateSettingsPanel } from "@/components/builder/TemplateSettingsPanel";
import { BuilderValidationMessages, ValidationOutputPanel } from "@/components/builder/ValidationOutputPanel";
import { ZoneInspector } from "@/components/builder/ZoneInspector";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/radix";
import type { GeneratorSettings, Point, ValidationResult } from "@/types";
import type { RmgDiagnosticSummary } from "@/rmgDiagnostics";
import type { TemplateAnalysis } from "@/analysis/templateAnalysis";
import type { CommitDesign } from "@/hooks/useBuilderWorkspace";

export type BuilderWorkspaceTab = "layout" | "json";

interface BuilderWorkspacePageProps {
  design: TemplateDesign;
  selectedConnectionId: string;
  dirty: boolean;
  fileName: string;
  selectedZone?: DesignZone;
  zoneLimitReached: boolean;
  zoneLimitMessage?: string;
  validation: ValidationResult;
  templateDiagnostics: RmgDiagnosticSummary;
  templateAnalysis: TemplateAnalysis | null;
  jsonDraft: string;
  jsonDirty: boolean;
  jsonParseError?: string;
  jsonApplyError?: string;
  jsonValidationErrors: string[];
  canUndoDesignChange: boolean;
  undoDesignChange(): void;
  handleNew(): void;
  handleGlobal: <K extends keyof TemplateDesign>(key: K, value: TemplateDesign[K]) => void;
  handlePlayerCount(playerCount: number): void;
  handleMapDimension(key: "mapWidth" | "mapHeight", value: number): void;
  handleLockMapDimensions(locked: boolean): void;
  handleHero(key: keyof TemplateDesign["heroSettings"], value: number): void;
  handleGameEnd(key: keyof TemplateDesign["gameEndConditions"], value: boolean | number | string): void;
  updateZone(mutator: (zone: DesignZone) => void): void;
  updateConnection(connectionId: string, mutator: (connection: DesignConnection) => void): void;
  handleAddReversePortal(connectionId: string): void;
  updateDesign(mutator: (design: TemplateDesign) => void): void;
  handleAddZone(role: DesignZoneRole): void;
  handleDuplicate(zoneId: string): void;
  handleTransferZoneSettings(sourceZoneId: string, targetZoneId: string): void;
  handleDelete(zoneId: string): void;
  handleMoveZone(zoneId: string, position: Point): void;
  handleSelectZone(zoneId: string): void;
  handleSelectConnection(connectionId: string): void;
  handleDeleteConnection(connectionId: string): void;
  handleEditConnection(connectionId: string): void;
  handleGenerateBalancedRandomMap(settings: GeneratorSettings): boolean;
  getMandatoryContentNames(): string[];
  onCanvasChange(canvas: HTMLCanvasElement | null): void;
  commit: CommitDesign;
}

export function BuilderWorkspacePage({
  design,
  selectedConnectionId,
  fileName,
  selectedZone,
  zoneLimitReached,
  zoneLimitMessage,
  validation,
  templateDiagnostics,
  templateAnalysis,
  jsonDraft,
  jsonDirty,
  jsonParseError,
  jsonApplyError,
  jsonValidationErrors,
  canUndoDesignChange,
  undoDesignChange,
  handleGlobal,
  handlePlayerCount,
  handleMapDimension,
  handleLockMapDimensions,
  handleHero,
  handleGameEnd,
  updateZone,
  updateConnection,
  handleAddReversePortal,
  updateDesign,
  handleAddZone,
  handleDuplicate,
  handleTransferZoneSettings,
  handleDelete,
  handleMoveZone,
  handleSelectZone,
  handleSelectConnection,
  handleDeleteConnection,
  handleEditConnection,
  handleGenerateBalancedRandomMap,
  getMandatoryContentNames,
  onCanvasChange,
  commit,
  handleJsonChange
}: BuilderWorkspacePageProps & { handleJsonChange: (nextText: string, nextParseError?: string) => void }): JSX.Element {
  const [builderWorkspaceTab, setBuilderWorkspaceTab] = useState<BuilderWorkspaceTab>("layout");
  const [connectionsOpen, setConnectionsOpen] = useState(false);
  const [roadMode, setRoadMode] = useState(false);
  const [advancedConfigurationOpen, setAdvancedConfigurationOpen] = useState(false);
  const [advancedConfigurationTab, setAdvancedConfigurationTab] = useState<AdvancedConfigurationTab>("layout");
  const [balancedRandomOpen, setBalancedRandomOpen] = useState(false);

  function handleConnectionsOpenChange(open: boolean): void {
    setConnectionsOpen(open);
    if (!open) handleSelectConnection("");
  }

  function handleEditConnectionLocal(connectionId: string): void {
    handleEditConnection(connectionId);
    setConnectionsOpen(true);
  }

  function openAdvancedConfiguration(tab: AdvancedConfigurationTab): void {
    setAdvancedConfigurationTab(tab);
    setAdvancedConfigurationOpen(true);
  }

  return (
    <>
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
                      <Button variant="violet" onClick={() => { handleSelectConnection(""); setConnectionsOpen(true); }}><Link2 size={16} />Connections</Button>
                    </div>
                    {zoneLimitMessage ? <div className="builder-inline-notice">{zoneLimitMessage}</div> : null}
                  </CardHeader>
                  <CardContent>
                    <DesignBoardCanvas
                      design={design}
                      selectedZoneId={selectedZone?.id ?? ""}
                      selectedConnectionId={selectedConnectionId}
                      roadMode={roadMode}
                      onCanvasChange={onCanvasChange}
                      onSelectZone={handleSelectZone}
                      onSelectConnection={handleSelectConnection}
                      onMoveZone={handleMoveZone}
                      onConnectZones={(next, nextSelectedZoneId) => commit(next, nextSelectedZoneId)}
                      onEditConnection={handleEditConnectionLocal}
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
                      <Button variant="blue" onClick={() => openAdvancedConfiguration("layout")}><Compass size={16} />Layout Profiles</Button>
                      <Button variant="blue" onClick={() => openAdvancedConfiguration("limits")}><ListChecks size={16} />Content Limits</Button>
                      <Button variant="violet" onClick={() => openAdvancedConfiguration("content")}><FileJson size={16} />Content Library</Button>
                      <Button variant="violet" onClick={() => openAdvancedConfiguration("expert")}><FileJson size={16} />Expert Settings</Button>
                      <Button variant="green" onClick={() => openAdvancedConfiguration("mandatory")}><PackageCheck size={16} />Mandatory Content</Button>
                      <Button variant="gold" onClick={() => setBalancedRandomOpen(true)}><Sparkles size={16} />Simple Generator</Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="json" forceMount style={builderWorkspaceTab === "json" ? undefined : { display: "none" }}>
                <ValidationOutputPanel
                  validation={validation}
                  templateDiagnostics={templateDiagnostics}
                  showBuilderValidationMessages={builderWorkspaceTab === "json"}
                  analysis={builderWorkspaceTab === "json" ? templateAnalysis : null}
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
              onDuplicate={handleDuplicate}
              duplicateDisabled={zoneLimitReached}
              duplicateDisabledReason={zoneLimitMessage}
              onTransferSettings={handleTransferZoneSettings}
              onDelete={handleDelete}
              zones={design.zones}
              layoutProfileNames={design.zoneLayouts.map((layout) => layout.name).filter((name): name is string => Boolean(name))}
              mandatoryContentNames={getMandatoryContentNames()}
              contentCountLimitNames={design.contentCountLimits.map((limit) => limit.name).filter(Boolean)}
              onUpdate={updateZone}
            />
          </aside>
        </div>
      </section>

      <ConnectionsDialog
        open={connectionsOpen}
        onOpenChange={handleConnectionsOpenChange}
        design={design}
        selectedConnectionId={selectedConnectionId}
        onAdd={() => commit(addConnection(design))}
        onAddReversePortal={handleAddReversePortal}
        onUpdate={updateConnection}
        onDelete={handleDeleteConnection}
      />
      <AdvancedConfigurationDialog
        open={advancedConfigurationOpen}
        activeTab={advancedConfigurationTab}
        onOpenChange={setAdvancedConfigurationOpen}
        onActiveTabChange={setAdvancedConfigurationTab}
        design={design}
        onUpdate={updateDesign}
        onGlobal={handleGlobal}
      />
      <BalancedRandomMapDialog
        open={balancedRandomOpen}
        onOpenChange={setBalancedRandomOpen}
        onGenerate={(settings) => {
          const generated = handleGenerateBalancedRandomMap(settings);
          if (generated) setBalancedRandomOpen(false);
          return generated;
        }}
      />
    </>
  );
}
