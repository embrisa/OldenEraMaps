import { CirclePlus, Trash2 } from "lucide-react";
import { useEffect, useState, type JSX } from "react";
import { getDesignMandatoryContentGroups, type TemplateDesign } from "@/design";
import type { ContentItem, ContentPlacementRule, MandatoryContentGroup } from "@/types";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/form-controls";
import { Checkbox, Dialog, DialogContent, DialogDescription, DialogTitle, ScrollArea } from "@/components/ui/radix";
import { Alert, CheckField, ConfigField, formatJsonInput, formatLineList, formatNumberInput, parseJsonInput, parseLineList, parseNumberInput } from "@/components/builder/formHelpers";

export function MandatoryContentDialog({
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
  const groups = getDesignMandatoryContentGroups(design);
  const [jsonDrafts, setJsonDrafts] = useState<Record<string, { value: string; error?: string }>>({});
  const [selectedGroupIndex, setSelectedGroupIndex] = useState(0);
  const selectedGroup = groups[selectedGroupIndex] ?? groups[0];
  const selectedIndex = selectedGroup ? groups.indexOf(selectedGroup) : -1;

  useEffect(() => {
    if (!open) return;
    setJsonDrafts({});
    setSelectedGroupIndex(0);
  }, [open]);

  useEffect(() => {
    if (selectedGroupIndex < groups.length) return;
    setSelectedGroupIndex(Math.max(0, groups.length - 1));
  }, [groups.length, selectedGroupIndex]);

  function materialize(draft: TemplateDesign): void {
    if (draft.useCustomMandatoryContent) return;
    draft.mandatoryContent = getDesignMandatoryContentGroups(draft);
    draft.useCustomMandatoryContent = true;
  }

  function addGroup(): void {
    onUpdate((draft) => {
      materialize(draft);
      draft.mandatoryContent.push({ name: uniqueGroupName(draft.mandatoryContent), content: [] });
      setSelectedGroupIndex(draft.mandatoryContent.length - 1);
    });
  }

  function deleteGroup(groupIndex: number): void {
    onUpdate((draft) => {
      materialize(draft);
      const [removed] = draft.mandatoryContent.splice(groupIndex, 1);
      if (!removed) return;
      for (const zone of draft.zones) {
        zone.mandatoryContent = zone.mandatoryContent.filter((name) => name !== removed.name);
      }
      setSelectedGroupIndex(Math.max(0, Math.min(groupIndex, draft.mandatoryContent.length - 1)));
    });
  }

  function updateGroupName(groupIndex: number, value: string): void {
    onUpdate((draft) => {
      materialize(draft);
      const group = draft.mandatoryContent[groupIndex];
      if (!group) return;
      const previousName = group.name;
      group.name = value;
      if (!value.trim()) return;
      for (const zone of draft.zones) {
        zone.mandatoryContent = zone.mandatoryContent.map((name) => name === previousName ? value : name);
      }
    });
  }

  function updateGroup(groupIndex: number, mutator: (group: MandatoryContentGroup) => void): void {
    onUpdate((draft) => {
      materialize(draft);
      const group = draft.mandatoryContent[groupIndex];
      if (!group) return;
      mutator(group);
    });
  }

  function updateItem(groupIndex: number, itemIndex: number, mutator: (item: ContentItem) => void): void {
    updateGroup(groupIndex, (group) => {
      const item = group.content?.[itemIndex];
      if (!item) return;
      mutator(item);
    });
  }

  function updateJson<T>(key: string, value: string, validate: (value: unknown) => value is T, errorMessage: string, apply: (parsed: T | undefined) => void): void {
    const parsed = parseJsonInput<T>(value);
    let error: string | undefined;
    let parsedValue: T | undefined;
    if (!parsed.ok) {
      error = parsed.error;
    } else if (parsed.value !== undefined && !validate(parsed.value)) {
      error = errorMessage;
    } else {
      parsedValue = parsed.value;
    }

    setJsonDrafts((current) => ({ ...current, [key]: { value, error } }));
    if (!error) apply(parsedValue);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="content-limits-dialog mandatory-content-dialog">
        <div className="dialog-heading">
          <div>
            <DialogTitle>Mandatory Content</DialogTitle>
            <DialogDescription>Edit the named top-level mandatoryContent groups referenced by zones.</DialogDescription>
          </div>
          <Button type="button" variant="gold" onClick={addGroup}><CirclePlus size={16} />Add Group</Button>
        </div>
        <ScrollArea className="content-limits-dialog__scroll">
          {groups.length === 0 ? <div className="empty-state">No mandatory content groups yet.</div> : null}
          {groups.length > 0 ? (
            <div className="content-limits-dialog__layout">
              <nav className="content-limit-list" aria-label="Mandatory content groups">
                {groups.map((group, groupIndex) => (
                  <button
                    key={`${group.name}-${groupIndex}`}
                    type="button"
                    className="content-limit-list__item"
                    data-selected={groupIndex === selectedIndex ? "true" : undefined}
                    onClick={() => setSelectedGroupIndex(groupIndex)}
                  >
                    <span>{group.name}</span>
                    <small>{group.content?.length ?? 0} items</small>
                  </button>
                ))}
              </nav>
              {selectedGroup && selectedIndex >= 0 ? (
                <article key={`${selectedGroup.name}-${selectedIndex}`} className="content-limit-group mandatory-content-group">
                  <div className="connection-title">
                    <ConfigField configKey="mandatoryContent.name" label="Group Name">
                      <Input value={selectedGroup.name} onChange={(event) => updateGroupName(selectedIndex, event.currentTarget.value)} />
                    </ConfigField>
                    <Button type="button" size="sm" variant="danger" onClick={() => deleteGroup(selectedIndex)}><Trash2 size={14} />Delete</Button>
                  </div>
                  <div className="content-limit-group__heading">
                    <strong>Content Items</strong>
                    <Button type="button" size="sm" variant="blue" onClick={() => updateGroup(selectedIndex, (draft) => { draft.content = [...(draft.content ?? []), { sid: "new_content_sid" }]; })}>
                      <CirclePlus size={14} />Add Item
                    </Button>
                  </div>
                  {(selectedGroup.content ?? []).map((item, itemIndex) => {
                    const rulesKey = draftKey(selectedIndex, itemIndex, "rules");
                    const contentKey = draftKey(selectedIndex, itemIndex, "content");
                    const rulesDraft = jsonDrafts[rulesKey];
                    const contentDraft = jsonDrafts[contentKey];
                    return (
                      <div key={`${item.name ?? item.sid ?? "item"}-${itemIndex}`} className="content-limit-row">
                        <div className="form-grid form-grid--three">
                          <ConfigField configKey="contentItem.name" label="Name">
                            <Input value={item.name ?? ""} onChange={(event) => updateItem(selectedIndex, itemIndex, (draft) => { draft.name = emptyToUndefined(event.currentTarget.value); })} />
                          </ConfigField>
                          <ConfigField configKey="contentItem.sid" label="SID">
                            <Input value={item.sid ?? ""} onChange={(event) => updateItem(selectedIndex, itemIndex, (draft) => { draft.sid = emptyToUndefined(event.currentTarget.value); })} />
                          </ConfigField>
                          <ConfigField configKey="contentItem.variant" label="Variant">
                            <Input type="number" value={formatNumberInput(item.variant)} onChange={(event) => updateItem(selectedIndex, itemIndex, (draft) => { draft.variant = parseNumberInput(event.currentTarget.value); })} />
                          </ConfigField>
                        </div>
                        <div className="checks checks--compact">
                          <CheckField checked={item.isGuarded === true} onCheckedChange={(checked) => updateItem(selectedIndex, itemIndex, (draft) => { draft.isGuarded = checked; })}>Guarded</CheckField>
                          <CheckField checked={item.isMine === true} onCheckedChange={(checked) => updateItem(selectedIndex, itemIndex, (draft) => { draft.isMine = checked; })}>Mine</CheckField>
                          <CheckField checked={item.soloEncounter === true} onCheckedChange={(checked) => updateItem(selectedIndex, itemIndex, (draft) => { draft.soloEncounter = checked; })}>Solo encounter</CheckField>
                          <CheckField checked={item.designatedEncounter === true} onCheckedChange={(checked) => updateItem(selectedIndex, itemIndex, (draft) => { draft.designatedEncounter = checked; })}>Designated encounter</CheckField>
                          <label className="checkline">
                            <Checkbox checked={item.road === true} onCheckedChange={(value) => updateItem(selectedIndex, itemIndex, (draft) => { draft.road = value === true; })} />
                            <span>Road</span>
                          </label>
                        </div>
                        <div className="form-grid form-grid--three">
                          <ConfigField configKey="contentItem.guardValue" label="Guard Value">
                            <Input type="number" value={formatNumberInput(item.guardValue)} onChange={(event) => updateItem(selectedIndex, itemIndex, (draft) => { draft.guardValue = parseNumberInput(event.currentTarget.value); })} />
                          </ConfigField>
                          <ConfigField configKey="contentItem.owner" label="Owner">
                            <Input value={formatOwnerInput(item.owner)} onChange={(event) => updateItem(selectedIndex, itemIndex, (draft) => { draft.owner = parseOwnerInput(event.currentTarget.value); })} />
                          </ConfigField>
                          <ConfigField configKey="contentItem.includeLists" label="Include Lists">
                            <Textarea rows={2} value={formatLineList(item.includeLists)} onChange={(event) => updateItem(selectedIndex, itemIndex, (draft) => { draft.includeLists = parseLineList(event.currentTarget.value); })} />
                          </ConfigField>
                        </div>
                        <div className="form-grid form-grid--two">
                          <ConfigField configKey="contentItem.rules" label="Rules JSON">
                            <Textarea rows={4} value={rulesDraft?.value ?? formatJsonInput(item.rules)} onChange={(event) => updateJson<ContentPlacementRule[]>(rulesKey, event.currentTarget.value, Array.isArray, "Use a JSON array of placement rules.", (parsed) => updateItem(selectedIndex, itemIndex, (draft) => { draft.rules = parsed; }))} />
                          </ConfigField>
                          <ConfigField configKey="contentItem.content" label="Advanced Content JSON">
                            <Textarea rows={4} value={contentDraft?.value ?? formatJsonInput(item.content)} onChange={(event) => updateJson<ContentItem[]>(contentKey, event.currentTarget.value, Array.isArray, "Use a JSON array of content items.", (parsed) => updateItem(selectedIndex, itemIndex, (draft) => { draft.content = parsed; }))} />
                          </ConfigField>
                        </div>
                        {rulesDraft?.error ? <Alert tone="danger">Rules JSON: {rulesDraft.error}</Alert> : null}
                        {contentDraft?.error ? <Alert tone="danger">Advanced Content JSON: {contentDraft.error}</Alert> : null}
                        <div className="dialog-actions dialog-actions--compact">
                          <Button type="button" size="sm" variant="danger" onClick={() => updateGroup(selectedIndex, (draft) => { draft.content = (draft.content ?? []).filter((_item, index) => index !== itemIndex); })}>
                            <Trash2 size={14} />Delete Item
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </article>
              ) : null}
            </div>
          ) : null}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function uniqueGroupName(groups: MandatoryContentGroup[]): string {
  const names = new Set(groups.map((group) => group.name));
  for (let index = 1; ; index++) {
    const candidate = `mandatory_content_custom_${index}`;
    if (!names.has(candidate)) return candidate;
  }
}

function draftKey(groupIndex: number, itemIndex: number, field: string): string {
  return `${groupIndex}:${itemIndex}:${field}`;
}

function emptyToUndefined(value: string): string | undefined {
  return value.trim() === "" ? undefined : value;
}

function formatOwnerInput(value: ContentItem["owner"]): string {
  return typeof value === "number" || typeof value === "string" ? String(value) : "";
}

function parseOwnerInput(value: string): number | string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && String(parsed) === trimmed ? parsed : trimmed;
}
