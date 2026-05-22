import { useEffect, useState, type JSX } from "react";
import { toast } from "sonner";
import type { BiomeSelector } from "@/types";
import { Field, Textarea } from "@/components/ui/form-controls";

export function BiomeField({ label, value, onChange }: { label: string; value?: BiomeSelector; onChange(value?: BiomeSelector): void }): JSX.Element {
  const [text, setText] = useState(() => formatJsonValue(value));
  useEffect(() => {
    setText(formatJsonValue(value));
  }, [value]);
  const parsed = parseBiomeSelector(text);
  const invalid = text.trim() !== "" && !parsed.valid;
  return (
    <Field label={label}>
      <Textarea
        className="code"
        rows={3}
        value={text}
        aria-invalid={invalid || undefined}
        onChange={(event) => setText(event.currentTarget.value)}
        onBlur={() => {
          if (!invalid) {
            onChange(parsed.value);
            return;
          }
          toast.error("Biome JSON must be valid JSON.");
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
