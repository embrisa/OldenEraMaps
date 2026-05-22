import { createClient } from "npm:@supabase/supabase-js@2";
import { createTagFromSlug, type CommunityTag } from "../../../src/community/tags.ts";
import { buildEdgeFunctionCorsHeaders } from "../../../src/community/edgeFunctionCors.ts";
import { UploadValidationError, prepareCommunityUploadCore, type UploadMapRequest } from "../../../src/community/uploadCore.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request),
    });
  }

  if (request.method !== "POST") {
    return jsonResponse(request, { error: "Method not allowed", code: "method_not_allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse(request, { error: "Upload service is not configured.", code: "service_not_configured" }, 500);
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: request.headers.get("Authorization") ?? "" } }
  });
  const { data: authData, error: authError } = await authClient.auth.getUser();
  if (authError || !authData.user) {
    return jsonResponse(request, { error: "Sign in before publishing a map template.", code: "unauthenticated" }, 401);
  }

  let body: UploadMapRequest;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, { error: "Upload request JSON is malformed.", code: "malformed_json" }, 400);
  }

  try {
    const prepared = await prepareCommunityUploadCore(body);
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: duplicate, error: duplicateError } = await serviceClient
      .from("maps")
      .select("id, slug, title")
      .eq("owner_id", authData.user.id)
      .eq("template_sha256", prepared.templateSha256)
      .maybeSingle();
    if (duplicateError) throw duplicateError;
    if (duplicate) {
      return jsonResponse(request, {
        error: "You have already uploaded this exact template.",
        code: "duplicate_template",
        existingMap: duplicate
      }, 409);
    }

    const { data: map, error: insertError } = await serviceClient
      .from("maps")
      .insert({
        owner_id: authData.user.id,
        slug: `${prepared.slug}-${crypto.randomUUID().slice(0, 8)}`,
        title: prepared.title,
        description: prepared.description,
        visibility: prepared.visibility,
        status: "published",
        map_width: prepared.metadata.mapWidth,
        map_height: prepared.metadata.mapHeight,
        player_count: prepared.metadata.playerCount,
        zone_count: prepared.metadata.zoneCount,
        connection_count: prepared.metadata.connectionCount,
        win_condition: prepared.metadata.winCondition,
        terrain_theme: prepared.metadata.terrainTheme,
        template_name: prepared.metadata.templateName,
        template_json: prepared.templateJson,
        design_json: prepared.designJson,
        preview_design_json: prepared.previewDesignJson,
        preview_renderer_version: prepared.previewRendererVersion,
        template_sha256: prepared.templateSha256,
        upload_warnings: prepared.warnings,
        factual_metadata: prepared.metadata
      })
      .select("*, profiles(display_name), map_tags(tags(slug, label, kind, category))")
      .single();
    if (insertError) throw insertError;

    await upsertTags(serviceClient, map.id, prepared.factualTagSlugs.map((slug) => createTagFromSlug(slug, "factual")), "factual");
    await upsertTags(serviceClient, map.id, prepared.descriptiveTagSlugs.map((slug) => createTagFromSlug(slug, "descriptive")), "descriptive");

    const { data: hydrated, error: hydrateError } = await serviceClient
      .from("maps")
      .select("*, profiles(display_name), map_tags(tags(slug, label, kind, category))")
      .eq("id", map.id)
      .single();
    if (hydrateError) throw hydrateError;

    return jsonResponse(request, { map: hydrated, warnings: prepared.warnings });
  } catch (error) {
    if (error instanceof UploadValidationError) {
      return jsonResponse(request, { error: error.message, code: error.code, details: error.details }, uploadErrorStatus(error.code));
    }
    console.error("upload-map failed", error);
    return jsonResponse(request, { error: "Upload failed.", code: "upload_failed" }, 500);
  }
});

async function upsertTags(client: ReturnType<typeof createClient>, mapId: string, tags: CommunityTag[], source: "factual" | "descriptive") {
  for (const currentTag of tags) {
    const slug = currentTag.slug;
    const { data: existing, error: selectError } = await client
      .from("tags")
      .select("id, kind")
      .eq("slug", slug)
      .maybeSingle();
    if (selectError) throw selectError;
    if (existing && existing.kind !== source) continue;

    const { data: tag, error } = existing ? { data: existing, error: null } : await client
      .from("tags")
      .upsert({
        slug,
        label: currentTag.label,
        kind: source,
        category: currentTag.category,
        constraints: source === "descriptive" ? currentTag.constraints ?? {} : {}
      }, { onConflict: "slug" })
      .select("id")
      .single();
    if (error) throw error;

    const { error: mapTagError } = await client
      .from("map_tags")
      .upsert({ map_id: mapId, tag_id: tag.id, source }, { onConflict: "map_id,tag_id" });
    if (mapTagError) throw mapTagError;
  }
}

function uploadErrorStatus(code: string): number {
  if (code === "unauthenticated") return 401;
  if (code === "duplicate_template") return 409;
  return 400;
}

function jsonResponse(request: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      ...corsHeaders(request),
    }
  });
}

function corsHeaders(request: Request): Record<string, string> {
  return buildEdgeFunctionCorsHeaders(
    request.headers.get("origin"),
    request.headers.get("access-control-request-headers")
  );
}
