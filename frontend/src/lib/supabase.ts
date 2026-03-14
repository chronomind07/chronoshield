/**
 * Single shared Supabase client for the entire app.
 * Import this everywhere — never call createClient() again directly,
 * or you'll get multiple GoTrueClient instances and broken session sharing.
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL     || "https://placeholder.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
