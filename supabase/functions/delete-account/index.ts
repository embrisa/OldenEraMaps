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
    return jsonResponse(request, { error: "Account deletion service is not configured.", code: "service_not_configured" }, 500);
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: request.headers.get("Authorization") ?? "" } }
  });
  const { data: authData, error: authError } = await authClient.auth.getUser();
  if (authError || !authData.user) {
    return jsonResponse(request, { error: "Sign in before deleting your account.", code: "unauthenticated" }, 401);
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey);
  const { error: deleteError } = await serviceClient.auth.admin.deleteUser(authData.user.id);
  if (deleteError) {
    console.error("delete-account failed", deleteError);
    return jsonResponse(request, { error: "Account deletion failed.", code: "delete_failed" }, 500);
  }

  return jsonResponse(request, { ok: true });
});

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
