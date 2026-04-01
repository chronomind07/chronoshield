/**
 * Single shared Supabase client for the entire app.
 * Import this everywhere — never call createClient() again directly,
 * or you'll get multiple GoTrueClient instances and broken session sharing.
 *
 * Uses createBrowserClient from @supabase/ssr so the session is stored in
 * cookies (not localStorage). This makes it readable by the SSR middleware
 * that protects /admin/* routes, while remaining fully compatible with all
 * browser-side usage (auth, data queries, etc.).
 */
import { createBrowserClient } from "@supabase/ssr";

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL      || "https://placeholder.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

export const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
