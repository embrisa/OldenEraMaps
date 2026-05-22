import { useEffect, useState, type JSX } from "react";
import type { TemplateDesign } from "@/design";
import type { JsonValue } from "@/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form-controls";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/radix";
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
  const [contentPoolsDraft, setContentPoolsDraft] = useState<JsonDraft>({ value: "[]" });
  const [contentListsDraft, setContentListsDraft] = useState<JsonDraft>({ value: "[]" });

  useEffect(() => {
    if (!open) return;
    setContentPoolsDraft({ value: formatJsonInput(design.contentPools) });
    setContentListsDraft({ value: formatJsonInput(design.contentLists) });
  }, [design.contentLists, design.contentPools, open]);

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
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="content-limits-dialog content-library-dialog">
        <div className="dialog-heading">
          <div>
            <DialogTitle>Advanced Content Library</DialogTitle>
            <DialogDescription>Edit expert-level top-level contentPools and contentLists blocks as raw JSON arrays.</DialogDescription>
          </div>
        </div>
        <div className="content-library-dialog__grid">
          <ConfigField configKey="template.contentPools" label="Content Pools JSON">
            <Textarea
              className="code"
              rows={18}
              aria-invalid={contentPoolsDraft.error ? true : undefined}
              value={contentPoolsDraft.value}
              onChange={(event) => setContentPoolsDraft({ value: event.currentTarget.value })}
            />
          </ConfigField>
          <ConfigField configKey="template.contentLists" label="Content Lists JSON">
            <Textarea
              className="code"
              rows={18}
              aria-invalid={contentListsDraft.error ? true : undefined}
              value={contentListsDraft.value}
              onChange={(event) => setContentListsDraft({ value: event.currentTarget.value })}
            />
          </ConfigField>
        </div>
        {contentPoolsDraft.error ? <Alert tone="danger">Content Pools JSON: {contentPoolsDraft.error}</Alert> : null}
        {contentListsDraft.error ? <Alert tone="danger">Content Lists JSON: {contentListsDraft.error}</Alert> : null}
        <div className="dialog-actions">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" variant="blue" onClick={handleApply}>Apply</Button>
        </div>
      </DialogContent>
    </Dialog>
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
