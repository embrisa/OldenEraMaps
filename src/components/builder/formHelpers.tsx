import type { JSX, ReactNode } from "react";
import { configHelp } from "@/configHelp";
import { Field } from "@/components/ui/form-controls";
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
                  onClick={(event) => applySuggestedValue(event.currentTarget, String(suggestion.value))}
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

export function Alert({ tone, children }: { tone: "success" | "warning" | "danger"; children: ReactNode }): JSX.Element {
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
  } catch {
    return { ok: false, error: "Must be valid JSON." };
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

function applySuggestedValue(button: HTMLButtonElement, value: string): void {
  const field = button.closest(".config-field");
  const control = field?.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea");
  if (!control) return;
  const prototype = control instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : control instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : HTMLInputElement.prototype;
  const valueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  valueSetter?.call(control, value);
  control.dispatchEvent(new Event("input", { bubbles: true }));
  control.dispatchEvent(new Event("change", { bubbles: true }));
}
