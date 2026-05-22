import { useEffect, useState, type JSX } from "react";
import type { TemplateDesign } from "@/design";
import type { GlobalBans, ValueOverride } from "@/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form-controls";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/radix";
import { Alert, ConfigField, formatJsonInput, parseJsonInput } from "@/components/builder/formHelpers";

interface JsonDraft {
  value: string;
  error?: string;
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
  onUpdate
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  design: TemplateDesign;
  onUpdate(mutator: (design: TemplateDesign) => void): void;
}): JSX.Element {
  const [valueOverridesDraft, setValueOverridesDraft] = useState<JsonDraft>({ value: "[]" });
  const [globalBansDraft, setGlobalBansDraft] = useState<JsonDraft>({ value: "{}" });

  useEffect(() => {
    if (!open) return;
    setValueOverridesDraft({ value: formatJsonInput(design.valueOverrides) });
    setGlobalBansDraft({ value: formatJsonInput(design.globalBans) });
  }, [design.globalBans, design.valueOverrides, open]);

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
            <DialogDescription>Edit top-level valueOverrides and globalBans as raw JSON. Legacy gameRules.globalBans imports remain preserved automatically.</DialogDescription>
          </div>
        </div>
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