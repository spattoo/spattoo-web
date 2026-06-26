"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { API_BASE } from "./api";

// The baker-side apiClient for OrdersPanel (order management + Send quote). Auth is
// the baker's Supabase session (signInWithPassword); every call carries the Bearer
// token and the API resolves the baker from baker_appusers.
export function makeBakerApiClient(supabase: SupabaseClient) {
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
  const authGet = (path: string) => authFetch(path);
  const publicGet = (path: string) =>
    fetch(`${API_BASE}${path}`).then((r) => {
      if (!r.ok) throw new Error(`API ${r.status}`);
      return r.json();
    });

  return {
    // Baker context (for slug + brand colour)
    fetchBakerProfile: () => authGet("/api/baker/profile"),

    // Orders
    fetchOrders: (params: Record<string, string> = {}) => {
      const qs = new URLSearchParams(params).toString();
      return authGet(`/api/orders${qs ? `?${qs}` : ""}`);
    },
    updateOrderStatus: (id: string, status: string, comment?: string) =>
      authFetch(`/api/orders/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status, comment }),
      }),
    editOrder: (id: string, formData: unknown) =>
      authFetch(`/api/orders/${id}`, { method: "PATCH", body: JSON.stringify(formData) }),
    issueQuote: (id: string, body: { price: number; lineItems?: unknown; validUntil?: string }) =>
      authFetch(`/api/orders/${id}/quote`, { method: "POST", body: JSON.stringify(body) }),
    fetchOrderAudit: (id: string) => authGet(`/api/orders/${id}/audit`),

    // Reference data
    fetchOrderStatuses: () => publicGet("/api/order-statuses"),
    fetchFlavours: (bakerSlug: string) =>
      publicGet(`/api/flavours?bakerSlug=${encodeURIComponent(bakerSlug)}`),
    fetchCustomers: () => authGet("/api/baker/customers"),
    fetchCraftGuides: (elementIds: string[]) =>
      authGet(`/api/craft-guide?element_ids=${(elementIds ?? []).join(",")}`).catch(() => []),
  };
}

export type BakerApiClient = ReturnType<typeof makeBakerApiClient>;
