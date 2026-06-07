import { ArrowRightLeft, Castle, Copy, Home, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type JSX } from "react";
import { terrainOptions } from "@/settings";
import { defaultDwellingCountForRole, defaultDwellingSettingsForZone, dwellingCountFromSettings, normalizeDwellingSettings, syncDwellingSettingsFromCount, syncZoneProfile, type DesignZone, type DesignZoneRole, type DwellingSettings } from "@/design";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, NativeSelect, SteppedValueSlider, Textarea } from "@/components/ui/form-controls";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/radix";
import { BiomeField } from "@/components/builder/BiomeField";
import { ContentPoolField, SidListField } from "@/components/builder/ContentPoolField";
import { DwellingSettingsDialog } from "@/components/builder/DwellingSettingsDialog";
import { MainObjectsEditor } from "@/components/builder/MainObjectsEditor";
import {
  CheckField,
  ConfigField,
  formatNumberList,
  parseNumberList
} from "@/components/builder/formHelpers";

export function ZoneInspector({
  zone,
  onDuplicate,
  duplicateDisabled = false,
  duplicateDisabledReason,
  onTransferSettings,
  onDelete,
  zones,
  layoutProfileNames,
  mandatoryContentNames,
  contentCountLimitNames,
  onUpdate
}: {
  zone: DesignZone | undefined;
  onDuplicate(zoneId: string): void;
  duplicateDisabled?: boolean;
  duplicateDisabledReason?: string;
  onTransferSettings(sourceZoneId: string, targetZoneId: string): void;
  onDelete(zoneId: string): void;
  zones: DesignZone[];
  layoutProfileNames: string[];
  mandatoryContentNames: string[];
  contentCountLimitNames: string[];
  onUpdate(mutator: (zone: DesignZone) => void): void;
}): JSX.Element {
  const transferTargetOptions = useMemo(
    () => zones.filter((candidate) => candidate.id !== zone?.id),
    [zone?.id, zones]
  );
  const [transferTargetId, setTransferTargetId] = useState("");
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [dwellingSettingsDialogOpen, setDwellingSettingsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"general" | "guardsRules" | "content">("general");

  useEffect(() => {
    if (transferTargetOptions.some((candidate) => candidate.id === transferTargetId)) return;
    setTransferTargetId(transferTargetOptions[0]?.id ?? "");
  }, [transferTargetId, transferTargetOptions]);

  const settings = useMemo(() => {
    if (!zone) return null;
    return normalizeDwellingSettings(zone.dwellingSettings, defaultDwellingSettingsForZone(zone, zone.dwellingCount));
  }, [zone?.dwellingSettings, zone?.dwellingCount, zone]);

  if (!zone) {
    return (
      <Card className="inspector-card">
        <CardHeader><CardTitle>Zone Inspector</CardTitle></CardHeader>
        <CardContent><div className="empty-state">Add a zone to begin.</div></CardContent>
      </Card>
    );
  }

  return (
    <Card className="inspector-card">
      <CardHeader>
        <div>
          <CardTitle>Zone Inspector</CardTitle>
          <CardDescription>Selected zone configuration.</CardDescription>
        </div>
        <RoleBadge role={zone.role} />
      </CardHeader>
      <CardContent>
        <div className="selected-title">
          <div className="selected-title__name selected-title__headline">
            <strong className="selected-title__strong">{zone.name}</strong>
            <RoleBadge role={zone.role} />
            <span className="selected-title__meta">
              {zone.castleCount} {zone.neutralCastlesAsRuins && zone.role === "Neutral" ? (zone.castleCount === 1 ? "ruin" : "ruins") : (zone.castleCount === 1 ? "city" : "cities")} · {zone.terrainTheme}
            </span>
          </div>
          <div className="selected-title__actions">
            <Button type="button" size="sm" variant="blue" disabled={duplicateDisabled} title={duplicateDisabled ? duplicateDisabledReason : undefined} onClick={() => onDuplicate(zone.id)}><Copy size={14} />Duplicate</Button>
            <Button type="button" size="sm" variant="danger" onClick={() => onDelete(zone.id)}><Trash2 size={14} />Delete</Button>
            {transferTargetOptions.length > 0 ? (
              <Button type="button" size="sm" variant="default" onClick={() => setTransferDialogOpen(true)}>
                <ArrowRightLeft size={14} />Transfer
              </Button>
            ) : null}
          </div>
        </div>
        {duplicateDisabledReason ? <div className="builder-inline-notice" style={{ marginBottom: "8px" }}>{duplicateDisabledReason}</div> : null}

        <div className="analysis-tabs zone-inspector-tabs">
          <button
            type="button"
            className={`analysis-tab-btn ${activeTab === "general" ? "active" : ""}`}
            onClick={() => setActiveTab("general")}
          >
            General
          </button>
          <button
            type="button"
            className={`analysis-tab-btn ${activeTab === "guardsRules" ? "active" : ""}`}
            onClick={() => setActiveTab("guardsRules")}
          >
            Guards &amp; Rules
          </button>
          <button
            type="button"
            className={`analysis-tab-btn ${activeTab === "content" ? "active" : ""}`}
            onClick={() => setActiveTab("content")}
          >
            Content
          </button>
        </div>

        {activeTab === "general" && (
          <div className="tab-pane">
            <div className="zone-general-grid">
              <ConfigField configKey="zone.name" label="Name" className="zone-general-grid__wide">
                <Input value={zone.name} onChange={(event) => {
                  const value = event.currentTarget.value;
                  onUpdate((draft) => { draft.name = value; });
                }} />
              </ConfigField>
              <ConfigField configKey="zone.role" label="Role">
                <NativeSelect value={zone.role} onChange={(event) => {
                  const value = event.currentTarget.value as DesignZoneRole;
                  onUpdate((draft) => {
                    draft.role = value;
                    draft.quality = draft.role === "Hub" ? "High" : draft.role === "Neutral" ? "Medium" : "Low";
                    if (draft.role !== "Spawn") draft.player = undefined;
                    if (draft.role !== "Neutral") draft.matchAdjacentNeutralCastleFactions = false;
                    if (draft.role !== "Neutral") draft.neutralCastlesAsRuins = false;
                    if (draft.role !== "Neutral") draft.naturalExpansion = false;
                    if (draft.role === "Hub") draft.name = draft.name.startsWith("Hub") ? draft.name : "Hub";
                    draft.dwellingCount = defaultDwellingCountForRole(draft.role);
                    draft.dwellingSettings = defaultDwellingSettingsForZone(draft, draft.dwellingCount);
                    draft.dwellingCountCustomized = true;
                    syncZoneProfile(draft);
                  });
                }}>
                  {["Spawn", "Neutral", "Hub"].map((value) => <option key={value} value={value}>{value}</option>)}
                </NativeSelect>
              </ConfigField>
              <ConfigField configKey="zone.quality" label="Quality">
                <NativeSelect value={zone.quality} onChange={(event) => {
                  const value = event.currentTarget.value as DesignZone["quality"];
                  onUpdate((draft) => {
                    draft.quality = value;
                    if (!draft.dwellingCountCustomized) draft.dwellingSettings = defaultDwellingSettingsForZone(draft, draft.dwellingCount);
                    syncZoneProfile(draft);
                  });
                }}>
                  {["Low", "Medium", "High"].map((value) => <option key={value} value={value}>{value}</option>)}
                </NativeSelect>
              </ConfigField>
              <ConfigField configKey="zone.player" label="Player">
                <SteppedValueSlider min={1} max={8} disabled={zone.role !== "Spawn"} value={zone.player ?? 1} onChange={(event) => {
                  onUpdate((draft) => { draft.player = Number(event.currentTarget.value); });
                }} />
              </ConfigField>
              <ConfigField configKey="zone.castleCount" label="Castles">
                <SteppedValueSlider min={0} max={8} value={zone.castleCount} onChange={(event) => {
                  onUpdate((draft) => { draft.castleCount = Number(event.currentTarget.value); });
                }} />
              </ConfigField>
              <ConfigField configKey="zone.size" label="Size">
                <SteppedValueSlider min={0.25} max={3} step={0.05} value={zone.size} onChange={(event) => {
                  onUpdate((draft) => { draft.size = Number(event.currentTarget.value); });
                }} />
              </ConfigField>
              <ConfigField configKey="zone.crossroadsPosition" label="Crossroads">
                <SteppedValueSlider min={0} max={1} step={0.01} value={zone.crossroadsPosition} onChange={(event) => {
                  onUpdate((draft) => { draft.crossroadsPosition = Number(event.currentTarget.value); });
                }} />
              </ConfigField>
              <ConfigField configKey="zone.terrainTheme" label="Terrain">
                <NativeSelect value={zone.terrainTheme} onChange={(event) => {
                  const value = event.currentTarget.value as DesignZone["terrainTheme"];
                  onUpdate((draft) => {
                    draft.terrainTheme = value;
                    draft.zoneBiome = undefined;
                    draft.contentBiome = undefined;
                    draft.metaObjectsBiome = undefined;
                  });
                }}>
                  {terrainOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </NativeSelect>
              </ConfigField>
              <ConfigField configKey="zone.layout" label="Layout" className="zone-general-grid__wide">
                <NativeSelect value={zone.layout} onChange={(event) => {
                  const value = event.currentTarget.value;
                  onUpdate((draft) => { draft.layout = value; });
                }}>
                  {layoutOptionsForZone(layoutProfileNames, zone.layout).map((option) => <option key={option} value={option}>{option}</option>)}
                </NativeSelect>
              </ConfigField>
            </div>

            <div className="dialog-section" style={{ marginTop: "12px" }}>
              <h3 className="dialog-section__heading">Biome Overrides</h3>
              <BiomeField label="Zone Biome" value={zone.zoneBiome} onChange={(value) => onUpdate((draft) => { draft.zoneBiome = value; })} />
              <BiomeField label="Content Biome" value={zone.contentBiome} onChange={(value) => onUpdate((draft) => { draft.contentBiome = value; })} />
              <BiomeField label="Meta Objects Biome" value={zone.metaObjectsBiome} onChange={(value) => onUpdate((draft) => { draft.metaObjectsBiome = value; })} />
            </div>

            <div className="checks checks--vertical zone-inspector-checks" style={{ marginTop: "12px", marginBottom: "12px" }}>
              <CheckField checked={zone.roads} onCheckedChange={(checked) => onUpdate((draft) => { draft.roads = checked; })}>Generate roads in this zone</CheckField>
              <CheckField checked={zone.footholds} onCheckedChange={(checked) => onUpdate((draft) => { draft.footholds = checked; })}>Include remote foothold content</CheckField>
              <CheckField checked={zone.holdCity} onCheckedChange={(checked) => onUpdate((draft) => { draft.holdCity = checked; })}>Mark as City Hold target</CheckField>
              {zone.role === "Neutral" ? (
                <CheckField checked={zone.naturalExpansion} onCheckedChange={(checked) => onUpdate((draft) => { draft.naturalExpansion = checked; })}>Mark as natural expansion</CheckField>
              ) : null}
              {zone.role === "Neutral" ? (
                <CheckField checked={zone.matchAdjacentNeutralCastleFactions} onCheckedChange={(checked) => onUpdate((draft) => { draft.matchAdjacentNeutralCastleFactions = checked; })}>Match adjacent neutral castles</CheckField>
              ) : null}
              {zone.role === "Neutral" ? (
                <CheckField checked={zone.neutralCastlesAsRuins} onCheckedChange={(checked) => onUpdate((draft) => { draft.neutralCastlesAsRuins = checked; })}>Make this zone's castles ruins</CheckField>
              ) : null}
            </div>
            <MainObjectsEditor zone={zone} onUpdate={onUpdate} />
          </div>
        )}

        {activeTab === "guardsRules" && (
          <div className="tab-pane">
            <div className="dialog-section">
              <h3 className="dialog-section__heading">Guard Settings</h3>
              <NumberGrid zone={zone} fields={[
                ["neutralStackStrengthPercent", "Guard Strength %", 25, 300],
                ["guardRandomizationPercent", "Guard Random %", 0, 50],
                ["guardCutoffValue", "Guard Cutoff", 0, 50000],
                ["guardMultiplier", "Guard Strength", 0, 10],
                ["guardWeeklyIncrement", "Guard Weekly Increment", 0, 10],
                ["diplomacyModifier", "Diplomacy Modifier", -5, 5]
              ]} onUpdate={onUpdate} />
              <div style={{ marginTop: "8px" }}>
                <ConfigField configKey="zone.guardReactionDistribution" label="Guard Reaction Distribution" className="zone-general-grid__wide">
                  <Textarea rows={2} value={formatNumberList(zone.guardReactionDistribution)} onChange={(event) => {
                    const value = parseNumberList(event.currentTarget.value);
                    onUpdate((draft) => { draft.guardReactionDistribution = value; });
                  }} />
                </ConfigField>
              </div>
            </div>
            <div className="dialog-section" style={{ marginTop: "12px" }}>
              <h3 className="dialog-section__heading">Zone Rules</h3>
              <div className="checks checks--vertical" style={{ gap: "6px", marginBottom: "8px" }}>
                <ConfigField configKey="zone.encounterHolesSettings" label="Encounter Holes">
                  <CheckField checked={zone.encounterHolesSettings != null} onCheckedChange={(checked) => onUpdate((draft) => {
                    draft.encounterHolesSettings = checked ? {
                      affectedEncounters: draft.encounterHolesSettings?.affectedEncounters ?? 0,
                      twoHoleEncounters: draft.encounterHolesSettings?.twoHoleEncounters ?? 0
                    } : undefined;
                  })}>Configure encounter holes for this zone</CheckField>
                </ConfigField>
                <ConfigField configKey="zone.randomHireEnableWeeklyUnitIncrement" label="Random Hire Growth">
                  <CheckField checked={zone.randomHireEnableWeeklyUnitIncrement === true} onCheckedChange={(checked) => onUpdate((draft) => {
                    draft.randomHireEnableWeeklyUnitIncrement = checked;
                  })}>Enable weekly random hire unit increment</CheckField>
                </ConfigField>
                <ConfigField configKey="zone.randomHireInitialUnitIncrement" label="Random Hire Initial Increment">
                  <CheckField checked={zone.randomHireInitialUnitIncrement != null} onCheckedChange={(checked) => onUpdate((draft) => {
                    draft.randomHireInitialUnitIncrement = checked ? (draft.randomHireInitialUnitIncrement ?? 0) : undefined;
                  })}>Set initial random hire unit increment</CheckField>
                </ConfigField>
              </div>
              <div className="form-grid form-grid--two">
                <ConfigField configKey="zone.encounterHolesSettings.affectedEncounters" label="Affected Encounters">
                  <SteppedValueSlider min={0} max={100} disabled={zone.encounterHolesSettings == null} value={zone.encounterHolesSettings?.affectedEncounters ?? 0} onChange={(event) => {
                    onUpdate((draft) => {
                      draft.encounterHolesSettings = {
                        affectedEncounters: Number(event.currentTarget.value),
                        twoHoleEncounters: draft.encounterHolesSettings?.twoHoleEncounters ?? 0
                      };
                    });
                  }} />
                </ConfigField>
                <ConfigField configKey="zone.encounterHolesSettings.twoHoleEncounters" label="Two-Hole Encounters">
                  <SteppedValueSlider min={0} max={100} disabled={zone.encounterHolesSettings == null} value={zone.encounterHolesSettings?.twoHoleEncounters ?? 0} onChange={(event) => {
                    onUpdate((draft) => {
                      draft.encounterHolesSettings = {
                        affectedEncounters: draft.encounterHolesSettings?.affectedEncounters ?? 0,
                        twoHoleEncounters: Number(event.currentTarget.value)
                      };
                    });
                  }} />
                </ConfigField>
                <ConfigField configKey="zone.randomHireInitialUnitIncrementValue" label="Initial Unit Increment">
                  <SteppedValueSlider min={0} max={100} disabled={zone.randomHireInitialUnitIncrement == null} value={zone.randomHireInitialUnitIncrement ?? 0} onChange={(event) => {
                    onUpdate((draft) => { draft.randomHireInitialUnitIncrement = Number(event.currentTarget.value); });
                  }} />
                </ConfigField>
              </div>
            </div>
          </div>
        )}

        {activeTab === "content" && settings && (
          <div className="tab-pane">
            <div className="dialog-section">
              <h3 className="dialog-section__heading">Density &amp; Value</h3>
              
              <div className="zone-dwellings-summary">
                <ConfigField configKey="zone.dwellingCount" label="Dwellings">
                  <SteppedValueSlider min={0} max={8} value={zone.dwellingCount} onChange={(event) => {
                    onUpdate((draft) => {
                      draft.dwellingCount = Number(event.currentTarget.value);
                      syncDwellingSettingsFromCount(draft);
                      draft.dwellingCountCustomized = true;
                    });
                  }} />
                </ConfigField>
                <Button type="button" variant="gold" onClick={() => setDwellingSettingsDialogOpen(true)}>
                  <Castle size={14} />Dwelling Settings
                </Button>
              </div>

              <div className="dialog-section__subheading zone-dwellings-heading">Configured Dwellings</div>
              <div className="dwelling-cards-list">
                {settings.mode === "Generated" ? (
                  <>
                    {settings.lowTierCount > 0 && (
                      <div className="dwelling-card-summary">
                        <Home size={14} className="text-gold" />
                        <div className="dwelling-card-summary__body">
                          <span className="dwelling-card-summary__title">Low-tier</span>
                          <span className="dwelling-card-summary__count">Count: {settings.lowTierCount}</span>
                        </div>
                      </div>
                    )}
                    {settings.highTierCount > 0 && (
                      <div className="dwelling-card-summary">
                        <Castle size={14} className="text-gold" />
                        <div className="dwelling-card-summary__body">
                          <span className="dwelling-card-summary__title">High-tier</span>
                          <span className="dwelling-card-summary__count">Count: {settings.highTierCount}</span>
                        </div>
                      </div>
                    )}
                    {settings.lowTierCount === 0 && settings.highTierCount === 0 && (
                      <span className="dwelling-card-summary__empty">No generated dwellings.</span>
                    )}
                  </>
                ) : (
                  settings.specific.length === 0 ? (
                    <span className="dwelling-card-summary__empty">No specific dwellings.</span>
                  ) : (
                    settings.specific.map((entry) => {
                      const isNeutral = entry.faction === "Neutral";
                      const IconComponent = isNeutral ? Home : Castle;
                      return (
                        <div key={entry.id} className="dwelling-card-summary">
                          <IconComponent size={14} className="text-gold dwelling-card-summary__icon" />
                          <div className="dwelling-card-summary__body">
                            <span className="dwelling-card-summary__title" title={entry.title}>
                              {entry.title}
                            </span>
                            <span className="dwelling-card-summary__count">Count: {entry.count}</span>
                          </div>
                        </div>
                      );
                    })
                  )
                )}
              </div>

              <div style={{ marginBottom: "12px" }}>
                <ConfigField configKey="zone.resourcesValue" label="Resources" className="zone-general-grid__wide">
                  <SteppedValueSlider min={0} max={120000} step={2500} value={zone.resourcesValue} onChange={(event) => {
                    const value = Number(event.currentTarget.value);
                    onUpdate((draft) => { setZoneResourceBudget(draft, value); });
                  }} />
                </ConfigField>
              </div>

              <NumberGrid zone={zone} fields={[
                ["resourceDensityPercent", "Resources %", 20, 400],
                ["structureDensityPercent", "Structures %", 20, 200],
                ["guardedContentValue", "Guarded Content Value", 0, 2000000],
                ["guardedContentValuePerArea", "Guarded Value / Area", 0, 20000],
                ["unguardedContentValue", "Unguarded Content Value", 0, 2000000],
                ["unguardedContentValuePerArea", "Unguarded Value / Area", 0, 20000],
                ["resourcesValuePerArea", "Resources Value / Area", 0, 20000]
              ]} onUpdate={onUpdate} />
            </div>
            <div className="dialog-section" style={{ marginTop: "12px" }}>
              <h3 className="dialog-section__heading">Content Pools</h3>
              <ContentPoolField label="Guarded Content Pool" configKey="zone.guardedContentPool" values={zone.guardedContentPool} onChange={(values) => onUpdate((draft) => { draft.guardedContentPool = values; })} />
              <ContentPoolField label="Unguarded Content Pool" configKey="zone.unguardedContentPool" values={zone.unguardedContentPool} onChange={(values) => onUpdate((draft) => { draft.unguardedContentPool = values; })} />
              <ContentPoolField label="Resources Content Pool" configKey="zone.resourcesContentPool" values={zone.resourcesContentPool} onChange={(values) => onUpdate((draft) => { draft.resourcesContentPool = values; })} />
            </div>
            <div className="dialog-section" style={{ marginTop: "12px" }}>
              <h3 className="dialog-section__heading">References</h3>
              <SidListField
                label="Mandatory Content"
                configKey="zone.mandatoryContent"
                values={zone.mandatoryContent}
                options={contentReferenceOptions(mandatoryContentNames, zone.mandatoryContent, "mandatory_content_")}
                onChange={(values) => onUpdate((draft) => { draft.mandatoryContent = values; })}
              />
              <SidListField
                label="Content Count Limits"
                configKey="zone.contentCountLimits"
                values={zone.contentCountLimits}
                options={contentReferenceOptions(contentCountLimitNames, zone.contentCountLimits, "content_limits_")}
                onChange={(values) => onUpdate((draft) => { draft.contentCountLimits = values; })}
              />
            </div>
          </div>
        )}
      </CardContent>

      {/* Transfer Settings dialog */}
      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent className="transfer-settings-dialog">
          <div className="dialog-heading">
            <div>
              <DialogTitle>Transfer Settings</DialogTitle>
              <DialogDescription>Choose a zone to receive this zone's configuration.</DialogDescription>
            </div>
          </div>
          <ConfigField configKey="zone.transferTarget" label="Target Zone">
            <NativeSelect
              aria-label="Transfer settings target"
              value={transferTargetId}
              onChange={(event) => setTransferTargetId(event.currentTarget.value)}
            >
              {transferTargetOptions.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>{candidate.name}</option>
              ))}
            </NativeSelect>
          </ConfigField>
          <div className="dialog-actions">
            <Button type="button" variant="ghost" onClick={() => setTransferDialogOpen(false)}>Cancel</Button>
            <Button
              type="button"
              disabled={!transferTargetId}
              onClick={() => {
                onTransferSettings(zone.id, transferTargetId);
                setTransferDialogOpen(false);
              }}
            >
              <ArrowRightLeft size={14} />Transfer Settings
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <DwellingSettingsDialog
        open={dwellingSettingsDialogOpen}
        onOpenChange={setDwellingSettingsDialogOpen}
        zone={zone}
        onChange={(settings: DwellingSettings) => onUpdate((draft) => {
          draft.dwellingSettings = settings;
          draft.dwellingCount = dwellingCountFromSettings(settings);
          draft.dwellingCountCustomized = true;
        })}
      />
    </Card>
  );
}

function layoutOptionsForZone(layoutProfileNames: string[], currentLayout: string): string[] {
  const options: string[] = [];
  const seen = new Set<string>();
  for (const name of [...layoutProfileNames, currentLayout]) {
    const trimmed = name.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    options.push(trimmed);
  }
  return options;
}

function NumberGrid({ zone, fields, onUpdate }: { zone: DesignZone; fields: Array<[keyof DesignZone, string, number, number]>; onUpdate(mutator: (zone: DesignZone) => void): void }): JSX.Element {
  return (
    <div className="form-grid form-grid--two">
      {fields.map(([field, label, min, max]) => (
        <ConfigField key={String(field)} configKey={`zone.${String(field)}`} label={label}>
          <SteppedValueSlider min={min} max={max} step={field === "guardMultiplier" || field === "guardWeeklyIncrement" || field === "diplomacyModifier" ? 0.05 : 1} value={zone[field] as number | undefined} onChange={(event) => {
            onUpdate((draft) => { draft[field] = Number(event.currentTarget.value) as never; });
          }} />
          {field === "guardMultiplier" && (
            <div className="metric-bar-bg" style={{ marginTop: "6px" }} title={`${zone.guardMultiplier}x multiplier`}>
              <div className="metric-bar-fill wealth-fill" style={{ width: `${Math.min(100, Math.max(0, (Number(zone.guardMultiplier) / 10) * 100))}%` }} />
            </div>
          )}
        </ConfigField>
      ))}
    </div>
  );
}

function setZoneResourceBudget(zone: DesignZone, resourcesValue: number): void {
  zone.resourcesValue = resourcesValue;
  zone.resourcesValuePerArea = resourcesValue > 0 ? Math.round(resourcesValue / 125) : 0;
}

function RoleBadge({ role }: { role: DesignZoneRole }): JSX.Element {
  return <Badge className={`role-badge role-badge--${role.toLowerCase()}`}>{role}</Badge>;
}

function contentReferenceOptions(referenceNames: string[], selectedNames: string[], prefix: string): Array<{ value: string; label: string; description?: string }> {
  const names = new Set([...referenceNames, ...selectedNames].filter(Boolean));
  return Array.from(names).map((name) => ({
    value: name,
    label: name.replace(prefix, "").replaceAll("_", " "),
    description: `Use the top-level ${name} reference.`
  }));
}
