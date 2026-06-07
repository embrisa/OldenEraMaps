import { useEffect, useState, useCallback } from "react";
import { applyRmgJsonToDesign, designToTemplate, type TemplateDesign } from "@/design";
import { serializeRmgTemplate } from "@/types";

function serializeDesignForBuilder(design: TemplateDesign): string | null {
  try {
    return serializeRmgTemplate(designToTemplate(design), { includeGeneratorPositions: true });
  } catch {
    return null;
  }
}

interface UseBuilderJsonWorkflowProps {
  design: TemplateDesign;
  selectedZoneId: string;
  commit: (
    next: TemplateDesign,
    nextSelectedZoneId?: string,
    options?: {
      allowDirtyJsonOverwrite?: boolean;
      markDirty?: boolean;
    }
  ) => boolean;
}

export function useBuilderJsonWorkflow({
  design,
  selectedZoneId,
  commit
}: UseBuilderJsonWorkflowProps) {
  const [jsonSnapshot, setJsonSnapshot] = useState(() => serializeDesignForBuilder(design) ?? "");
  const [jsonDraft, setJsonDraft] = useState(() => serializeDesignForBuilder(design) ?? "");
  const [jsonParseError, setJsonParseError] = useState<string>();
  const [jsonApplyError, setJsonApplyError] = useState<string>();
  const [jsonValidationErrors, setJsonValidationErrors] = useState<string[]>([]);

  const jsonDirty = jsonDraft !== jsonSnapshot;

  const handleJsonChange = useCallback((nextText: string, nextParseError?: string): void => {
    setJsonDraft(nextText);
    setJsonParseError(nextParseError);
    setJsonApplyError(undefined);
    setJsonValidationErrors([]);
  }, []);

  const syncJsonSnapshot = useCallback((next: TemplateDesign): void => {
    const nextSnapshot = serializeDesignForBuilder(next);
    if (!nextSnapshot) return;
    setJsonSnapshot(nextSnapshot);
    setJsonDraft(nextSnapshot);
    setJsonParseError(undefined);
  }, []);

  const clearJsonMessages = useCallback((): void => {
    setJsonApplyError(undefined);
    setJsonValidationErrors([]);
  }, []);

  const applyJsonText = useCallback((text: string): void => {
    const result = applyRmgJsonToDesign(text, design);
    if (!result.ok) {
      setJsonApplyError(result.parseError);
      setJsonValidationErrors(result.validation?.errors ?? []);
      return;
    }

    setJsonParseError(undefined);
    setJsonApplyError(undefined);
    setJsonValidationErrors([]);
    commit(result.design, selectedZoneId, { allowDirtyJsonOverwrite: true, markDirty: true });
  }, [design, selectedZoneId, commit]);

  // Sync edits from manual text changes back into design if valid/no syntax error
  useEffect(() => {
    if (!jsonDirty || jsonParseError) return;
    applyJsonText(jsonDraft);
  }, [jsonDirty, jsonDraft, jsonParseError, applyJsonText]);

  return {
    jsonSnapshot,
    jsonDraft,
    jsonParseError,
    jsonApplyError,
    jsonValidationErrors,
    jsonDirty,
    handleJsonChange,
    syncJsonSnapshot,
    clearJsonMessages,
    applyJsonText
  };
}
