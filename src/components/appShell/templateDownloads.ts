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

type SaveFilePickerFunction = (options: SaveFilePickerOptions) => Promise<SaveFilePickerHandle>;

export function builderExportBaseName(templateName: string): string {
  return normalizeDownloadBaseName(templateName) || "Custom Template";
}

export function communityDownloadBaseName(map: { title?: string; templateName?: string; slug?: string }): string {
  return normalizeDownloadBaseName(map.title ?? map.templateName ?? map.slug ?? "") || "map";
}

export async function downloadText(name: string, content: string, type: string, options?: DownloadOptions): Promise<void> {
  await downloadBlob(name, new Blob([content], { type }), options);
}

export async function downloadBlob(name: string, blob: Blob, options?: DownloadOptions): Promise<void> {
  if (options?.preferSavePicker && await writeBlobWithSavePicker(name, blob)) {
    return;
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
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

async function writeBlobWithSavePicker(name: string, blob: Blob): Promise<boolean> {
  const showSaveFilePicker = saveFilePicker();
  if (!showSaveFilePicker) return false;

  try {
    const handle = await showSaveFilePicker({
      suggestedName: name,
      types: pickerTypesForMimeType(blob.type)
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return true;
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return true;
    }
    return false;
  }
}
