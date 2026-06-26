"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

// The customer-side apiClient passed into <CakeDesigner>. The key difference from
// the baker/admin client: auth is the CUSTOMER's Supabase session (set via the
// invite OTP), and ordering goes through the authenticated customer route, where
// the server derives the customer FROM THE TOKEN — the client never sends a
// customer identity.
export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export function makeCustomerApiClient(supabase: SupabaseClient) {
  async function authFetch(path: string, opts: RequestInit = {}) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((opts.headers as Record<string, string>) ?? {}),
    };
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
    const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e.error ?? `API ${res.status}`);
    }
    return res.json();
  }

  async function publicGet(path: string) {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) throw new Error(`API ${res.status}`);
    return res.json();
  }

  return {
    // Public reads
    fetchFlavours: (bakerSlug: string) =>
      publicGet(`/api/flavours?bakerSlug=${encodeURIComponent(bakerSlug)}`),
    fetchOrderStatuses: () => publicGet(`/api/order-statuses`),

    // Authenticated as the customer
    getSignedUploadUrl: (folder: string, filename: string, contentType: string) =>
      authFetch("/api/storage/sign-upload", {
        method: "POST",
        body: JSON.stringify({ folder, filename, contentType }),
      }),
    // "Request quote": the server resolves the customer from the session token;
    // the payload carries NO customer identity (only bakerSlug + design/delivery).
    requestQuote: (payload: unknown) =>
      authFetch("/api/customer/orders", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  };
}

export type CustomerApiClient = ReturnType<typeof makeCustomerApiClient>;
