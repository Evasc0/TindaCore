import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl =
  (typeof import.meta !== "undefined" && import.meta.env.VITE_SUPABASE_URL) ||
  (typeof process !== "undefined" && process.env.SUPABASE_URL) ||
  "";
const supabaseAnonKey =
  (typeof import.meta !== "undefined" && import.meta.env.VITE_SUPABASE_ANON_KEY) ||
  (typeof process !== "undefined" && process.env.SUPABASE_ANON_KEY) ||
  "";

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, { auth: { autoRefreshToken: false, persistSession: false } })
    : null;

export const isSupabaseConfigured = !!supabase;
