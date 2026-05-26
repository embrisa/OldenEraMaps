import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildEdgeFunctionCorsHeaders,
} from "../../../src/community/edgeFunctionCors.ts";

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
    return jsonResponse(request, { error: "Delete service is not configured.", code: "service_not_configured" }, 500);
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: request.headers.get("Authorization") ?? "" } }
  });
  const { data: authData, error: authError } = await authClient.auth.getUser();
  if (authError || !authData.user) {
    return jsonResponse(request, { error: "Sign in before deleting a map listing.", code: "unauthenticated" }, 401);
  }

  let body: DeleteMapRequest;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, { error: "Delete request JSON is malformed.", code: "malformed_json" }, 400);
  }

  if (typeof body.mapId !== "string" || body.mapId.trim().length === 0) {
    return jsonResponse(request, { error: "Map id is required.", code: "missing_map_id" }, 400);
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: map, error: mapError } = await serviceClient
    .from("maps")
    .select("id, owner_id")
    .eq("id", body.mapId)
    .maybeSingle();

  if (mapError) {
    console.error("delete-map lookup failed", mapError);
    return jsonResponse(request, { error: "Map lookup failed.", code: "lookup_failed" }, 500);
  }
  if (!map) return jsonResponse(request, { error: "Map not found.", code: "not_found" }, 404);
  if (map.owner_id !== authData.user.id) {
    return jsonResponse(request, { error: "You can only delete your own map listings.", code: "forbidden" }, 403);
  }

  const { error: deleteError } = await serviceClient
    .from("maps")
    .delete()
    .eq("id", body.mapId);
  if (deleteError) {
    console.error("delete-map delete failed", deleteError);
    return jsonResponse(request, { error: "Map deletion failed.", code: "delete_failed" }, 500);
  }

  return jsonResponse(request, { ok: true });
});

interface DeleteMapRequest {
  mapId?: string;
}

function corsHeaders(request: Request): HeadersInit {
  return buildEdgeFunctionCorsHeaders(
    request.headers.get("Origin"),
    request.headers.get("Access-Control-Request-Headers")
  );
}

function jsonResponse(request: Request, body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request),
      "Content-Type": "application/json"
    }
  });
}
