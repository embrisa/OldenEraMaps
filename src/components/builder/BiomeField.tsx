import { useEffect, useState, type JSX } from "react";
import { toast } from "sonner";
import type { BiomeSelector } from "@/types";
import { Field, Textarea } from "@/components/ui/form-controls";

export function BiomeField({ label, value, onChange }: { label: string; value?: BiomeSelector; onChange(value?: BiomeSelector): void }): JSX.Element {
  const [text, setText] = useState(() => formatJsonValue(value));
  // Compare by content: the selector object is re-cloned on every unrelated zone edit.
  const valueJson = serializeSelector(value);
  useEffect(() => {
    setText((current) => {
      const parsed = parseBiomeSelector(current);
      return parsed.valid && serializeSelector(parsed.value) === valueJson ? current : formatJsonValue(value);
    });
  }, [valueJson]);
  const parsed = parseBiomeSelector(text);
  const invalid = text.trim() !== "" && !parsed.valid;
  return (
    <Field label={label}>
      <Textarea
        className="code"
        rows={3}
        value={text}
        aria-invalid={invalid || undefined}
        onChange={(event) => {
          const nextText = event.currentTarget.value;
          setText(nextText);
          // Commit valid JSON right away so it is stored on the zone being edited, even if the
          // inspector switches zones before this field blurs.
          const next = parseBiomeSelector(nextText);
          if (next.valid && serializeSelector(next.value) !== valueJson) onChange(next.value);
        }}
        onBlur={() => {
          if (invalid) toast.error("Biome JSON must be valid JSON.");
        }}
      />
    </Field>
  );
}

function parseBiomeSelector(value: string): { valid: boolean; value?: BiomeSelector } {
  const trimmed = value.trim();
  if (!trimmed) return { valid: true, value: undefined };
  try {
    return { valid: true, value: JSON.parse(trimmed) as BiomeSelector };
  } catch {
    return { valid: false };
  }
}

function formatJsonValue(value: BiomeSelector | undefined): string {
  return value ? JSON.stringify(value, null, 2) : "";
}

function serializeSelector(value: BiomeSelector | undefined): string {
  return value === undefined ? "" : JSON.stringify(value);
}
