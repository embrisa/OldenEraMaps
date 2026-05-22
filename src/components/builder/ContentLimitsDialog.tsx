import { CirclePlus, Trash2 } from "lucide-react";
import { useEffect, useState, type JSX } from "react";
import type { ContentCountLimit, ContentItem, ContentSidLimit } from "@/types";
import type { TemplateDesign } from "@/design";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/form-controls";
import { Dialog, DialogContent, DialogDescription, DialogTitle, ScrollArea } from "@/components/ui/radix";
import { Alert, ConfigField, formatJsonInput, formatLineList, formatNumberInput, parseJsonInput, parseLineList, parseNumberInput } from "@/components/builder/formHelpers";

export function ContentLimitsDialog({
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
  const [contentDrafts, setContentDrafts] = useState<Record<string, { value: string; error?: string }>>({});
  const [selectedGroupIndex, setSelectedGroupIndex] = useState(0);
  const selectedGroup = design.contentCountLimits[selectedGroupIndex] ?? design.contentCountLimits[0];
  const selectedIndex = selectedGroup ? design.contentCountLimits.indexOf(selectedGroup) : -1;

  useEffect(() => {
    if (!open) return;
    setContentDrafts({});
    setSelectedGroupIndex(0);
  }, [open]);

  useEffect(() => {
    if (selectedGroupIndex < design.contentCountLimits.length) return;
    setSelectedGroupIndex(Math.max(0, design.contentCountLimits.length - 1));
  }, [design.contentCountLimits.length, selectedGroupIndex]);

  function addGroup(): void {
    onUpdate((draft) => {
      draft.contentCountLimits.push({ name: uniqueLimitName(draft.contentCountLimits), limits: [] });
      setSelectedGroupIndex(draft.contentCountLimits.length - 1);
    });
  }

  function deleteGroup(groupIndex: number): void {
    onUpdate((draft) => {
      const [removed] = draft.contentCountLimits.splice(groupIndex, 1);
      if (!removed) return;
      for (const zone of draft.zones) {
        zone.contentCountLimits = zone.contentCountLimits.filter((name) => name !== removed.name);
      }
      setSelectedGroupIndex(Math.max(0, Math.min(groupIndex, draft.contentCountLimits.length - 1)));
    });
  }

  function updateGroupName(groupIndex: number, value: string): void {
    onUpdate((draft) => {
      const group = draft.contentCountLimits[groupIndex];
      if (!group) return;
      const previousName = group.name;
      group.name = value;
      if (!value.trim()) return;
      for (const zone of draft.zones) {
        zone.contentCountLimits = zone.contentCountLimits.map((name) => name === previousName ? value : name);
      }
    });
  }

  function updateGroup(groupIndex: number, mutator: (group: ContentCountLimit) => void): void {
    onUpdate((draft) => {
      const group = draft.contentCountLimits[groupIndex];
      if (!group) return;
      mutator(group);
    });
  }

  function updateSidLimit(groupIndex: number, limitIndex: number, mutator: (limit: ContentSidLimit) => void): void {
    updateGroup(groupIndex, (group) => {
      const limit = group.limits?.[limitIndex];
      if (!limit) return;
      mutator(limit);
    });
  }

  function updateContentJson(groupIndex: number, limitIndex: number, value: string): void {
    const key = draftKey(groupIndex, limitIndex);
    const parsed = parseJsonInput<ContentItem[]>(value);
    let error: string | undefined;
    let parsedValue: ContentItem[] | undefined;
    if (!parsed.ok) {
      error = parsed.error;
    } else if (parsed.value !== undefined && !Array.isArray(parsed.value)) {
      error = "Use a JSON array of content items.";
    } else {
      parsedValue = parsed.value;
    }

    setContentDrafts((current) => ({ ...current, [key]: { value, error } }));
    if (error) return;

    updateSidLimit(groupIndex, limitIndex, (limit) => {
      limit.content = parsedValue;
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="content-limits-dialog">
        <div className="dialog-heading">
          <div>
            <DialogTitle>Advanced Content Limits</DialogTitle>
            <DialogDescription>Edit the named top-level contentCountLimits blocks used by zones.</DialogDescription>
          </div>
          <Button type="button" variant="gold" onClick={addGroup}><CirclePlus size={16} />Add Limit</Button>
        </div>
        <ScrollArea className="content-limits-dialog__scroll">
          {design.contentCountLimits.length === 0 ? <div className="empty-state">No content limits yet.</div> : null}
          {design.contentCountLimits.length > 0 ? (
            <div className="content-limits-dialog__layout">
              <nav className="content-limit-list" aria-label="Content limit groups">
                {design.contentCountLimits.map((group, groupIndex) => (
                  <button
                    key={`${group.name}-${groupIndex}`}
                    type="button"
                    className="content-limit-list__item"
                    data-selected={groupIndex === selectedIndex ? "true" : undefined}
                    onClick={() => setSelectedGroupIndex(groupIndex)}
                  >
                    <span>{group.name}</span>
                    <small>{group.limits?.length ?? 0} SID limits</small>
                  </button>
                ))}
              </nav>
              {selectedGroup && selectedIndex >= 0 ? (
            <article key={`${selectedGroup.name}-${selectedIndex}`} className="content-limit-group">
              <div className="connection-title">
                <ConfigField configKey="contentCountLimit.name" label="Limit Name">
                  <Input value={selectedGroup.name} onChange={(event) => updateGroupName(selectedIndex, event.currentTarget.value)} />
                </ConfigField>
                <Button type="button" size="sm" variant="danger" onClick={() => deleteGroup(selectedIndex)}><Trash2 size={14} />Delete</Button>
              </div>
              <div className="form-grid form-grid--two">
                <ConfigField configKey="contentCountLimit.playerMin" label="Player Min">
                  <Input type="number" value={formatNumberInput(selectedGroup.playerMin)} onChange={(event) => updateGroup(selectedIndex, (draft) => { draft.playerMin = parseNumberInput(event.currentTarget.value); })} />
                </ConfigField>
                <ConfigField configKey="contentCountLimit.playerMax" label="Player Max">
                  <Input type="number" value={formatNumberInput(selectedGroup.playerMax)} onChange={(event) => updateGroup(selectedIndex, (draft) => { draft.playerMax = parseNumberInput(event.currentTarget.value); })} />
                </ConfigField>
              </div>
              <div className="content-limit-group__heading">
                <strong>SID Limits</strong>
                <Button type="button" size="sm" variant="blue" onClick={() => updateGroup(selectedIndex, (draft) => { draft.limits = [...(draft.limits ?? []), { sid: "new_content_sid", maxCount: 1 }]; })}>
                  <CirclePlus size={14} />Add SID
                </Button>
              </div>
              {(selectedGroup.limits ?? []).map((limit, limitIndex) => {
                const contentDraft = contentDrafts[draftKey(selectedIndex, limitIndex)];
                return (
                  <div key={`${limit.sid}-${limitIndex}`} className="content-limit-row">
                    <div className="form-grid form-grid--three">
                      <ConfigField configKey="contentSidLimit.sid" label="SID">
                        <Input value={limit.sid} onChange={(event) => updateSidLimit(selectedIndex, limitIndex, (draft) => { draft.sid = event.currentTarget.value; })} />
                      </ConfigField>
                      <ConfigField configKey="contentSidLimit.variant" label="Variant">
                        <Input type="number" value={formatNumberInput(limit.variant)} onChange={(event) => updateSidLimit(selectedIndex, limitIndex, (draft) => { draft.variant = parseNumberInput(event.currentTarget.value); })} />
                      </ConfigField>
                      <ConfigField configKey="contentSidLimit.maxCount" label="Max Count">
                        <Input type="number" value={formatNumberInput(limit.maxCount)} onChange={(event) => updateSidLimit(selectedIndex, limitIndex, (draft) => { draft.maxCount = parseNumberInput(event.currentTarget.value); })} />
                      </ConfigField>
                    </div>
                    <div className="form-grid form-grid--two">
                      <ConfigField configKey="contentSidLimit.includeLists" label="Include Lists">
                        <Textarea rows={3} value={formatLineList(limit.includeLists)} onChange={(event) => updateSidLimit(selectedIndex, limitIndex, (draft) => { draft.includeLists = parseLineList(event.currentTarget.value); })} />
                      </ConfigField>
                      <ConfigField configKey="contentSidLimit.content" label="Content JSON">
                        <Textarea rows={3} value={contentDraft?.value ?? formatJsonInput(limit.content)} onChange={(event) => updateContentJson(selectedIndex, limitIndex, event.currentTarget.value)} />
                      </ConfigField>
                    </div>
                    {contentDraft?.error ? <Alert tone="danger">Content JSON: {contentDraft.error}</Alert> : null}
                    <div className="dialog-actions dialog-actions--compact">
                      <Button type="button" size="sm" variant="danger" onClick={() => updateGroup(selectedIndex, (draft) => { draft.limits = (draft.limits ?? []).filter((_limit, index) => index !== limitIndex); })}>
                        <Trash2 size={14} />Delete SID
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

function uniqueLimitName(limits: ContentCountLimit[]): string {
  const names = new Set(limits.map((limit) => limit.name));
  for (let index = 1; ; index++) {
    const candidate = `content_limits_custom_${index}`;
    if (!names.has(candidate)) return candidate;
  }
}

function draftKey(groupIndex: number, limitIndex: number): string {
  return `${groupIndex}:${limitIndex}`;
}
