"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Browser Supabase client for the customer storefront. The session (set after the
// invite OTP verify) persists in localStorage, scoped to the current origin —
// which is why the whole customer journey must stay on one origin (the baker's
// subdomain). See PRICING_AND_QUOTE_PLAN / the storefront routing notes.
let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (set them in apps/app/.env.local)."
    );
  }
  client = createClient(url, anon, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return client;
}
