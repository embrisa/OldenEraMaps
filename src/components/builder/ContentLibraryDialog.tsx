import { useEffect, useState, type JSX } from "react";
import type { TemplateDesign } from "@/design";
import type { JsonValue } from "@/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/radix";
import { RmgJsonEditor } from "@/components/builder/RmgJsonEditor";
import { Alert, ConfigField, formatJsonInput, parseJsonInput } from "@/components/builder/formHelpers";

interface JsonDraft {
  value: string;
  error?: string;
}

type ParsedArrayDraft =
  | { ok: true; value: JsonValue[] }
  | { ok: false; error: string };

export function ContentLibraryDialog({
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="content-limits-dialog content-library-dialog">
        <ContentLibraryPanel active={open} design={design} onUpdate={onUpdate} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

export function ContentLibraryPanel({
  active,
  design,
  onUpdate,
  onClose
}: {
  active: boolean;
  design: TemplateDesign;
  onUpdate(mutator: (design: TemplateDesign) => void): void;
  onClose(): void;
}): JSX.Element {
  const [contentPoolsDraft, setContentPoolsDraft] = useState<JsonDraft>({ value: "[]" });
  const [contentListsDraft, setContentListsDraft] = useState<JsonDraft>({ value: "[]" });

  useEffect(() => {
    if (!active) return;
    setContentPoolsDraft({ value: formatJsonInput(design.contentPools) });
    setContentListsDraft({ value: formatJsonInput(design.contentLists) });
  }, [active, design.contentLists, design.contentPools]);

  function handleApply(): void {
    const parsedPools = parseArrayDraft(contentPoolsDraft.value, "Use a JSON array of content pool blocks.");
    const parsedLists = parseArrayDraft(contentListsDraft.value, "Use a JSON array of content list blocks.");

    setContentPoolsDraft({ value: contentPoolsDraft.value, error: parsedPools.ok ? undefined : parsedPools.error });
    setContentListsDraft({ value: contentListsDraft.value, error: parsedLists.ok ? undefined : parsedLists.error });

    if (!parsedPools.ok || !parsedLists.ok) return;

    onUpdate((draft) => {
      draft.contentPools = parsedPools.value;
      draft.contentLists = parsedLists.value;
    });
    onClose();
  }

  return (
    <>
      <div className="dialog-heading">
        <div>
          <h3>Advanced Content Library</h3>
          <p>Edit expert-level top-level contentPools and contentLists blocks as JSON arrays.</p>
        </div>
      </div>
        <div className="content-library-dialog__grid">
          <ConfigField configKey="template.contentPools" label="Content Pools JSON">
            <RmgJsonEditor
              ariaLabel="Content Pools JSON editor"
              className="rmg-json-editor--compact"
              value={contentPoolsDraft.value}
              onChange={(value) => setContentPoolsDraft({ value })}
            />
          </ConfigField>
          <ConfigField configKey="template.contentLists" label="Content Lists JSON">
            <RmgJsonEditor
              ariaLabel="Content Lists JSON editor"
              className="rmg-json-editor--compact"
              value={contentListsDraft.value}
              onChange={(value) => setContentListsDraft({ value })}
            />
          </ConfigField>
        </div>
        {contentPoolsDraft.error ? <Alert tone="danger">Content Pools JSON: {contentPoolsDraft.error}</Alert> : null}
        {contentListsDraft.error ? <Alert tone="danger">Content Lists JSON: {contentListsDraft.error}</Alert> : null}
        <div className="dialog-actions">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="button" variant="blue" onClick={handleApply}>Apply</Button>
        </div>
    </>
  );
}

function parseArrayDraft(value: string, errorMessage: string): ParsedArrayDraft {
  const parsed = parseJsonInput<JsonValue[]>(value);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error };
  }
  if (!Array.isArray(parsed.value)) {
    return { ok: false, error: errorMessage };
  }
  return { ok: true, value: parsed.value };
}
