import { CirclePlus, Trash2 } from "lucide-react";
import { useEffect, useState, type JSX } from "react";
import type { DesignZone } from "@/design";
import type { MainObject, TypedSelector } from "@/types";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/form-controls";
import { Alert, CheckField, ConfigField, formatJsonInput, formatNumberInput, parseJsonInput, parseNumberInput } from "@/components/builder/formHelpers";

interface MainObjectJsonDraft {
  faction: string;
  factions: string;
  placementArgs: string;
  factionError?: string;
  factionsError?: string;
  placementArgsError?: string;
}

export function MainObjectsEditor({
  zone,
  onUpdate
}: {
  zone: DesignZone;
  onUpdate(mutator: (zone: DesignZone) => void): void;
}): JSX.Element {
  const [drafts, setDrafts] = useState<MainObjectJsonDraft[]>(() => buildDrafts(zone.customMainObjects));

  useEffect(() => {
    setDrafts(buildDrafts(zone.customMainObjects));
  }, [zone.id, zone.customMainObjects]);

  function updateMainObject(index: number, mutator: (mainObject: MainObject) => void): void {
    onUpdate((draftZone) => {
      const next = [...draftZone.customMainObjects];
      const mainObject = { ...(next[index] ?? defaultMainObjectForZone(draftZone)) };
      mutator(mainObject);
      next[index] = mainObject;
      draftZone.customMainObjects = next;
    });
  }

  function updateJsonField(index: number, field: "faction" | "factions" | "placementArgs", value: string): void {
    const parsed = parseJsonInput<unknown>(value);
    const parsedValue = parsed.ok ? parsed.value : undefined;
    let error: string | undefined;
    if (!parsed.ok) {
      error = parsed.error;
    } else if ((field === "faction" || field === "factions") && parsedValue !== undefined && !isPlainObject(parsedValue)) {
      error = "Use a JSON object selector.";
    } else if (field === "placementArgs" && parsedValue !== undefined && !Array.isArray(parsedValue)) {
      error = "Use a JSON array.";
    }

    setDrafts((current) => {
      const next = [...current];
      next[index] = {
        ...(next[index] ?? emptyDraft()),
        [field]: value,
        [`${field}Error`]: error
      };
      return next;
    });

    if (error) return;
    updateMainObject(index, (mainObject) => {
      if (field === "faction") mainObject.faction = parsedValue as TypedSelector | undefined;
      else if (field === "factions") mainObject.factions = parsedValue as TypedSelector | undefined;
      else mainObject.placementArgs = parsedValue as string[] | undefined;
    });
  }

  function removeMainObject(index: number): void {
    onUpdate((draftZone) => {
      draftZone.customMainObjects = draftZone.customMainObjects.filter((_, objectIndex) => objectIndex !== index);
    });
  }

  const enabled = zone.useCustomMainObjects;
  const mainObjects = zone.customMainObjects;

  return (
    <details className="raw-details main-objects-editor">
      <summary>Main Objects</summary>
      <div className="checks checks--vertical">
        <ConfigField configKey="zone.useCustomMainObjects" label="Custom Main Objects">
          <CheckField checked={enabled} onCheckedChange={(checked) => onUpdate((draft) => {
            draft.useCustomMainObjects = checked;
            if (checked && draft.customMainObjects.length === 0) {
              draft.customMainObjects = [defaultMainObjectForZone(draft)];
            }
          })}>Use custom main objects</CheckField>
        </ConfigField>
      </div>
      {enabled ? (
        <div className="main-objects-editor__body">
          <Button type="button" size="sm" variant="blue" onClick={() => onUpdate((draft) => {
            draft.customMainObjects = [...draft.customMainObjects, defaultMainObjectForZone(draft)];
          })}><CirclePlus size={14} />Add Main Object</Button>
          {mainObjects.length === 0 ? <div className="empty-state">No custom main objects.</div> : mainObjects.map((mainObject, index) => {
            const draft = drafts[index] ?? emptyDraft();
            return (
              <article className="main-object-row" key={index}>
                <div className="main-object-row__title">
                  <strong>Main Object {index + 1}</strong>
                  <Button type="button" size="sm" variant="danger" onClick={() => removeMainObject(index)}><Trash2 size={14} />Delete</Button>
                </div>
                <div className="form-grid form-grid--three">
                  <ConfigField configKey="zone.mainObjects.type" label="Type">
                    <Input value={mainObject.type} onChange={(event) => {
                      const value = event.currentTarget.value;
                      updateMainObject(index, (draft) => { draft.type = value; });
                    }} />
                  </ConfigField>
                  <ConfigField configKey="zone.mainObjects.spawn" label="Spawn">
                    <Input value={mainObject.spawn ?? ""} onChange={(event) => {
                      const value = event.currentTarget.value.trim();
                      updateMainObject(index, (draft) => { draft.spawn = value || undefined; });
                    }} />
                  </ConfigField>
                  <ConfigField configKey="zone.mainObjects.owner" label="Owner">
                    <Input value={formatOwner(mainObject.owner)} onChange={(event) => {
                      const value = event.currentTarget.value.trim();
                      updateMainObject(index, (draft) => { draft.owner = parseOwner(value); });
                    }} />
                  </ConfigField>
                </div>
                <div className="form-grid form-grid--three">
                  <NumberInput label="Guard Chance" value={mainObject.guardChance} onChange={(value) => updateMainObject(index, (draft) => { draft.guardChance = value; })} />
                  <NumberInput label="Guard Value" value={mainObject.guardValue} onChange={(value) => updateMainObject(index, (draft) => { draft.guardValue = value; })} />
                  <NumberInput label="Guard Randomization" value={mainObject.guardRandomization} onChange={(value) => updateMainObject(index, (draft) => { draft.guardRandomization = value; })} />
                </div>
                <div className="form-grid form-grid--three">
                  <NumberInput label="Guard Weekly Increment" value={mainObject.guardWeeklyIncrement} onChange={(value) => updateMainObject(index, (draft) => { draft.guardWeeklyIncrement = value; })} />
                  <NumberInput label="Initial Unit Increment" value={mainObject.initialUnitIncrement} onChange={(value) => updateMainObject(index, (draft) => { draft.initialUnitIncrement = value; })} />
                  <ConfigField configKey="zone.mainObjects.buildingsConstructionSid" label="Buildings Construction SID">
                    <Input value={mainObject.buildingsConstructionSid ?? ""} onChange={(event) => {
                      const value = event.currentTarget.value.trim();
                      updateMainObject(index, (draft) => { draft.buildingsConstructionSid = value || undefined; });
                    }} />
                  </ConfigField>
                </div>
                <div className="form-grid form-grid--three">
                  <ConfigField configKey="zone.mainObjects.placement" label="Placement">
                    <Input value={mainObject.placement ?? ""} onChange={(event) => {
                      const value = event.currentTarget.value.trim();
                      updateMainObject(index, (draft) => { draft.placement = value || undefined; });
                    }} />
                  </ConfigField>
                  <ConfigField configKey="zone.mainObjects.faction" label="Faction Selector JSON">
                    <Textarea className="code" rows={5} value={draft.faction} aria-invalid={draft.factionError ? true : undefined} onChange={(event) => updateJsonField(index, "faction", event.currentTarget.value)} />
                  </ConfigField>
                  <ConfigField configKey="zone.mainObjects.factions" label="Factions Selector JSON">
                    <Textarea className="code" rows={5} value={draft.factions} aria-invalid={draft.factionsError ? true : undefined} onChange={(event) => updateJsonField(index, "factions", event.currentTarget.value)} />
                  </ConfigField>
                </div>
                <ConfigField configKey="zone.mainObjects.placementArgs" label="Placement Args JSON">
                  <Textarea className="code" rows={3} value={draft.placementArgs} aria-invalid={draft.placementArgsError ? true : undefined} onChange={(event) => updateJsonField(index, "placementArgs", event.currentTarget.value)} />
                </ConfigField>
                <div className="checks checks--vertical">
                  <CheckField checked={mainObject.removeGuardIfHasOwner === true} onCheckedChange={(checked) => updateMainObject(index, (draft) => { draft.removeGuardIfHasOwner = checked; })}>Remove guard if has owner</CheckField>
                  <CheckField checked={mainObject.holdCityWinCon === true} onCheckedChange={(checked) => updateMainObject(index, (draft) => { draft.holdCityWinCon = checked; })}>Hold City win condition</CheckField>
                  <CheckField checked={mainObject.enableWeeklyUnitIncrement === true} onCheckedChange={(checked) => updateMainObject(index, (draft) => { draft.enableWeeklyUnitIncrement = checked; })}>Enable weekly unit increment</CheckField>
                  <CheckField checked={mainObject.isKeyObject === true} onCheckedChange={(checked) => updateMainObject(index, (draft) => { draft.isKeyObject = checked; })}>Is key object</CheckField>
                </div>
                {draft.factionError ? <Alert tone="danger">Faction Selector JSON: {draft.factionError}</Alert> : null}
                {draft.factionsError ? <Alert tone="danger">Factions Selector JSON: {draft.factionsError}</Alert> : null}
                {draft.placementArgsError ? <Alert tone="danger">Placement Args JSON: {draft.placementArgsError}</Alert> : null}
              </article>
            );
          })}
        </div>
      ) : null}
    </details>
  );
}

function NumberInput({ label, value, onChange }: { label: string; value: number | undefined; onChange(value: number | undefined): void }): JSX.Element {
  return (
    <ConfigField configKey={`zone.mainObjects.${label}`} label={label}>
      <Input type="number" step="0.01" value={formatNumberInput(value)} onChange={(event) => onChange(parseNumberInput(event.currentTarget.value))} />
    </ConfigField>
  );
}

function buildDrafts(mainObjects: MainObject[]): MainObjectJsonDraft[] {
  return mainObjects.map((mainObject) => ({
    faction: formatJsonInput(mainObject.faction),
    factions: formatJsonInput(mainObject.factions),
    placementArgs: formatJsonInput(mainObject.placementArgs)
  }));
}

function emptyDraft(): MainObjectJsonDraft {
  return { faction: "", factions: "", placementArgs: "" };
}

function defaultMainObjectForZone(zone: DesignZone): MainObject {
  if (zone.role === "Spawn") {
    return {
      type: "Spawn",
      spawn: `Player${zone.player ?? 1}`,
      removeGuardIfHasOwner: true,
      guardChance: 1,
      placement: "Uniform",
      placementArgs: ["true", "0.7", "0"]
    };
  }
  return {
    type: zone.neutralCastlesAsRuins ? "Ruins" : "City",
    guardChance: 1,
    faction: { type: "FromList", args: [] },
    placement: zone.holdCity ? "Center" : "Uniform",
    placementArgs: zone.holdCity ? [] : ["true", "0.8", "2"],
    holdCityWinCon: zone.holdCity ? true : undefined
  };
}

function parseOwner(value: string): number | string | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && String(parsed) === value ? parsed : value;
}

function formatOwner(value: number | string | undefined): string {
  return value === undefined ? "" : String(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
