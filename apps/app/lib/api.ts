"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

// The customer-side apiClient passed into <CakeDesigner orderMode="customer">.
// Differences from the baker/admin client:
//  - auth is the CUSTOMER's Supabase session (set via the invite OTP). The RBAC
//    'customer' role is granted 'design:create' + 'order:place', so the global
//    catalog endpoints (elements/types/materials/textures/tags/templates) work
//    with the customer's Bearer token — no special routes needed.
//  - baker identity comes from the storefront SLUG (public by-slug endpoints), not
//    from the logged-in user (a customer isn't a baker_appuser).
//  - ordering goes through the authenticated customer route; the server derives the
//    customer FROM THE TOKEN, so the payload never carries a customer identity.
export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export function makeCustomerApiClient(supabase: SupabaseClient, slug: string) {
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

  async function publicGet(path: string) {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) throw new Error(`API ${res.status}`);
    return res.json();
  }

  return {
    // ── Baker context (by slug — the customer is not the baker) ───────────────
    // CakeDesigner expects { baker } and sets it as bakerData (needs slug + colors).
    fetchBakerProfile: () =>
      publicGet(`/api/storefront/${encodeURIComponent(slug)}`).then((baker) => ({ baker })),
    fetchBakerSettings: () =>
      publicGet(`/api/storefront/${encodeURIComponent(slug)}/settings`),

    // ── Catalog (customer Bearer; 'design:create' grants access) ──────────────
    fetchElementTypes: () => authGet(`/api/element-types`),
    fetchElements: (opts: { parentsOnly?: boolean; elementTypeId?: string } = {}) => {
      const qs = new URLSearchParams();
      if (opts.parentsOnly) qs.set("parents_only", "true");
      if (opts.elementTypeId) qs.set("element_type_id", opts.elementTypeId);
      const q = qs.toString();
      return authGet(`/api/elements${q ? `?${q}` : ""}`);
    },
    fetchMaterials: () => authGet(`/api/materials`),
    fetchTextures: () => authGet(`/api/textures`),
    fetchTags: () => authGet(`/api/tags`),
    fetchTemplates: () => authGet(`/api/templates`).catch(() => []),
    fetchTemplate: (id: string) => authGet(`/api/templates/${id}`),

    // Customer has no baker "me" profile — the designer tolerates null.
    fetchMe: () => Promise.resolve(null),

    // ── Public reads ──────────────────────────────────────────────────────────
    fetchFlavours: (bakerSlug: string) =>
      publicGet(`/api/flavours?bakerSlug=${encodeURIComponent(bakerSlug)}`),
    fetchOrderStatuses: () => publicGet(`/api/order-statuses`),

    // ── Authenticated as the customer ─────────────────────────────────────────
    getSignedUploadUrl: (folder: string, filename: string, contentType: string) =>
      authFetch("/api/storage/sign-upload", {
        method: "POST",
        body: JSON.stringify({ folder, filename, contentType }),
      }),
    // "Request quote": server resolves the customer from the token; the payload
    // carries NO customer identity (only bakerSlug + design/delivery).
    requestQuote: (payload: unknown) =>
      authFetch("/api/customer/orders", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  };
}

export type CustomerApiClient = ReturnType<typeof makeCustomerApiClient>;
