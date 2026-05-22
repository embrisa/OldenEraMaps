import { Sparkles } from "lucide-react";
import { useMemo, useState, type JSX } from "react";
import {
  balancedRandomMapSizeOptions,
  balancedRandomTopologyOptions,
  buildBalancedRandomMapSettings,
  countBalancedRandomZones,
  createBalancedRandomMapDraft,
  type BalancedRandomNeutralSplitDraft,
  type BalancedRandomToggleOverride,
  type BalancedRandomMapDraft
} from "@/balancedRandomMap";
import { connectionStyleOptions, contentPresetOptions, paceOptions, presetOptions, terrainOptions, validateSettings } from "@/settings";
import type { GeneratorSettings } from "@/types";
import { Alert, CheckField, ConfigField } from "@/components/builder/formHelpers";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, SteppedValueSlider } from "@/components/ui/form-controls";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/radix";

export function BalancedRandomMapDialog({
  open,
  onOpenChange,
  onGenerate
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  onGenerate(settings: GeneratorSettings): boolean;
}): JSX.Element {
  const [draft, setDraft] = useState<BalancedRandomMapDraft>(() => createBalancedRandomMapDraft());
  const settings = useMemo(() => buildBalancedRandomMapSettings(draft), [draft]);
  const validation = useMemo(() => validateSettings(settings), [settings]);
  const zoneCount = countBalancedRandomZones(settings);

  function update<K extends keyof BalancedRandomMapDraft>(key: K, value: BalancedRandomMapDraft[K]): void {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updateNeutralSplit<K extends keyof BalancedRandomNeutralSplitDraft>(key: K, value: BalancedRandomNeutralSplitDraft[K]): void {
    setDraft((current) => ({
      ...current,
      neutralSplit: {
        ...current.neutralSplit,
        [key]: value
      }
    }));
  }

  function updateOptionalNumber<K extends "maxPortalConnections" | "minNeutralZonesBetweenPlayers">(key: K, value: string): void {
    const trimmed = value.trim();
    update(key, trimmed === "" ? undefined : Math.max(0, Number(trimmed)) as BalancedRandomMapDraft[K]);
  }

  function updateToggleOverride<K extends "noDirectPlayerConnections" | "matchPlayerCastleFactions">(key: K, value: string): void {
    update(key, value as BalancedRandomToggleOverride as BalancedRandomMapDraft[K]);
  }

  function handleGenerate(): void {
    if (onGenerate(settings)) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <header className="dialog-heading">
          <div>
            <DialogTitle>Balanced Random Map</DialogTitle>
            <DialogDescription>
              Generates a fresh layout with fairer spawn spacing, balanced routes, and enough structure to stay competitive instead of chaotic.
            </DialogDescription>
          </div>
        </header>

        <div className="balanced-random-dialog">
          <div className="balanced-random-dialog__grid">
            <div className="form-grid form-grid--three">
              <ConfigField configKey="global.templateName" label="Template Name">
                <Input value={draft.templateName} onChange={(event) => update("templateName", event.currentTarget.value)} />
              </ConfigField>
              <ConfigField configKey="players.count" label="Players">
                <SteppedValueSlider
                  min={2}
                  max={8}
                  value={draft.playerCount}
                  onChange={(event) => update("playerCount", Number(event.currentTarget.value) as BalancedRandomMapDraft["playerCount"])}
                />
              </ConfigField>
              <ConfigField configKey="zones.neutral.count" label="Neutral Zones">
                <SteppedValueSlider
                  min={0}
                  max={24}
                  value={draft.neutralZoneCount}
                  onChange={(event) => update("neutralZoneCount", Number(event.currentTarget.value) as BalancedRandomMapDraft["neutralZoneCount"])}
                />
              </ConfigField>
            </div>

            <div className="form-grid form-grid--three">
              <ConfigField configKey="map.size" label="Map Size">
                <NativeSelect value={draft.mapSize} onChange={(event) => update("mapSize", event.currentTarget.value as BalancedRandomMapDraft["mapSize"])}>
                  {balancedRandomMapSizeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </NativeSelect>
              </ConfigField>
              <ConfigField configKey="topology" label="Topology">
                <NativeSelect value={draft.topology} onChange={(event) => update("topology", event.currentTarget.value as BalancedRandomMapDraft["topology"])}>
                  {balancedRandomTopologyOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </NativeSelect>
              </ConfigField>
              <ConfigField configKey="pace" label="Pace">
                <NativeSelect value={draft.pacePreset} onChange={(event) => update("pacePreset", event.currentTarget.value as BalancedRandomMapDraft["pacePreset"])}>
                  {paceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </NativeSelect>
              </ConfigField>
            </div>

            <div className="form-grid form-grid--three">
              <ConfigField configKey="content.preset" label="Content Focus">
                <NativeSelect value={draft.contentPreset} onChange={(event) => update("contentPreset", event.currentTarget.value as BalancedRandomMapDraft["contentPreset"])}>
                  {contentPresetOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </NativeSelect>
              </ConfigField>
              <ConfigField configKey="terrain.theme" label="Terrain Theme">
                <NativeSelect value={draft.terrainTheme} onChange={(event) => update("terrainTheme", event.currentTarget.value as BalancedRandomMapDraft["terrainTheme"])}>
                  {terrainOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </NativeSelect>
              </ConfigField>
              <ConfigField configKey="seed" label="Seed (optional)">
                <Input value={draft.seed} inputMode="numeric" placeholder="Random every time" onChange={(event) => update("seed", event.currentTarget.value)} />
              </ConfigField>
            </div>
          </div>

          <div className="checks">
            <CheckField checked={draft.cityHold} onCheckedChange={(checked) => update("cityHold", checked)}>Enable City Hold objective</CheckField>
            <CheckField checked={draft.naturalExpansion} onCheckedChange={(checked) => update("naturalExpansion", checked)}>Add natural expansion zones</CheckField>
            <CheckField checked={draft.randomPortals} onCheckedChange={(checked) => update("randomPortals", checked)}>Allow extra random portals</CheckField>
          </div>

          <details className="raw-details">
            <summary>Advanced</summary>

            <div className="balanced-random-dialog__grid">
              <div className="form-grid form-grid--three">
                <ConfigField configKey="generation.preset" label="Generation Preset">
                  <NativeSelect value={draft.generationPreset} onChange={(event) => update("generationPreset", event.currentTarget.value as BalancedRandomMapDraft["generationPreset"])}>
                    {presetOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </NativeSelect>
                </ConfigField>
                <ConfigField configKey="connection.style" label="Connection Style">
                  <NativeSelect value={draft.connectionStylePreset} onChange={(event) => update("connectionStylePreset", event.currentTarget.value as BalancedRandomMapDraft["connectionStylePreset"])}>
                    {connectionStyleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </NativeSelect>
                </ConfigField>
                <ConfigField configKey="connections.portal.max" label="Max Portal Connections">
                  <Input
                    type="number"
                    min={0}
                    value={draft.maxPortalConnections ?? ""}
                    placeholder="Auto"
                    onChange={(event) => updateOptionalNumber("maxPortalConnections", event.currentTarget.value)}
                  />
                </ConfigField>
              </div>

              <div className="form-grid form-grid--three">
                <ConfigField configKey="players.direct" label="Direct Player Connections">
                  <NativeSelect value={draft.noDirectPlayerConnections} onChange={(event) => updateToggleOverride("noDirectPlayerConnections", event.currentTarget.value)}>
                    <option value="Auto">Auto</option>
                    <option value="Disabled">Allow direct routes</option>
                    <option value="Enabled">Block direct routes</option>
                  </NativeSelect>
                </ConfigField>
                <ConfigField configKey="zones.neutral.minBetweenPlayers" label="Min Neutral Zones Between Players">
                  <Input
                    type="number"
                    min={0}
                    value={draft.minNeutralZonesBetweenPlayers ?? ""}
                    placeholder="Auto"
                    onChange={(event) => updateOptionalNumber("minNeutralZonesBetweenPlayers", event.currentTarget.value)}
                  />
                </ConfigField>
                <ConfigField configKey="players.castles.matchFactions" label="Match Player Castle Factions">
                  <NativeSelect value={draft.matchPlayerCastleFactions} onChange={(event) => updateToggleOverride("matchPlayerCastleFactions", event.currentTarget.value)}>
                    <option value="Auto">Auto</option>
                    <option value="Enabled">Match factions</option>
                    <option value="Disabled">Do not match</option>
                  </NativeSelect>
                </ConfigField>
              </div>

              <div className="form-grid form-grid--three">
                <ConfigField configKey="zones.neutral.lowNoCastle" label="Neutral Low / No Castle">
                  <Input type="number" min={0} value={draft.neutralSplit.neutralLowNoCastleCount} onChange={(event) => updateNeutralSplit("neutralLowNoCastleCount", Math.max(0, Number(event.currentTarget.value)))} />
                </ConfigField>
                <ConfigField configKey="zones.neutral.lowCastle" label="Neutral Low / Castle">
                  <Input type="number" min={0} value={draft.neutralSplit.neutralLowCastleCount} onChange={(event) => updateNeutralSplit("neutralLowCastleCount", Math.max(0, Number(event.currentTarget.value)))} />
                </ConfigField>
                <ConfigField configKey="zones.neutral.mediumNoCastle" label="Neutral Medium / No Castle">
                  <Input type="number" min={0} value={draft.neutralSplit.neutralMediumNoCastleCount} onChange={(event) => updateNeutralSplit("neutralMediumNoCastleCount", Math.max(0, Number(event.currentTarget.value)))} />
                </ConfigField>
              </div>

              <div className="form-grid form-grid--three">
                <ConfigField configKey="zones.neutral.mediumCastle" label="Neutral Medium / Castle">
                  <Input type="number" min={0} value={draft.neutralSplit.neutralMediumCastleCount} onChange={(event) => updateNeutralSplit("neutralMediumCastleCount", Math.max(0, Number(event.currentTarget.value)))} />
                </ConfigField>
                <ConfigField configKey="zones.neutral.highNoCastle" label="Neutral High / No Castle">
                  <Input type="number" min={0} value={draft.neutralSplit.neutralHighNoCastleCount} onChange={(event) => updateNeutralSplit("neutralHighNoCastleCount", Math.max(0, Number(event.currentTarget.value)))} />
                </ConfigField>
                <ConfigField configKey="zones.neutral.highCastle" label="Neutral High / Castle">
                  <Input type="number" min={0} value={draft.neutralSplit.neutralHighCastleCount} onChange={(event) => updateNeutralSplit("neutralHighCastleCount", Math.max(0, Number(event.currentTarget.value)))} />
                </ConfigField>
              </div>
            </div>
          </details>

          <div className="balanced-random-dialog__summary" aria-label="Balanced random map summary">
            <span><Sparkles size={14} />{settings.mapWidth} x {settings.mapHeight}</span>
            <span><Sparkles size={14} />{zoneCount} total zones</span>
            <span><Sparkles size={14} />{settings.topology === "Default" ? "Ring" : settings.topology}</span>
            <span><Sparkles size={14} />Seed {settings.seed}</span>
          </div>

          {validation.errors.length > 0 ? (
            <Alert tone="danger">
              {validation.errors.map((error) => <div key={error}>{error}</div>)}
            </Alert>
          ) : null}

          {validation.warnings.length > 0 ? (
            <Alert tone="warning">
              {validation.warnings.map((warning) => <div key={warning}>{warning}</div>)}
            </Alert>
          ) : null}

          <div className="dialog-actions">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleGenerate} disabled={validation.errors.length > 0}>Generate Balanced Map</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
