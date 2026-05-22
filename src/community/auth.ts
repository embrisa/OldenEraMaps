import type { AuthChangeEvent, Provider, Session, SupabaseClient, User } from "@supabase/supabase-js";
import { requireSupabaseClient, supabase } from "@/community/supabaseClient";
import type { Database } from "@/community/databaseTypes";

export const OAUTH_PROVIDERS = ["google", "github", "discord"] as const;

export type CommunityAuthProvider = (typeof OAUTH_PROVIDERS)[number];

export interface CommunityAuthProfile {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  email: string | null;
}

export interface CommunityAuthState {
  status: "loading" | "signed-out" | "signed-in";
  session: Session | null;
  profile: CommunityAuthProfile | null;
  error: string | null;
}

export type CommunityAuthAction =
  | { type: "loading" }
  | { type: "session"; session: Session | null }
  | { type: "error"; error: string }
  | { type: "clear-error" };

export function communityAuthReducer(state: CommunityAuthState, action: CommunityAuthAction): CommunityAuthState {
  if (action.type === "loading") {
    return { ...state, status: "loading", error: null };
  }
  if (action.type === "session") {
    return {
      status: action.session ? "signed-in" : "signed-out",
      session: action.session,
      profile: action.session ? profileFromUser(action.session.user) : null,
      error: null
    };
  }
  if (action.type === "error") {
    return { ...state, status: state.session ? "signed-in" : "signed-out", error: action.error };
  }
  return { ...state, error: null };
}

export function initialCommunityAuthState(): CommunityAuthState {
  return {
    status: "loading",
    session: null,
    profile: null,
    error: null
  };
}

export async function getSession(client: SupabaseClient<Database> | null = supabase): Promise<Session | null> {
  if (!client) return null;
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return data.session;
}

export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void,
  client: SupabaseClient<Database> | null = supabase
): () => void {
  if (!client) return () => {};
  const { data } = client.auth.onAuthStateChange(callback);
  return () => data.subscription.unsubscribe();
}

export async function signInWithProvider(provider: CommunityAuthProvider, client: SupabaseClient<Database> | null = supabase): Promise<void> {
  const authClient = requireSupabaseClient(client);
  const { error } = await authClient.auth.signInWithOAuth({
    provider: provider as Provider,
    options: {
      redirectTo: window.location.origin
    }
  });
  if (error) throw error;
}

export async function signOut(client: SupabaseClient<Database> | null = supabase): Promise<void> {
  if (!client) return;
  const { error } = await client.auth.signOut();
  if (error) throw error;
}

export async function deleteCurrentAccount(client: SupabaseClient<Database> | null = supabase): Promise<void> {
  if (!client) return;

  const { data, error } = await client.functions.invoke<{ error?: string; code?: string; details?: string[] }>("delete-account", {
    body: {}
  });

  if (error) {
    const details = await readFunctionError(error, "Failed to delete account.");
    throw new Error(details.message);
  }
  if (data?.error) throw new Error(data.error);

  await client.auth.signOut().catch(() => {});
}

export async function syncCurrentUserProfile(session: Session, client: SupabaseClient<Database> | null = supabase): Promise<void> {
  if (!client) return;
  const profile = profileFromUser(session.user);
  const { error } = await client
    .from("profiles")
    .upsert([{
      id: profile.userId,
      display_name: profile.displayName,
      avatar_url: null
    }], { ignoreDuplicates: true, onConflict: "id" });
  if (error) throw error;
}

export function profileFromUser(user: User): CommunityAuthProfile {
  const metadata = user.user_metadata;
  const displayName = readMetadataString(metadata, "full_name")
    ?? readMetadataString(metadata, "name")
    ?? readMetadataString(metadata, "user_name")
    ?? "Cartographer";

  return {
    userId: user.id,
    displayName,
    avatarUrl: readMetadataString(metadata, "avatar_url") ?? readMetadataString(metadata, "picture"),
    email: user.email ?? null
  };
}

function readMetadataString(metadata: User["user_metadata"], key: string): string | null {
  const value = metadata[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

async function readFunctionError(error: unknown, fallback: string): Promise<{ message: string; code: string; details: string[] }> {
  const fallbackMessage = error instanceof Error ? error.message : fallback;
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
