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
      // Preserve the server's machine code + HTTP status so callers can branch
      // (e.g. BAKER_INACTIVE / ORDER_LIMIT_REACHED) instead of string-matching.
      const err = Object.assign(new Error(e.error ?? `API ${res.status}`), {
        code: e.code as string | undefined,
        status: res.status,
      });
      throw err;
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

    // Which channel THIS order's customer can actually be reached on, so the gate asks for one
    // contact instead of making somebody guess which one we hold. Returns the channel only, never
    // the contact — and answers the baker's configured channels for an unknown order, so it cannot
    // be used to discover whether an order id is real.
    fetchOrderChannel: (orderId: string) =>
      publicGet(`/api/storefront/${encodeURIComponent(slug)}/order-channel/${encodeURIComponent(orderId)}`),

    // ── Catalog (customer Bearer; 'design:create' grants access) ──────────────
    fetchElementTypes: () => authGet(`/api/element-types`),
    // What a decoration IS, for the browsing menu — as opposed to element-types, which is how it
    // behaves. Each carries a `count`, and empty categories are already dropped server-side, so the
    // menu can be drawn before a single element is fetched.
    fetchElementCategories: () => authGet(`/api/element-categories`),
    fetchElements: (opts: { parentsOnly?: boolean; elementTypeId?: string; categoryId?: string } = {}) => {
      const qs = new URLSearchParams();
      if (opts.parentsOnly) qs.set("parents_only", "true");
      if (opts.elementTypeId) qs.set("element_type_id", opts.elementTypeId);
      if (opts.categoryId) qs.set("category_id", opts.categoryId);
      const q = qs.toString();
      return authGet(`/api/elements${q ? `?${q}` : ""}`);
    },
    fetchMaterials: () => authGet(`/api/materials`),
    fetchTextures: () => authGet(`/api/textures`),
    fetchTextStyles: () => authGet(`/api/text-styles`),
    // The cake shapes admin authored. Without this the designer falls back to its seed — round and
    // rectangle only — so a customer would never be offered the baker's heart or hexagon.
    fetchCakeShapes: () => authGet(`/api/cake-shapes`),
    fetchTags: () => authGet(`/api/tags`),
    fetchTemplates: () => authGet(`/api/templates`).catch(() => []),
    fetchTemplate: (id: string) => authGet(`/api/templates/${id}`),

    // The principal's real role + capabilities (resolveCustomer → 'customer' with
    // design:create/order:place). Drives the designer's hasCap gating so the baker
    // chrome (Dashboard/Orders/Customers/Invite/Save-as-Template) stays hidden.
    fetchMe: () => authGet("/api/me").catch(() => null),

    // ── Public reads ──────────────────────────────────────────────────────────
    fetchFlavours: (bakerSlug: string) =>
      publicGet(`/api/flavours?bakerSlug=${encodeURIComponent(bakerSlug)}`),
    fetchOrderStatuses: () => publicGet(`/api/order-statuses`),
    // Eggless / vegan / Jain / allergens. Reference data, not a tenant's data, so it
    // is public — the order form needs it before anyone authenticates. With a slug each
    // row also carries `offered`: whether this bakery deals in it at all. The full list
    // comes back either way, because a diet option that isn't offered is hidden while an
    // allergen never is — that rule lives on the surface, not here.
    fetchDietaryRequirements: (bakerSlugArg?: string) =>
      bakerSlugArg
        ? publicGet(`/api/dietary-requirements?bakerSlug=${encodeURIComponent(bakerSlugArg)}`)
        : publicGet(`/api/dietary-requirements`),

    // ── Authenticated as the customer ─────────────────────────────────────────
    // contentLength is REQUIRED and is signed INTO the URL: the body goes browser → R2 and never
    // passes through the API, so a size limit checked in the client is advice, not a limit. R2 rejects
    // a PUT whose body length differs from the one signed. Callers pass the blob's own .size.
    // The upload size ceiling, as the API currently has it. Read, never copied: the limit is env-tuned
    // on the API, and a hardcoded client would go on accepting files the API then 413s.
    fetchUploadLimits: () => authFetch("/api/storage/limits"),
    getSignedUploadUrl: (folder: string, filename: string, contentType: string, contentLength: number) =>
      authFetch("/api/storage/sign-upload", {
        method: "POST",
        body: JSON.stringify({ folder, filename, contentType, contentLength }),
      }),
    // "Request quote": server resolves the customer from the token; the payload
    // carries NO customer identity (only bakerSlug + design/delivery).
    requestQuote: (payload: unknown) =>
      authFetch("/api/customer/orders", {
        method: "POST",
        body: JSON.stringify(payload),
      }),

    // ── The customer's own quotes/orders (the "your quotes" view) ─────────────
    fetchMyOrders: () =>
      authFetch(`/api/customer/orders?bakerSlug=${encodeURIComponent(slug)}`),
    fetchMyOrder: (id: string) => authFetch(`/api/customer/orders/${id}`),

    // What this bakery already holds for the signed-in customer, so the quote form only asks for an
    // email when there is none. Booleans, never the contacts themselves — the form's question is
    // "do I render a field", and a stolen token should not read back an address to answer it.
    fetchCustomerProfile: (bakerSlug: string) =>
      authFetch(`/api/customer/profile?bakerSlug=${encodeURIComponent(bakerSlug)}`),
    acceptQuote: (id: string) =>
      authFetch(`/api/customer/orders/${id}/accept`, { method: "POST" }),
    declineQuote: (id: string) =>
      authFetch(`/api/customer/orders/${id}/decline`, { method: "POST" }),
    // "Talk to {baker}" — record a question on the quote + notify the baker.
    sendOrderMessage: (id: string, message: string) =>
      authFetch(`/api/customer/orders/${id}/message`, {
        method: "POST",
        body: JSON.stringify({ message }),
      }),

    // ── Live co-design sessions (the customer joins the baker's live session) ──
    createDesignSession: (body: unknown) =>
      authFetch("/api/design-sessions", { method: "POST", body: JSON.stringify(body) }),
    getDesignSession: (id: string) => authGet(`/api/design-sessions/${id}`),
    putDesignSessionDesign: (id: string, design: unknown) =>
      authFetch(`/api/design-sessions/${id}/design`, { method: "PUT", body: JSON.stringify({ design }) }),
    penDesignSession: (id: string, body: unknown) =>
      authFetch(`/api/design-sessions/${id}/pen`, { method: "POST", body: JSON.stringify(body) }),
    endDesignSession: (id: string) =>
      authFetch(`/api/design-sessions/${id}/end`, { method: "POST" }),
  };
}

export type CustomerApiClient = ReturnType<typeof makeCustomerApiClient>;
