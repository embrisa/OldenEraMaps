import { useEffect, useState, type JSX } from "react";
import type { TemplateDesign } from "@/design";
import type { GlobalBans, NoiseEntry, ValueOverride } from "@/types";
import { Button } from "@/components/ui/button";
import { Input, SteppedValueSlider, Textarea } from "@/components/ui/form-controls";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/radix";
import { Alert, ConfigField, formatJsonInput, parseJsonInput } from "@/components/builder/formHelpers";

interface JsonDraft {
  value: string;
  error?: string;
}

interface NoiseDraftState {
  obstacles: string;
  water: string;
  obstaclesError?: string;
  waterError?: string;
}

type ParsedValueOverridesDraft =
  | { ok: true; value: ValueOverride[] }
  | { ok: false; error: string };

type ParsedGlobalBansDraft =
  | { ok: true; value: GlobalBans }
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
  const [valueOverridesDraft, setValueOverridesDraft] = useState<JsonDraft>({ value: "[]" });
  const [globalBansDraft, setGlobalBansDraft] = useState<JsonDraft>({ value: "{}" });
  const [noiseDrafts, setNoiseDrafts] = useState<NoiseDraftState>(() => ({
    obstacles: formatJsonInput(design.border.obstaclesNoise),
    water: formatJsonInput(design.border.waterNoise)
  }));

  useEffect(() => {
    if (!open) return;
    setValueOverridesDraft({ value: formatJsonInput(design.valueOverrides) });
    setGlobalBansDraft({ value: formatJsonInput(design.globalBans) });
    setNoiseDrafts({
      obstacles: formatJsonInput(design.border.obstaclesNoise),
      water: formatJsonInput(design.border.waterNoise)
    });
  }, [design.globalBans, design.valueOverrides, design.border.obstaclesNoise, design.border.waterNoise, open]);

  function updateOrientation<K extends keyof TemplateDesign["orientation"]>(key: K, value: TemplateDesign["orientation"][K]): void {
    onGlobal("orientation", { ...design.orientation, [key]: value });
  }

  function updateBorder<K extends keyof TemplateDesign["border"]>(key: K, value: TemplateDesign["border"][K]): void {
    onGlobal("border", { ...design.border, [key]: value });
  }

  function updateNoise(field: "obstacles" | "water", value: string): void {
    const parsed = parseJsonInput<unknown>(value);
    const error = parsed.ok ? validateNoiseEntries(parsed.value) : parsed.error;
    setNoiseDrafts((current) => ({
      ...current,
      [field]: value,
      [`${field}Error`]: error
    }));
    if (error) return;
    updateBorder(field === "obstacles" ? "obstaclesNoise" : "waterNoise", parsed.ok && parsed.value !== undefined ? parsed.value as NoiseEntry[] : []);
  }

  function handleApply(): void {
    const parsedValueOverrides = parseValueOverridesDraft(valueOverridesDraft.value);
    const parsedGlobalBans = parseGlobalBansDraft(globalBansDraft.value);

    setValueOverridesDraft({ value: valueOverridesDraft.value, error: parsedValueOverrides.ok ? undefined : parsedValueOverrides.error });
    setGlobalBansDraft({ value: globalBansDraft.value, error: parsedGlobalBans.ok ? undefined : parsedGlobalBans.error });

    if (!parsedValueOverrides.ok || !parsedGlobalBans.ok) return;

    onUpdate((draft) => {
      draft.valueOverrides = parsedValueOverrides.value;
      draft.globalBans = parsedGlobalBans.value;
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="content-limits-dialog content-library-dialog">
        <div className="dialog-heading">
          <div>
            <DialogTitle>Expert Settings</DialogTitle>
            <DialogDescription>Map geometry, orientation, and raw JSON overrides.</DialogDescription>
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
            <ConfigField configKey="global.border.obstaclesNoise" label="Obstacle Noise (JSON)">
              <Textarea rows={5} value={noiseDrafts.obstacles} onChange={(event) => updateNoise("obstacles", event.currentTarget.value)} />
            </ConfigField>
            <ConfigField configKey="global.border.waterNoise" label="Water Noise (JSON)">
              <Textarea rows={5} value={noiseDrafts.water} onChange={(event) => updateNoise("water", event.currentTarget.value)} />
            </ConfigField>
          </div>
          {noiseDrafts.obstaclesError ? <Alert tone="danger">Obstacle Noise: {noiseDrafts.obstaclesError}</Alert> : null}
          {noiseDrafts.waterError ? <Alert tone="danger">Water Noise: {noiseDrafts.waterError}</Alert> : null}
        </div>
        <div className="dialog-section">
          <h3 className="dialog-section__heading">JSON Overrides</h3>
          <div className="content-library-dialog__grid">
            <ConfigField configKey="template.valueOverrides" label="Value Overrides JSON">
              <Textarea
                className="code"
                rows={18}
                aria-invalid={valueOverridesDraft.error ? true : undefined}
                value={valueOverridesDraft.value}
                onChange={(event) => setValueOverridesDraft({ value: event.currentTarget.value })}
              />
            </ConfigField>
            <ConfigField configKey="template.globalBans" label="Global Bans JSON">
              <Textarea
                className="code"
                rows={18}
                aria-invalid={globalBansDraft.error ? true : undefined}
                value={globalBansDraft.value}
                onChange={(event) => setGlobalBansDraft({ value: event.currentTarget.value })}
              />
            </ConfigField>
          </div>
        </div>
        {valueOverridesDraft.error ? <Alert tone="danger">Value Overrides JSON: {valueOverridesDraft.error}</Alert> : null}
        {globalBansDraft.error ? <Alert tone="danger">Global Bans JSON: {globalBansDraft.error}</Alert> : null}
        <div className="dialog-actions">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" variant="blue" onClick={handleApply}>Apply</Button>
        </div>
      </DialogContent>
    </Dialog>
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

function parseGlobalBansDraft(value: string): ParsedGlobalBansDraft {
  const parsed = parseJsonInput<GlobalBans>(value);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error };
  }
  if (parsed.value === undefined) {
    return { ok: true, value: {} };
  }
  if (!parsed.value || typeof parsed.value !== "object" || Array.isArray(parsed.value)) {
    return { ok: false, error: "Use a JSON object with optional items, heroes, and magics arrays." };
  }
  return { ok: true, value: parsed.value };
}

function validateNoiseEntries(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return "Use a JSON array of noise objects.";
  return value.every((entry) => (
    entry
    && typeof entry === "object"
    && typeof (entry as NoiseEntry).amp === "number"
    && Number.isFinite((entry as NoiseEntry).amp)
    && typeof (entry as NoiseEntry).freq === "number"
    && Number.isFinite((entry as NoiseEntry).freq)
  )) ? undefined : "Every entry needs numeric amp and freq values.";
}