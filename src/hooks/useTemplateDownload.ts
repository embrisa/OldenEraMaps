import { useCallback, useState } from "react";
import { downloadBlob, downloadText } from "@/components/appShell/templateDownloads";
import { generateMapPreviewImages } from "@/community/previewImageGenerator";
import type { TemplateDesign } from "@/design";
import type { ValidationResult } from "@/types";
import type { RmgDiagnosticSummary } from "@/rmgDiagnostics";
import type { ButtonProps } from "@/components/ui/button";

interface PendingConfirmation {
  title: string;
  message: string;
  confirmLabel: string;
  confirmVariant?: ButtonProps["variant"];
  onConfirm(): void;
}

interface UseTemplateDownloadProps {
  design: TemplateDesign;
  validation: ValidationResult;
  templateDiagnostics: RmgDiagnosticSummary;
  exportFileName: string;
  exportJson: string;
  forceExportJson: string;
  exportPreviewFileName: string;
  previewAvailable: boolean;
  historyRevision: number;
  designBoardCanvas: HTMLCanvasElement | null;
}

export function useTemplateDownload({
  design,
  validation,
  templateDiagnostics,
  exportFileName,
  exportJson,
  forceExportJson,
  exportPreviewFileName,
  previewAvailable,
  historyRevision,
  designBoardCanvas
}: UseTemplateDownloadProps) {
  const [exportWarningOpen, setExportWarningOpen] = useState(false);
  const [lastPreviewExportRevision, setLastPreviewExportRevision] = useState<number | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);

  const requestConfirmation = useCallback((confirmation: PendingConfirmation): void => {
    setPendingConfirmation(confirmation);
  }, []);

  const runAfterDiscardingUnsavedChanges = useCallback(
    (action: () => void, isDirty: boolean): void => {
      if (!isDirty) {
        action();
        return;
      }

      requestConfirmation({
        title: "Discard unsaved changes?",
        message: "The current builder design has unsaved changes. Continue and discard those changes?",
        confirmLabel: "Discard changes",
        confirmVariant: "danger",
        onConfirm: action
      });
    },
    [requestConfirmation]
  );

  const handleExportClick = useCallback((): void => {
    const exportHasBlockingIssues = validation.errors.length > 0 || templateDiagnostics.errors.length > 0;
    const exportHasWarnings = templateDiagnostics.warnings.length > 0;

    if (!exportHasBlockingIssues && !exportHasWarnings) {
      if (exportJson === "") return;
      void downloadText(exportFileName, exportJson, "application/json", { preferSavePicker: true });
      return;
    }

    if (exportHasBlockingIssues && forceExportJson === "") return;
    if (!exportHasBlockingIssues && exportJson === "") return;
    setExportWarningOpen(true);
  }, [validation.errors.length, templateDiagnostics.errors.length, templateDiagnostics.warnings.length, exportJson, exportFileName, forceExportJson]);

  const handleForceExportClick = useCallback(async (): Promise<void> => {
    const exportHasBlockingIssues = validation.errors.length > 0 || templateDiagnostics.errors.length > 0;
    const payload = exportHasBlockingIssues ? forceExportJson : exportJson;
    if (payload === "") return;
    setExportWarningOpen(false);
    await downloadText(exportFileName, payload, "application/json", { preferSavePicker: true });
  }, [exportFileName, exportJson, forceExportJson, templateDiagnostics.errors.length, validation.errors.length]);

  const handleExportPreviewImageClick = useCallback(async (): Promise<void> => {
    if (!previewAvailable) return;
    const preview = await generateMapPreviewImages(design, { format: "image/png", source: designBoardCanvas ?? undefined });
    await downloadBlob(exportPreviewFileName, preview.large, { preferSavePicker: true });
    setLastPreviewExportRevision(historyRevision);
  }, [previewAvailable, design, designBoardCanvas, exportPreviewFileName, historyRevision]);

  const previewFresh = lastPreviewExportRevision !== null && lastPreviewExportRevision === historyRevision;

  return {
    exportWarningOpen,
    setExportWarningOpen,
    lastPreviewExportRevision,
    setLastPreviewExportRevision,
    pendingConfirmation,
    setPendingConfirmation,
    requestConfirmation,
    runAfterDiscardingUnsavedChanges,
    handleExportClick,
    handleForceExportClick,
    handleExportPreviewImageClick,
    previewFresh
  };
}
