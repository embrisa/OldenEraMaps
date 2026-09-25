import { useCallback, useState } from "react";
import { toast } from "sonner";
import { downloadBlob, downloadText, type DownloadResult } from "@/components/appShell/templateDownloads";
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

function notifyDownload(result: DownloadResult, fileName: string): void {
  if (result === "cancelled") return;
  toast.success(result === "saved" ? `Saved ${fileName}` : `Downloading ${fileName}`);
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
  designBoardCanvas
}: UseTemplateDownloadProps) {
  const [exportWarningOpen, setExportWarningOpen] = useState(false);
  // Designs are immutable snapshots, so identity tells whether the exported preview is current.
  const [lastPreviewExportDesign, setLastPreviewExportDesign] = useState<TemplateDesign | null>(null);
  // Builder validation errors block the normal serialization; template-diagnostic errors do not.
  const exportPayload = validation.errors.length > 0 ? forceExportJson : exportJson;
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
    if (exportPayload === "") return;

    if (!exportHasBlockingIssues && !exportHasWarnings) {
      void downloadText(exportFileName, exportPayload, "application/json", { preferSavePicker: true })
        .then((result) => notifyDownload(result, exportFileName));
      return;
    }

    setExportWarningOpen(true);
  }, [validation.errors.length, templateDiagnostics.errors.length, templateDiagnostics.warnings.length, exportPayload, exportFileName]);

  const handleForceExportClick = useCallback(async (): Promise<void> => {
    if (exportPayload === "") return;
    setExportWarningOpen(false);
    notifyDownload(await downloadText(exportFileName, exportPayload, "application/json", { preferSavePicker: true }), exportFileName);
  }, [exportFileName, exportPayload]);

  const handleExportPreviewImageClick = useCallback(async (): Promise<void> => {
    if (!previewAvailable) return;
    try {
      const preview = await generateMapPreviewImages(design, { format: "image/png", source: designBoardCanvas ?? undefined });
      const result = await downloadBlob(exportPreviewFileName, preview.large, { preferSavePicker: true });
      if (result === "cancelled") return;
      setLastPreviewExportDesign(design);
      notifyDownload(result, exportPreviewFileName);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? `Preview export failed: ${error.message}` : "Preview export failed.");
    }
  }, [previewAvailable, design, designBoardCanvas, exportPreviewFileName]);

  const previewFresh = lastPreviewExportDesign === design;

  return {
    exportWarningOpen,
    setExportWarningOpen,
    exportPayload,
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
