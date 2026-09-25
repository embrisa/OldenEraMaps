import { useEffect, useRef, useState, useCallback } from "react";
import { applyRmgJsonToDesign, designToTemplate, type TemplateDesign } from "@/design";
import { serializeRmgTemplate } from "@/types";

function sameMessages(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((message, index) => message === right[index]);
}

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
  const [jsonValidationErrors, setJsonValidationErrorsState] = useState<string[]>([]);
  // False when the builder design cannot be serialized (it has validation errors), so the
  // snapshot shown in the editor is stale and must not be applied back over newer builder edits.
  const [jsonSnapshotCurrent, setJsonSnapshotCurrent] = useState(true);
  // The draft text most recently auto-applied; each draft is attempted once.
  const lastAutoAppliedDraftRef = useRef<string | null>(null);

  const jsonDirty = jsonDraft !== jsonSnapshot;

  const setJsonValidationErrors = useCallback((next: string[]): void => {
    setJsonValidationErrorsState((current) => (sameMessages(current, next) ? current : next));
  }, []);

  const handleJsonChange = useCallback((nextText: string, nextParseError?: string): void => {
    lastAutoAppliedDraftRef.current = null;
    setJsonDraft(nextText);
    setJsonParseError(nextParseError);
    setJsonApplyError(undefined);
    setJsonValidationErrors([]);
  }, [setJsonValidationErrors]);

  const syncJsonSnapshot = useCallback((next: TemplateDesign): void => {
    const nextSnapshot = serializeDesignForBuilder(next);
    setJsonSnapshotCurrent(nextSnapshot !== null);
    if (!nextSnapshot) return;
    setJsonSnapshot(nextSnapshot);
    setJsonDraft(nextSnapshot);
    setJsonParseError(undefined);
  }, []);

  const clearJsonMessages = useCallback((): void => {
    setJsonApplyError(undefined);
    setJsonValidationErrors([]);
  }, [setJsonValidationErrors]);

  const applyJsonText = useCallback((text: string): void => {
    if (!jsonSnapshotCurrent) {
      setJsonApplyError("Fix the builder errors before editing JSON; the editor is showing an outdated snapshot.");
      return;
    }
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
  }, [jsonSnapshotCurrent, design, selectedZoneId, commit, setJsonValidationErrors]);

  // Sync edits from manual text changes back into design if valid/no syntax error.
  // applyJsonText changes identity on most renders, so guard against re-applying the same
  // draft: a failing apply would otherwise set state, re-render and retry forever.
  useEffect(() => {
    if (!jsonDirty || jsonParseError) return;
    if (lastAutoAppliedDraftRef.current === jsonDraft) return;
    lastAutoAppliedDraftRef.current = jsonDraft;
    applyJsonText(jsonDraft);
  }, [jsonDirty, jsonDraft, jsonParseError, applyJsonText]);

  return {
    jsonSnapshot,
    jsonDraft,
    jsonParseError,
    jsonApplyError,
    jsonValidationErrors,
    jsonDirty,
    jsonSnapshotCurrent,
    handleJsonChange,
    syncJsonSnapshot,
    clearJsonMessages,
    applyJsonText
  };
}
