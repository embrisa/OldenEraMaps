import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./databaseTypes";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const canCreateBrowserSupabaseClient = typeof WebSocket !== "undefined";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient<Database> | null = isSupabaseConfigured
  ? (canCreateBrowserSupabaseClient ? createClient<Database>(supabaseUrl!, supabaseAnonKey!) : null)
  : null;

export function requireSupabaseClient(client: SupabaseClient<Database> | null = supabase): SupabaseClient<Database> {
  if (!client) {
    throw new Error("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  }

  return client;
}
