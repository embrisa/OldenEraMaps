import { CirclePlus, Trash2 } from "lucide-react";
import { useEffect, useState, type JSX } from "react";
import type { DesignZone } from "@/design";
import type { MainObject, TypedSelector } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form-controls";
import { RmgJsonEditor } from "@/components/builder/RmgJsonEditor";
import { Alert, CheckField, ConfigField, currentJsonDraft, formatJsonInput, formatNumberInput, jsonDraftBase, parseJsonInput, parseNumberInput, removeIndexedDrafts, type JsonTextDraft } from "@/components/builder/formHelpers";

type MainObjectJsonField = "faction" | "factions" | "placementArgs";
type MainObjectTextField = "spawn" | "buildingsConstructionSid" | "placement";

export function MainObjectsEditor({
  zone,
  onUpdate
}: {
  zone: DesignZone;
  onUpdate(mutator: (zone: DesignZone) => void): void;
}): JSX.Element {
  // JSON text drafts keyed "index:field". Only a zone switch resets them: every zone edit re-clones
  // customMainObjects, and stale drafts (undo, import) are ignored via their base value.
  const [drafts, setDrafts] = useState<Record<string, JsonTextDraft>>({});

  useEffect(() => {
    setDrafts({});
  }, [zone.id]);

  function jsonDraftFor(index: number, field: MainObjectJsonField, mainObject: MainObject): { value: string; error?: string } {
    return currentJsonDraft(drafts[`${index}:${field}`], mainObject[field]) ?? { value: formatJsonInput(mainObject[field]) };
  }

  function updateMainObject(index: number, mutator: (mainObject: MainObject) => void): void {
    onUpdate((draftZone) => {
      const next = [...draftZone.customMainObjects];
      const mainObject = { ...(next[index] ?? defaultMainObjectForZone(draftZone)) };
      mutator(mainObject);
      next[index] = mainObject;
      draftZone.customMainObjects = next;
    });
  }

  function updateJsonField(index: number, field: MainObjectJsonField, value: string): void {
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

    const base = jsonDraftBase(error ? zone.customMainObjects[index]?.[field] : parsedValue);
    setDrafts((current) => ({ ...current, [`${index}:${field}`]: { value, error, base } }));

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
    setDrafts((current) => removeIndexedDrafts(current, [], index));
  }

  // Text fields keep what is typed (including spaces) and are trimmed once the field is left.
  function updateTextField(index: number, field: MainObjectTextField, value: string): void {
    updateMainObject(index, (draft) => { draft[field] = value.trim() ? value : undefined; });
  }

  function trimTextField(index: number, field: MainObjectTextField, value: string): void {
    if (value === value.trim()) return;
    updateMainObject(index, (draft) => { draft[field] = value.trim() || undefined; });
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
            const factionDraft = jsonDraftFor(index, "faction", mainObject);
            const factionsDraft = jsonDraftFor(index, "factions", mainObject);
            const placementArgsDraft = jsonDraftFor(index, "placementArgs", mainObject);
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
                    <Input
                      value={mainObject.spawn ?? ""}
                      onChange={(event) => updateTextField(index, "spawn", event.currentTarget.value)}
                      onBlur={(event) => trimTextField(index, "spawn", event.currentTarget.value)}
                    />
                  </ConfigField>
                  <ConfigField configKey="zone.mainObjects.owner" label="Owner">
                    <Input
                      value={formatOwner(mainObject.owner)}
                      onChange={(event) => {
                        const value = event.currentTarget.value;
                        updateMainObject(index, (draft) => { draft.owner = parseOwner(value); });
                      }}
                      onBlur={(event) => {
                        const value = event.currentTarget.value;
                        if (value === value.trim()) return;
                        updateMainObject(index, (draft) => { draft.owner = parseOwner(value.trim()); });
                      }}
                    />
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
                    <Input
                      value={mainObject.buildingsConstructionSid ?? ""}
                      onChange={(event) => updateTextField(index, "buildingsConstructionSid", event.currentTarget.value)}
                      onBlur={(event) => trimTextField(index, "buildingsConstructionSid", event.currentTarget.value)}
                    />
                  </ConfigField>
                </div>
                <div className="form-grid form-grid--three">
                  <ConfigField configKey="zone.mainObjects.placement" label="Placement">
                    <Input
                      value={mainObject.placement ?? ""}
                      onChange={(event) => updateTextField(index, "placement", event.currentTarget.value)}
                      onBlur={(event) => trimTextField(index, "placement", event.currentTarget.value)}
                    />
                  </ConfigField>
                  <ConfigField configKey="zone.mainObjects.faction" label="Faction Selector JSON">
                    <RmgJsonEditor
                      ariaLabel={`Faction Selector JSON editor for main object ${index + 1}`}
                      className="rmg-json-editor--mini"
                      value={factionDraft.value}
                      onChange={(value) => updateJsonField(index, "faction", value)}
                    />
                  </ConfigField>
                  <ConfigField configKey="zone.mainObjects.factions" label="Factions Selector JSON">
                    <RmgJsonEditor
                      ariaLabel={`Factions Selector JSON editor for main object ${index + 1}`}
                      className="rmg-json-editor--mini"
                      value={factionsDraft.value}
                      onChange={(value) => updateJsonField(index, "factions", value)}
                    />
                  </ConfigField>
                </div>
                <ConfigField configKey="zone.mainObjects.placementArgs" label="Placement Args JSON">
                  <RmgJsonEditor
                    ariaLabel={`Placement Args JSON editor for main object ${index + 1}`}
                    className="rmg-json-editor--mini"
                    value={placementArgsDraft.value}
                    onChange={(value) => updateJsonField(index, "placementArgs", value)}
                  />
                </ConfigField>
                <div className="checks checks--vertical">
                  <CheckField checked={mainObject.removeGuardIfHasOwner === true} onCheckedChange={(checked) => updateMainObject(index, (draft) => { draft.removeGuardIfHasOwner = checked; })}>Remove guard if has owner</CheckField>
                  <CheckField checked={mainObject.holdCityWinCon === true} onCheckedChange={(checked) => updateMainObject(index, (draft) => { draft.holdCityWinCon = checked; })}>Hold City win condition</CheckField>
                  <CheckField checked={mainObject.enableWeeklyUnitIncrement === true} onCheckedChange={(checked) => updateMainObject(index, (draft) => { draft.enableWeeklyUnitIncrement = checked; })}>Enable weekly unit increment</CheckField>
                  <CheckField checked={mainObject.isKeyObject === true} onCheckedChange={(checked) => updateMainObject(index, (draft) => { draft.isKeyObject = checked; })}>Is key object</CheckField>
                </div>
                {factionDraft.error ? <Alert tone="danger">Faction Selector JSON: {factionDraft.error}</Alert> : null}
                {factionsDraft.error ? <Alert tone="danger">Factions Selector JSON: {factionsDraft.error}</Alert> : null}
                {placementArgsDraft.error ? <Alert tone="danger">Placement Args JSON: {placementArgsDraft.error}</Alert> : null}
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
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && String(parsed) === value ? parsed : value;
}

function formatOwner(value: number | string | undefined): string {
  return value === undefined ? "" : String(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
