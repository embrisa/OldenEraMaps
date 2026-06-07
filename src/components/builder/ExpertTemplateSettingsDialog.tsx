import { useEffect, useState, type JSX } from "react";
import type { TemplateDesign } from "@/design";
import type { GlobalBans, NoiseEntry, ValueOverride } from "@/types";
import { Button } from "@/components/ui/button";
import { Input, SteppedValueSlider } from "@/components/ui/form-controls";
import { Dialog, DialogContent } from "@/components/ui/radix";
import { RmgJsonEditor } from "@/components/builder/RmgJsonEditor";
import { Alert, ConfigField, formatJsonInput, parseJsonInput } from "@/components/builder/formHelpers";

interface JsonDraft {
  value: string;
  error?: string;
}

interface NoiseDraftState {
  obstacles: NoiseEntry[];
  water: NoiseEntry[];
}

interface GlobalBansDraftState {
  items: string[];
  heroes: string[];
  magics: string[];
}

type ParsedValueOverridesDraft =
  | { ok: true; value: ValueOverride[] }
  | { ok: false; error: string };

export function ExpertTemplateSettingsDialog({
  open,
  onOpenChange,
  design,
  onUpdate,
  onGlobal
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  design: TemplateDesign;
  onUpdate(mutator: (design: TemplateDesign) => void): void;
  onGlobal<K extends keyof TemplateDesign>(key: K, value: TemplateDesign[K]): void;
}): JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="content-limits-dialog content-library-dialog">
        <ExpertTemplateSettingsPanel active={open} design={design} onUpdate={onUpdate} onGlobal={onGlobal} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

export function ExpertTemplateSettingsPanel({
  active,
  design,
  onUpdate,
  onGlobal,
  onClose
}: {
  active: boolean;
  design: TemplateDesign;
  onUpdate(mutator: (design: TemplateDesign) => void): void;
  onGlobal<K extends keyof TemplateDesign>(key: K, value: TemplateDesign[K]): void;
  onClose(): void;
}): JSX.Element {
  const [valueOverridesDraft, setValueOverridesDraft] = useState<JsonDraft>({ value: "[]" });
  const [globalBansDraft, setGlobalBansDraft] = useState<GlobalBansDraftState>(() => toGlobalBansDraft(design.globalBans));
  const [noiseDrafts, setNoiseDrafts] = useState<NoiseDraftState>(() => ({
    obstacles: cloneNoiseEntries(design.border.obstaclesNoise),
    water: cloneNoiseEntries(design.border.waterNoise)
  }));

  useEffect(() => {
    if (!active) return;
    setValueOverridesDraft({ value: formatJsonInput(design.valueOverrides) });
    setGlobalBansDraft(toGlobalBansDraft(design.globalBans));
    setNoiseDrafts({
      obstacles: cloneNoiseEntries(design.border.obstaclesNoise),
      water: cloneNoiseEntries(design.border.waterNoise)
    });
  }, [active, design.globalBans, design.valueOverrides, design.border.obstaclesNoise, design.border.waterNoise]);

  function updateOrientation<K extends keyof TemplateDesign["orientation"]>(key: K, value: TemplateDesign["orientation"][K]): void {
    onGlobal("orientation", { ...design.orientation, [key]: value });
  }

  function updateBorder<K extends keyof TemplateDesign["border"]>(key: K, value: TemplateDesign["border"][K]): void {
    onGlobal("border", { ...design.border, [key]: value });
  }

  function syncNoise(field: "obstacles" | "water", nextEntries: NoiseEntry[]): void {
    setNoiseDrafts((current) => ({ ...current, [field]: nextEntries }));
    updateBorder(field === "obstacles" ? "obstaclesNoise" : "waterNoise", nextEntries);
  }

  function updateNoiseEntry(field: "obstacles" | "water", index: number, key: keyof NoiseEntry, value: string): void {
    const parsed = Number(value);
    const nextEntries = noiseDrafts[field].map((entry, entryIndex) => (
      entryIndex === index
        ? { ...entry, [key]: Number.isFinite(parsed) ? parsed : 0 }
        : entry
    ));
    syncNoise(field, nextEntries);
  }

  function handleApply(): void {
    const parsedValueOverrides = parseValueOverridesDraft(valueOverridesDraft.value);
    setValueOverridesDraft({ value: valueOverridesDraft.value, error: parsedValueOverrides.ok ? undefined : parsedValueOverrides.error });
    if (!parsedValueOverrides.ok) return;

    onUpdate((draft) => {
      draft.valueOverrides = parsedValueOverrides.value;
      draft.globalBans = fromGlobalBansDraft(globalBansDraft);
    });
    onClose();
  }

  return (
    <>
      <div className="dialog-heading">
        <div>
          <h3>Expert Settings</h3>
          <p>Map geometry, orientation, bans, and JSON overrides.</p>
        </div>
      </div>
        <div className="dialog-section">
          <h3 className="dialog-section__heading">Map Orientation</h3>
          <div className="form-grid form-grid--three">
            <ConfigField configKey="global.orientation.zeroAngleZone" label="Zero Angle Zone">
              <Input value={design.orientation.zeroAngleZone ?? ""} onChange={(event) => updateOrientation("zeroAngleZone", event.currentTarget.value || undefined)} />
            </ConfigField>
            <ConfigField configKey="global.orientation.baseAngleMin" label="Base Angle Min">
              <SteppedValueSlider min={0} max={360} step={1} value={design.orientation.baseAngleMin} onChange={(event) => updateOrientation("baseAngleMin", Number(event.currentTarget.value))} />
            </ConfigField>
            <ConfigField configKey="global.orientation.baseAngleMax" label="Base Angle Max">
              <SteppedValueSlider min={0} max={360} step={1} value={design.orientation.baseAngleMax} onChange={(event) => updateOrientation("baseAngleMax", Number(event.currentTarget.value))} />
            </ConfigField>
          </div>
          <div className="form-grid form-grid--two">
            <ConfigField configKey="global.orientation.randomAngleAmplitude" label="Random Angle Amplitude">
              <SteppedValueSlider min={0} max={360} step={1} value={design.orientation.randomAngleAmplitude} onChange={(event) => updateOrientation("randomAngleAmplitude", Number(event.currentTarget.value))} />
            </ConfigField>
            <ConfigField configKey="global.orientation.randomAngleStep" label="Random Angle Step">
              <SteppedValueSlider min={0} max={360} step={1} value={design.orientation.randomAngleStep} onChange={(event) => updateOrientation("randomAngleStep", Number(event.currentTarget.value))} />
            </ConfigField>
          </div>
        </div>
        <div className="dialog-section">
          <h3 className="dialog-section__heading">Map Borders</h3>
          <div className="form-grid form-grid--three">
            <ConfigField configKey="global.border.cornerRadius" label="Corner Radius">
              <SteppedValueSlider min={0} max={64} step={1} value={design.border.cornerRadius} onChange={(event) => updateBorder("cornerRadius", Number(event.currentTarget.value))} />
            </ConfigField>
            <ConfigField configKey="global.border.obstaclesWidth" label="Obstacle Width">
              <SteppedValueSlider min={0} max={32} step={1} value={design.border.obstaclesWidth} onChange={(event) => updateBorder("obstaclesWidth", Number(event.currentTarget.value))} />
            </ConfigField>
            <ConfigField configKey="global.border.waterWidth" label="Water Width">
              <SteppedValueSlider min={0} max={32} step={1} value={design.border.waterWidth} onChange={(event) => updateBorder("waterWidth", Number(event.currentTarget.value))} />
            </ConfigField>
          </div>
          <div className="form-grid form-grid--three">
            <ConfigField configKey="global.border.waterType" label="Water Type">
              <Input value={design.border.waterType} onChange={(event) => updateBorder("waterType", event.currentTarget.value)} />
            </ConfigField>
          </div>
          <div className="form-grid form-grid--two">
            <ConfigField configKey="global.border.obstaclesNoise" label="Obstacle Noise">
              <NoiseEntryEditor
                entries={noiseDrafts.obstacles}
                onAdd={() => syncNoise("obstacles", [...noiseDrafts.obstacles, { amp: 0.2, freq: 1 }])}
                onRemove={(index) => syncNoise("obstacles", noiseDrafts.obstacles.filter((_entry, entryIndex) => entryIndex !== index))}
                onChange={(index, key, value) => updateNoiseEntry("obstacles", index, key, value)}
              />
            </ConfigField>
            <ConfigField configKey="global.border.waterNoise" label="Water Noise">
              <NoiseEntryEditor
                entries={noiseDrafts.water}
                onAdd={() => syncNoise("water", [...noiseDrafts.water, { amp: 0.2, freq: 1 }])}
                onRemove={(index) => syncNoise("water", noiseDrafts.water.filter((_entry, entryIndex) => entryIndex !== index))}
                onChange={(index, key, value) => updateNoiseEntry("water", index, key, value)}
              />
            </ConfigField>
          </div>
        </div>
        <div className="dialog-section">
          <h3 className="dialog-section__heading">Global Bans</h3>
          <div className="content-library-dialog__grid">
            <ConfigField configKey="template.globalBans.items" label="Banned Items">
              <StringListEditor
                values={globalBansDraft.items}
                emptyLabel="No banned items."
                addLabel="Add item"
                onAdd={() => setGlobalBansDraft((current) => ({ ...current, items: [...current.items, ""] }))}
                onRemove={(index) => setGlobalBansDraft((current) => ({ ...current, items: current.items.filter((_value, valueIndex) => valueIndex !== index) }))}
                onChange={(index, value) => setGlobalBansDraft((current) => ({
                  ...current,
                  items: current.items.map((entry, entryIndex) => entryIndex === index ? value : entry)
                }))}
              />
            </ConfigField>
            <ConfigField configKey="template.globalBans.heroes" label="Banned Heroes">
              <StringListEditor
                values={globalBansDraft.heroes}
                emptyLabel="No banned heroes."
                addLabel="Add hero"
                onAdd={() => setGlobalBansDraft((current) => ({ ...current, heroes: [...current.heroes, ""] }))}
                onRemove={(index) => setGlobalBansDraft((current) => ({ ...current, heroes: current.heroes.filter((_value, valueIndex) => valueIndex !== index) }))}
                onChange={(index, value) => setGlobalBansDraft((current) => ({
                  ...current,
                  heroes: current.heroes.map((entry, entryIndex) => entryIndex === index ? value : entry)
                }))}
              />
            </ConfigField>
            <ConfigField configKey="template.globalBans.magics" label="Banned Magics">
              <StringListEditor
                values={globalBansDraft.magics}
                emptyLabel="No banned magics."
                addLabel="Add magic"
                onAdd={() => setGlobalBansDraft((current) => ({ ...current, magics: [...current.magics, ""] }))}
                onRemove={(index) => setGlobalBansDraft((current) => ({ ...current, magics: current.magics.filter((_value, valueIndex) => valueIndex !== index) }))}
                onChange={(index, value) => setGlobalBansDraft((current) => ({
                  ...current,
                  magics: current.magics.map((entry, entryIndex) => entryIndex === index ? value : entry)
                }))}
              />
            </ConfigField>
          </div>
        </div>
        <div className="dialog-section">
          <h3 className="dialog-section__heading">JSON Overrides</h3>
          <div className="content-library-dialog__grid">
            <ConfigField configKey="template.valueOverrides" label="Value Overrides JSON">
              <RmgJsonEditor
                ariaLabel="Value Overrides JSON editor"
                className="rmg-json-editor--compact"
                value={valueOverridesDraft.value}
                onChange={(value) => setValueOverridesDraft({ value })}
              />
            </ConfigField>
          </div>
        </div>
        {valueOverridesDraft.error ? <Alert tone="danger">Value Overrides JSON: {valueOverridesDraft.error}</Alert> : null}
        <div className="dialog-actions">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="button" variant="blue" onClick={handleApply}>Apply</Button>
        </div>
    </>
  );
}

function parseValueOverridesDraft(value: string): ParsedValueOverridesDraft {
  const parsed = parseJsonInput<ValueOverride[]>(value);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error };
  }
  if (parsed.value === undefined) {
    return { ok: true, value: [] };
  }
  if (!Array.isArray(parsed.value) || parsed.value.some((entry) => !entry || typeof entry !== "object" || Array.isArray(entry))) {
    return { ok: false, error: "Use a JSON array of value override objects." };
  }
  return { ok: true, value: parsed.value };
}

function cloneNoiseEntries(entries: NoiseEntry[] | undefined): NoiseEntry[] {
  return (entries ?? []).map((entry) => ({
    amp: Number.isFinite(entry.amp) ? entry.amp : 0,
    freq: Number.isFinite(entry.freq) ? entry.freq : 0
  }));
}

function toGlobalBansDraft(globalBans: GlobalBans | undefined): GlobalBansDraftState {
  return {
    items: [...(globalBans?.items ?? [])],
    heroes: [...(globalBans?.heroes ?? [])],
    magics: [...(globalBans?.magics ?? [])]
  };
}

function fromGlobalBansDraft(draft: GlobalBansDraftState): GlobalBans {
  const items = sanitizeStringList(draft.items);
  const heroes = sanitizeStringList(draft.heroes);
  const magics = sanitizeStringList(draft.magics);
  return {
    ...(items.length > 0 ? { items } : {}),
    ...(heroes.length > 0 ? { heroes } : {}),
    ...(magics.length > 0 ? { magics } : {})
  };
}

function sanitizeStringList(values: string[]): string[] {
  return values.map((value) => value.trim()).filter(Boolean);
}

function StringListEditor({
  values,
  emptyLabel,
  addLabel,
  onAdd,
  onRemove,
  onChange
}: {
  values: string[];
  emptyLabel: string;
  addLabel: string;
  onAdd(): void;
  onRemove(index: number): void;
  onChange(index: number, value: string): void;
}): JSX.Element {
  return (
    <div className="structured-list-editor">
      {values.length === 0 ? <div className="structured-list-editor__empty">{emptyLabel}</div> : null}
      {values.map((value, index) => (
        <div key={`${addLabel}-${index}`} className="structured-list-editor__row">
          <Input value={value} onChange={(event) => onChange(index, event.currentTarget.value)} />
          <Button type="button" size="sm" variant="danger" onClick={() => onRemove(index)}>Remove</Button>
        </div>
      ))}
      <Button type="button" size="sm" variant="blue" onClick={onAdd}>{addLabel}</Button>
    </div>
  );
}

function NoiseEntryEditor({
  entries,
  onAdd,
  onRemove,
  onChange
}: {
  entries: NoiseEntry[];
  onAdd(): void;
  onRemove(index: number): void;
  onChange(index: number, key: keyof NoiseEntry, value: string): void;
}): JSX.Element {
  return (
    <div className="structured-list-editor">
      {entries.length === 0 ? <div className="structured-list-editor__empty">No noise entries.</div> : null}
      {entries.map((entry, index) => (
        <div key={`noise-${index}`} className="structured-list-editor__row structured-list-editor__row--numbers">
          <Input type="number" step="0.01" aria-label={`Noise amplitude ${index + 1}`} value={String(entry.amp)} onChange={(event) => onChange(index, "amp", event.currentTarget.value)} />
          <Input type="number" step="0.01" aria-label={`Noise frequency ${index + 1}`} value={String(entry.freq)} onChange={(event) => onChange(index, "freq", event.currentTarget.value)} />
          <Button type="button" size="sm" variant="danger" onClick={() => onRemove(index)}>Remove</Button>
        </div>
      ))}
      <Button type="button" size="sm" variant="blue" onClick={onAdd}>Add entry</Button>
    </div>
  );
}
