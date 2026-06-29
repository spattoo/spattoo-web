"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { API_BASE } from "./api";

// The baker-side apiClient for the FULL CakeDesigner (baker mode) — which contains
// the designer, dashboard, OrdersPanel + Send quote, and edit-in-3D. Auth is the
// baker's Supabase session; every call carries the Bearer token and the API
// resolves the baker from baker_appusers. The 'owner'/'staff' roles hold
// design:create + order caps, so the global catalog endpoints work.
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

  // The baker's own slug (cached) — needed for the public order-create + flavours.
  let slugCache: string | null = null;
  async function bakerSlug(): Promise<string | null> {
    if (slugCache) return slugCache;
    const p = await authGet("/api/baker/profile").catch(() => null);
    slugCache = (p?.baker ?? p)?.slug ?? null;
    return slugCache;
  }

  return {
    // ── Baker context ─────────────────────────────────────────────────────────
    fetchBakerProfile: () => authGet("/api/baker/profile"),
    fetchBakerSettings: () => authGet("/api/baker/settings"),
    fetchMe: () => authGet("/api/me").catch(() => null),

    // ── Catalog (baker Bearer; design:create) ─────────────────────────────────
    fetchElementTypes: () => authGet("/api/element-types"),
    fetchElements: (opts: { parentsOnly?: boolean; elementTypeId?: string } = {}) => {
      const qs = new URLSearchParams();
      if (opts.parentsOnly) qs.set("parents_only", "true");
      if (opts.elementTypeId) qs.set("element_type_id", opts.elementTypeId);
      const q = qs.toString();
      return authGet(`/api/elements${q ? `?${q}` : ""}`);
    },
    fetchMaterials: () => authGet("/api/materials"),
    fetchTextures: () => authGet("/api/textures"),
    fetchTags: () => authGet("/api/tags"),
    fetchTemplates: () => authGet("/api/templates").catch(() => []),
    fetchTemplate: (id: string) => authGet(`/api/templates/${id}`),

    // ── Uploads + order create/design (baker placing an order; edit-in-3D save) ─
    getSignedUploadUrl: (folder: string, filename: string, contentType: string) =>
      authFetch("/api/storage/sign-upload", {
        method: "POST",
        body: JSON.stringify({ folder, filename, contentType }),
      }),
    placeOrder: async (payload: Record<string, unknown>) =>
      authFetch("/api/orders", {
        method: "POST",
        body: JSON.stringify({ ...payload, bakerSlug: await bakerSlug() }),
      }),
    updateOrderDesign: (id: string, payload: unknown) =>
      authFetch(`/api/orders/${id}/design`, { method: "PATCH", body: JSON.stringify(payload) }),

    // ── Orders + quoting ──────────────────────────────────────────────────────
    fetchOrders: (params: Record<string, string> = {}) => {
      const qs = new URLSearchParams(params).toString();
      return authGet(`/api/orders${qs ? `?${qs}` : ""}`);
    },
    updateOrderStatus: (id: string, status: string, comment?: string) =>
      authFetch(`/api/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status, comment }) }),
    editOrder: (id: string, formData: unknown) =>
      authFetch(`/api/orders/${id}`, { method: "PATCH", body: JSON.stringify(formData) }),
    issueQuote: (id: string, body: { price: number; advanceAmount?: number | null; note?: string; lineItems?: unknown; validUntil?: string }) =>
      authFetch(`/api/orders/${id}/quote`, { method: "POST", body: JSON.stringify(body) }),
    fetchOrderAudit: (id: string) => authGet(`/api/orders/${id}/audit`),

    // ── Reference data ────────────────────────────────────────────────────────
    fetchOrderStatuses: () => publicGet("/api/order-statuses"),
    fetchFlavours: (bakerSlugArg?: string) =>
      bakerSlugArg
        ? publicGet(`/api/flavours?bakerSlug=${encodeURIComponent(bakerSlugArg)}`)
        : bakerSlug().then((s) => (s ? publicGet(`/api/flavours?bakerSlug=${encodeURIComponent(s)}`) : [])),
    fetchCraftGuides: (elementIds: string[]) =>
      authGet(`/api/craft-guide?element_ids=${(elementIds ?? []).join(",")}`).catch(() => []),

    // ── Customers ─────────────────────────────────────────────────────────────
    fetchCustomers: () => authGet("/api/baker/customers"),
    createCustomer: (payload: unknown) =>
      authFetch("/api/baker/customers", { method: "POST", body: JSON.stringify(payload) }),
    updateCustomer: (id: string, payload: unknown) =>
      authFetch(`/api/baker/customers/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
    deactivateCustomer: (id: string) =>
      authFetch(`/api/baker/customers/${id}/deactivate`, { method: "PATCH" }),
    reactivateCustomer: (id: string) =>
      authFetch(`/api/baker/customers/${id}/reactivate`, { method: "PATCH" }),
    inviteCustomer: (payload: unknown) =>
      authFetch("/api/baker/customers/invite", { method: "POST", body: JSON.stringify(payload) }),

    // ── Dashboard ─────────────────────────────────────────────────────────────
    fetchDashboard: () => authGet("/api/baker/dashboard"),
    fetchDashboardBreakdown: (period: string) =>
      authGet(`/api/baker/dashboard/breakdown?period=${encodeURIComponent(period)}`),

    // ── Flavours (baker management: global list + this baker's exclusions) ──────
    fetchBakerFlavours: () => authGet("/api/baker/flavours"),
    updateBakerFlavourExclusions: (excludedFlavourIds: string[]) =>
      authFetch("/api/baker/flavours/exclusions", {
        method: "PUT",
        body: JSON.stringify({ excluded_flavour_ids: excludedFlavourIds }),
      }),

    // ── Profile / Settings / Storefront publish ───────────────────────────────
    updateBakerProfile: (payload: unknown) =>
      authFetch("/api/baker/profile", { method: "PATCH", body: JSON.stringify(payload) }),
    updateBakerSettings: (settings: unknown) =>
      authFetch("/api/baker/settings", { method: "PUT", body: JSON.stringify(settings) }),
    fetchStorefrontThemes: () => authGet("/api/baker/storefront-themes"),
    publishStorefront: () => authFetch("/api/baker/storefront/publish", { method: "POST" }),
    unpublishStorefront: () => authFetch("/api/baker/storefront/unpublish", { method: "POST" }),

    // ── Storefront gallery + testimonials ─────────────────────────────────────
    addStorefrontPhoto: (key: string, caption?: string) =>
      authFetch("/api/baker/storefront-photos", {
        method: "POST",
        body: JSON.stringify({ storage_key: key, caption }),
      }),
    updateStorefrontPhotos: (photos: unknown) =>
      authFetch("/api/baker/storefront-photos", { method: "PUT", body: JSON.stringify({ photos }) }),
    deleteStorefrontPhoto: (id: string) =>
      authFetch(`/api/baker/storefront-photos/${id}`, { method: "DELETE" }),
    updateTestimonials: (testimonials: unknown) =>
      authFetch("/api/baker/testimonials", { method: "PUT", body: JSON.stringify({ testimonials }) }),

    // ── Billing / subscription ────────────────────────────────────────────────
    fetchBillingStatus: () => authGet("/api/billing/status"),
    fetchBillingPeriods: () => authGet("/api/billing/periods"),
    fetchSubscriptionHistory: () => authGet("/api/baker/subscription/history"),
    activateSparkPlan: () => authFetch("/api/billing/activate-spark", { method: "POST" }),
    createSubscription: (tier: string, billingPeriodId: string) =>
      authFetch("/api/billing/subscribe", {
        method: "POST",
        body: JSON.stringify({ tier, billing_period_id: billingPeriodId }),
      }),
    cancelSubscription: () => authFetch("/api/billing/cancel", { method: "POST" }),

    // ── Self-signup (free Spark tier; no payment) ─────────────────────────────
    checkSlug: (slug: string) =>
      publicGet(`/api/bakers/slug-available?slug=${encodeURIComponent(slug)}`),
    createBakerSelf: (payload: unknown) =>
      authFetch("/api/bakers/self", { method: "POST", body: JSON.stringify(payload) }),
    // Onboarding wizard plan step — sets the plan WITHOUT charge (dev/no-payment).
    selectPlan: (plan: string) =>
      authFetch("/api/baker/plan/select", { method: "POST", body: JSON.stringify({ plan }) }),

    // ── Account ───────────────────────────────────────────────────────────────
    signOut: () => supabase.auth.signOut(),
    changePassword: (password: string) => supabase.auth.updateUser({ password }),
  };
}

export type BakerApiClient = ReturnType<typeof makeBakerApiClient>;
