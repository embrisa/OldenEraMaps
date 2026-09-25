import { useEffect, useState, type JSX, type ReactNode, type TextareaHTMLAttributes } from "react";
import { configHelp } from "@/configHelp";
import { Field, Textarea } from "@/components/ui/form-controls";
import { Checkbox, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/radix";

export const factionMarks = ["temple", "grove", "dungeon", "hive", "necropolis", "schism"] as const;

export function ConfigField({ configKey, label, children, className }: { configKey: string; label: string; children: ReactNode; className?: string }): JSX.Element {
  const tooltip = configHelp[configKey]?.tooltip;
  const detail = configHelp[configKey]?.detail;
  const suggestions = configHelp[configKey]?.suggestions ?? [];
  return (
    <div className={className ? `config-field ${className}` : "config-field"} data-config-key={configKey}>
      <Field label={label} help={tooltip} helpDetail={detail}>{children}</Field>
      {suggestions.length > 0 ? (
        <div className="config-suggestions" aria-label="Suggested values">
          {suggestions.map((suggestion) => (
            <Tooltip key={`${suggestion.label}-${String(suggestion.value)}`}>
              <TooltipTrigger asChild>
                <button
                  className="suggestion-chip"
                  type="button"
                  onClick={(event) => applySuggestedValue(event.currentTarget, suggestion.value)}
                >
                  {suggestion.label}
                </button>
              </TooltipTrigger>
              {suggestion.description ? <TooltipContent>{suggestion.description}</TooltipContent> : null}
            </Tooltip>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function CheckField({ checked, onCheckedChange, children }: { checked: boolean; onCheckedChange(checked: boolean): void; children: ReactNode }): JSX.Element {
  return (
    <label className="checkline">
      <Checkbox checked={checked} onCheckedChange={(value) => onCheckedChange(value === true)} />
      <span>{children}</span>
    </label>
  );
}

export function Alert({ tone, children }: { tone: "success" | "warning" | "danger" | "info"; children: ReactNode }): JSX.Element {
  return <div className={`alert alert--${tone}`} role={tone === "danger" ? "alert" : "status"}>{children}</div>;
}

export function parseLineList(value: string): string[] {
  return value.split(/\r?\n|,/).map((entry) => entry.trim()).filter(Boolean);
}

export function parseNumberList(value: string): number[] {
  return parseLineList(value).map((entry) => Number(entry)).filter(Number.isFinite);
}

export function parseNumberInput(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function formatNumberInput(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
}

export function parseJsonInput<T>(value: string): { ok: true; value: T | undefined } | { ok: false; error: string } {
  if (value.trim() === "") return { ok: true, value: undefined };
  try {
    return { ok: true, value: JSON.parse(value) as T };
  } catch (error) {
    return { ok: false, error: formatJsonParseError(error) };
  }
}

export function formatJsonInput(value: unknown): string {
  return value === undefined ? "" : JSON.stringify(value, null, 2);
}

export function formatLineList(values: string[] | undefined): string {
  return values?.join("\n") ?? "";
}

export function formatNumberList(values: number[] | undefined): string {
  return values?.join(", ") ?? "";
}

type ListTextareaProps<T> = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange"> & {
  values: T[] | undefined;
  onValuesChange(values: T[]): void;
};

/** Newline/comma separated list editor that keeps the raw text, so separators survive while typing. */
export function LineListTextarea(props: ListTextareaProps<string>): JSX.Element {
  return <ListTextarea {...props} parse={parseLineList} format={formatLineList} />;
}

/** Comma/newline separated number list editor that keeps the raw text while typing. */
export function NumberListTextarea(props: ListTextareaProps<number>): JSX.Element {
  return <ListTextarea {...props} parse={parseNumberList} format={formatNumberList} />;
}

function ListTextarea<T>({
  values,
  onValuesChange,
  parse,
  format,
  ...props
}: ListTextareaProps<T> & { parse(text: string): T[]; format(values: T[] | undefined): string }): JSX.Element {
  const [text, setText] = useState(() => format(values));
  const valuesKey = JSON.stringify(values ?? []);

  useEffect(() => {
    // Keep the typed text (trailing separators, spacing) while it still parses to the stored list.
    setText((current) => JSON.stringify(parse(current)) === valuesKey ? current : format(values));
  }, [valuesKey]);

  return (
    <Textarea
      {...props}
      value={text}
      onChange={(event) => {
        const nextText = event.currentTarget.value;
        setText(nextText);
        const nextValues = parse(nextText);
        if (JSON.stringify(nextValues) !== valuesKey) onValuesChange(nextValues);
      }}
    />
  );
}

export interface JsonTextDraft {
  value: string;
  error?: string;
  /** Serialized model value the draft was written against. */
  base: string;
}

export function jsonDraftBase(value: unknown): string {
  return JSON.stringify(value) ?? "";
}

/**
 * Returns the draft only while the model still holds the value it was written against. After an
 * undo, import or delete moved another value into that slot, the stale draft is ignored.
 */
export function currentJsonDraft(draft: JsonTextDraft | undefined, modelValue: unknown): JsonTextDraft | undefined {
  return draft && draft.base === jsonDraftBase(modelValue) ? draft : undefined;
}

/**
 * Drops the drafts of a deleted list entry and moves the drafts of later entries down one slot,
 * so position-keyed drafts ("group:item:field") stay with their entries.
 */
export function removeIndexedDrafts<T>(drafts: Record<string, T>, parentPath: number[], removedIndex: number): Record<string, T> {
  const depth = parentPath.length;
  const next: Record<string, T> = {};
  for (const [key, draft] of Object.entries(drafts)) {
    const parts = key.split(":");
    const index = Number(parts[depth]);
    const inList = parentPath.every((segment, segmentIndex) => parts[segmentIndex] === String(segment)) && Number.isInteger(index);
    if (!inList || index < removedIndex) {
      next[key] = draft;
    } else if (index > removedIndex) {
      parts[depth] = String(index - 1);
      next[parts.join(":")] = draft;
    }
  }
  return next;
}

function applySuggestedValue(button: HTMLButtonElement, value: string | number | boolean): void {
  const field = button.closest(".config-field");
  if (!field) return;

  // Checkbox fields use Radix checkboxes (buttons), which have no value to set: toggle them instead.
  const checkbox = typeof value === "boolean" ? field.querySelector<HTMLButtonElement>('button[role="checkbox"]') : null;
  if (checkbox) {
    if (!checkbox.disabled && (checkbox.getAttribute("aria-checked") === "true") !== value) checkbox.click();
    return;
  }

  // Prefer a slider's typed value box over its range input: range inputs snap values to their step.
  const control = field.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input:not([type='range']), select, textarea")
    ?? field.querySelector<HTMLInputElement>("input");
  if (!control || control.disabled) return;
  const prototype = control instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : control instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : HTMLInputElement.prototype;
  const valueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  valueSetter?.call(control, String(value));
  control.dispatchEvent(new Event("input", { bubbles: true }));
  control.dispatchEvent(new Event("change", { bubbles: true }));
}

function formatJsonParseError(error: unknown): string {
  if (!(error instanceof Error) || !error.message.trim()) {
    return "Must be valid JSON.";
  }

  const columnMatch = error.message.match(/position\s+(\d+)/i);
  if (!columnMatch) {
    return `Must be valid JSON. ${error.message}`;
  }

  const position = Number(columnMatch[1]);
  if (!Number.isFinite(position) || position < 0) {
    return error.message;
  }

  return `Must be valid JSON. ${error.message} (around character ${position + 1})`;
}
