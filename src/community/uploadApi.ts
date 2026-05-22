import type { SupabaseClient } from "@supabase/supabase-js";
import { designToTemplate, serializeDesignFile, type TemplateDesign } from "@/design";
import { serializeTemplate } from "@/generator";
import { mapDatabaseRecordToCommunityMapRecord, type CommunityMapDatabaseRecord } from "@/community/databaseMappers";
import { buildPreviewDesign, PREVIEW_RENDERER_VERSION } from "@/community/previewDesign";
import { requireSupabaseClient, supabase } from "@/community/supabaseClient";
import type { Database } from "@/community/databaseTypes";
import type { CommunityMapRecord, CommunityUploadDraft } from "@/community/maps";
import type { UploadMapRequest } from "@/community/uploadCore";

export interface ServerUploadCommunityMapResult {
  map: CommunityMapRecord;
  warnings: string[];
}

export class ServerUploadError extends Error {
  constructor(
    message: string,
    public readonly code = "upload_failed",
    public readonly details: string[] = [message]
  ) {
    super(message);
    this.name = "ServerUploadError";
  }
}

export interface UploadCommunityMapToServerOptions {
  previewSource?: unknown;
}

export async function uploadCommunityMapToServer(
  design: TemplateDesign,
  draft: CommunityUploadDraft,
  client: SupabaseClient<Database> | null = supabase,
  _options: UploadCommunityMapToServerOptions = {}
): Promise<ServerUploadCommunityMapResult> {
  const api = requireSupabaseClient(client);
  const template = designToTemplate(design);

  const request: UploadMapRequest = {
    title: draft.title,
    description: typeof template.description === "string" ? template.description : draft.summary,
    visibility: draft.visibility,
    descriptiveTagSlugs: draft.descriptiveTagSlugs,
    templateJson: JSON.parse(serializeTemplate(template)),
    designJson: JSON.parse(serializeDesignFile(design)),
    previewDesignJson: buildPreviewDesign(design)
  };

  const { data, error } = await api.functions.invoke<{
    map: CommunityMapDatabaseRecord;
    warnings?: string[];
    error?: string;
    code?: string;
    details?: string[];
  }>("upload-map", {
    body: {
      ...request,
      previewRendererVersion: PREVIEW_RENDERER_VERSION,
    }
  });

  if (error) {
    const details = await readFunctionError(error);
    throw new ServerUploadError(details.message, details.code, details.details);
  }
  if (!data?.map) {
    throw new ServerUploadError(data?.error ?? "Upload failed before the map was saved.", data?.code, data?.details);
  }

  return {
    map: mapDatabaseRecordToCommunityMapRecord(data.map),
    warnings: data.warnings ?? []
  };
}

async function readFunctionError(error: unknown): Promise<{ message: string; code: string; details: string[] }> {
  const fallbackMessage = error instanceof Error ? error.message : "Upload failed before the map was saved.";
  const context = typeof error === "object" && error && "context" in error ? (error as { context?: unknown }).context : undefined;
  if (context instanceof Response) {
    try {
      const body = await context.clone().json() as { error?: string; code?: string; details?: string[] };
      return {
        message: body.error ?? fallbackMessage,
        code: body.code ?? "edge_function_error",
        details: body.details ?? [body.error ?? fallbackMessage]
      };
    } catch {
      return { message: fallbackMessage, code: "edge_function_error", details: [fallbackMessage] };
    }
  }
  return { message: fallbackMessage, code: "edge_function_error", details: [fallbackMessage] };
}
