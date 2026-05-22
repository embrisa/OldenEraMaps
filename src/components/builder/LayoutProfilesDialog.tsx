import { CirclePlus, Trash2 } from "lucide-react";
import { useEffect, useState, type JSX } from "react";
import type { TemplateDesign } from "@/design";
import type { AmbientPickupDistribution, ElevationMode, GuardedEncounterResourceFractions, ZoneLayout } from "@/types";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/form-controls";
import { Dialog, DialogContent, DialogDescription, DialogTitle, ScrollArea } from "@/components/ui/radix";
import { Alert, ConfigField, formatJsonInput, formatNumberInput, parseJsonInput, parseNumberInput } from "@/components/builder/formHelpers";

interface JsonDraft {
  value: string;
  error?: string;
}

export function LayoutProfilesDialog({
  open,
  onOpenChange,
  design,
  onUpdate
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  design: TemplateDesign;
  onUpdate(mutator: (design: TemplateDesign) => void): void;
}): JSX.Element {
  const [selectedProfileIndex, setSelectedProfileIndex] = useState(0);
  const [elevationDrafts, setElevationDrafts] = useState<Record<number, JsonDraft>>({});
  const [guardedFractionsDrafts, setGuardedFractionsDrafts] = useState<Record<number, JsonDraft>>({});
  const [ambientDrafts, setAmbientDrafts] = useState<Record<number, JsonDraft>>({});
  const selectedProfile = design.zoneLayouts[selectedProfileIndex] ?? design.zoneLayouts[0];
  const selectedIndex = selectedProfile ? design.zoneLayouts.indexOf(selectedProfile) : -1;

  useEffect(() => {
    if (!open) return;
    setSelectedProfileIndex(0);
    setElevationDrafts({});
    setGuardedFractionsDrafts({});
    setAmbientDrafts({});
  }, [open]);

  useEffect(() => {
    if (selectedProfileIndex < design.zoneLayouts.length) return;
    setSelectedProfileIndex(Math.max(0, design.zoneLayouts.length - 1));
  }, [design.zoneLayouts.length, selectedProfileIndex]);

  function addProfile(): void {
    onUpdate((draft) => {
      draft.zoneLayouts.push(createLayoutProfile(uniqueProfileName(draft.zoneLayouts)));
      setSelectedProfileIndex(draft.zoneLayouts.length - 1);
    });
  }

  function deleteProfile(profileIndex: number): void {
    onUpdate((draft) => {
      if (draft.zoneLayouts.length <= 1) return;
      const fallbackName = draft.zoneLayouts.find((_profile, index) => index !== profileIndex)?.name;
      const [removed] = draft.zoneLayouts.splice(profileIndex, 1);
      if (!removed || !fallbackName) return;
      for (const zone of draft.zones) {
        if (zone.layout === removed.name) {
          zone.layout = fallbackName;
        }
      }
      setSelectedProfileIndex(Math.max(0, Math.min(profileIndex, draft.zoneLayouts.length - 1)));
    });
  }

  function updateProfileName(profileIndex: number, value: string): void {
    onUpdate((draft) => {
      const profile = draft.zoneLayouts[profileIndex];
      if (!profile) return;
      const previousName = profile.name;
      profile.name = value;
      if (!value.trim()) return;
      for (const zone of draft.zones) {
        if (zone.layout === previousName) {
          zone.layout = value;
        }
      }
    });
  }

  function updateProfile(profileIndex: number, mutator: (profile: ZoneLayout) => void): void {
    onUpdate((draft) => {
      const profile = draft.zoneLayouts[profileIndex];
      if (!profile) return;
      mutator(profile);
    });
  }

  function updateElevationModes(profileIndex: number, value: string): void {
    const parsed = parseJsonInput<ElevationMode[]>(value);
    let error: string | undefined;
    let parsedValue: ElevationMode[] | undefined;
    if (!parsed.ok) {
      error = parsed.error;
    } else if (parsed.value !== undefined && !Array.isArray(parsed.value)) {
      error = "Use a JSON array of elevation mode objects.";
    } else {
      parsedValue = parsed.value;
    }

    setElevationDrafts((current) => ({ ...current, [profileIndex]: { value, error } }));
    if (error) return;

    updateProfile(profileIndex, (profile) => {
      profile.elevationModes = parsedValue;
    });
  }

  function updateGuardedFractions(profileIndex: number, value: string): void {
    const parsed = parseJsonInput<GuardedEncounterResourceFractions>(value);
    let error: string | undefined;
    let parsedValue: GuardedEncounterResourceFractions | undefined;
    if (!parsed.ok) {
      error = parsed.error;
    } else if (parsed.value !== undefined && Array.isArray(parsed.value)) {
      error = "Use a JSON object for guarded encounter fractions.";
    } else {
      parsedValue = parsed.value;
    }

    setGuardedFractionsDrafts((current) => ({ ...current, [profileIndex]: { value, error } }));
    if (error) return;

    updateProfile(profileIndex, (profile) => {
      profile.guardedEncounterResourceFractions = parsedValue;
    });
  }

  function updateAmbientDistribution(profileIndex: number, value: string): void {
    const parsed = parseJsonInput<AmbientPickupDistribution>(value);
    let error: string | undefined;
    let parsedValue: AmbientPickupDistribution | undefined;
    if (!parsed.ok) {
      error = parsed.error;
    } else if (parsed.value !== undefined && Array.isArray(parsed.value)) {
      error = "Use a JSON object for ambient pickup distribution.";
    } else {
      parsedValue = parsed.value;
    }

    setAmbientDrafts((current) => ({ ...current, [profileIndex]: { value, error } }));
    if (error) return;

    updateProfile(profileIndex, (profile) => {
      profile.ambientPickupDistribution = parsedValue;
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="content-limits-dialog">
        <div className="dialog-heading">
          <div>
            <DialogTitle>Layout Profiles</DialogTitle>
            <DialogDescription>Edit the named top-level zoneLayouts blocks referenced by zones.</DialogDescription>
          </div>
          <Button type="button" variant="gold" onClick={addProfile}><CirclePlus size={16} />Add Profile</Button>
        </div>
        <ScrollArea className="content-limits-dialog__scroll">
          {design.zoneLayouts.length === 0 ? <div className="empty-state">No layout profiles yet.</div> : null}
          {design.zoneLayouts.length > 0 ? (
            <div className="content-limits-dialog__layout">
              <nav className="content-limit-list" aria-label="Layout profiles">
                {design.zoneLayouts.map((profile, profileIndex) => (
                  <button
                    key={`${profile.name}-${profileIndex}`}
                    type="button"
                    className="content-limit-list__item"
                    data-selected={profileIndex === selectedIndex ? "true" : undefined}
                    onClick={() => setSelectedProfileIndex(profileIndex)}
                  >
                    <span>{profile.name}</span>
                    <small>{profile.elevationModes?.length ?? 0} elevation modes</small>
                  </button>
                ))}
              </nav>
              {selectedProfile && selectedIndex >= 0 ? (
                <article key={`${selectedProfile.name}-${selectedIndex}`} className="content-limit-group">
                  <div className="connection-title">
                    <ConfigField configKey="zoneLayout.name" label="Layout Name">
                      <Input value={selectedProfile.name} onChange={(event) => updateProfileName(selectedIndex, event.currentTarget.value)} />
                    </ConfigField>
                    <Button type="button" size="sm" variant="danger" disabled={design.zoneLayouts.length <= 1} onClick={() => deleteProfile(selectedIndex)}><Trash2 size={14} />Delete</Button>
                  </div>
                  <div className="form-grid form-grid--two">
                    <ConfigField configKey="zoneLayout.obstaclesFill" label="Obstacles Fill">
                      <Input type="number" step="0.01" value={formatNumberInput(selectedProfile.obstaclesFill)} onChange={(event) => updateProfile(selectedIndex, (profile) => { profile.obstaclesFill = parseNumberInput(event.currentTarget.value); })} />
                    </ConfigField>
                    <ConfigField configKey="zoneLayout.obstaclesFillVoid" label="Obstacles Fill Void">
                      <Input type="number" step="0.01" value={formatNumberInput(selectedProfile.obstaclesFillVoid)} onChange={(event) => updateProfile(selectedIndex, (profile) => { profile.obstaclesFillVoid = parseNumberInput(event.currentTarget.value); })} />
                    </ConfigField>
                  </div>
                  <div className="form-grid form-grid--two">
                    <ConfigField configKey="zoneLayout.lakesFill" label="Lakes Fill">
                      <Input type="number" step="0.01" value={formatNumberInput(selectedProfile.lakesFill)} onChange={(event) => updateProfile(selectedIndex, (profile) => { profile.lakesFill = parseNumberInput(event.currentTarget.value); })} />
                    </ConfigField>
                    <ConfigField configKey="zoneLayout.minLakeArea" label="Min Lake Area">
                      <Input type="number" step="1" value={formatNumberInput(selectedProfile.minLakeArea)} onChange={(event) => updateProfile(selectedIndex, (profile) => { profile.minLakeArea = parseNumberInput(event.currentTarget.value); })} />
                    </ConfigField>
                  </div>
                  <div className="form-grid form-grid--two">
                    <ConfigField configKey="zoneLayout.elevationClusterScale" label="Elevation Cluster Scale">
                      <Input type="number" step="0.001" value={formatNumberInput(selectedProfile.elevationClusterScale)} onChange={(event) => updateProfile(selectedIndex, (profile) => { profile.elevationClusterScale = parseNumberInput(event.currentTarget.value); })} />
                    </ConfigField>
                    <ConfigField configKey="zoneLayout.roadClusterArea" label="Road Cluster Area">
                      <Input type="number" step="1" value={formatNumberInput(selectedProfile.roadClusterArea)} onChange={(event) => updateProfile(selectedIndex, (profile) => { profile.roadClusterArea = parseNumberInput(event.currentTarget.value); })} />
                    </ConfigField>
                  </div>
                  <ConfigField configKey="zoneLayout.elevationModes" label="Elevation Modes JSON">
                    <Textarea rows={6} className="code" value={elevationDrafts[selectedIndex]?.value ?? formatJsonInput(selectedProfile.elevationModes)} onChange={(event) => updateElevationModes(selectedIndex, event.currentTarget.value)} />
                  </ConfigField>
                  {elevationDrafts[selectedIndex]?.error ? <Alert tone="danger">Elevation Modes JSON: {elevationDrafts[selectedIndex]?.error}</Alert> : null}
                  <ConfigField configKey="zoneLayout.guardedEncounterResourceFractions" label="Guarded Encounter Fractions JSON">
                    <Textarea rows={5} className="code" value={guardedFractionsDrafts[selectedIndex]?.value ?? formatJsonInput(selectedProfile.guardedEncounterResourceFractions)} onChange={(event) => updateGuardedFractions(selectedIndex, event.currentTarget.value)} />
                  </ConfigField>
                  {guardedFractionsDrafts[selectedIndex]?.error ? <Alert tone="danger">Guarded Encounter Fractions JSON: {guardedFractionsDrafts[selectedIndex]?.error}</Alert> : null}
                  <ConfigField configKey="zoneLayout.ambientPickupDistribution" label="Ambient Pickup Distribution JSON">
                    <Textarea rows={6} className="code" value={ambientDrafts[selectedIndex]?.value ?? formatJsonInput(selectedProfile.ambientPickupDistribution)} onChange={(event) => updateAmbientDistribution(selectedIndex, event.currentTarget.value)} />
                  </ConfigField>
                  {ambientDrafts[selectedIndex]?.error ? <Alert tone="danger">Ambient Pickup Distribution JSON: {ambientDrafts[selectedIndex]?.error}</Alert> : null}
                </article>
              ) : null}
            </div>
          ) : null}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function createLayoutProfile(name: string): ZoneLayout {
  return {
    name,
    obstaclesFill: 0.24,
    obstaclesFillVoid: 0.48,
    lakesFill: 0.3,
    minLakeArea: 16,
    elevationClusterScale: 0.16,
    elevationModes: [{ weight: 2, minElevatedFraction: 0.2, maxElevatedFraction: 0.4 }],
    roadClusterArea: 160,
    guardedEncounterResourceFractions: { countBounds: [], fractions: [0.66] },
    ambientPickupDistribution: { repulsion: 1, noise: 0.4, roadAttraction: -0.3, obstacleAttraction: 0, groupSizeWeights: [20, 2, 1] }
  };
}

function uniqueProfileName(layouts: ZoneLayout[]): string {
  const names = new Set(layouts.map((layout) => layout.name));
  for (let index = 1; ; index++) {
    const candidate = `zone_layout_custom_${index}`;
    if (!names.has(candidate)) return candidate;
  }
}