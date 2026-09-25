export interface SaveFilePickerHandle {
  createWritable(): Promise<SaveFilePickerWritable>;
}

export interface SaveFilePickerWritable {
  write(data: Blob): Promise<void>;
  close(): Promise<void>;
}

export interface SaveFilePickerOptions {
  suggestedName: string;
  types?: Array<{
    description?: string;
    accept: Record<string, string[]>;
  }>;
}

export interface DownloadOptions {
  preferSavePicker?: boolean;
}

/** "saved" = written through the save picker, "downloaded" = browser download started, "cancelled" = user dismissed the picker. */
export type DownloadResult = "saved" | "downloaded" | "cancelled";

type SaveFilePickerFunction = (options: SaveFilePickerOptions) => Promise<SaveFilePickerHandle>;

export function builderExportBaseName(templateName: string): string {
  return normalizeDownloadBaseName(templateName) || "Custom Template";
}

export function communityDownloadBaseName(map: { title?: string; templateName?: string; slug?: string }): string {
  return normalizeDownloadBaseName(map.title ?? map.templateName ?? map.slug ?? "") || "map";
}

export async function downloadText(name: string, content: string, type: string, options?: DownloadOptions): Promise<DownloadResult> {
  return downloadBlob(name, new Blob([content], { type }), options);
}

export async function downloadBlob(name: string, blob: Blob, options?: DownloadOptions): Promise<DownloadResult> {
  if (options?.preferSavePicker) {
    const pickerResult = await writeBlobWithSavePicker(name, blob);
    if (pickerResult) return pickerResult;
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
  return "downloaded";
}

function normalizeDownloadBaseName(value: string): string {
  return value
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1f]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim();
}

function saveFilePicker(): SaveFilePickerFunction | null {
  if (typeof window === "undefined" || !("showSaveFilePicker" in window)) return null;
  return (window as Window & { showSaveFilePicker?: SaveFilePickerFunction }).showSaveFilePicker ?? null;
}

function pickerTypesForMimeType(type: string): SaveFilePickerOptions["types"] | undefined {
  if (type === "application/json") {
    return [{
      description: "JSON files",
      accept: { "application/json": [".json", ".rmg.json", ".oetd.json"] }
    }];
  }

  if (type === "image/png") {
    return [{
      description: "PNG images",
      accept: { "image/png": [".png"] }
    }];
  }

  return undefined;
}

async function writeBlobWithSavePicker(name: string, blob: Blob): Promise<"saved" | "cancelled" | null> {
  const showSaveFilePicker = saveFilePicker();
  if (!showSaveFilePicker) return null;

  try {
    const handle = await showSaveFilePicker({
      suggestedName: name,
      types: pickerTypesForMimeType(blob.type)
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return "saved";
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return "cancelled";
    }
    return null;
  }
}
